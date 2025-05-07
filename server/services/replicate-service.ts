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
    const output = await replicate.run("stability-ai/sdxl:c221b2b8ef527988fb59bf24a8b97c4561f1c671f73bd389f866bfb27c061316", {
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
    });

    console.log(
      `Replicate Raw Output (S${scene.sceneNumber}V${variationNumber}):`,
      JSON.stringify(output, null, 2).substring(0, 500) + "...",
    );

    let imageUrl: string | undefined;

    // Handle ReadableStream response
    if (Array.isArray(output) && output.length > 0) {
      if (output[0] instanceof ReadableStream) {
        // The stream contains the image directly - return base64 data URL
        const reader = output[0].getReader();
        const chunks = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
        const imageBuffer = Buffer.concat(chunks);
        imageUrl = `data:image/png;base64,${imageBuffer.toString('base64')}`;
      } else if (typeof output[0] === "string") {
        imageUrl = output[0];
      }
    } else if (typeof output === "string" && output.startsWith("http")) {
      imageUrl = output;
    }

    if (!imageUrl) {
      console.error(
        `No valid image URL found for S${scene.sceneNumber}V${variationNumber}. Output:`,
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
  const sceneContext = scene.content?.substring(0, 500) || "";

  // Base prompt incorporating scene details
  let prompt = `Cinematic film still, photorealistic, high detail. Scene: ${sceneLocation}. `;
  prompt += `Scene context: ${sceneContext}. `;
  
  // Detailed product placement instructions
  prompt += `Integrate ${product.name} (${product.category.toLowerCase()}) naturally into the scene. `;

  // Category-specific placement strategies
  if (product.category === ProductCategory.BEVERAGE) {
    prompt += `Show the ${product.name} in a natural drinking/serving moment - on a table, in someone's hand, or being poured. The product should be clearly identifiable but not feel forced.`;
  } else if (product.category === ProductCategory.ELECTRONICS) {
    prompt += `Show the ${product.name} being used naturally within the scene - integrated into the action, not just placed as a prop. Ensure the brand is recognizable.`;
  } else if (product.category === ProductCategory.AUTOMOTIVE) {
    prompt += `Feature the ${product.name} as part of the scene's environment - whether parked, driving by, or as a key story element. Show the distinctive design features of the vehicle.`;
  } else if (product.category === ProductCategory.FASHION) {
    prompt += `Have a character wearing or interacting with the ${product.name} in a way that fits the scene's context. The brand should be visible but not overly prominent.`;
  } else if (product.category === ProductCategory.FOOD) {
    prompt += `Include the ${product.name} in a natural eating/dining scenario within the scene. The packaging or presentation should be clearly visible but feel organic to the moment.`;
  } else {
    prompt += `Integrate the ${product.name} naturally into the scene's environment, making it visible but not distracting from the scene's narrative.`;
  }

  // Add scene-specific context from brandable reason
  if (scene.brandableReason) {
    prompt += ` ${scene.brandableReason}`;
  }

  // Technical specifications for quality
  prompt += ` Create a high-quality cinematic shot with professional lighting, sharp focus, and natural color grading. Make the product integration feel authentic to the scene.`;

  return prompt.substring(0, 1000);
}

function createPlacementDescription(request: GenerationRequest): string {
  const { scene, product, variationNumber } = request;
  return `Variation ${variationNumber}: ${product.name} placed in the scene. ${scene.heading}. Context: ${scene.brandableReason || "General placement"}`;
}