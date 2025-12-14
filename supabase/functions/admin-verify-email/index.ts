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
    const { email } = await req.json()

    if (!email || typeof email !== "string") {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Check if email is in admin whitelist using the database function
    const { data: isAdmin, error } = await supabase.rpc("is_admin_email", {
      p_email: email.toLowerCase().trim()
    })

    if (error) {
      console.error("Error checking admin email:", error)
      return new Response(
        JSON.stringify({ error: "Internal server error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: "Unauthorized", authorized: false }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    return new Response(
      JSON.stringify({ authorized: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )

  } catch (error) {
    console.error("Admin verify email error:", error)
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
