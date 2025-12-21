import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno"
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts"

const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY")!
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!
const supabaseUrl = Deno.env.get("SUPABASE_URL")!
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
})

// Legacy Credit-Mapping für alte Price IDs (falls noch im System)
const LEGACY_PRICE_TO_CREDITS: Record<string, number> = {
  "price_1Sa4OGB6KiFq7suQs93Pgp8m": 5,
  "price_1Sa4OHB6KiFq7suQTgcrTdWS": 15,
  "price_1Sa4OHB6KiFq7suQgUMxpEnu": 50,
  "price_1Sa4OIB6KiFq7suQ9zjdy3U2": 12,
  "price_1Sa4OIB6KiFq7suQEVEkd6oe": 30,
}

// Idempotenz-Check (fixed SQL injection by using parameterized query)
async function isEventProcessed(
  supabase: ReturnType<typeof createClient>,
  identifier: string
): Promise<boolean> {
  // Check for payment intent ID
  const { data: intentData } = await supabase
    .from("credit_purchases")
    .select("id")
    .eq("stripe_payment_intent_id", identifier)
    .limit(1)

  if (intentData && intentData.length > 0) return true

  // Check for session ID
  const { data: sessionData } = await supabase
    .from("credit_purchases")
    .select("id")
    .eq("stripe_session_id", identifier)
    .limit(1)

  return sessionData && sessionData.length > 0
}

// Manuelle Signatur-Verifizierung
async function verifyStripeSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<{ valid: boolean; timestamp?: number; error?: string }> {
  try {
    const parts = signature.split(",")
    const timestampPart = parts.find((p) => p.startsWith("t="))
    const signaturePart = parts.find((p) => p.startsWith("v1="))

    if (!timestampPart || !signaturePart) {
      return { valid: false, error: "Invalid signature format" }
    }

    const timestamp = parseInt(timestampPart.split("=")[1], 10)
    const expectedSignature = signaturePart.split("=")[1]

    const tolerance = 300 // 5 minutes
    const currentTime = Math.floor(Date.now() / 1000)
    if (Math.abs(currentTime - timestamp) > tolerance) {
      return { valid: false, error: `Timestamp outside tolerance` }
    }

    const signedPayload = `${timestamp}.${payload}`
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    )
    const signatureBuffer = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(signedPayload)
    )
    const computedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")

    if (computedSignature === expectedSignature) {
      return { valid: true, timestamp }
    }

    return { valid: false, error: "Signature mismatch" }
  } catch (err) {
    return { valid: false, error: `Verification error: ${err}` }
  }
}

