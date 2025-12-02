import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

// Initialize the API client
// Note: process.env.API_KEY must be set in the environment
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

const MODEL_NAME = 'gemini-2.5-flash-image';

export const generateDigitalMedia = async (
  sketchBase64: string,
  userPrompt: string,
  referenceImagesBase64: string[] = []
): Promise<{ text: string; imageBase64?: string }> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing. Please set REACT_APP_GEMINI_API_KEY or check metadata.");
  }

  // Ensure base64 is clean
  const cleanBase64 = (b64: string) => b64.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');

  // 1. Prepare Sketch Part
  const parts: any[] = [
    {
      inlineData: {
        mimeType: 'image/jpeg',
        data: cleanBase64(sketchBase64)
      }
    }
  ];

  // 2. Prepare Reference Images Parts (Logos, Products, etc.)
  referenceImagesBase64.forEach((refImg) => {
    parts.push({
      inlineData: {
        mimeType: 'image/jpeg',
        data: cleanBase64(refImg)
      }
    });
  });

  // 3. Construct the Strictly Optimized Prompt
  const referenceInstruction = referenceImagesBase64.length > 0
    ? `I have provided ${referenceImagesBase64.length} additional reference images (logos/products) after the sketch. You MUST integrate these specific assets into the final design where appropriate based on the sketch layout.`
    : '';

  const finalPrompt = `
    ROLE: Expert Digital Graphic Designer & Renderer.
    
    TASK: Transform the first image (the SKETCH) into a FINAL, PRODUCTION-READY DIGITAL MEDIA ASSET.
    
    STRICT VISUAL REQUIREMENTS:
    1. **FULL BLEED / BORDERLESS**: The output must be the digital graphic itself. It must NOT look like a photo of a piece of paper on a desk. Do not render a table, background textures, pencils, or paper edges. The graphic must fill the entire frame 100%.
    2. **DIGITAL QUALITY**: The style should be clean, high-resolution, and professional. It should look like it was exported directly from design software (Illustrator/Photoshop), not photographed.
    3. **COMPOSITION**: Use the first image (Sketch) strictly for layout and composition. 
    ${referenceInstruction}
    
    USER CUSTOMIZATION:
    ${userPrompt}
    
    OUTPUT:
    Generate the final image only. If you absolutely cannot generate an image, describe it in extreme detail.
  `;

  parts.push({ text: finalPrompt });

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: parts
      }
    });

    // Check for generated image in response
    let generatedImage = '';
    let generatedText = '';

    if (response.candidates && response.candidates[0].content && response.candidates[0].content.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          generatedImage = part.inlineData.data;
        }
        if (part.text) {
          generatedText += part.text;
        }
      }
    }

    return {
      text: generatedText,
      imageBase64: generatedImage ? `data:image/png;base64,${generatedImage}` : undefined
    };

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};