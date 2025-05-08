// server/services/replicate-service.ts
import Replicate from "replicate";
import { Scene, Product, ProductCategory } from "@shared/schema";

interface GenerationRequest {
  scene: Scene;
  product: Product;
  variationNumber: number;
  sceneSeed?: number; // Optional: For consistent scene generation across product variations
}

interface GenerationResult {
  imageUrl: string;
  description: string;
  success: boolean;
}

const FALLBACK_IMAGE_URL =
  "https://placehold.co/864x480/grey/white?text=Image+Gen+Error";

// Helper function to sanitize URLs and provide a specific fallback for errors
const getSanitizedImageUrl = (url: string | undefined | null): string => {
  if (!url || typeof url !== "string") {
    console.warn(
      "[SanitizeImageURL] Received invalid or empty URL, using fallback.",
      `Input URL: ${url}`,
    );
    return FALLBACK_IMAGE_URL;
  }
  try {
    const trimmedUrl = url.trim();
    new URL(trimmedUrl); // Validate URL
    return trimmedUrl;
  } catch (error) {
    console.error(
      "[SanitizeImageURL] Invalid URL format received:",
      url,
      ". Using fallback.",
      error,
    );
    return FALLBACK_IMAGE_URL;
  }
};

export async function generateProductPlacement(
  request: GenerationRequest,
): Promise<GenerationResult> {
  const { scene, product, variationNumber, sceneSeed } = request;
  // Generate the detailed prompt using the revised function
  const { prompt, negative_prompt } = createProductPlacementPrompt(request);
  const description = createPlacementDescription(request); // Description can remain the same

  try {
    const apiToken = process.env.REPLICATE_API_TOKEN;
    if (!apiToken) {
      console.error(
        "[ReplicateService] REPLICATE_API_TOKEN environment variable is not set.",
      );
      return { imageUrl: FALLBACK_IMAGE_URL, description, success: false };
    }

    const replicate = new Replicate({ auth: apiToken });

    const seed =
      sceneSeed !== undefined
        ? sceneSeed
        : Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);

    // Define input parameters for SDXL
    const replicateInput = {
      prompt: prompt,
      negative_prompt: negative_prompt,
      width: 1024,
      height: 576,
      num_inference_steps: 30, // SDXL often works well with fewer steps
      guidance_scale: 7.5, // Standard guidance scale
      seed: seed,
    };

    console.log(
      `[ReplicateService] Calling SDXL for Scene ${scene.sceneNumber}, Var ${variationNumber}, Product: ${product.name}, Seed: ${seed}`,
    );
    console.log(
      `[ReplicateService] Prompt (start): ${prompt.substring(0, 150)}...`,
    );
    console.log(
      `[ReplicateService] Full input: ${JSON.stringify(replicateInput)}`,
    );

    // Run the SDXL model
    const output = (await replicate.run(
      "stability-ai/sdxl:c221b2b8ef527988fb59bf24a8b97c4561f1c671f73bd389f866bfb27c061316", // Using SDXL
      {
        input: replicateInput,
      },
    )) as string[] | string | { error: string } | unknown; // Allow for potential error object in output

    console.log(
      `[ReplicateService] Raw SDXL Output (S${scene.sceneNumber}V${variationNumber}):`,
      JSON.stringify(output, null, 2).substring(0, 500) + "...",
    );

    let imageUrl: string | undefined;

    // Refined output handling for SDXL (often returns array of URLs)
    if (
      Array.isArray(output) &&
      output.length > 0 &&
      typeof output[0] === "string" &&
      output[0].startsWith("http")
    ) {
      imageUrl = output[0];
    } else if (typeof output === "string" && output.startsWith("http")) {
      // Handle case where it might return a single string URL
      imageUrl = output;
    } else if (
      typeof output === "object" &&
      output !== null &&
      "error" in output
    ) {
      // Handle potential error object returned by Replicate
      console.error(
        `[ReplicateService] Replicate returned an error in output for S${scene.sceneNumber}V${variationNumber}: ${output.error}`,
      );
    }
    // Note: Removed ReadableStream handling as SDXL typically returns URLs directly

    if (!imageUrl) {
      console.error(
        `[ReplicateService] No valid image URL found in SDXL output for S${scene.sceneNumber}V${variationNumber}. Output:`,
        JSON.stringify(output),
      );
      return { imageUrl: FALLBACK_IMAGE_URL, description, success: false };
    }

    const sanitizedUrl = getSanitizedImageUrl(imageUrl);
    if (
      sanitizedUrl === FALLBACK_IMAGE_URL &&
      imageUrl !== FALLBACK_IMAGE_URL
    ) {
      console.warn(
        `[ReplicateService] URL sanitization changed a potentially valid SDXL output to fallback. Original: ${imageUrl}`,
      );
    }

    console.log(
      `[ReplicateService] Generated Image URL (S${scene.sceneNumber}V${variationNumber}): ${sanitizedUrl}`,
    );
    return {
      imageUrl: sanitizedUrl,
      description,
      success: sanitizedUrl !== FALLBACK_IMAGE_URL,
    };
  } catch (error: any) {
    console.error(
      `[ReplicateService] Replicate API error for S${scene.sceneNumber}V${variationNumber} (Product: ${product.name}):`,
    );
    if (error.response && error.response.data) {
      console.error(
        "[ReplicateService] Error Details:",
        JSON.stringify(error.response.data, null, 2),
      );
    } else if (error.message) {
      console.error("[ReplicateService] Error Message:", error.message);
    } else {
      console.error(
        "[ReplicateService] Full Error Object:",
        JSON.stringify(error, null, 2),
      );
    }
    return { imageUrl: FALLBACK_IMAGE_URL, description, success: false };
  }
}

