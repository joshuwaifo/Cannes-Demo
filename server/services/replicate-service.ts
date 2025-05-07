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

    // Stability AI model configuration
    const output = await replicate.run(
      "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b",
      {
        input: {
          prompt: prompt,
          width: 1024,
          height: 576,
          refine: "expert_ensemble_refiner",
          scheduler: "K_EULER",
          num_outputs: 1,
          guidance_scale: 7.5,
          apply_watermark: false,
          high_noise_frac: 0.8,
          negative_prompt: "low quality, blurry, watermark, text, logo",
          seed: Math.floor(Math.random() * Number.MAX_SAFE_INTEGER),
        },
      }
    );

    console.log(
      `Replicate Raw Output (S${scene.sceneNumber}V${variationNumber}):`,
      JSON.stringify(output, null, 2).substring(0, 500) + "...",
    );

    let imageUrl: string | undefined;

    // Handle response from Replicate API
    if (Array.isArray(output) && output.length > 0) {
      if (typeof output[0] === "string" && output[0].startsWith("http")) {
        imageUrl = output[0];
      }
      else if (output[0] instanceof ReadableStream) {
        try {
          const reader = output[0].getReader();
          let chunks = [];
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
          }
          // Check if it's a PNG (starts with PNG magic number)
          const buffer = Buffer.concat(chunks);
          if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
            // TODO: We need to implement image storage and return a URL
            console.log("Received valid PNG image data");
            imageUrl = FALLBACK_IMAGE_URL; // For now, use fallback until storage is implemented
          } else {
            // Try parsing as JSON if not PNG
            const result = JSON.parse(buffer.toString());
            imageUrl = result.url || result[0];
          }
        } catch (err) {
          console.warn("Failed to process ReadableStream:", err);
          imageUrl = FALLBACK_IMAGE_URL;
        }
      }
    } 
    // Handle direct URL response
    else if (typeof output === "string" && output.startsWith("http")) {
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
  const sceneContext = scene.content?.substring(0, 300) || "";

  // Base cinematic quality descriptors
  let prompt = `Cinematic 35mm film still, ultra photorealistic, extremely detailed. Scene: ${sceneLocation}. `;
  prompt += `Scene context: ${sceneContext}. `;
  
  // Product integration specifics
  prompt += `Professional product placement of ${product.name} (${product.category.toLowerCase()}). `;

  // Category-specific placement strategies
  if (product.category === ProductCategory.BEVERAGE) {
    prompt += `${product.name} placed naturally in scene, crystal clear bottle/can, perfect lighting highlighting the product, condensation details, premium look`;
  } else if (product.category === ProductCategory.ELECTRONICS) {
    prompt += `${product.name} seamlessly integrated, screen displaying content, modern aesthetic, premium materials visible`;
  } else if (product.category === ProductCategory.AUTOMOTIVE) {
    prompt += `${product.name} vehicle prominently featured, showroom quality, dramatic lighting, professional automotive photography style`;
  } else if (product.category === ProductCategory.FASHION) {
    prompt += `${product.name} worn naturally, premium fabric details visible, fashion photography lighting`;
  } else {
    prompt += `${product.name} integrated organically into scene, professional product photography quality`;
  }

  // Scene-specific context
  if (scene.brandableReason) {
    prompt += ` ${scene.brandableReason}`;
  }

  // Technical quality specifications
  prompt += ` 8k resolution, masterful composition, perfect exposure, rich color grading, cinematic lighting, sharp focus`;

  return prompt.substring(0, 1000);
}

function createPlacementDescription(request: GenerationRequest): string {
  const { scene, product, variationNumber } = request;
  return `Variation ${variationNumber}: ${product.name} placed in the scene. ${scene.heading}. Context: ${scene.brandableReason || "General placement"}`;
}
