// server/services/replicate-service.ts
import Replicate from "replicate";
import { Scene, Product, ProductCategory } from "@shared/schema";

interface GenerationRequest {
  scene: Scene;
  product: Product;
  variationNumber: number;
}

interface GenerationResult {
  imageUrl: string;
  description: string;
  success: boolean; // Added to indicate if generation was successful
}

const FALLBACK_IMAGE_URL =
  "https://placehold.co/864x480/grey/white?text=Image+Gen+Failed";

// Helper function to sanitize URLs and provide a specific fallback for errors
const getSanitizedImageUrl = (url: string | undefined | null): string => {
  if (!url || typeof url !== "string") {
    console.warn(
      "Received invalid or empty URL for sanitization, using fallback.",
    );
    return FALLBACK_IMAGE_URL;
  }
  try {
    const trimmedUrl = url.trim();
    new URL(trimmedUrl); // Validate URL
    return trimmedUrl;
  } catch (error) {
    console.error("Invalid URL format received:", url, ". Using fallback.");
    return FALLBACK_IMAGE_URL;
  }
};

export async function generateProductPlacement(
  request: GenerationRequest,
): Promise<GenerationResult> {
  const { scene, product, variationNumber } = request;
  const description = createPlacementDescription(request);

  try {
    const apiToken = process.env.REPLICATE_API_TOKEN;
    if (!apiToken) {
      console.error("REPLICATE_API_TOKEN environment variable is not set");
      return { imageUrl: FALLBACK_IMAGE_URL, description, success: false };
    }

    const replicate = new Replicate({ auth: apiToken });
    const prompt = createProductPlacementPrompt(request);

    console.log(
      `Replicate Call: Scene ${scene.sceneNumber}, Var ${variationNumber}, Product ${product.name}. Prompt (start): ${prompt.substring(0, 100)}...`,
    );

    // flux-1.1-pro model expects input like this
    const output = await replicate.run(
      "black-forest-labs/flux-1.1-pro:e1c1e646358567a901416b5c7988466a041060115a56513a3176f97648145859", // Using specific version
      {
        input: {
          prompt: prompt,
          width: 1024,
          height: 576,
          aspect_ratio: "custom",
          // prompt_upsampling: true, // Not a direct parameter for this model version, control through prompt detail
          // output_format: "webp", // This model usually outputs png or jpg based on default, or specified in prompt techniques
          // output_quality: 80, // Quality controlled by model / prompt
          // safety_tolerance: 2, // Handled by Replicate's platform-level safety
          seed: Math.floor(Math.random() * Number.MAX_SAFE_INTEGER),
          // num_inference_steps: 50, // Example, if you want to control this
          // guidance_scale: 7.5, // Example
        },
      },
    );

    console.log(
      `Replicate Raw Output (S${scene.sceneNumber}V${variationNumber}):`,
      JSON.stringify(output, null, 2).substring(0, 500) + "...",
    );

    let imageUrl: string | undefined;

    if (
      Array.isArray(output) &&
      output.length > 0 &&
      typeof output[0] === "string"
    ) {
      imageUrl = output[0];
    } else if (typeof output === "string" && output.startsWith("http")) {
      // Some models might return direct string URL
      imageUrl = output;
    } else {
      console.error(
        `Unexpected output format from Replicate for S${scene.sceneNumber}V${variationNumber}. Output:`,
        output,
      );
      return { imageUrl: FALLBACK_IMAGE_URL, description, success: false };
    }

    const sanitizedUrl = getSanitizedImageUrl(imageUrl);
    console.log(
      `Generated Image URL (S${scene.sceneNumber}V${variationNumber}): ${sanitizedUrl}`,
    );
    return {
      imageUrl: sanitizedUrl,
      description,
      success: sanitizedUrl !== FALLBACK_IMAGE_URL,
    };
  } catch (error: any) {
    console.error(
      `Replicate API error for S${scene.sceneNumber}V${variationNumber} (Product: ${product.name}):`,
      error.message || error,
    );
    return { imageUrl: FALLBACK_IMAGE_URL, description, success: false };
  }
}

function createProductPlacementPrompt(request: GenerationRequest): string {
  const { scene, product } = request;
  const sceneLocation = scene.heading || "A dynamic film scene";

  // More descriptive prompt focusing on visual elements
  let prompt = `Cinematic film still, high detail, photorealistic. Scene: ${sceneLocation}. `;
  prompt += `Featuring a ${product.category.toLowerCase()} product: ${product.name}. `;

  // Add specific placement details based on product category and variation number (conceptual)
  // This part would need more sophisticated logic based on scene content analysis
  if (product.category === ProductCategory.BEVERAGE) {
    prompt += `The ${product.name} is clearly visible, perhaps on a table or held by a character.`;
  } else if (product.category === ProductCategory.ELECTRONICS) {
    prompt += `A character is interacting with the ${product.name}, or it's prominently displayed on a desk.`;
  } else if (product.category === ProductCategory.AUTOMOTIVE) {
    prompt += `The ${product.name} vehicle is a key visual element, maybe in motion or stylishly parked.`;
  } else {
    prompt += `The ${product.name} is naturally integrated into the scene.`;
  }

  prompt += ` Focus on realism and brand visibility. ${scene.brandableReason || ""}.`;
  prompt +=
    " Shot on 35mm film, professional lighting, sharp focus, vivid colors.";

  return prompt.substring(0, 1000); // Ensure prompt length is within limits
}

function createPlacementDescription(request: GenerationRequest): string {
  const { scene, product, variationNumber } = request;
  return `Variation ${variationNumber}: ${product.name} placed in the scene. ${scene.heading}. Context: ${scene.brandableReason || "General placement"}`;
}