// Revised prompt generation function
function createProductPlacementPrompt(request: GenerationRequest): {
  prompt: string;
  negative_prompt: string;
} {
  const { scene, product } = request;

  // Extract key details
  const sceneLocation = scene.heading || "A dynamic film scene";
  // Limit context to prevent overly long prompts, focus on action/dialogue snippets
  const sceneContext = scene.content
    ? scene.content.split("\n").slice(0, 5).join(" ").substring(0, 300)
    : "No specific action described.";
  const productName = product.name;
  const productCategory = product.category.toLowerCase();
  const placementReason =
    scene.brandableReason ||
    `Suitable setting for a ${productCategory} product.`;

  // Define cinematic style keywords
  const cinematicStyle =
    "cinematic film still, photorealistic, high detail, professional cinematography, sharp focus, natural lighting, realistic textures, shot on 35mm film aesthetic";

  // Construct the main prompt
  let prompt = `${cinematicStyle}. `;
  prompt += `Scene: ${sceneLocation}. `;
  // Integrate context carefully
  prompt += `The scene involves: "${sceneContext}". `;
  // Explicitly state the goal: natural integration
  prompt += `Naturally and seamlessly integrate the product "${productName}" (category: ${productCategory}) into this scene. `;
  // Provide guidance based on the placement reason
  prompt += `Placement context: ${placementReason}. `;
  // Guide the AI on how to place it believably
  prompt += `The product should appear as a believable element of the scene's environment or be used naturally by characters if implied by the context. It should be subtly visible and recognizable without feeling like an advertisement. `;
  // Reinforce visual quality
  prompt += `Focus on realism, believable scale, and context-appropriate integration.`;

  // Construct the negative prompt
  const negative_prompt = `advertisement, commercial, billboard, poster, text, words, letters, signature, watermark, blurry, low quality, noisy, distorted, deformed, ugly, cartoon, drawing, illustration, 3d render, video game graphics, floating object, unrealistic scale, out of place, forced placement, multiple products, cluttered scene, generic background`;

  // Return both prompts, ensuring they don't exceed reasonable limits
  return {
    prompt: prompt.substring(0, 1000), // Keep a safeguard limit
    negative_prompt: negative_prompt.substring(0, 500),
  };
}

function createPlacementDescription(request: GenerationRequest): string {
  const { scene, product, variationNumber } = request;
  // Keep description concise for UI
  return `Var ${variationNumber}: ${product.name} in ${scene.heading}. Notes: ${scene.brandableReason || "Standard placement."}`;
}
