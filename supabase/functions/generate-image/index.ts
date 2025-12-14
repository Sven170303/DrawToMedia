import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabaseUrl = Deno.env.get("SUPABASE_URL")!
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const geminiApiKey = Deno.env.get("GEMINI_API_KEY")

// Early validation of required environment variables
if (!geminiApiKey) {
  console.error("GEMINI_API_KEY is not configured")
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

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

interface ReferenceImage {
  base64: string
  mimeType: string
}

interface GenerateRequest {
  imageBase64: string
  imageMimeType: string
  referenceImages?: ReferenceImage[]
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
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  const startTime = Date.now()

  try {
    // 0. Check for required API key
    if (!geminiApiKey) {
      console.error("GEMINI_API_KEY environment variable is missing")
      return new Response(
        JSON.stringify({ error: "Image generation service is not configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

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
      console.error("Auth error:", authError)
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // 2. Request-Body parsen und validieren
    const body: GenerateRequest = await req.json()
    const { imageBase64, imageMimeType, referenceImages, userPrompt, output_format, resolution, aspect_ratio } = body

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

    // 3. Credits prüfen
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("credits")
      .eq("id", user.id)
      .single()

    if (userError || !userData) {
      console.error("User data error:", userError)
      return new Response(
        JSON.stringify({ error: "Could not retrieve user data" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    if (userData.credits < 1) {
      return new Response(
        JSON.stringify({ error: "Insufficient credits" }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // 4. Gemini API aufrufen
    const geminiAspectRatio = ASPECT_RATIO_MAP[aspect_ratio] || "1:1"

    // Kombiniere System-Prompt mit User-Prompt
    const fullPrompt = userPrompt
      ? `${SYSTEM_PROMPT}\n\nUser's specific instructions: ${userPrompt}`
      : SYSTEM_PROMPT

    // Build parts array with main image and optional reference images
    const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [
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

    // Add reference images if provided
    if (referenceImages && referenceImages.length > 0) {
      for (const refImage of referenceImages) {
        const cleanRefBase64 = refImage.base64.replace(/^data:image\/\w+;base64,/, "")
        parts.push({
          inlineData: {
            mimeType: refImage.mimeType,
            data: cleanRefBase64
          }
        })
      }
      console.log(`Including ${referenceImages.length} reference image(s) in request`)
    }

    const geminiRequestBody = {
      contents: [
        {
          parts: parts
        }
      ],
      generationConfig: {
        imageConfig: {
          aspectRatio: geminiAspectRatio,
          imageSize: resolution
        }
      }
    }

    console.log(`Calling Gemini API for user ${user.id} with aspect ratio ${geminiAspectRatio} and resolution ${resolution}`)
    console.log(`Request body structure: contents with ${parts.length} parts, imageConfig: ${JSON.stringify(geminiRequestBody.generationConfig)}`)

    const geminiResponse = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": geminiApiKey
        },
        body: JSON.stringify(geminiRequestBody)
      }
    )

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text()
      console.error("Gemini API error:", geminiResponse.status, errorText)

      // Parse error for more specific feedback
      let userMessage = "Image generation failed. Please try again."
      try {
        const errorJson = JSON.parse(errorText)
        if (errorJson.error?.message) {
          console.error("Gemini error message:", errorJson.error.message)
          // Check for common error types
          if (errorJson.error.message.includes("API key")) {
            userMessage = "Image generation service configuration error."
          } else if (errorJson.error.message.includes("quota")) {
            userMessage = "Service temporarily unavailable. Please try again later."
          } else if (errorJson.error.message.includes("safety")) {
            userMessage = "Image could not be generated due to content restrictions."
          }
        }
      } catch {
        // Keep default message
      }

      return new Response(
        JSON.stringify({ error: userMessage }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const geminiResult: GeminiResponse = await geminiResponse.json()

    if (geminiResult.error) {
      console.error("Gemini API returned error:", geminiResult.error)
      return new Response(
        JSON.stringify({ error: "Image generation failed: " + geminiResult.error.message }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // 5. Generiertes Bild aus Response extrahieren
    let generatedImageData: string | null = null
    let generatedMimeType: string | null = null

    const responseParts = geminiResult.candidates?.[0]?.content?.parts
    if (responseParts) {
      for (const part of responseParts) {
        if (part.inlineData) {
          generatedImageData = part.inlineData.data
          generatedMimeType = part.inlineData.mimeType
          break
        }
      }
    }

    if (!generatedImageData) {
      console.error("No image in Gemini response:", JSON.stringify(geminiResult).substring(0, 500))
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
      console.error("Storage upload error:", uploadError)
      return new Response(
        JSON.stringify({ error: "Failed to save generated image" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Public URL generieren
    const { data: publicUrlData } = supabase.storage
      .from("generations")
      .getPublicUrl(fileName)

    const generatedImageUrl = publicUrlData.publicUrl

    // 7. Credit abziehen (atomare Operation)
    const { data: creditDeducted, error: creditError } = await supabase.rpc("deduct_credit", {
      p_user_id: user.id
    })

    if (creditError || !creditDeducted) {
      console.error("Credit deduction error:", creditError || "Insufficient credits")
      // Bild löschen bei Fehler
      await supabase.storage.from("generations").remove([fileName])
      return new Response(
        JSON.stringify({ error: "Insufficient credits" }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // 8. Generation in Datenbank loggen
    const generationTimeSeconds = Math.round((Date.now() - startTime) / 1000)

    const { error: insertError } = await supabase.from("generations").insert({
      user_id: user.id,
      original_image_url: "inline_base64", // Originalbild wurde nicht gespeichert
      generated_image_url: generatedImageUrl,
      user_prompt: userPrompt || null,
      system_prompt: SYSTEM_PROMPT,
      format: output_format,
      resolution: resolution,
      generation_time_seconds: generationTimeSeconds,
      is_public: false
    })

    if (insertError) {
      console.error("Generation insert error:", insertError)
      // Nicht kritisch - Bild wurde erfolgreich generiert
    }

    console.log(`Generation completed for user ${user.id} in ${generationTimeSeconds}s`)

    // 9. Erfolgreiche Response
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

  } catch (error) {
    console.error("Generate image error:", error)
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
