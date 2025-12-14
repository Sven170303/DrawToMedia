import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabaseUrl = Deno.env.get("SUPABASE_URL")!
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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
        const { id, name_de, name_en, name_fr, description_de, description_en, description_fr, credits, price_cents, is_active, is_popular, sort_order } = data

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

        const { error: updateError } = await supabase
          .from("credit_packages")
          .update(updateData)
          .eq("id", id)

        if (updateError) {
          throw updateError
        }

        // Log admin action
        await supabase.rpc("log_admin_action", {
          p_admin_id: user.id,
          p_action: "UPDATE_PACKAGE",
          p_details: { package_id: id, previous: currentPackage, updated: updateData },
          p_ip_address: ipAddress,
        })

        return new Response(
          JSON.stringify({ success: true, message: "Package updated" }),
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
        const { id, name, name_de, name_en, name_fr, description_de, description_en, description_fr, credits_per_month, price_cents, interval, is_active, is_popular, sort_order, features } = data

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

        const { error: updateError } = await supabase
          .from("subscription_plans")
          .update(updateData)
          .eq("id", id)

        if (updateError) {
          throw updateError
        }

        // Log admin action
        await supabase.rpc("log_admin_action", {
          p_admin_id: user.id,
          p_action: "UPDATE_SUBSCRIPTION_PLAN",
          p_details: { plan_id: id, previous: currentPlan, updated: updateData },
          p_ip_address: ipAddress,
        })

        return new Response(
          JSON.stringify({ success: true, message: "Subscription plan updated" }),
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
