import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno"

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
})

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
}

// Mapping von Product IDs zu Metadata
const PRODUCT_METADATA: Record<string, { credits: number; type: "one_time" | "subscription"; popular?: boolean }> = {
  "prod_TX8ff9rU2hmuKA": { credits: 5, type: "one_time" },
  "prod_TX8fxksOk2BWvV": { credits: 15, type: "one_time", popular: true },
  "prod_TX8f5fPshnDHXd": { credits: 50, type: "one_time" },
  "prod_TX8f4XSQ5Ut4cS": { credits: 12, type: "subscription" },
  "prod_TX8f6IOkSiMHzx": { credits: 30, type: "subscription", popular: true },
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Aktive Preise mit Produkten abrufen
    const prices = await stripe.prices.list({
      active: true,
      expand: ["data.product"],
      limit: 20,
    })

    const formattedPrices = prices.data
      .filter(price => {
        const product = price.product as Stripe.Product
        return product.active && PRODUCT_METADATA[product.id]
      })
      .map(price => {
        const product = price.product as Stripe.Product
        const metadata = PRODUCT_METADATA[product.id]

        return {
          id: price.id,
          productId: product.id,
          name: product.name,
          description: product.description,
          unitAmount: price.unit_amount,
          currency: price.currency,
          type: price.type,
          interval: price.recurring?.interval || null,
          credits: metadata.credits,
          pricePerCredit: Math.round((price.unit_amount || 0) / metadata.credits),
          popular: metadata.popular || false,
        }
      })
      .sort((a, b) => {
        // Sortiere: erst Einmalkäufe nach Credits, dann Abos nach Credits
        if (a.type !== b.type) {
          return a.type === "one_time" ? -1 : 1
        }
        return a.credits - b.credits
      })

    // Aufteilen in Kategorien
    const oneTimePrices = formattedPrices.filter(p => p.type === "one_time")
    const subscriptionPrices = formattedPrices.filter(p => p.type === "recurring")

    return new Response(
      JSON.stringify({
        oneTime: oneTimePrices,
        subscription: subscriptionPrices,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=300", // 5 Minuten Cache
        }
      }
    )
  } catch (error) {
    console.error("Error fetching prices:", error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
