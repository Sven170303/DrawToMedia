import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabaseUrl = Deno.env.get("SUPABASE_URL")!
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!

// Allowed origins for CORS (public endpoint - wider access allowed)
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
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  }
}

serve(async (req) => {
  const origin = req.headers.get("Origin")
  const corsHeaders = getCorsHeaders(origin)

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    // Get active packages from database
    const { data: packages, error: packagesError } = await supabase
      .from("credit_packages")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })

    if (packagesError) {
      throw packagesError
    }

    // Get pricing config
    const { data: pricingConfig, error: pricingError } = await supabase
      .from("pricing_config")
      .select("*")
      .single()

    // Get active subscription plans
    const { data: subscriptionPlans, error: plansError } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })

    // Format packages for frontend (one-time purchases)
    const formattedPackages = packages.map(pkg => ({
      id: pkg.id,
      name: pkg.name,
      name_de: pkg.name_de,
      name_en: pkg.name_en,
      name_fr: pkg.name_fr,
      description_de: pkg.description_de,
      description_en: pkg.description_en,
      description_fr: pkg.description_fr,
      credits: pkg.credits,
      price_cents: pkg.price_cents,
      price_formatted: (pkg.price_cents / 100).toFixed(2),
      currency: pricingConfig?.currency || "eur",
      price_per_credit: Math.round(pkg.price_cents / pkg.credits),
      is_popular: pkg.is_popular,
      stripe_product_id: pkg.stripe_product_id,
      type: "one_time" as const,
    }))

    // Format subscription plans for frontend
    const formattedSubscriptions = (subscriptionPlans || []).map(plan => ({
      id: plan.id,
      name: plan.name,
      name_de: plan.name_de,
      name_en: plan.name_en,
      name_fr: plan.name_fr,
      description_de: plan.description_de,
      description_en: plan.description_en,
      description_fr: plan.description_fr,
      credits_per_month: plan.credits_per_month,
      price_cents: plan.price_cents,
      price_formatted: (plan.price_cents / 100).toFixed(2),
      currency: pricingConfig?.currency || "eur",
      interval: plan.interval,
      is_popular: plan.is_popular,
      features: plan.features || [],
      stripe_product_id: plan.stripe_product_id,
      stripe_price_id: plan.stripe_price_id,
      type: "subscription" as const,
    }))

    return new Response(
      JSON.stringify({
        packages: formattedPackages,
        subscriptions: formattedSubscriptions,
        pricing_config: pricingError ? null : {
          tokens_per_euro: pricingConfig?.tokens_per_euro,
          tokens_per_generation: pricingConfig?.tokens_per_generation,
          currency: pricingConfig?.currency,
        },
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=60", // 1 minute cache
        }
      }
    )

  } catch (_error) {
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
