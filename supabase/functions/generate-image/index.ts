import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabaseUrl = Deno.env.get("SUPABASE_URL")!
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const geminiApiKey = Deno.env.get("GEMINI_API_KEY")!

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

// Simple in-memory rate limiting (per-user, 5 second cooldown)
const rateLimitMap = new Map<string, number>()
const RATE_LIMIT_MS = 5000

// Aspect Ratio zu Gemini-Format Mapping
const ASPECT_RATIO_MAP: Record<string, string> = {
  "21:9": "21:9",
  "16:9": "16:9",
  "3:2": "3:2",
  "4:3": "4:3",
  "5:4": "5:4",
  "1:1": "1:1",
  "4:5": "4:5",
  "3:4": "3:4",
  "2:3": "2:3",
  "9:16": "9:16",
}

// Output-Format zu MIME-Type Mapping
const FORMAT_TO_MIME: Record<string, string> = {
  "png": "image/png",
  "jpeg": "image/jpeg",
  "webp": "image/webp",
}

// System-Prompt für die Bildtransformation
const SYSTEM_PROMPT = `You are an expert digital artist specializing in transforming hand-drawn sketches into professional digital artwork.

Your task is to transform the provided sketch/drawing into a high-quality digital image while:
1. Preserving the original composition, layout, and key elements of the sketch
2. Adding professional polish, clean lines, and refined details
3. Applying appropriate colors, lighting, and shading
4. Maintaining the artistic intent and style suggested by the original

Follow the user's specific instructions for style, colors, and any modifications they request.
Output only the transformed image without any text explanation.`

interface GenerateRequest {
  imageBase64: string
  imageMimeType: string
  userPrompt: string
  output_format: "png" | "jpeg" | "webp"
  resolution: "1K" | "2K" | "4K"
  aspect_ratio: string
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string
        inlineData?: {
          mimeType: string
          data: string
        }
      }>
    }
  }>
  error?: {
    message: string
    code: number
  }
}

