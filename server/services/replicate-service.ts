// server/services/replicate-service.ts
import Replicate from "replicate";
import {
  Scene,
  Product,
  SceneVariation,
  ProductCategory,
} from "@shared/schema";
import * as storage from "../storage";
import { Buffer } from "buffer";

// --- Interfaces ---
interface GenerationRequest {
  scene: Scene;
  product: Product;
  variationNumber: number;
  prompt: string;
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
const FALLBACK_IMAGE_URL =
  "https://placehold.co/1024x576/grey/white?text=Image+Gen+Failed";

// New image model - Flux
const REPLICATE_IMAGE_MODEL = "black-forest-labs/flux-dev-lora";
const REPLICATE_IMAGE_VERSION =
  "c1e1c01d94a9281ec65a8e29cb3716e4695b3420daae37c7a9e0dcd36519fc9a";

// New video model - WAN  
const REPLICATE_VIDEO_MODEL = "wavespeedai/wan-2.1-i2v-480p";
const REPLICATE_VIDEO_VERSION =
  "19f0e73c14779211b3c4d95123dbf2dbd5d182801f104a7df9b2a51889614cc2";

const MAX_PROMPT_LENGTH = 950; // Keep prompt length limit

// --- Utilities ---
function isValidHttpUrl(urlString: string): boolean {
  if (!urlString || typeof urlString !== "string") return false;
  try {
    const url = new URL(urlString);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

const getSanitizedImageUrl = (url: string | undefined | null): string => {
  if (!url || typeof url !== "string") return FALLBACK_IMAGE_URL;
  const trimmedUrl = url.trim();
  if (trimmedUrl.startsWith("data:image/")) return trimmedUrl;
  if (isValidHttpUrl(trimmedUrl)) return trimmedUrl;
  console.warn(
    `[Sanitize] URL is not HTTP/HTTPS or Data URI, using fallback: ${trimmedUrl.substring(0, 50)}...`,
  );
  return FALLBACK_IMAGE_URL;
};

function getReplicateClient(): Replicate {
  const apiToken = process.env.REPLICATE_API_TOKEN;
  if (!apiToken) {
    console.error(
      "CRITICAL: REPLICATE_API_TOKEN environment variable is not set.",
    );
    throw new Error("Replicate API token is not configured.");
  }
  return new Replicate({ auth: apiToken });
}

async function safeReplicateCall<T>(
  operation: () => Promise<T>,
  context: string,
): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    const replicateErrorDetail =
      error.response?.data?.detail ||
      error.message ||
      "Unknown Replicate error";
    const statusCode = error.response?.status;
    console.error(
      `Replicate API error during [${context}] (Status: ${statusCode || "N/A"}):`,
      replicateErrorDetail,
    );
    throw new Error(`Replicate failed [${context}]: ${replicateErrorDetail}`);
  }
}

// --- Image Generation (No changes from previous working version) ---
export async function generateProductPlacement(
  request: GenerationRequest,
): Promise<GenerationResult> {
  const { scene, product, variationNumber, prompt } = request;
  const logPrefix = `[ImgGen S${scene.sceneNumber} V${variationNumber} P:${product.id}]`;
  const description = createPlacementDescription(request);

  if (!prompt || typeof prompt !== "string" || prompt.trim().length < 10) {
    console.error(`${logPrefix} Invalid or empty prompt received: "${prompt}"`);
    return {
      imageUrl: FALLBACK_IMAGE_URL,
      description: "Error: Invalid generation prompt.",
      success: false,
    };
  }

  const finalPrompt =
    prompt.length > MAX_PROMPT_LENGTH
      ? prompt.substring(0, MAX_PROMPT_LENGTH) + "..."
      : prompt;
  if (prompt.length > MAX_PROMPT_LENGTH) {
    console.warn(
      `${logPrefix} Prompt truncated to ${MAX_PROMPT_LENGTH} characters.`,
    );
  }

  try {
    const replicate = getReplicateClient();
    console.log(
      `${logPrefix} Using Gemini Prompt (len ${finalPrompt.length}): ${finalPrompt.substring(0, 100)}...`,
    );

    // Get product image URL to use as reference for the Flux model
    if (!product.imageUrl || !isValidHttpUrl(product.imageUrl)) {
      console.error(`${logPrefix} Product ${product.id} has invalid or missing image URL: ${product.imageUrl}`);
      return {
        imageUrl: FALLBACK_IMAGE_URL,
        description: "Generation failed: Missing brand image reference",
        success: false,
      };
    }

    // Prepare input for Flux model
    const input = {
      prompt: finalPrompt,
      negative_prompt: "nsfw, nude, naked, offensive, violence, gore, explicit language, text, words, letters, watermark, signature, blurry, low quality, distorted, deformed, bad anatomy, extra limbs, disfigured, multiple views",
      image: product.imageUrl, // Pass the brand image URL as reference
      width: 1024,
      height: 576,
      num_inference_steps: 30,
      guidance_scale: 7.5,
      num_outputs: 1,
      strength: 0.65, // Control how much influence the reference image has (0.0 to 1.0)
      seed: Math.floor(Math.random() * 2147483647), // Random seed
    };

    console.log(
      `${logPrefix} Calling Flux model (${REPLICATE_IMAGE_MODEL}:${REPLICATE_IMAGE_VERSION}) with product image: ${product.imageUrl.substring(0, 60)}...`,
    );

    const output: any = await safeReplicateCall(
      () =>
        replicate.run(`${REPLICATE_IMAGE_MODEL}:${REPLICATE_IMAGE_VERSION}`, {
          input,
        }),
      `Run Flux Image Model Var ${variationNumber}`,
    );

    let imageUrl: string | undefined;
    let failureReason = "Unexpected output format";

    if (
      output &&
      typeof output === "object" &&
      !Array.isArray(output) &&
      output.error
    ) {
      failureReason = String(output.error);
      console.error(
        `${logPrefix} Replicate run returned an error object:`,
        failureReason,
      );
    } else if (Array.isArray(output) && output.length > 0) {
      const firstItem = output[0];
      if (typeof firstItem === "string" && isValidHttpUrl(firstItem)) {
        imageUrl = firstItem;
      } else if (firstItem instanceof ReadableStream) {
        console.log(
          `${logPrefix} Replicate output is a ReadableStream. Reading data...`,
        );
        try {
          const reader = firstItem.getReader();
          const chunks: Uint8Array[] = [];
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
              chunks.push(value);
            }
          }
          const imageBuffer = Buffer.concat(chunks);
          imageUrl = `data:image/png;base64,${imageBuffer.toString("base64")}`;
          console.log(
            `${logPrefix} Successfully read stream and created base64 data URI.`,
          );
        } catch (streamError: any) {
          console.error(
            `${logPrefix} Error reading Replicate stream:`,
            streamError,
          );
          failureReason = `Error reading output stream: ${streamError.message}`;
          imageUrl = undefined;
        }
      } else if (
        firstItem &&
        typeof firstItem === "object" &&
        firstItem.error
      ) {
        failureReason = String(firstItem.error);
        console.error(
          `${logPrefix} Replicate run returned an array containing an error object:`,
          failureReason,
        );
      } else {
        console.error(
          `${logPrefix} Replicate run returned array with unexpected content type:`,
          typeof firstItem,
        );
      }
    } else {
      console.error(
        `${logPrefix} Replicate run returned unexpected or empty output:`,
        output,
      );
    }

