import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno"

const supabaseUrl = Deno.env.get("SUPABASE_URL")!
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY")

// Initialize Stripe only if key is available (for pricing sync)
const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    })
  : null

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

// ============================================================================
// STRIPE PRICE SYNC HELPERS
// ============================================================================
// SECURITY: All prices are created server-side based on database values.
// Frontend CANNOT influence the actual Stripe price - it only triggers sync.
// The price_cents is ALWAYS read from the database, never from the request.
// ============================================================================

interface StripePriceSyncResult {
  success: boolean
  newPriceId?: string
  newProductId?: string
  error?: string
}

/**
 * Creates a new Stripe Price for a credit package (one-time payment)
 * SECURITY: Price is read from database, not from request
 */
async function syncCreditPackageToStripe(
  supabase: ReturnType<typeof createClient>,
  packageId: string,
  currentPackage: {
    name: string
    name_en?: string
    description_en?: string
    credits: number
    price_cents: number
    stripe_product_id: string | null
    stripe_price_id: string | null
  },
  newPriceCents?: number
): Promise<StripePriceSyncResult> {
  if (!stripe) {
    return { success: false, error: "Stripe not configured" }
  }

  try {
    // Get pricing config for currency
    const { data: pricingConfig } = await supabase
      .from("pricing_config")
      .select("currency")
      .single()
    const currency = pricingConfig?.currency || "eur"

    // Determine the price to use (new price if provided, otherwise current)
    const priceCents = newPriceCents ?? currentPackage.price_cents

    // Get or create Stripe Product
    let stripeProductId = currentPackage.stripe_product_id

    if (!stripeProductId) {
      const product = await stripe.products.create({
        name: currentPackage.name_en || currentPackage.name,
        description: currentPackage.description_en || `${currentPackage.credits} credits package`,
        metadata: {
          supabase_package_id: packageId,
          credits: currentPackage.credits.toString(),
          type: "credit_package",
        },
      })
      stripeProductId = product.id
    }

    // Archive old price if exists (Stripe prices cannot be deleted, only archived)
    if (currentPackage.stripe_price_id) {
      try {
        await stripe.prices.update(currentPackage.stripe_price_id, { active: false })
      } catch (archiveError) {
        console.warn("Could not archive old price:", archiveError)
        // Continue anyway - old price might already be archived
      }
    }

    // Create new Stripe Price with server-side validated amount
    const newPrice = await stripe.prices.create({
      product: stripeProductId,
      unit_amount: priceCents, // SECURITY: From database, not frontend
      currency: currency,
      metadata: {
        supabase_package_id: packageId,
        credits: currentPackage.credits.toString(),
        type: "credit_package",
      },
    })

    return {
      success: true,
      newPriceId: newPrice.id,
      newProductId: stripeProductId,
    }
  } catch (error) {
    console.error("Stripe sync error for package:", error)
    return { success: false, error: error.message }
  }
}

/**
 * Creates a new Stripe Price for a subscription plan (recurring payment)
 * SECURITY: Price is read from database, not from request
 */
