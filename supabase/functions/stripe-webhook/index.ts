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

// Credit-Mapping für Price IDs
const PRICE_TO_CREDITS: Record<string, number> = {
  "price_1Sa4OGB6KiFq7suQs93Pgp8m": 5,   // Starter Pack
  "price_1Sa4OHB6KiFq7suQTgcrTdWS": 15,  // Standard Pack
  "price_1Sa4OHB6KiFq7suQgUMxpEnu": 50,  // Pro Pack
  "price_1Sa4OIB6KiFq7suQ9zjdy3U2": 12,  // Basic Abo
  "price_1Sa4OIB6KiFq7suQEVEkd6oe": 30,  // Plus Abo
}

// Idempotenz-Check: Prüft ob Event bereits verarbeitet wurde
async function isEventProcessed(supabase: ReturnType<typeof createClient>, eventId: string): Promise<boolean> {
  const { data } = await supabase
    .from("credit_purchases")
    .select("id")
    .or(`stripe_session_id.eq.${eventId},stripe_payment_intent_id.eq.${eventId}`)
    .limit(1)

  return (data && data.length > 0)
}

// Manuelle Signatur-Verifizierung (funktioniert besser in Deno)
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

    // Check timestamp tolerance (5 minutes)
    const tolerance = 300 // 5 minutes
    const currentTime = Math.floor(Date.now() / 1000)
    if (Math.abs(currentTime - timestamp) > tolerance) {
      return { valid: false, error: `Timestamp outside tolerance: ${currentTime - timestamp}s difference` }
    }

    // Compute expected signature
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

    return { valid: false, error: `Signature mismatch. Expected: ${expectedSignature.substring(0, 20)}..., Got: ${computedSignature.substring(0, 20)}...` }
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

  // Verifiziere Signatur manuell
  const verification = await verifyStripeSignature(body, signature, webhookSecret)

  if (!verification.valid) {
    return new Response(
      JSON.stringify({ error: "Invalid signature" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    )
  }

  // Parse das Event
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
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        const userId = session.metadata?.supabase_user_id

        if (!userId) {
          throw new Error("No user ID in session metadata")
        }

        if (session.mode === "payment") {
          // Idempotenz-Check: Wurde dieser Kauf bereits verarbeitet?
          const alreadyProcessed = await isEventProcessed(supabase, session.id)
          if (alreadyProcessed) {
            break
          }

          const lineItems = await stripe.checkout.sessions.listLineItems(session.id)
          const priceId = lineItems.data[0]?.price?.id
          const credits = PRICE_TO_CREDITS[priceId!] || 0

          if (credits > 0) {
            // Erst Purchase loggen (für Idempotenz), dann Credits gutschreiben
            const { error: insertError } = await supabase.from("credit_purchases").insert({
              user_id: userId,
              credits: credits,
              amount_paid: (session.amount_total || 0) / 100,
              currency: session.currency || "eur",
              stripe_session_id: session.id,
              stripe_payment_intent_id: session.payment_intent as string,
            })

            if (insertError) {
              // Unique constraint violation = bereits verarbeitet
              if (insertError.code === "23505") {
                break
              }
              throw insertError
            }

            const { error: rpcError } = await supabase.rpc("add_credits", {
              p_user_id: userId,
              p_amount: credits
            })

            if (rpcError) {
              throw rpcError
            }
          }

        } else if (session.mode === "subscription") {
          const subscription = await stripe.subscriptions.retrieve(
            session.subscription as string
          )
          const priceId = subscription.items.data[0].price.id
          const credits = PRICE_TO_CREDITS[priceId] || 0

          const { error: subError } = await supabase.from("subscriptions").insert({
            user_id: userId,
            stripe_subscription_id: subscription.id,
            stripe_customer_id: subscription.customer as string,
            price_id: priceId,
            status: subscription.status,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          })

          if (subError) {
            // Unique constraint = subscription already exists
            if (subError.code !== "23505") {
              throw subError
            }
          }

          if (credits > 0) {
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
            .select("user_id, price_id")
            .eq("stripe_subscription_id", subscription.id)
            .single()

          if (!subData) {
            break
          }

          const credits = PRICE_TO_CREDITS[subData.price_id] || 0

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
