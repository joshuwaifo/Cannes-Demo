// server/services/replicate-service.ts
import Replicate from "replicate";
import {
  Scene,
  Product,
  ProductCategory,
  SceneVariation,
} from "@shared/schema"; // Added SceneVariation
import * as storage from "../storage"; // Import all exports as 'storage'
import { Buffer } from "buffer"; // Required for Buffer.concat

interface GenerationRequest {
  scene: Scene;
  product: Product;
  variationNumber: number;
  // sceneBasePrompt?: string; // Keep consistency if needed
  // sceneBaseSeed?: number; // Keep consistency if needed
}


// Utility function to validate URLs
function isValidHttpUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

// Enhanced error handling wrapper for Replicate API calls
async function safeReplicateCall<T>(
  operation: () => Promise<T>,
  context: string
): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    const errorMessage = error.response?.data?.error || error.message || "Unknown error";
    console.error(`Replicate API error (${context}):`, {
      message: errorMessage,
      details: error.response?.data,
      logs: error.response?.data?.logs
    });
    throw new Error(`Replicate ${context} failed: ${errorMessage}`);
  }
}

interface GenerationResult {
  imageUrl: string;
  description: string;
  success: boolean; // Added to indicate if generation was successful
}

// --- Video Generation Types ---
interface VideoGenerationResult {
  predictionId: string | null;
  error?: string;
  status?: string; // Initial status
}

interface PredictionStatusResult {
  status:
    | "starting"
    | "processing"
    | "succeeded"
    | "failed"
    | "canceled"
    | "unknown";
  outputUrl?: string | null; // URL of the generated video
  error?: string | null;
  logs?: string | null; // Include logs for debugging
}

const FALLBACK_IMAGE_URL =
  "https://placehold.co/864x480/grey/white?text=Image+Gen+Failed";
const FALLBACK_VIDEO_URL = ""; // No fallback video, just indicate failure

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

// --- generateProductPlacement (Still Image Generation - CORRECTED) ---
export async function generateProductPlacement(
  request: GenerationRequest,
): Promise<GenerationResult> {
  const { scene, product, variationNumber } = request;
  const description = createPlacementDescription(request); // Use helper

  try {
    const apiToken = process.env.REPLICATE_API_TOKEN;
    if (!apiToken) {
      console.error("REPLICATE_API_TOKEN environment variable is not set");
      return { imageUrl: FALLBACK_IMAGE_URL, description, success: false };
    }

    const replicate = new Replicate({ auth: apiToken });
    const prompt = createProductPlacementPrompt(request); // Use helper

    console.log(
      `Replicate Call (Image): Scene ${scene.sceneNumber}, Var ${variationNumber}, Product ${product.name}. Prompt (start): ${prompt.substring(0, 100)}...`,
    );

    // stability-ai/sdxl model
    const output: any = await replicate.run(
      "stability-ai/sdxl:c221b2b8ef527988fb59bf24a8b97c4561f1c671f73bd389f866bfb27c061316",
      {
        input: {
          prompt: prompt,
          width: 1024,
          height: 576,
          // aspect_ratio: "custom", // Implicitly handled by width/height
          seed: Math.floor(Math.random() * Number.MAX_SAFE_INTEGER),
        },
      },
    );

    console.log(
      `Replicate Raw Output (S${scene.sceneNumber}V${variationNumber}):`,
      // Safely stringify and truncate, as output could be large or complex
      output &&
        typeof output === "object" &&
        !(output instanceof ReadableStream)
        ? JSON.stringify(output, null, 2).substring(0, 500) + "..."
        : String(output).substring(0, 500) + "...",
    );

    let imageUrl: string | undefined;

    // Restore original output handling logic to correctly process potential ReadableStream
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
        const imageBuffer = Buffer.concat(chunks); // Ensure Buffer is imported
        imageUrl = `data:image/png;base64,${imageBuffer.toString("base64")}`;
      } else if (typeof output[0] === "string") {
        imageUrl = output[0];
      }
    } else if (
      typeof output === "string" &&
      (output.startsWith("http") || output.startsWith("data:"))
    ) {
      imageUrl = output;
    }
    // Add check for non-array ReadableStream (though less common for 'run' method, defensive)
    else if (output instanceof ReadableStream) {
      const reader = output.getReader();
      const chunks = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      const imageBuffer = Buffer.concat(chunks);
      imageUrl = `data:image/png;base64,${imageBuffer.toString("base64")}`;
    }

    if (!imageUrl || typeof imageUrl !== "string") {
      // Check if imageUrl was successfully extracted as a string
      console.error(
        `No valid image URL found or extracted for S${scene.sceneNumber}V${variationNumber}. Output received:`,
        output, // Log the problematic output again if it wasn't clear from raw log
      );
      return { imageUrl: FALLBACK_IMAGE_URL, description, success: false };
    }

    const sanitizedUrl = getSanitizedImageUrl(imageUrl);
    // Log the actual sanitized URL for verification if needed, but be mindful of console spam
    // console.log(
    //    `Generated Image URL (S${scene.sceneNumber}V${variationNumber}): ${sanitizedUrl}`
    // );
    console.log(
      `Image generation process completed for S${scene.sceneNumber}V${variationNumber}. Success: ${sanitizedUrl !== FALLBACK_IMAGE_URL}`,
    );

    return {
      imageUrl: sanitizedUrl,
      description,
      success: sanitizedUrl !== FALLBACK_IMAGE_URL,
    };
  } catch (error: any) {
    console.error(
      `Replicate API error (Image) for S${scene.sceneNumber}V${variationNumber} (Product: ${product.name}):`,
      error.message || error,
      error.stack, // Log stack for more details
    );
    return { imageUrl: FALLBACK_IMAGE_URL, description, success: false };
  }
}

