// // server/services/replicate-service.ts
// import Replicate from "replicate";
// import {
//   Scene,
//   Product,
//   ProductCategory,
//   SceneVariation,
// } from "@shared/schema"; // Added SceneVariation
// import * as storage from "../storage"; // Import all exports as 'storage'
// import { Buffer } from "buffer"; // Required for Buffer.concat

// interface GenerationRequest {
//   scene: Scene;
//   product: Product;
//   variationNumber: number;
//   // sceneBasePrompt?: string; // Keep consistency if needed
//   // sceneBaseSeed?: number; // Keep consistency if needed
// }


// // Utility function to validate URLs
// function isValidHttpUrl(urlString: string): boolean {
//   try {
//     const url = new URL(urlString);
//     return url.protocol === "http:" || url.protocol === "https:";
//   } catch {
//     return false;
//   }
// }

// // Enhanced error handling wrapper for Replicate API calls
// async function safeReplicateCall<T>(
//   operation: () => Promise<T>,
//   context: string
// ): Promise<T> {
//   try {
//     return await operation();
//   } catch (error: any) {
//     const errorMessage = error.response?.data?.error || error.message || "Unknown error";
//     console.error(`Replicate API error (${context}):`, {
//       message: errorMessage,
//       details: error.response?.data,
//       logs: error.response?.data?.logs
//     });
//     throw new Error(`Replicate ${context} failed: ${errorMessage}`);
//   }
// }

// interface GenerationResult {
//   imageUrl: string;
//   description: string;
//   success: boolean; // Added to indicate if generation was successful
// }

// // --- Video Generation Types ---
// interface VideoGenerationResult {
//   predictionId: string | null;
//   error?: string;
//   status?: string; // Initial status
// }

// interface PredictionStatusResult {
//   status:
//     | "starting"
//     | "processing"
//     | "succeeded"
//     | "failed"
//     | "canceled"
//     | "unknown";
//   outputUrl?: string | null; // URL of the generated video
//   error?: string | null;
//   logs?: string | null; // Include logs for debugging
// }

// const FALLBACK_IMAGE_URL =
//   "https://placehold.co/864x480/grey/white?text=Image+Gen+Failed";
// const FALLBACK_VIDEO_URL = ""; // No fallback video, just indicate failure

// // Helper function to sanitize URLs and provide a specific fallback for errors
// const getSanitizedImageUrl = (url: string | undefined | null): string => {
//   if (!url || typeof url !== "string") {
//     console.warn(
//       "Received invalid or empty URL for sanitization, using fallback.",
//     );
//     return FALLBACK_IMAGE_URL;
//   }
//   try {
//     const trimmedUrl = url.trim();
//     new URL(trimmedUrl); // Validate URL
//     return trimmedUrl;
//   } catch (error) {
//     console.error("Invalid URL format received:", url, ". Using fallback.");
//     return FALLBACK_IMAGE_URL;
//   }
// };

// // --- generateProductPlacement (Still Image Generation - CORRECTED) ---
// export async function generateProductPlacement(
//   request: GenerationRequest,
// ): Promise<GenerationResult> {
//   const { scene, product, variationNumber } = request;
//   const description = createPlacementDescription(request); // Use helper

//   try {
//     const apiToken = process.env.REPLICATE_API_TOKEN;
//     if (!apiToken) {
//       console.error("REPLICATE_API_TOKEN environment variable is not set");
//       return { imageUrl: FALLBACK_IMAGE_URL, description, success: false };
//     }

//     const replicate = new Replicate({ auth: apiToken });
//     const prompt = createProductPlacementPrompt(request); // Use helper

//     console.log(
//       `Replicate Call (Image): Scene ${scene.sceneNumber}, Var ${variationNumber}, Product ${product.name}. Prompt (start): ${prompt.substring(0, 100)}...`,
//     );

//     // stability-ai/sdxl model
//     const output: any = await replicate.run(
//       "stability-ai/sdxl:c221b2b8ef527988fb59bf24a8b97c4561f1c671f73bd389f866bfb27c061316",
//       {
//         input: {
//           prompt: prompt,
//           width: 1024,
//           height: 576,
//           // aspect_ratio: "custom", // Implicitly handled by width/height
//           seed: Math.floor(Math.random() * Number.MAX_SAFE_INTEGER),
//         },
//       },
//     );