    if (!imageUrl) {
      if (
        failureReason.toLowerCase().includes("safety_checker") ||
        failureReason.toLowerCase().includes("safety filter")
      ) {
        console.warn(`${logPrefix} SAFETY FILTER likely triggered.`);
        return {
          imageUrl: FALLBACK_IMAGE_URL,
          description: "Generation failed due to safety filter.",
          success: false,
        };
      }
      return {
        imageUrl: FALLBACK_IMAGE_URL,
        description: `Generation failed: ${failureReason}`,
        success: false,
      };
    }

    const sanitizedUrl = getSanitizedImageUrl(imageUrl);
    const success = sanitizedUrl !== FALLBACK_IMAGE_URL;
    console.log(
      `${logPrefix} Image generation completed. Success: ${success}. Type: ${imageUrl.startsWith("data:") ? "Data URI" : "URL"}`,
    );

    return { imageUrl: imageUrl, description, success }; // Return original URL/DataURI
  } catch (error: any) {
    console.error(
      `${logPrefix} Overall error during image generation process:`,
      error.message || error,
    );
    return {
      imageUrl: FALLBACK_IMAGE_URL,
      description: `Generation failed: ${error.message}`,
      success: false,
    };
  }
}

// --- Video Generation (UPDATED for WAN 2.1 I2V model) ---
export async function generateVideoFromVariation(
  variationId: number,
): Promise<VideoGenerationResult> {
  const logPrefix = `[VidGen Var ${variationId}]`;
  try {
    const replicate = getReplicateClient();

    // 1. Fetch variation details
    const variation = await storage.getSceneVariationById(variationId);
    if (!variation) throw new Error(`Variation ${variationId} not found.`);
    if (
      !variation.imageUrl ||
      variation.imageUrl === FALLBACK_IMAGE_URL ||
      (!isValidHttpUrl(variation.imageUrl) &&
        !variation.imageUrl.startsWith("data:image/"))
    ) {
      console.error(
        `${logPrefix} Cannot generate video. Invalid, missing, or fallback start image URL.`,
      );
      throw new Error(
        `Cannot generate video for Variation ${variationId} due to invalid or missing source image.`,
      );
    }
    if (!variation.geminiPrompt)
      throw new Error(`Missing Gemini prompt for variation ${variationId}.`);

    const scene = await storage.getSceneById(variation.sceneId);
    if (!scene) throw new Error(`Scene ${variation.sceneId} not found.`);
    const product = await storage.getProductById(variation.productId);
    if (!product) throw new Error(`Product ${variation.productId} not found.`);

    // 2. Create a concise prompt for the WAN model
    // The WAN model uses the image as primary input and the prompt as guidance
    const videoPrompt = variation.geminiPrompt;

    // Prepare a shortened prompt if necessary
    const shortenedPrompt = videoPrompt.length > MAX_PROMPT_LENGTH
      ? videoPrompt.substring(0, MAX_PROMPT_LENGTH) + "..."
      : videoPrompt;

    if (videoPrompt.length > MAX_PROMPT_LENGTH) {
      console.warn(
        `${logPrefix} Video prompt truncated to ${MAX_PROMPT_LENGTH} characters.`,
      );
    }

    // --- WAN 2.1 Model Input Parameters ---
    const input = {
      image: variation.imageUrl, // The generated image to animate
      prompt: shortenedPrompt, // Description for guidance
      video_length: 32, // Number of frames (default for this model)
      sizing_strategy: "maintain_aspect_ratio", // How to handle the image size
      motion_bucket_id: 40, // Controls the amount of motion (0-255), higher = more motion
      negative_prompt: "blurry, distorted, low quality, glitch, text, watermark",
      frames_per_second: 8, // Output video FPS
      seed: Math.floor(Math.random() * 2147483647), // Random seed for deterministic results
    };
    // --- End WAN Parameters ---

    console.log(
      `${logPrefix} Calling WAN 2.1 video generator (${REPLICATE_VIDEO_MODEL}:${REPLICATE_VIDEO_VERSION})...`,
    );
    console.log(
      `${logPrefix} Input Image Type: ${variation.imageUrl.startsWith("data:") ? "Data URI" : "URL"}`,
    );

    // 3. Start prediction job
    const prediction = await safeReplicateCall(
      () =>
        replicate.predictions.create({
          version: `${REPLICATE_VIDEO_MODEL}:${REPLICATE_VIDEO_VERSION}`,
          input: input,
        }),
      `Create WAN Video Prediction for Var ${variationId}`,
    );

    console.log(
      `${logPrefix} Prediction started. ID: ${prediction.id}, Status: ${prediction.status}`,
    );

    if (prediction.status === "failed" || prediction.status === "canceled") {
      const errMsg = prediction.error
        ? String(prediction.error)
        : `Prediction immediately ${prediction.status}`;
      console.error(
        `${logPrefix} Prediction failed or canceled on start: ${errMsg}`,
      );
      return {
        predictionId: prediction.id,
        error: errMsg,
        status: prediction.status,
      };
    }

    return {
      predictionId: prediction.id,
      status: prediction.status as VideoGenerationResult["status"],
    };
  } catch (error: any) {
    console.error(
      `${logPrefix} Error starting video generation process:`,
      error.message || error,
    );
    return {
      predictionId: null,
      error: error.message || "Failed to start video generation",
    };
  }
}