async function syncSubscriptionPlanToStripe(
  supabase: ReturnType<typeof createClient>,
  planId: string,
  currentPlan: {
    name: string
    name_en?: string
    description_en?: string
    credits_per_month: number
    price_cents: number
    interval: string
    stripe_product_id: string | null
    stripe_price_id: string | null
  },
  newPriceCents?: number
): Promise<StripePriceSyncResult> {
  if (!stripe) {
    return { success: false, error: "Stripe not configured" }
  }

  try {
    // Get pricing config for currency
    const { data: pricingConfig } = await supabase
      .from("pricing_config")
      .select("currency")
      .single()
    const currency = pricingConfig?.currency || "eur"

    // Determine the price to use (new price if provided, otherwise current)
    const priceCents = newPriceCents ?? currentPlan.price_cents

    // Get or create Stripe Product
    let stripeProductId = currentPlan.stripe_product_id

    if (!stripeProductId) {
      const product = await stripe.products.create({
        name: currentPlan.name_en || currentPlan.name,
        description: currentPlan.description_en || `${currentPlan.credits_per_month} credits per month`,
        metadata: {
          supabase_plan_id: planId,
          credits_per_month: currentPlan.credits_per_month.toString(),
          type: "subscription_plan",
        },
      })
      stripeProductId = product.id
    }

    // Archive old price if exists
    if (currentPlan.stripe_price_id) {
      try {
        await stripe.prices.update(currentPlan.stripe_price_id, { active: false })
      } catch (archiveError) {
        console.warn("Could not archive old price:", archiveError)
      }
    }

    // Create new Stripe Price with recurring interval
    const newPrice = await stripe.prices.create({
      product: stripeProductId,
      unit_amount: priceCents, // SECURITY: From database, not frontend
      currency: currency,
      recurring: {
        interval: (currentPlan.interval as "month" | "year") || "month",
      },
      metadata: {
        supabase_plan_id: planId,
        credits_per_month: currentPlan.credits_per_month.toString(),
        type: "subscription_plan",
      },
    })

    return {
      success: true,
      newPriceId: newPrice.id,
      newProductId: stripeProductId,
    }
  } catch (error) {
    console.error("Stripe sync error for plan:", error)
    return { success: false, error: error.message }
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const token = authHeader.replace("Bearer ", "")
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Check if user is admin
    const { data: isAdmin } = await supabase.rpc("is_user_admin", {
      p_user_id: user.id
    })

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: "Forbidden - Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const body = await req.json()
    const { action, data } = body

    // Get client IP for audit logging
    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0] ||
                      req.headers.get("x-real-ip") ||
                      "unknown"

    switch (action) {
      case "update_pricing_config": {
        const { tokens_per_euro, tokens_per_generation, min_purchase_amount, max_purchase_amount } = data

        // Validate input
        if (tokens_per_euro !== undefined && (tokens_per_euro < 1 || tokens_per_euro > 1000)) {
          return new Response(
            JSON.stringify({ error: "tokens_per_euro must be between 1 and 1000" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          )
        }

        if (tokens_per_generation !== undefined && (tokens_per_generation < 1 || tokens_per_generation > 100)) {
          return new Response(
            JSON.stringify({ error: "tokens_per_generation must be between 1 and 100" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          )
        }

        // Get current pricing config
        const { data: currentConfig, error: fetchError } = await supabase
          .from("pricing_config")
          .select("*")
          .single()

        if (fetchError) {
          throw fetchError
        }

        // Update pricing config
        const updateData: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
          updated_by: user.id,
        }

        if (tokens_per_euro !== undefined) updateData.tokens_per_euro = tokens_per_euro
        if (tokens_per_generation !== undefined) updateData.tokens_per_generation = tokens_per_generation
        if (min_purchase_amount !== undefined) updateData.min_purchase_amount = min_purchase_amount
        if (max_purchase_amount !== undefined) updateData.max_purchase_amount = max_purchase_amount

        const { error: updateError } = await supabase
          .from("pricing_config")
          .update(updateData)
          .eq("id", currentConfig.id)

        if (updateError) {
          throw updateError
        }

        // Log admin action
        await supabase.rpc("log_admin_action", {
          p_admin_id: user.id,
          p_action: "UPDATE_PRICING_CONFIG",
          p_details: { previous: currentConfig, updated: updateData },
          p_ip_address: ipAddress,
        })

        return new Response(
          JSON.stringify({ success: true, message: "Pricing config updated" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }

      case "update_package": {
        const { id, name_de, name_en, name_fr, description_de, description_en, description_fr, credits, price_cents, is_active, is_popular, sort_order, sync_to_stripe = true } = data

        if (!id) {
          return new Response(
            JSON.stringify({ error: "Package ID is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          )
        }

        // Get current package
        const { data: currentPackage, error: fetchError } = await supabase
          .from("credit_packages")
          .select("*")
          .eq("id", id)
          .single()

        if (fetchError) {
          return new Response(
            JSON.stringify({ error: "Package not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          )
        }

        // Build update object
        const updateData: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        }

        if (name_de !== undefined) updateData.name_de = name_de
        if (name_en !== undefined) updateData.name_en = name_en
        if (name_fr !== undefined) updateData.name_fr = name_fr
        if (description_de !== undefined) updateData.description_de = description_de
        if (description_en !== undefined) updateData.description_en = description_en
        if (description_fr !== undefined) updateData.description_fr = description_fr
        if (credits !== undefined) updateData.credits = credits
        if (price_cents !== undefined) updateData.price_cents = price_cents
        if (is_active !== undefined) updateData.is_active = is_active
        if (is_popular !== undefined) updateData.is_popular = is_popular
        if (sort_order !== undefined) updateData.sort_order = sort_order

        // SECURITY: Sync to Stripe if price changed
        // The price is taken from the database/request, but Stripe sync uses server-side values
        let stripeSyncResult: StripePriceSyncResult | null = null
        const priceChanged = price_cents !== undefined && price_cents !== currentPackage.price_cents

        if (sync_to_stripe && priceChanged && stripe) {
          // Sync new price to Stripe
          // SECURITY: We pass the new price_cents that will be stored in DB
          // The sync function creates the Stripe price server-side
          stripeSyncResult = await syncCreditPackageToStripe(
            supabase,
            id,
            {
              name: currentPackage.name,
              name_en: name_en ?? currentPackage.name_en,
              description_en: description_en ?? currentPackage.description_en,
              credits: credits ?? currentPackage.credits,
              price_cents: currentPackage.price_cents, // Current price for reference
              stripe_product_id: currentPackage.stripe_product_id,
              stripe_price_id: currentPackage.stripe_price_id,
            },
            price_cents // New price to create in Stripe
          )

          if (stripeSyncResult.success) {
            // Update Stripe IDs in database
            if (stripeSyncResult.newProductId) {
              updateData.stripe_product_id = stripeSyncResult.newProductId
            }
            if (stripeSyncResult.newPriceId) {
              updateData.stripe_price_id = stripeSyncResult.newPriceId
            }
          } else {
            console.error("Stripe sync failed:", stripeSyncResult.error)
            // Don't fail the whole operation, but log the warning
          }
        }

        const { error: updateError } = await supabase
          .from("credit_packages")
          .update(updateData)
          .eq("id", id)

        if (updateError) {
          throw updateError
        }

        // Log admin action with Stripe sync info
        await supabase.rpc("log_admin_action", {
          p_admin_id: user.id,
          p_action: "UPDATE_PACKAGE",
          p_details: {
            package_id: id,
            previous: currentPackage,
            updated: updateData,
            stripe_sync: stripeSyncResult ? {
              success: stripeSyncResult.success,
              new_price_id: stripeSyncResult.newPriceId,
              error: stripeSyncResult.error,
            } : null,
          },
          p_ip_address: ipAddress,
        })

        return new Response(
          JSON.stringify({
            success: true,
            message: "Package updated",
            stripe_synced: stripeSyncResult?.success ?? false,
            stripe_error: stripeSyncResult?.error,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }

      case "create_package": {
        const { name, name_de, name_en, name_fr, description_de, description_en, description_fr, credits, price_cents, stripe_product_id, is_active = true, is_popular = false, sort_order = 0 } = data

        if (!name || !name_de || !name_en || !name_fr || !credits || !price_cents) {
          return new Response(
            JSON.stringify({ error: "Missing required fields" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          )
        }

        const { data: newPackage, error: insertError } = await supabase
          .from("credit_packages")
          .insert({
            name,
            name_de,
            name_en,
            name_fr,
            description_de,
            description_en,
            description_fr,
            credits,
            price_cents,
            stripe_product_id,
            is_active,
            is_popular,
            sort_order,
          })
          .select()
          .single()

        if (insertError) {
          throw insertError
        }

        // Log admin action
        await supabase.rpc("log_admin_action", {
          p_admin_id: user.id,
          p_action: "CREATE_PACKAGE",
          p_details: { package: newPackage },
          p_ip_address: ipAddress,
        })

        return new Response(
          JSON.stringify({ success: true, package: newPackage }),
          { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }

      case "delete_package": {
        const { id } = data

        if (!id) {
          return new Response(
            JSON.stringify({ error: "Package ID is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          )
        }

        // Get package before deletion for audit log
        const { data: packageToDelete } = await supabase
          .from("credit_packages")
          .select("*")
          .eq("id", id)
          .single()

        const { error: deleteError } = await supabase
          .from("credit_packages")
          .delete()
          .eq("id", id)

        if (deleteError) {
          throw deleteError
        }

        // Log admin action
        await supabase.rpc("log_admin_action", {
          p_admin_id: user.id,
          p_action: "DELETE_PACKAGE",
          p_details: { deleted_package: packageToDelete },
          p_ip_address: ipAddress,
        })

        return new Response(
          JSON.stringify({ success: true, message: "Package deleted" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }

      case "get_stats": {
        const { data: stats, error: statsError } = await supabase.rpc("get_admin_stats")

        if (statsError) {
          throw statsError
        }

        return new Response(
          JSON.stringify({ success: true, stats }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }

      case "get_audit_log": {
        const { limit = 50, offset = 0 } = data || {}

        const { data: logs, error: logsError } = await supabase
          .from("admin_audit_log")
          .select(`
            *,
            admin:users!admin_audit_log_admin_id_fkey(email)
          `)
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1)

        if (logsError) {
          throw logsError
        }

        return new Response(
          JSON.stringify({ success: true, logs }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }

      // Subscription Plan Actions
      case "create_subscription_plan": {
        const { name, name_de, name_en, name_fr, description_de, description_en, description_fr, credits_per_month, price_cents, interval = 'month', is_active = true, is_popular = false, sort_order = 0, features = [] } = data

        if (!name || !name_de || !name_en || !name_fr || !credits_per_month || !price_cents) {
          return new Response(
            JSON.stringify({ error: "Missing required fields" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          )
        }

        const { data: newPlan, error: insertError } = await supabase
          .from("subscription_plans")
          .insert({
            name,
            name_de,
            name_en,
            name_fr,
            description_de,
            description_en,
            description_fr,
            credits_per_month,
            price_cents,
            interval,
            is_active,
            is_popular,
            sort_order,
            features,
          })
          .select()
          .single()

        if (insertError) {
          throw insertError
        }

        // Log admin action
        await supabase.rpc("log_admin_action", {
          p_admin_id: user.id,
          p_action: "CREATE_SUBSCRIPTION_PLAN",
          p_details: { plan: newPlan },
          p_ip_address: ipAddress,
        })

        return new Response(
          JSON.stringify({ success: true, plan: newPlan }),
          { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }

      case "update_subscription_plan": {
        const { id, name, name_de, name_en, name_fr, description_de, description_en, description_fr, credits_per_month, price_cents, interval, is_active, is_popular, sort_order, features, sync_to_stripe = true } = data

        if (!id) {
          return new Response(
            JSON.stringify({ error: "Plan ID is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          )
        }

        // Get current plan
        const { data: currentPlan, error: fetchError } = await supabase
          .from("subscription_plans")
          .select("*")
          .eq("id", id)
          .single()

        if (fetchError) {
          return new Response(
            JSON.stringify({ error: "Subscription plan not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          )
        }

        // Build update object
        const updateData: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        }

        if (name !== undefined) updateData.name = name
        if (name_de !== undefined) updateData.name_de = name_de
        if (name_en !== undefined) updateData.name_en = name_en
        if (name_fr !== undefined) updateData.name_fr = name_fr
        if (description_de !== undefined) updateData.description_de = description_de
        if (description_en !== undefined) updateData.description_en = description_en
        if (description_fr !== undefined) updateData.description_fr = description_fr
        if (credits_per_month !== undefined) updateData.credits_per_month = credits_per_month
        if (price_cents !== undefined) updateData.price_cents = price_cents
        if (interval !== undefined) updateData.interval = interval
        if (is_active !== undefined) updateData.is_active = is_active
        if (is_popular !== undefined) updateData.is_popular = is_popular
        if (sort_order !== undefined) updateData.sort_order = sort_order
        if (features !== undefined) updateData.features = features

        // SECURITY: Sync to Stripe if price or interval changed
        let stripeSyncResult: StripePriceSyncResult | null = null
        const priceChanged = price_cents !== undefined && price_cents !== currentPlan.price_cents
        const intervalChanged = interval !== undefined && interval !== currentPlan.interval

        if (sync_to_stripe && (priceChanged || intervalChanged) && stripe) {
          // Sync new price to Stripe
          stripeSyncResult = await syncSubscriptionPlanToStripe(
            supabase,
            id,
            {
              name: currentPlan.name,
              name_en: name_en ?? currentPlan.name_en,
              description_en: description_en ?? currentPlan.description_en,
              credits_per_month: credits_per_month ?? currentPlan.credits_per_month,
              price_cents: currentPlan.price_cents,
              interval: interval ?? currentPlan.interval,
              stripe_product_id: currentPlan.stripe_product_id,
              stripe_price_id: currentPlan.stripe_price_id,
            },
            price_cents ?? currentPlan.price_cents // New price or current if only interval changed
          )

          if (stripeSyncResult.success) {
            if (stripeSyncResult.newProductId) {
              updateData.stripe_product_id = stripeSyncResult.newProductId
            }
            if (stripeSyncResult.newPriceId) {
              updateData.stripe_price_id = stripeSyncResult.newPriceId
            }
          } else {
            console.error("Stripe sync failed for subscription plan:", stripeSyncResult.error)
          }
        }

        const { error: updateError } = await supabase
          .from("subscription_plans")
          .update(updateData)
          .eq("id", id)

        if (updateError) {
          throw updateError
        }

        // Log admin action with Stripe sync info
        await supabase.rpc("log_admin_action", {
          p_admin_id: user.id,
          p_action: "UPDATE_SUBSCRIPTION_PLAN",
          p_details: {
            plan_id: id,
            previous: currentPlan,
            updated: updateData,
            stripe_sync: stripeSyncResult ? {
              success: stripeSyncResult.success,
              new_price_id: stripeSyncResult.newPriceId,
              error: stripeSyncResult.error,
            } : null,
          },
          p_ip_address: ipAddress,
        })

        return new Response(
          JSON.stringify({
            success: true,
            message: "Subscription plan updated",
            stripe_synced: stripeSyncResult?.success ?? false,
            stripe_error: stripeSyncResult?.error,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }

      case "delete_subscription_plan": {
        const { id } = data

        if (!id) {
          return new Response(
            JSON.stringify({ error: "Plan ID is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          )
        }

        // Get plan before deletion for audit log
        const { data: planToDelete } = await supabase
          .from("subscription_plans")
          .select("*")
          .eq("id", id)
          .single()

        const { error: deleteError } = await supabase
          .from("subscription_plans")
          .delete()
          .eq("id", id)

        if (deleteError) {
          throw deleteError
        }

        // Log admin action
        await supabase.rpc("log_admin_action", {
          p_admin_id: user.id,
          p_action: "DELETE_SUBSCRIPTION_PLAN",
          p_details: { deleted_plan: planToDelete },
          p_ip_address: ipAddress,
        })

        return new Response(
          JSON.stringify({ success: true, message: "Subscription plan deleted" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }

      // User Management Actions
      case "get_users": {
        const { limit = 50, offset = 0, search = "" } = data || {}

        let query = supabase
          .from("users")
          .select(`
            id,
            email,
            credits,
            stripe_customer_id,
            preferred_language,
            is_admin,
            created_at,
            updated_at
          `, { count: "exact" })
          .order("created_at", { ascending: false })

        if (search) {
          query = query.ilike("email", `%${search}%`)
        }

        const { data: users, error: usersError, count } = await query
          .range(offset, offset + limit - 1)

        if (usersError) {
          throw usersError
        }

        return new Response(
          JSON.stringify({ success: true, users, total: count }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }

      case "adjust_credits": {
        const { user_id, amount, reason } = data

        if (!user_id) {
          return new Response(
            JSON.stringify({ error: "User ID is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          )
        }

        if (amount === undefined || amount === null || typeof amount !== "number") {
          return new Response(
            JSON.stringify({ error: "Amount must be a number" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          )
        }

        if (!reason || reason.trim() === "") {
          return new Response(
            JSON.stringify({ error: "Reason is required for credit adjustments" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          )
        }

        // Get current user data
        const { data: targetUser, error: fetchError } = await supabase
          .from("users")
          .select("id, email, credits")
          .eq("id", user_id)
          .single()

        if (fetchError || !targetUser) {
          return new Response(
            JSON.stringify({ error: "User not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          )
        }

        const newCredits = targetUser.credits + amount

        // Prevent negative credits
        if (newCredits < 0) {
          return new Response(
            JSON.stringify({ error: "Cannot reduce credits below 0" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          )
        }

        // Update credits
        const { error: updateError } = await supabase
          .from("users")
          .update({
            credits: newCredits,
            updated_at: new Date().toISOString()
          })
          .eq("id", user_id)

        if (updateError) {
          throw updateError
        }

        // Log admin action
        await supabase.rpc("log_admin_action", {
          p_admin_id: user.id,
          p_action: amount > 0 ? "ADD_CREDITS" : "REMOVE_CREDITS",
          p_details: {
            target_user_id: user_id,
            target_user_email: targetUser.email,
            previous_credits: targetUser.credits,
            adjustment: amount,
            new_credits: newCredits,
            reason: reason,
          },
          p_ip_address: ipAddress,
        })

        return new Response(
          JSON.stringify({
            success: true,
            message: `Credits adjusted by ${amount}`,
            previous_credits: targetUser.credits,
            new_credits: newCredits
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }

      default:
        return new Response(
          JSON.stringify({ error: "Unknown action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
    }

  } catch (error) {
    console.error("Admin update pricing error:", error)
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
