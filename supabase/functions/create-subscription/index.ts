import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno"

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
})

const supabaseUrl = Deno.env.get("SUPABASE_URL")!
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  "https://draw-to-digital.com",
  "https://www.draw-to-digital.com",
  "https://dev.draw-to-digital.com",
  "http://localhost:3000",
]

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  }
}

serve(async (req) => {
  const origin = req.headers.get("Origin")
  const corsHeaders = getCorsHeaders(origin)

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

    const { plan_id, success_url, cancel_url } = await req.json()

    if (!plan_id) {
      return new Response(
        JSON.stringify({ error: "plan_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Get subscription plan from database (SERVER-SIDE PRICE - NOT FROM FRONTEND!)
    const { data: plan, error: planError } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("id", plan_id)
      .eq("is_active", true)
      .single()

    if (planError || !plan) {
      return new Response(
        JSON.stringify({ error: "Subscription plan not found or inactive" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Get pricing config for currency
    const { data: pricingConfig } = await supabase
      .from("pricing_config")
      .select("currency")
      .single()

    const currency = pricingConfig?.currency || "eur"

    // Get or create Stripe customer
    const { data: userData } = await supabase
      .from("users")
      .select("stripe_customer_id, email")
      .eq("id", user.id)
      .single()

    let stripeCustomerId: string

    if (userData?.stripe_customer_id) {
      stripeCustomerId = userData.stripe_customer_id
    } else {
      const customer = await stripe.customers.create({
        email: user.email || userData?.email,
        metadata: { supabase_user_id: user.id },
      })
      stripeCustomerId = customer.id

      await supabase
        .from("users")
        .update({ stripe_customer_id: stripeCustomerId })
        .eq("id", user.id)
    }

    // Check if user already has an active subscription
    const { data: existingSubscription } = await supabase
      .from("subscriptions")
      .select("id, status")
      .eq("user_id", user.id)
      .in("status", ["active", "trialing"])
      .single()

    if (existingSubscription) {
      return new Response(
        JSON.stringify({ error: "You already have an active subscription. Please cancel it first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Get or create Stripe Product and Price for this plan
    let stripePriceId = plan.stripe_price_id

    if (!stripePriceId) {
      // Create Stripe Product if needed
      let stripeProductId = plan.stripe_product_id

      if (!stripeProductId) {
        const product = await stripe.products.create({
          name: plan.name_en || plan.name,
          description: plan.description_en || `${plan.credits_per_month} credits per month`,
          metadata: {
            supabase_plan_id: plan.id,
            credits_per_month: plan.credits_per_month.toString(),
          },
        })
        stripeProductId = product.id

        // Save Stripe product ID back to database
        await supabase
          .from("subscription_plans")
          .update({ stripe_product_id: stripeProductId })
          .eq("id", plan.id)
      }

      // Create Stripe Price
      const price = await stripe.prices.create({
        product: stripeProductId,
        unit_amount: plan.price_cents,
        currency: currency,
        recurring: {
          interval: plan.interval as "month" | "year",
        },
        metadata: {
          supabase_plan_id: plan.id,
          credits_per_month: plan.credits_per_month.toString(),
        },
      })
      stripePriceId = price.id

      // Save Stripe price ID back to database
      await supabase
        .from("subscription_plans")
        .update({ stripe_price_id: stripePriceId })
        .eq("id", plan.id)
    }

    // Create Stripe Checkout Session for subscription
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: "subscription",
      line_items: [
        {
          price: stripePriceId,
          quantity: 1,
        },
      ],
      success_url: success_url || `${req.headers.get("origin")}/credits?subscription=success`,
      cancel_url: cancel_url || `${req.headers.get("origin")}/credits?subscription=cancelled`,
      metadata: {
        supabase_user_id: user.id,
        subscription_plan_id: plan.id,
        credits_per_month: plan.credits_per_month.toString(),
      },
      subscription_data: {
        metadata: {
          supabase_user_id: user.id,
          subscription_plan_id: plan.id,
          credits_per_month: plan.credits_per_month.toString(),
        },
      },
    })

    return new Response(
      JSON.stringify({
        checkout_url: session.url,
        session_id: session.id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )

  } catch (_error) {
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