// --- Prediction Status (No changes needed) ---
// export async function getPredictionStatus(predictionId: string): Promise<PredictionStatusResult> {
//   const logPrefix = `[Poll Status ID ${predictionId}]`;
//   try {
//     const replicate = getReplicateClient();
//     // console.log(`${logPrefix} Fetching prediction status...`); // Keep logs minimal

//     const prediction = await safeReplicateCall(() =>
//         replicate.predictions.get(predictionId),
//         `Get Prediction Status ${predictionId}`
//     );

//     let status: PredictionStatusResult['status'] = 'unknown';
//     if (['starting', 'processing', 'succeeded', 'failed', 'canceled'].includes(prediction.status)) {
//       status = prediction.status as PredictionStatusResult['status'];
//     } else {
//         console.warn(`${logPrefix} Received unexpected status from Replicate: ${prediction.status}`);
//     }

//     // LTX output is typically a direct URL string
//     const outputUrl = (prediction.output && typeof prediction.output === 'string' && isValidHttpUrl(prediction.output))
//                       ? prediction.output
//                       : null;

//     if (status === 'succeeded' && !outputUrl) {
//         console.warn(`${logPrefix} Prediction succeeded but output URL is invalid or missing. Output:`, prediction.output);
//     }

//     const errorString = prediction.error ? String(prediction.error) : null;

