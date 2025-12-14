import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno"

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
})

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
      console.error("Auth error:", authError)
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const { package_id } = await req.json()

    if (!package_id) {
      return new Response(
        JSON.stringify({ error: "package_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Get package from database (SERVER-SIDE PRICE - NOT FROM FRONTEND!)
    const { data: pkg, error: pkgError } = await supabase
      .from("credit_packages")
      .select("*")
      .eq("id", package_id)
      .eq("is_active", true)
      .single()

    if (pkgError || !pkg) {
      console.error("Package error:", pkgError)
      return new Response(
        JSON.stringify({ error: "Package not found or inactive" }),
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

    // Create PaymentIntent with SERVER-SIDE price (SECURE!)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: pkg.price_cents, // Price from database, not from frontend!
      currency: currency,
      customer: stripeCustomerId,
      metadata: {
        supabase_user_id: user.id,
        package_id: pkg.id,
        package_name: pkg.name,
        credits: pkg.credits.toString(),
      },
      automatic_payment_methods: {
        enabled: true,
      },
    })

    console.log("PaymentIntent created:", paymentIntent.id, "for package:", pkg.name, "amount:", pkg.price_cents)

    return new Response(
      JSON.stringify({
        client_secret: paymentIntent.client_secret,
        payment_intent_id: paymentIntent.id,
        amount: pkg.price_cents,
        currency: currency,
        credits: pkg.credits,
        package_name: pkg.name,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )

  } catch (error) {
    console.error("Create payment intent error:", error)
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