//     console.log(
//       `Replicate Raw Output (S${scene.sceneNumber}V${variationNumber}):`,
//       // Safely stringify and truncate, as output could be large or complex
//       output &&
//         typeof output === "object" &&
//         !(output instanceof ReadableStream)
//         ? JSON.stringify(output, null, 2).substring(0, 500) + "..."
//         : String(output).substring(0, 500) + "...",
//     );

//     let imageUrl: string | undefined;

//     // Restore original output handling logic to correctly process potential ReadableStream
//     if (Array.isArray(output) && output.length > 0) {
//       if (output[0] instanceof ReadableStream) {
//         // The stream contains the image directly - return base64 data URL
//         const reader = output[0].getReader();
//         const chunks = [];
//         while (true) {
//           const { done, value } = await reader.read();
//           if (done) break;
//           chunks.push(value);
//         }
//         const imageBuffer = Buffer.concat(chunks); // Ensure Buffer is imported
//         imageUrl = `data:image/png;base64,${imageBuffer.toString("base64")}`;
//       } else if (typeof output[0] === "string") {
//         imageUrl = output[0];
//       }
//     } else if (
//       typeof output === "string" &&
//       (output.startsWith("http") || output.startsWith("data:"))
//     ) {
//       imageUrl = output;
//     }
//     // Add check for non-array ReadableStream (though less common for 'run' method, defensive)
//     else if (output instanceof ReadableStream) {
//       const reader = output.getReader();
//       const chunks = [];
//       while (true) {
//         const { done, value } = await reader.read();
//         if (done) break;
//         chunks.push(value);
//       }
//       const imageBuffer = Buffer.concat(chunks);
//       imageUrl = `data:image/png;base64,${imageBuffer.toString("base64")}`;
//     }

//     if (!imageUrl || typeof imageUrl !== "string") {
//       // Check if imageUrl was successfully extracted as a string
//       console.error(
//         `No valid image URL found or extracted for S${scene.sceneNumber}V${variationNumber}. Output received:`,
//         output, // Log the problematic output again if it wasn't clear from raw log
//       );
//       return { imageUrl: FALLBACK_IMAGE_URL, description, success: false };
//     }

//     const sanitizedUrl = getSanitizedImageUrl(imageUrl);
//     // Log the actual sanitized URL for verification if needed, but be mindful of console spam
//     // console.log(
//     //    `Generated Image URL (S${scene.sceneNumber}V${variationNumber}): ${sanitizedUrl}`
//     // );
//     console.log(
//       `Image generation process completed for S${scene.sceneNumber}V${variationNumber}. Success: ${sanitizedUrl !== FALLBACK_IMAGE_URL}`,
//     );

//     return {
//       imageUrl: sanitizedUrl,
//       description,
//       success: sanitizedUrl !== FALLBACK_IMAGE_URL,
//     };
//   } catch (error: any) {
//     console.error(
//       `Replicate API error (Image) for S${scene.sceneNumber}V${variationNumber} (Product: ${product.name}):`,
//       error.message || error,
//       error.stack, // Log stack for more details
//     );
//     return { imageUrl: FALLBACK_IMAGE_URL, description, success: false };
//   }
// }

// // --- NEW: generateVideoFromVariation ---
// export async function generateVideoFromVariation(
//   variationId: number,
// ): Promise<VideoGenerationResult> {
//   try {
//     const apiToken = process.env.REPLICATE_API_TOKEN;
//     if (!apiToken) {
//       throw new Error("REPLICATE_API_TOKEN environment variable is not set");
//     }
//     const replicate = new Replicate({ auth: apiToken });

//     // 1. Fetch variation details (including image URL, scene, product)
//     const variation = await storage.getSceneVariationById(variationId);
//     if (
//       !variation ||
//       !variation.imageUrl ||
//       variation.imageUrl === FALLBACK_IMAGE_URL
//     ) {
//       throw new Error(
//         `Variation ${variationId} not found or has no valid start image.`,
//       );
//     }
//     const scene = await storage.getSceneById(variation.sceneId);
//     if (!scene) {
//       throw new Error(
//         `Scene ${variation.sceneId} for variation ${variationId} not found.`,
//       );
//     }
//     const product = await storage.getProductById(variation.productId);
//     if (!product) {
//       throw new Error(
//         `Product ${variation.productId} for variation ${variationId} not found.`,
//       );
//     }

