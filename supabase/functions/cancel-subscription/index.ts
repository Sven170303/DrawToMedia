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

    const { subscription_id } = await req.json()

    if (!subscription_id) {
      return new Response(
        JSON.stringify({ error: "subscription_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Verify the subscription belongs to this user
    const { data: subData, error: subError } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("stripe_subscription_id", subscription_id)
      .eq("user_id", user.id)
      .single()

    if (subError || !subData) {
      console.error("Subscription lookup error:", subError)
      return new Response(
        JSON.stringify({ error: "Subscription not found or does not belong to user" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Cancel the subscription at period end (user keeps access until end of billing period)
    const cancelledSubscription = await stripe.subscriptions.update(subscription_id, {
      cancel_at_period_end: true,
    })

    // Update local record
    await supabase
      .from("subscriptions")
      .update({
        cancelled_at: new Date().toISOString(),
        status: cancelledSubscription.status,
      })
      .eq("stripe_subscription_id", subscription_id)

    console.log("Subscription cancelled:", subscription_id, "for user:", user.id)

    return new Response(
      JSON.stringify({
        success: true,
        message: "Subscription will be cancelled at the end of the current billing period",
        cancel_at: new Date(cancelledSubscription.current_period_end * 1000).toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )

  } catch (error) {
    console.error("Cancel subscription error:", error)
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