serve(async (req) => {
  const signature = req.headers.get("stripe-signature")

  if (!signature) {
    return new Response(
      JSON.stringify({ error: "No signature" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    )
  }

  const body = await req.text()

  const verification = await verifyStripeSignature(body, signature, webhookSecret)

  if (!verification.valid) {
    return new Response(
      JSON.stringify({ error: "Invalid signature" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    )
  }

  let event: Stripe.Event
  try {
    event = JSON.parse(body) as Stripe.Event
  } catch (_err) {
    return new Response(
      JSON.stringify({ error: "Invalid JSON" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    )
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    switch (event.type) {
      // NEW: Handle PaymentIntent for one-time purchases (from create-payment-intent)
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        const userId = paymentIntent.metadata?.supabase_user_id
        const packageId = paymentIntent.metadata?.package_id
        const creditsStr = paymentIntent.metadata?.credits

        if (!userId) {
          // No user ID in payment intent metadata, might be from another source
          break
        }

        // Idempotenz-Check
        const alreadyProcessed = await isEventProcessed(supabase, paymentIntent.id)
        if (alreadyProcessed) {
          // Already processed - return success to prevent retries
          return new Response(
            JSON.stringify({ received: true, message: "Already processed" }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        }

        let credits = 0

        // Try to get credits from metadata (new system)
        if (creditsStr) {
          credits = parseInt(creditsStr, 10)
        }
        // Fallback: Look up package in database
        else if (packageId) {
          const { data: pkg } = await supabase
            .from("credit_packages")
            .select("credits")
            .eq("id", packageId)
            .single()

          if (pkg) {
            credits = pkg.credits
          }
        }

        if (credits > 0) {
          // Log purchase first (for idempotency)
          const { error: insertError } = await supabase.from("credit_purchases").insert({
            user_id: userId,
            credits: credits,
            amount_paid: paymentIntent.amount / 100,
            currency: paymentIntent.currency,
            stripe_payment_intent_id: paymentIntent.id,
          })

          if (insertError) {
            if (insertError.code === "23505") {
              // Duplicate - already processed, return success
              return new Response(
                JSON.stringify({ received: true, message: "Already processed" }),
                { status: 200, headers: { "Content-Type": "application/json" } }
              )
            }
            throw insertError
          }

          // Add credits
          const { error: rpcError } = await supabase.rpc("add_credits", {
            p_user_id: userId,
            p_amount: credits
          })

          if (rpcError) {
            throw rpcError
          }
        }
        break
      }

      // LEGACY: Handle checkout.session.completed (for old checkout flow and subscriptions)
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.metadata?.supabase_user_id

        if (!userId) {
          // No user ID in session metadata
          break
        }

        if (session.mode === "payment") {
          // Legacy one-time payment via Checkout
          const alreadyProcessed = await isEventProcessed(supabase, session.id)
          if (alreadyProcessed) {
            return new Response(
              JSON.stringify({ received: true, message: "Already processed" }),
              { status: 200, headers: { "Content-Type": "application/json" } }
            )
          }

          const lineItems = await stripe.checkout.sessions.listLineItems(session.id)
          const priceId = lineItems.data[0]?.price?.id
          const credits = LEGACY_PRICE_TO_CREDITS[priceId!] || 0

          if (credits > 0) {
            const { error: insertError } = await supabase.from("credit_purchases").insert({
              user_id: userId,
              credits: credits,
              amount_paid: (session.amount_total || 0) / 100,
              currency: session.currency || "eur",
              stripe_session_id: session.id,
              stripe_payment_intent_id: session.payment_intent as string,
            })

            if (insertError && insertError.code !== "23505") {
              throw insertError
            }

            if (!insertError) {
              await supabase.rpc("add_credits", {
                p_user_id: userId,
                p_amount: credits
              })
            }
          }

        } else if (session.mode === "subscription") {
          const subscription = await stripe.subscriptions.retrieve(
            session.subscription as string
          )
          const priceId = subscription.items.data[0].price.id

          // Get subscription plan ID and credits from metadata (new system)
          const subscriptionPlanId = session.metadata?.subscription_plan_id || subscription.metadata?.subscription_plan_id
          const creditsPerMonthStr = session.metadata?.credits_per_month || subscription.metadata?.credits_per_month

          let credits = 0

          // Try new system first (from metadata)
          if (creditsPerMonthStr) {
            credits = parseInt(creditsPerMonthStr, 10)
          }
          // Try to look up from subscription_plans table
          else if (subscriptionPlanId) {
            const { data: plan } = await supabase
              .from("subscription_plans")
              .select("credits_per_month")
              .eq("id", subscriptionPlanId)
              .single()

            if (plan) {
              credits = plan.credits_per_month
            }
          }
          // Legacy fallback
          else {
            credits = LEGACY_PRICE_TO_CREDITS[priceId] || 0
          }

          const { error: subError } = await supabase.from("subscriptions").insert({
            user_id: userId,
            stripe_subscription_id: subscription.id,
            stripe_customer_id: subscription.customer as string,
            price_id: priceId,
            subscription_plan_id: subscriptionPlanId || null,
            credits_per_month: credits,
            status: subscription.status,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          })

          if (subError && subError.code !== "23505") {
            throw subError
          }

          // Add initial credits for new subscription
          if (credits > 0 && !subError) {
            await supabase.rpc("add_credits", {
              p_user_id: userId,
              p_amount: credits
            })
          }
        }
        break
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice

        if (invoice.billing_reason === "subscription_cycle") {
          const subscription = await stripe.subscriptions.retrieve(
            invoice.subscription as string
          )

          const { data: subData } = await supabase
            .from("subscriptions")
            .select("user_id, price_id, credits_per_month, subscription_plan_id")
            .eq("stripe_subscription_id", subscription.id)
            .single()

          if (!subData) {
            // No subscription found
            break
          }

          let credits = 0

          // Use stored credits_per_month from subscription record (new system)
          if (subData.credits_per_month) {
            credits = subData.credits_per_month
          }
          // Fallback: look up from subscription_plans table
          else if (subData.subscription_plan_id) {
            const { data: plan } = await supabase
              .from("subscription_plans")
              .select("credits_per_month")
              .eq("id", subData.subscription_plan_id)
              .single()

            if (plan) {
              credits = plan.credits_per_month
            }
          }
          // Legacy fallback
          else {
            credits = LEGACY_PRICE_TO_CREDITS[subData.price_id] || 0
          }

          if (credits > 0) {
            await supabase.rpc("add_credits", {
              p_user_id: subData.user_id,
              p_amount: credits
            })
          }

          await supabase
            .from("subscriptions")
            .update({
              current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
              status: subscription.status,
            })
            .eq("stripe_subscription_id", subscription.id)
        }
        break
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription

        await supabase
          .from("subscriptions")
          .update({
            status: subscription.status,
            price_id: subscription.items.data[0].price.id,
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          })
          .eq("stripe_subscription_id", subscription.id)
        break
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription

        await supabase
          .from("subscriptions")
          .update({
            status: "cancelled",
            cancelled_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", subscription.id)
        break
      }
    }

    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )

  } catch (_error) {
    return new Response(
      JSON.stringify({ error: "Webhook processing failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
})