// --- NEW: generateVideoFromVariation ---
export async function generateVideoFromVariation(
  variationId: number,
): Promise<VideoGenerationResult> {
  try {
    const apiToken = process.env.REPLICATE_API_TOKEN;
    if (!apiToken) {
      throw new Error("REPLICATE_API_TOKEN environment variable is not set");
    }
    const replicate = new Replicate({ auth: apiToken });

    // 1. Fetch variation details (including image URL, scene, product)
    const variation = await storage.getSceneVariationById(variationId);
    if (
      !variation ||
      !variation.imageUrl ||
      variation.imageUrl === FALLBACK_IMAGE_URL
    ) {
      throw new Error(
        `Variation ${variationId} not found or has no valid start image.`,
      );
    }
    const scene = await storage.getSceneById(variation.sceneId);
    if (!scene) {
      throw new Error(
        `Scene ${variation.sceneId} for variation ${variationId} not found.`,
      );
    }
    const product = await storage.getProductById(variation.productId);
    if (!product) {
      throw new Error(
        `Product ${variation.productId} for variation ${variationId} not found.`,
      );
    }

    // 2. Construct the video prompt (enhance the still image context)
    const stillImagePromptContext = createProductPlacementPrompt({
      scene,
      product,
      variationNumber: variation.variationNumber,
    });
    // Validate image URL before proceeding
    if (!variation.imageUrl || !isValidHttpUrl(variation.imageUrl)) {
      throw new Error("Invalid or missing image URL for video generation");
    }

    const videoPrompt = `Create a cinematic animation from this scene. Primary focus: ${stillImagePromptContext}
Key animation guidelines:
- Maintain absolute photorealism and the established composition
- Add minimal, natural motion: subtle character movements, gentle environmental effects
- Keep the product "${product.name}" perfectly integrated and clear
- Use smooth, cinematic camera work (slight dolly or pan if appropriate)
- Preserve lighting quality and mood throughout

Do not:
- Add sudden movements or jerky motion
- Change the scene composition drastically
- Alter product placement or visibility
- Modify the fundamental lighting or atmosphere`;

    const generationParams = {
      prompt: videoPrompt.substring(0, 1000),
      start_image: variation.imageUrl,
      num_frames: 90, // 3 seconds at 30fps
      motion_bucket_id: 35, // Moderate motion level
      fps: 30,
      guidance_scale: 7.5, // Balance between prompt adherence and creativity
      negative_prompt: "blurry, low quality, jerky motion, distortion, warping, artifacting",
    };

    console.log(
      `Replicate Call (Video): Var ${variation.id}. Start Image: ${variation.imageUrl}. Prompt: ${videoPrompt.substring(0, 150)}...`,
    );

    // 3. Call Replicate's prediction endpoint for Kling model
    const prediction = await replicate.predictions.create({
      version: "kwaivgi/kling-v1.6-standard",
      input: generationParams,
      // webhook: "YOUR_WEBHOOK_URL", // Optional: Use webhooks instead of polling for better scalability
      // webhook_events_filter: ["completed"]
    });

    console.log(
      `Started Replicate video prediction for Var ${variation.id}. Prediction ID: ${prediction.id}, Status: ${prediction.status}`,
    );

    if (prediction.status === "failed" || prediction.status === "canceled") {
      return {
        predictionId: prediction.id,
        error: prediction.error
          ? String(prediction.error)
          : "Prediction failed or was canceled",
        status: prediction.status,
      };
    }

    return {
      predictionId: prediction.id,
      status: prediction.status as VideoGenerationResult["status"],
    }; // Cast status
  } catch (error: any) {
    console.error(
      `Error starting video generation for Variation ${variationId}:`,
      error.message || error,
    );
    return {
      predictionId: null,
      error: error.message || "Failed to start video generation",
    };
  }
}

