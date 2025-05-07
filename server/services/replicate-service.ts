// server/services/replicate-service.ts
import Replicate from "replicate";
import { Scene, Product, ProductCategory } from "@shared/schema";

interface GenerationRequest {
  scene: Scene;
  product: Product;
  variationNumber: number;
  sceneBasePrompt?: string; // Optional base prompt for consistent scene generation
  sceneBaseSeed?: number;   // Optional seed for consistent scene generation
}

interface GenerationResult {
  imageUrl: string;
  description: string;
  success: boolean;
}

interface SceneBaseData {
  prompt: string;
  seed: number;
}

// Cache for storing base scene prompts and seeds to ensure consistency across variations
const sceneBaseCache = new Map<number, SceneBaseData>();

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

/**
 * Generate a product placement image for a specific scene and product.
 * This optimized version ensures consistency between variations for the same scene.
 */
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
    
    // Get or create the base scene prompt and seed to ensure consistency
    let basePrompt: string;
    let baseSeed: number;
    
    // Use provided base data or fetch from cache
    if (request.sceneBasePrompt && request.sceneBaseSeed) {
      basePrompt = request.sceneBasePrompt;
      baseSeed = request.sceneBaseSeed;
    } else {
      // Check if we already have a base prompt and seed for this scene
      const cachedBase = sceneBaseCache.get(scene.id);
      if (cachedBase) {
        basePrompt = cachedBase.prompt;
        baseSeed = cachedBase.seed;
      } else {
        // Create new base prompt and seed for this scene
        basePrompt = createBaseScenePrompt(scene);
        baseSeed = Math.floor(Math.random() * 1000000);
        
        // Cache for future variations of this scene
        sceneBaseCache.set(scene.id, { prompt: basePrompt, seed: baseSeed });
      }
    }
    
    // Now create the full prompt with product integration
    const fullPrompt = createProductPlacementPrompt(request, basePrompt);

    console.log(
      `Replicate Call: Scene ${scene.sceneNumber}, Var ${variationNumber}, Product ${product.name}. Seed: ${baseSeed}. Prompt (start): ${fullPrompt.substring(0, 100)}...`,
    );

    // Using flux-1.1-pro model with fixed seed for consistency across variations
    const output = await replicate.run(
      "black-forest-labs/flux-1.1-pro:e1c1e646358567a901416b5c7988466a041060115a56513a3176f97648145859",
      {
        input: {
          prompt: fullPrompt,
          width: 1024,
          height: 576,
          aspect_ratio: "custom",
          seed: baseSeed, // Using the same seed for consistent scene composition
          negative_prompt: "low quality, blurry, distorted text, watermark, logo",
        },
      },
    );

    console.log(
      `Replicate Output (S${scene.sceneNumber}V${variationNumber}):`,
      typeof output === 'object' ? JSON.stringify(output).substring(0, 200) + "..." : output,
    );

    let imageUrl: string | undefined;

    if (Array.isArray(output) && output.length > 0 && typeof output[0] === "string") {
      imageUrl = output[0];
    } else if (typeof output === "string" && output.startsWith("http")) {
      imageUrl = output;
    } else {
      console.error(
        `Unexpected output format from Replicate for S${scene.sceneNumber}V${variationNumber}.`,
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

/**
 * Creates a base prompt that describes just the scene setting without any specific products.
 * This ensures consistent scene composition across different product variations.
 */
function createBaseScenePrompt(scene: Scene): string {
  const sceneLocation = scene.heading || "A cinematic scene";
  const sceneDescription = scene.content?.substring(0, 300) || "";

  // Create a base scene prompt focusing on setting and atmosphere only
  let basePrompt = `Conceptual film still, cinematic film set, professional cinematography. `;
  basePrompt += `Scene setting: ${sceneLocation}. `;
  
  // Extract key setting details without mentioning specific brands
  if (sceneDescription) {
    // Clean up script direction formatting
    const cleanDescription = sceneDescription
      .replace(/\([^)]*\)/g, '') // Remove parenthetical directions
      .replace(/^[A-Z\s]+:/gm, '') // Remove character names followed by colon
      .replace(/\n+/g, ' ') // Replace newlines with spaces
      .trim();
      
    basePrompt += `Scene context: ${cleanDescription}. `;
  }
  
  // Add visual style guidance that will be consistent across variations
  basePrompt += `Professional lighting, sharp focus, cinematic composition. `;
  basePrompt += scene.brandableReason ? `Setting context: ${scene.brandableReason}. ` : '';
  basePrompt += `35mm film look, production quality, movie still.`;
  
  return basePrompt.substring(0, 900); // Keep within reasonable length
}

/**
 * Takes the base scene prompt and adds specific product placement details.
 * This ensures the scene remains consistent while only the product changes.
 */
function createProductPlacementPrompt(
  request: GenerationRequest, 
  basePrompt: string
): string {
  const { scene, product } = request;
  
  // Start with the base scene prompt to maintain consistency
  let fullPrompt = basePrompt;
  
  // Add product-specific details
  fullPrompt += ` Feature a ${product.category.toLowerCase()} product: ${product.name}, `;
  
  // Product category-specific integration guidance
  switch (product.category) {
    case ProductCategory.BEVERAGE:
      fullPrompt += `the ${product.name} beverage is prominently displayed, the bottle/can is clearly visible with recognizable branding. `;
      break;
    case ProductCategory.FOOD:
      fullPrompt += `the ${product.name} food product is integrated naturally with clear packaging/branding visible. `;
      break;
    case ProductCategory.ELECTRONICS:
      fullPrompt += `the ${product.name} device is being used or displayed in the scene with visible brand elements. `;
      break;
    case ProductCategory.AUTOMOTIVE:
      fullPrompt += `the ${product.name} vehicle is prominently featured in the scene with recognizable design elements. `;
      break;
    case ProductCategory.FASHION:
      fullPrompt += `the ${product.name} fashion item is worn or displayed clearly with visible branding. `;
      break;
    default:
      fullPrompt += `the ${product.name} product is naturally integrated into the scene with visible branding. `;
  }
  
  // Emphasize conceptual rather than hyper-realistic quality
  fullPrompt += `Conceptual product placement, focus on compositional harmony and brand visibility. `;
  
  return fullPrompt.substring(0, 1000); // Keep within token limits
}

/**
 * Creates a descriptive caption for the placement variation.
 */
function createPlacementDescription(request: GenerationRequest): string {
  const { scene, product, variationNumber } = request;
  return `Variation ${variationNumber}: ${product.name} ${product.category.toLowerCase()} placed in ${scene.heading}. ${scene.brandableReason || "Strategic product placement"}`;
}