//     // 2. Construct the video prompt (enhance the still image context)
//     const stillImagePromptContext = createProductPlacementPrompt({
//       scene,
//       product,
//       variationNumber: variation.variationNumber,
//     });
//     // Validate image URL before proceeding
//     if (!variation.imageUrl || !isValidHttpUrl(variation.imageUrl)) {
//       throw new Error("Invalid or missing image URL for video generation");
//     }

//     const videoPrompt = `Create a cinematic animation from this scene. Primary focus: ${stillImagePromptContext}
// Key animation guidelines:
// - Maintain absolute photorealism and the established composition
// - Add minimal, natural motion: subtle character movements, gentle environmental effects
// - Keep the product "${product.name}" perfectly integrated and clear
// - Use smooth, cinematic camera work (slight dolly or pan if appropriate)
// - Preserve lighting quality and mood throughout

// Do not:
// - Add sudden movements or jerky motion
// - Change the scene composition drastically
// - Alter product placement or visibility
// - Modify the fundamental lighting or atmosphere`;

//     const generationParams = {
//       prompt: videoPrompt.substring(0, 1000),
//       start_image: variation.imageUrl,
//       num_frames: 90, // 3 seconds at 30fps
//       motion_bucket_id: 35, // Moderate motion level
//       fps: 30,
//       guidance_scale: 7.5, // Balance between prompt adherence and creativity
//       negative_prompt: "blurry, low quality, jerky motion, distortion, warping, artifacting",
//     };

//     console.log(
//       `Replicate Call (Video): Var ${variation.id}. Start Image: ${variation.imageUrl}. Prompt: ${videoPrompt.substring(0, 150)}...`,
//     );

//     // 3. Call Replicate's prediction endpoint for Kling model
//     const prediction = await replicate.predictions.create({
//       version: "kwaivgi/kling-v1.6-standard",
//       input: generationParams,
//       // webhook: "YOUR_WEBHOOK_URL", // Optional: Use webhooks instead of polling for better scalability
//       // webhook_events_filter: ["completed"]
//     });

//     console.log(
//       `Started Replicate video prediction for Var ${variation.id}. Prediction ID: ${prediction.id}, Status: ${prediction.status}`,
//     );

//     if (prediction.status === "failed" || prediction.status === "canceled") {
//       return {
//         predictionId: prediction.id,
//         error: prediction.error
//           ? String(prediction.error)
//           : "Prediction failed or was canceled",
//         status: prediction.status,
//       };
//     }

//     return {
//       predictionId: prediction.id,
//       status: prediction.status as VideoGenerationResult["status"],
//     }; // Cast status
//   } catch (error: any) {
//     console.error(
//       `Error starting video generation for Variation ${variationId}:`,
//       error.message || error,
//     );
//     return {
//       predictionId: null,
//       error: error.message || "Failed to start video generation",
//     };
//   }
// }

// // --- NEW: getPredictionStatus ---
// export async function getPredictionStatus(
//   predictionId: string,
// ): Promise<PredictionStatusResult> {
//   try {
//     const apiToken = process.env.REPLICATE_API_TOKEN;
//     if (!apiToken) {
//       throw new Error("REPLICATE_API_TOKEN environment variable is not set");
//     }
//     const replicate = new Replicate({ auth: apiToken });

//     const prediction = await replicate.predictions.get(predictionId);

//     // Map Replicate status to our defined status type
//     let status: PredictionStatusResult["status"] = "unknown";
//     if (
//       ["starting", "processing", "succeeded", "failed", "canceled"].includes(
//         prediction.status,
//       )
//     ) {
//       status = prediction.status as PredictionStatusResult["status"];
//     }

//     // Ensure output is treated as a string URL
//     const outputUrl =
//       prediction.output && typeof prediction.output === "string"
//         ? prediction.output
//         : Array.isArray(prediction.output) &&
//             typeof prediction.output[0] === "string"
//           ? prediction.output[0] // Kling might output an array with one URL
//           : null;

//     return {
//       status: status,
//       outputUrl: outputUrl,
//       error: prediction.error ? String(prediction.error) : null, // Ensure error is string or null
//       logs: prediction.logs,
//     };
//   } catch (error: any) {
//     console.error(
//       `Error fetching prediction status for ID ${predictionId}:`,
//       error.message || error,
//     );
//     return {
//       status: "failed", // Consider it failed if we can't get status
//       error: `Failed to fetch prediction status: ${error.message || "Unknown error"}`,
//     };
//   }
// }