serve(async (req) => {
  const origin = req.headers.get("Origin")
  const corsHeaders = getCorsHeaders(origin)

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  const startTime = Date.now()

  try {
    // 1. Authentifizierung prüfen
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

    // 1.5 Rate Limiting - prevent spam requests
    const lastRequest = rateLimitMap.get(user.id)
    if (lastRequest && Date.now() - lastRequest < RATE_LIMIT_MS) {
      const waitTime = Math.ceil((RATE_LIMIT_MS - (Date.now() - lastRequest)) / 1000)
      return new Response(
        JSON.stringify({ error: `Rate limited. Please wait ${waitTime} seconds.` }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }
    rateLimitMap.set(user.id, Date.now())

    // 2. Request-Body parsen und validieren
    const body: GenerateRequest = await req.json()
    const { imageBase64, imageMimeType, userPrompt, output_format, resolution, aspect_ratio } = body

    if (!imageBase64 || !imageMimeType) {
      return new Response(
        JSON.stringify({ error: "Missing image data" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Validiere Base64 (darf kein Data-URL-Prefix haben)
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "")

    // Validiere MIME-Type
    const validMimeTypes = ["image/jpeg", "image/png", "image/webp"]
    if (!validMimeTypes.includes(imageMimeType)) {
      return new Response(
        JSON.stringify({ error: "Invalid image format. Supported: JPEG, PNG, WebP" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // 3. Credits ZUERST abziehen (atomare Operation - verhindert Race Conditions)
    const { data: creditDeducted, error: creditError } = await supabase.rpc("deduct_credit", {
      p_user_id: user.id
    })

    if (creditError || !creditDeducted) {
      return new Response(
        JSON.stringify({ error: "Insufficient credits" }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Flag to track if we need to refund the credit on error
    let shouldRefundCredit = true

    // 4. Gemini API aufrufen
    const geminiAspectRatio = ASPECT_RATIO_MAP[aspect_ratio] || "1:1"

    // Kombiniere System-Prompt mit User-Prompt
    const fullPrompt = userPrompt
      ? `${SYSTEM_PROMPT}\n\nUser's specific instructions: ${userPrompt}`
      : SYSTEM_PROMPT

    const geminiRequestBody = {
      contents: [
        {
          parts: [
            {
              text: fullPrompt
            },
            {
              inlineData: {
                mimeType: imageMimeType,
                data: cleanBase64
              }
            }
          ]
        }
      ],
      generationConfig: {
        imageConfig: {
          aspectRatio: geminiAspectRatio,
          imageSize: resolution
        }
      }
    }

    // Gemini API call with timeout (30 seconds)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)

    let geminiResponse: Response
    try {
      geminiResponse = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": geminiApiKey
          },
          body: JSON.stringify(geminiRequestBody),
          signal: controller.signal
        }
      )
    } catch (fetchError) {
      clearTimeout(timeout)
      // Refund credit on timeout/network error
      if (shouldRefundCredit) {
        await supabase.rpc("add_credits", { p_user_id: user.id, p_amount: 1 })
      }
      const errorMessage = fetchError instanceof Error && fetchError.name === "AbortError"
        ? "Generation timed out. Please try again."
        : "Network error. Please try again."
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }
    clearTimeout(timeout)

    if (!geminiResponse.ok) {
      // Refund credit on API error
      if (shouldRefundCredit) {
        await supabase.rpc("add_credits", { p_user_id: user.id, p_amount: 1 })
      }
      return new Response(
        JSON.stringify({ error: "Image generation failed. Please try again." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const geminiResult: GeminiResponse = await geminiResponse.json()

    if (geminiResult.error) {
      // Refund credit on Gemini error
      if (shouldRefundCredit) {
        await supabase.rpc("add_credits", { p_user_id: user.id, p_amount: 1 })
      }
      return new Response(
        JSON.stringify({ error: "Image generation failed. Please try a different prompt." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // 5. Generiertes Bild aus Response extrahieren
    let generatedImageData: string | null = null
    let generatedMimeType: string | null = null

    const parts = geminiResult.candidates?.[0]?.content?.parts
    if (parts) {
      for (const part of parts) {
        if (part.inlineData) {
          generatedImageData = part.inlineData.data
          generatedMimeType = part.inlineData.mimeType
          break
        }
      }
    }

    if (!generatedImageData) {
      // Refund credit if no image was generated
      if (shouldRefundCredit) {
        await supabase.rpc("add_credits", { p_user_id: user.id, p_amount: 1 })
      }
      return new Response(
        JSON.stringify({ error: "No image was generated. Please try a different prompt." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // 6. Bild in Supabase Storage speichern
    const timestamp = Date.now()
    const fileExtension = output_format || "png"
    const fileName = `${user.id}/${timestamp}_generated.${fileExtension}`

    // Base64 zu Uint8Array konvertieren
    const binaryString = atob(generatedImageData)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }

    const targetMimeType = FORMAT_TO_MIME[output_format] || generatedMimeType || "image/png"

    const { error: uploadError } = await supabase.storage
      .from("generations")
      .upload(fileName, bytes, {
        contentType: targetMimeType,
        upsert: false
      })

    if (uploadError) {
      // Refund credit on storage error
      if (shouldRefundCredit) {
        await supabase.rpc("add_credits", { p_user_id: user.id, p_amount: 1 })
      }
      return new Response(
        JSON.stringify({ error: "Failed to save generated image" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Image successfully stored - no refund needed anymore
    shouldRefundCredit = false

    // Public URL generieren
    const { data: publicUrlData } = supabase.storage
      .from("generations")
      .getPublicUrl(fileName)

    const generatedImageUrl = publicUrlData.publicUrl

    // 7. Generation in Datenbank loggen (Credit wurde bereits in Schritt 3 abgezogen)
    const generationTimeSeconds = Math.round((Date.now() - startTime) / 1000)

    await supabase.from("generations").insert({
      user_id: user.id,
      original_image_url: "inline_base64",
      generated_image_url: generatedImageUrl,
      user_prompt: userPrompt || null,
      system_prompt: SYSTEM_PROMPT,
      format: output_format,
      resolution: resolution,
      generation_time_seconds: generationTimeSeconds,
      is_public: false
    })

    // 8. Erfolgreiche Response
    return new Response(
      JSON.stringify({
        imageUrl: generatedImageUrl,
        generationTime: generationTimeSeconds
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      }
    )

  } catch (_error) {
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
