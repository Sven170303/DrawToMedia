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
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // User aus JWT Token extrahieren
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

    const { priceId, mode, locale = "de" } = await req.json()

    if (!priceId || !mode) {
      return new Response(
        JSON.stringify({ error: "Missing priceId or mode" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Stripe Customer erstellen oder abrufen
    let stripeCustomerId: string

    const { data: userData } = await supabase
      .from("users")
      .select("stripe_customer_id, email")
      .eq("id", user.id)
      .single()

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

    // Frontend URL mit Fallback
    const frontendUrl = Deno.env.get("FRONTEND_URL")?.trim() || "http://localhost:3002"
    console.log("Using frontend URL:", frontendUrl)
    console.log("Creating checkout for user:", user.id, "mode:", mode)

    // Checkout Session erstellen
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: stripeCustomerId,
      mode: mode as "payment" | "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${frontendUrl}/${locale}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/${locale}/payment/cancelled`,
      locale: locale as Stripe.Checkout.SessionCreateParams.Locale,
      metadata: {
        supabase_user_id: user.id,
      },
    }

    // Für Einmalzahlungen: Metadata auch auf dem PaymentIntent setzen
    if (mode === "payment") {
      sessionParams.payment_intent_data = {
        metadata: {
          supabase_user_id: user.id,
        },
      }
    }

    // Für Subscriptions: Metadata auf subscription_data setzen
    if (mode === "subscription") {
      sessionParams.subscription_data = {
        metadata: {
          supabase_user_id: user.id,
        },
      }
    }

    const session = await stripe.checkout.sessions.create(sessionParams)

    console.log("Checkout session created:", session.id, "URL:", session.url)

    return new Response(
      JSON.stringify({ checkoutUrl: session.url }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        }
      }
    )
  } catch (error) {
    console.error("Checkout error:", error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