// // Helper to create the still image prompt (can be reused/adapted for video)
// function createProductPlacementPrompt(request: GenerationRequest): string {
//   const { scene, product } = request;
//   const sceneLocation = scene.heading || "A dynamic film scene";
//   const sceneContext = scene.content?.substring(0, 500) || "";

//   // Base prompt incorporating scene details
//   let prompt = `Cinematic film still, photorealistic, high detail. Scene: ${sceneLocation}. `;
//   prompt += `Scene context: ${sceneContext}. `;
//   prompt += `Integrate ${product.name} (${product.category.toLowerCase()}) naturally into the scene. `;

//   // Add guidance based on category or reason
//   if (scene.brandableReason) {
//     prompt += `Placement idea: ${scene.brandableReason}. `;
//   } else {
//     // Add generic guidance if no reason provided
//     prompt += `The product should appear naturally within the environment or be used subtly by characters. `;
//   }

//   prompt += `Ensure the product is identifiable but not overly prominent, maintaining the scene's realism and cinematic quality. Professional lighting and composition.`;

//   // console.log(`Generated Prompt: ${prompt.substring(0,150)}...`) // Log less verbosely

//   return prompt.substring(0, 1000); // Limit prompt length
// }

// // Helper to create description
// function createPlacementDescription(request: GenerationRequest): string {
//   const { scene, product, variationNumber } = request;
//   return `Variation ${variationNumber}: ${product.name} placed in the scene. ${scene.heading}. Context: ${scene.brandableReason || "General placement"}`;
// }


// server/services/replicate-service.ts
import Replicate from "replicate";
import { Scene, Product, SceneVariation } from "@shared/schema";
import * as storage from "../storage";
import { Buffer } from "buffer"; // Required for Buffer.concat

// --- Interfaces ---
interface GenerationRequest {
  scene: Scene;
  product: Product;
  variationNumber: number;
  prompt: string; // Expect prompt to be passed in
}

interface GenerationResult {
  imageUrl: string;
  description: string;
  success: boolean;
}

interface VideoGenerationResult {
  predictionId: string | null;
  error?: string;
  status?: string;
}

interface PredictionStatusResult {
  status:
    | "starting"
    | "processing"
    | "succeeded"
    | "failed"
    | "canceled"
    | "unknown";
  outputUrl?: string | null;
  error?: string | null;
  logs?: string | null;
}

// --- Constants ---
const FALLBACK_IMAGE_URL = "https://placehold.co/1024x576/grey/white?text=Image+Gen+Failed"; // Updated size
const REPLICATE_IMAGE_MODEL = "stability-ai/sdxl";
const REPLICATE_IMAGE_VERSION = "c221b2b8ef527988fb59bf24a8b97c4561f1c671f73bd389f866bfb27c061316";
const REPLICATE_VIDEO_MODEL = "stability-ai/stable-video-diffusion";
const REPLICATE_VIDEO_VERSION = "3f0457e4619daac51203dedb472816fd4af51f3149fa7a9e0b5ffcf1b8172438";

