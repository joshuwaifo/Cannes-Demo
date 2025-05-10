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
const REPLICATE_IMAGE_MODEL = "stability-ai/sdxl";
const REPLICATE_IMAGE_VERSION =
  "c221b2b8ef527988fb59bf24a8b97c4561f1c671f73bd389f866bfb27c061316";
// --- NEW VIDEO MODEL CONSTANTS ---
const REPLICATE_VIDEO_MODEL = "lightricks/ltx-video";
const REPLICATE_VIDEO_VERSION =
  "8c47da666861d081eeb4d1261853087de23923a268a69b63febdf5dc1dee08e4"; // Use LTX version
// const REPLICATE_VIDEO_MODEL = "lightricks/ltx-video";
// const REPLICATE_VIDEO_VERSION = "8c47da666861d081eeb4d1261853087de23923a268a69b63febdf5dc1dee08e4"; // Use LTX version
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

    const input = {
      prompt: finalPrompt,
      negative_prompt:
        "nsfw, nude, naked, offensive, violence, gore, explicit language, text, words, letters, watermark, signature, blurry, low quality, distorted, deformed, bad anatomy, extra limbs, disfigured, multiple views",
      width: 1024,
      height: 576,
      num_outputs: 1,
      scheduler: "K_EULER",
      num_inference_steps: 30,
      guidance_scale: 7,
      refine: "expert_ensemble_refiner",
      refine_steps: 50,
    };

    console.log(
      `${logPrefix} Calling Replicate run (${REPLICATE_IMAGE_MODEL}:${REPLICATE_IMAGE_VERSION})...`,
    );

    const output: any = await safeReplicateCall(
      () =>
        replicate.run(`${REPLICATE_IMAGE_MODEL}:${REPLICATE_IMAGE_VERSION}`, {
          input,
        }),
      `Run Image Model Var ${variationNumber}`,
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

// --- Video Generation (UPDATED for LTX Model) ---
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

    const scene = await storage.getSceneById(variation.sceneId); // Keep for context if needed
    if (!scene) throw new Error(`Scene ${variation.sceneId} not found.`);
    const product = await storage.getProductById(variation.productId);
    if (!product) throw new Error(`Product ${variation.productId} not found.`);

    // 2. Construct LTX video prompt (focus on text prompt, image is separate input)
    // Use the detailed Gemini prompt as the main textual guidance.
    const ltxPrompt = variation.geminiPrompt;

    // --- LTX Model Input Parameters ---
    const input = {
      image_input: variation.imageUrl, // Use the generated image (URL or Data URI)
      prompt: ltxPrompt.substring(0, MAX_PROMPT_LENGTH), // Main creative direction
      style: "cinematic", // LTX specific: choose style ('cinematic', 'realistic', 'anime', etc.)
      camera_control: "none", // LTX specific: 'none', 'pan_right', 'zoom_in', etc.
      motion_control: "gentle_subtle_ambient", // LTX specific: 'gentle_wind', 'camera_shake', 'static', etc. Choose one that fits.
      duration_seconds: 3, // LTX specific: duration
      seed: Math.floor(Math.random() * 4294967295), // Standard 32-bit seed
      // negative_prompt: "low quality, blurry, text, watermark", // LTX also supports negative prompts
      // aspect_ratio: "16:9", // LTX might infer or require this
    };
    // --- End LTX Parameters ---

    if (ltxPrompt.length > MAX_PROMPT_LENGTH) {
      console.warn(
        `${logPrefix} LTX prompt truncated to ${MAX_PROMPT_LENGTH} characters.`,
      );
    }

    console.log(
      `${logPrefix} Calling Replicate create prediction (${REPLICATE_VIDEO_MODEL}:${REPLICATE_VIDEO_VERSION})...`,
    );
    console.log(
      `${logPrefix} Start Image Type: ${variation.imageUrl.startsWith("data:") ? "Data URI" : "URL"}`,
    );
    // console.log(`${logPrefix} LTX Input Payload:`, JSON.stringify(input, null, 2)); // Debug if needed

    // 3. Start prediction job
    const prediction = await safeReplicateCall(
      () =>
        replicate.predictions.create({
          version: `${REPLICATE_VIDEO_MODEL}:${REPLICATE_VIDEO_VERSION}`, // REPLICATE_VIDEO_VERSION, // Use LTX version
          input: input,
          // webhook: process.env.REPLICATE_WEBHOOK_URL,
          // webhook_events_filter: ["completed", "failed"]
        }),
      `Create LTX Video Prediction Var ${variationId}`,
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

    // --- MODIFIED: Handle Array Output ---
    let outputUrl: string | null = null;
    if (prediction.output) {
      if (
        Array.isArray(prediction.output) &&
        prediction.output.length > 0 &&
        typeof prediction.output[0] === "string" &&
        isValidHttpUrl(prediction.output[0])
      ) {
        // If it's an array with a valid URL string as the first element
        outputUrl = prediction.output[0];
        // console.log(`${logPrefix} Extracted URL from array output: ${outputUrl.substring(0, 60)}...`); // Optional debug log
      } else if (
        typeof prediction.output === "string" &&
        isValidHttpUrl(prediction.output)
      ) {
        // Handle direct string URL output (fallback for other models potentially)
        outputUrl = prediction.output;
      } else {
        // Log if output is present but not in expected format (array or string)
        console.warn(
          `${logPrefix} Prediction output is present but not a valid URL string or array containing one. Output:`,
          prediction.output,
        );
      }
    }
    // --- END MODIFIED ---

    if (status === "succeeded" && !outputUrl) {
      // This warning might still trigger if the URL in the array is somehow invalid, but less likely now.
      console.warn(
        `${logPrefix} Prediction succeeded but valid output URL could not be extracted. Output received:`,
        prediction.output,
      );
      // Optionally update status to failed if URL is critical for success state
      // status = 'failed';
      // prediction.error = prediction.error || "Prediction succeeded but output URL is invalid or missing.";
    }

    const errorString = prediction.error ? String(prediction.error) : null;

    return {
      status: status,
      outputUrl: outputUrl, // Send the extracted URL
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