//     return {
//       status: status,
//       outputUrl: outputUrl,
//       error: errorString,
//       logs: prediction.logs,
//     };

//   } catch (error: any) {
//     console.error(`${logPrefix} Failed to fetch prediction status overall.`);
//     return {
//       status: 'failed',
//       error: `Failed to fetch prediction status: ${error.message || 'Unknown error'}`,
//     };
//   }
// }

export async function getPredictionStatus(
  predictionId: string,
): Promise<PredictionStatusResult> {
  const logPrefix = `[Poll Status ID ${predictionId}]`;
  try {
    const replicate = getReplicateClient();

    const prediction = await safeReplicateCall(
      () => replicate.predictions.get(predictionId),
      `Get Prediction Status ${predictionId}`,
    );

    let status: PredictionStatusResult["status"] = "unknown";
    if (
      ["starting", "processing", "succeeded", "failed", "canceled"].includes(
        prediction.status,
      )
    ) {
      status = prediction.status as PredictionStatusResult["status"];
    } else {
      console.warn(
        `${logPrefix} Received unexpected status from Replicate: ${prediction.status}`,
      );
    }

    // --- UPDATED: Handle WAN 2.1 model output format ---
    let outputUrl: string | null = null;
    if (prediction.output) {
      // Case 1: WAN model typically outputs an object with 'video' property that contains the URL
      if (
        typeof prediction.output === "object" &&
        !Array.isArray(prediction.output) &&
        prediction.output.video &&
        typeof prediction.output.video === "string" &&
        isValidHttpUrl(prediction.output.video)
      ) {
        outputUrl = prediction.output.video;
        console.log(`${logPrefix} Extracted URL from WAN output object video property`);
      }
      // Case 2: Array output (for compatibility with other models)
      else if (
        Array.isArray(prediction.output) &&
        prediction.output.length > 0
      ) {
        const firstItem = prediction.output[0];
        if (typeof firstItem === "string" && isValidHttpUrl(firstItem)) {
          outputUrl = firstItem;
          console.log(`${logPrefix} Extracted URL from array output first element`);
        }
      }
      // Case 3: Direct string URL
      else if (
        typeof prediction.output === "string" &&
        isValidHttpUrl(prediction.output)
      ) {
        outputUrl = prediction.output;
        console.log(`${logPrefix} Extracted direct URL string from output`);
      }
      // Case 4: Unknown format
      else {
        console.warn(
          `${logPrefix} Prediction output is present but not in a recognized format:`,
          typeof prediction.output === 'object' ? JSON.stringify(prediction.output).substring(0, 300) : prediction.output
        );
      }
    }
    // --- END UPDATED ---

    if (status === "succeeded" && !outputUrl) {
      console.warn(
        `${logPrefix} Prediction succeeded but valid output URL could not be extracted.`
      );
      // We'll log the output structure to help diagnose the issue
      if (prediction.output) {
        console.warn(`Output type: ${typeof prediction.output}`);
        if (typeof prediction.output === 'object') {
          console.warn(`Output keys: ${Object.keys(prediction.output).join(', ')}`);
        }
      } else {
        console.warn(`Output is null or undefined`);
      }
    }

    const errorString = prediction.error ? String(prediction.error) : null;

    return {
      status: status,
      outputUrl: outputUrl,
      error: errorString,
      logs: prediction.logs,
    };
  } catch (error: any) {
    console.error(`${logPrefix} Failed to fetch prediction status overall.`);
    return {
      status: "failed",
      error: `Failed to fetch prediction status: ${error.message || "Unknown error"}`,
    };
  }
}

// --- Helper to create basic description ---
function createPlacementDescription(request: GenerationRequest): string {
  const { scene, product, variationNumber } = request;
  return `Variation ${variationNumber}: ${product.name} in scene ${scene.sceneNumber} (${scene.heading}).`;
}