// --- NEW: getPredictionStatus ---
export async function getPredictionStatus(
  predictionId: string,
): Promise<PredictionStatusResult> {
  try {
    const apiToken = process.env.REPLICATE_API_TOKEN;
    if (!apiToken) {
      throw new Error("REPLICATE_API_TOKEN environment variable is not set");
    }
    const replicate = new Replicate({ auth: apiToken });

    const prediction = await replicate.predictions.get(predictionId);

    // Map Replicate status to our defined status type
    let status: PredictionStatusResult["status"] = "unknown";
    if (
      ["starting", "processing", "succeeded", "failed", "canceled"].includes(
        prediction.status,
      )
    ) {
      status = prediction.status as PredictionStatusResult["status"];
    }

    // Ensure output is treated as a string URL
    const outputUrl =
      prediction.output && typeof prediction.output === "string"
        ? prediction.output
        : Array.isArray(prediction.output) &&
            typeof prediction.output[0] === "string"
          ? prediction.output[0] // Kling might output an array with one URL
          : null;

    return {
      status: status,
      outputUrl: outputUrl,
      error: prediction.error ? String(prediction.error) : null, // Ensure error is string or null
      logs: prediction.logs,
    };
  } catch (error: any) {
    console.error(
      `Error fetching prediction status for ID ${predictionId}:`,
      error.message || error,
    );
    return {
      status: "failed", // Consider it failed if we can't get status
      error: `Failed to fetch prediction status: ${error.message || "Unknown error"}`,
    };
  }
}

// Helper to create the still image prompt (can be reused/adapted for video)
function createProductPlacementPrompt(request: GenerationRequest): string {
  const { scene, product } = request;
  const sceneLocation = scene.heading || "A dynamic film scene";
  const sceneContext = scene.content?.substring(0, 500) || "";

  // Base prompt incorporating scene details
  let prompt = `Cinematic film still, photorealistic, high detail. Scene: ${sceneLocation}. `;
  prompt += `Scene context: ${sceneContext}. `;
  prompt += `Integrate ${product.name} (${product.category.toLowerCase()}) naturally into the scene. `;

  // Add guidance based on category or reason
  if (scene.brandableReason) {
    prompt += `Placement idea: ${scene.brandableReason}. `;
  } else {
    // Add generic guidance if no reason provided
    prompt += `The product should appear naturally within the environment or be used subtly by characters. `;
  }

  prompt += `Ensure the product is identifiable but not overly prominent, maintaining the scene's realism and cinematic quality. Professional lighting and composition.`;

  // console.log(`Generated Prompt: ${prompt.substring(0,150)}...`) // Log less verbosely

  return prompt.substring(0, 1000); // Limit prompt length
}

// Helper to create description
function createPlacementDescription(request: GenerationRequest): string {
  const { scene, product, variationNumber } = request;
  return `Variation ${variationNumber}: ${product.name} placed in the scene. ${scene.heading}. Context: ${scene.brandableReason || "General placement"}`;
}