// --- Utilities ---
function isValidHttpUrl(urlString: string): boolean {
  if (!urlString || typeof urlString !== 'string') return false;
  try {
    const url = new URL(urlString);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

const getSanitizedImageUrl = (url: string | undefined | null): string => {
  if (!url || typeof url !== 'string' || !isValidHttpUrl(url)) {
    // console.warn("Invalid or empty URL for sanitization, using fallback.", url); // Keep logging minimal
    return FALLBACK_IMAGE_URL;
  }
  return url.trim(); // Already validated by isValidHttpUrl
};

// Helper to initialize Replicate client
function getReplicateClient(): Replicate {
    const apiToken = process.env.REPLICATE_API_TOKEN;
    if (!apiToken) {
        console.error("CRITICAL: REPLICATE_API_TOKEN environment variable is not set.");
        throw new Error("Replicate API token is not configured.");
    }
    return new Replicate({ auth: apiToken });
}

// Enhanced error handling wrapper
async function safeReplicateCall<T>(operation: () => Promise<T>, context: string): Promise<T> {
    try {
        return await operation();
    } catch (error: any) {
        // Attempt to parse Replicate's specific error structure
        const replicateErrorDetail = error.response?.data?.detail || error.message || 'Unknown Replicate error';
        const statusCode = error.response?.status;
        console.error(`Replicate API error during [${context}] (Status: ${statusCode || 'N/A'}):`, replicateErrorDetail);
        // Log full error for debugging if needed, but keep propagated message concise
        // console.error("Full Replicate error object:", error);
        throw new Error(`Replicate failed [${context}]: ${replicateErrorDetail}`); // Throw a new error with combined info
    }
}

// --- Image Generation ---
export async function generateProductPlacement(request: GenerationRequest): Promise<GenerationResult> {
  const { scene, product, variationNumber, prompt } = request;
  const logPrefix = `[ImgGen S${scene.sceneNumber} V${variationNumber} P:${product.id}]`;

  // Use the prompt to generate a description, or fallback
  const description = prompt ? `Variation ${variationNumber}: ${product.name}. ${prompt.substring(0, 100)}...` : `Variation ${variationNumber} for ${product.name}`;

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 10) {
       console.error(`${logPrefix} Invalid or empty prompt received: "${prompt}"`);
       return { imageUrl: FALLBACK_IMAGE_URL, description: "Error: Invalid generation prompt.", success: false };
   }

  try {
    const replicate = getReplicateClient();
    console.log(`${logPrefix} Using Gemini Prompt: ${prompt.substring(0, 100)}...`);

    const input = {
        prompt: prompt,
        width: 1024,
        height: 576, // 16:9 aspect ratio
        num_outputs: 1,
        scheduler: "K_EULER", // Common scheduler for SDXL
        num_inference_steps: 25, // Balance quality and speed
        guidance_scale: 7.5,
        refine: "expert_ensemble_refiner", // Use SDXL refiner for better detail
        refine_steps: 50,
        // seed: Math.floor(Math.random() * Number.MAX_SAFE_INTEGER), // Consider making seed consistent per scene/product if needed
    };

     console.log(`${logPrefix} Calling Replicate run (${REPLICATE_IMAGE_MODEL}:${REPLICATE_IMAGE_VERSION})...`);

    const output: any = await safeReplicateCall(() => replicate.run(
       `${REPLICATE_IMAGE_MODEL}:${REPLICATE_IMAGE_VERSION}`,
      { input }
    ), `Run Image Model Var ${variationNumber}`);

    // SDXL usually returns an array of URL strings
    let imageUrl: string | undefined;
    if (Array.isArray(output) && output.length > 0 && typeof output[0] === 'string') {
        imageUrl = output[0];
    } else {
        console.error(`${logPrefix} Unexpected output format from Replicate:`, output);
         return { imageUrl: FALLBACK_IMAGE_URL, description, success: false };
    }

    const sanitizedUrl = getSanitizedImageUrl(imageUrl);
    const success = sanitizedUrl !== FALLBACK_IMAGE_URL;
    console.log(`${logPrefix} Image generation completed. Success: ${success}. URL: ${success ? sanitizedUrl.substring(0, 60) + '...' : 'FALLBACK'}`);

    return { imageUrl: sanitizedUrl, description, success };

  } catch (error: any) {
    console.error(`${logPrefix} Error during image generation:`, error.message || error);
    return { imageUrl: FALLBACK_IMAGE_URL, description, success: false };
  }
}

// --- Video Generation ---
export async function generateVideoFromVariation(variationId: number): Promise<VideoGenerationResult> {
  const logPrefix = `[VidGen Var ${variationId}]`;
  try {
    const replicate = getReplicateClient();

    // 1. Fetch variation details including the crucial Gemini prompt
    const variation = await storage.getSceneVariationById(variationId);
    if (!variation) throw new Error(`Variation ${variationId} not found.`);
    if (!variation.imageUrl || !isValidHttpUrl(variation.imageUrl)) throw new Error(`Invalid or missing start image URL for variation ${variationId}.`);
    if (!variation.geminiPrompt) throw new Error(`Missing Gemini prompt for variation ${variationId}. Cannot generate video.`);

    // 2. Construct video prompt using the stored Gemini prompt
    const imageContextPrompt = variation.geminiPrompt;
    const videoPrompt = `Animate this cinematic scene: "${imageContextPrompt}". Add subtle, realistic motion fitting the description (e.g., gentle character shifts, environmental effects like steam/wind). Maintain photorealism, lighting, and composition. Ensure the integrated product remains clear and natural. Avoid jerky motion or drastic changes.`;

    const input = {
      image_path: variation.imageUrl, // Parameter name for Stable Video Diffusion
      prompt: videoPrompt.substring(0, 1000), // Ensure prompt is within limits
      video_length: "25_frames", // SVD specific param (adjust as needed: "14_frames" or "25_frames")
      frames_per_second: 6, // SVD default/recommendation
      motion_bucket_id: 35, // Moderate motion, adjust based on testing (lower = less motion)
      guidance_scale: 7.5, // SVD doesn't use this typically, but replicate might map it? Check model page.
      seed: Math.floor(Math.random() * 4294967295), // SVD uses 32-bit seed
      // Negative prompt might not be directly supported by SVD via replicate, handled in main prompt
    };

    console.log(`${logPrefix} Calling Replicate create prediction (${REPLICATE_VIDEO_MODEL}:${REPLICATE_VIDEO_VERSION})...`);
    console.log(`${logPrefix} Start Image: ${variation.imageUrl}`);
    // console.log(`${logPrefix} Video Prompt: ${videoPrompt.substring(0,150)}...`); // Log prompt if needed

    // 3. Start prediction job
    const prediction = await safeReplicateCall(() => replicate.predictions.create({
      version: REPLICATE_VIDEO_VERSION,
      input: input,
      // webhook: process.env.REPLICATE_WEBHOOK_URL, // Consider using webhooks
      // webhook_events_filter: ["completed"]
    }), `Create Video Prediction Var ${variationId}`);


    console.log(`${logPrefix} Prediction started. ID: ${prediction.id}, Status: ${prediction.status}`);

    if (prediction.status === 'failed' || prediction.status === 'canceled') {
      return {
        predictionId: prediction.id,
        error: prediction.error ? String(prediction.error) : `Prediction ${prediction.status}`,
        status: prediction.status,
      };
    }

    return {
      predictionId: prediction.id,
      status: prediction.status as VideoGenerationResult['status'],
    };

  } catch (error: any) {
    console.error(`${logPrefix} Error starting video generation:`, error.message || error);
    return {
      predictionId: null,
      error: error.message || 'Failed to start video generation',
    };
  }
}

// --- Prediction Status ---
export async function getPredictionStatus(predictionId: string): Promise<PredictionStatusResult> {
  const logPrefix = `[Poll Status ID ${predictionId}]`;
  try {
    const replicate = getReplicateClient();
    // console.log(`${logPrefix} Fetching prediction status...`); // Keep polling logs minimal

    const prediction = await safeReplicateCall(() =>
        replicate.predictions.get(predictionId),
        `Get Prediction Status ${predictionId}`
    );

    let status: PredictionStatusResult['status'] = 'unknown';
    if (['starting', 'processing', 'succeeded', 'failed', 'canceled'].includes(prediction.status)) {
      status = prediction.status as PredictionStatusResult['status'];
    } else {
        console.warn(`${logPrefix} Received unexpected status: ${prediction.status}`);
    }

    // SVD output is typically a direct URL string
    const outputUrl = (prediction.output && typeof prediction.output === 'string' && isValidHttpUrl(prediction.output))
                      ? prediction.output
                      : null; // Null if not a valid URL string

    if (status === 'succeeded' && !outputUrl) {
        console.warn(`${logPrefix} Prediction succeeded but output URL is invalid or missing. Output:`, prediction.output);
    }


    return {
      status: status,
      outputUrl: outputUrl,
      error: prediction.error ? String(prediction.error) : null,
      logs: prediction.logs,
    };

  } catch (error: any) {
    // Don't log the full error message here again, safeReplicateCall already did
    console.error(`${logPrefix} Failed to fetch prediction status.`);
    return {
      status: 'failed', // Assume failure if status check fails
      error: `Failed to fetch prediction status: ${error.message || 'Unknown error'}`,
    };
  }
}

// --- Helper to create basic description ---
// Kept simple as the main context is now in the geminiPrompt
function createPlacementDescription(request: GenerationRequest): string {
  const { scene, product, variationNumber } = request;
  return `Variation ${variationNumber}: ${product.name} in scene ${scene.sceneNumber} (${scene.heading}).`;
}