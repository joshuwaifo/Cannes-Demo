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

const REPLICATE_IMAGE_MODEL = "black-forest-labs/flux-dev-lora";
const REPLICATE_IMAGE_VERSION =
  "6cfd3a89f8a165f6055e013abac527519689b74e3a48851a7c374e113e7ce697";

// UPDATED VIDEO MODEL CONSTANTS
const REPLICATE_VIDEO_MODEL = "wavespeedai/wan-2.1-i2v-480p";
const REPLICATE_VIDEO_VERSION =
  "ea681d183d59e636a8514d08c46a6736f26468c0b583609064e750c94157e8e4"; // Example version

const MAX_PROMPT_LENGTH = 950; // Max length for image prompts, video prompts might have different limits

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

// --- Image Generation ---
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
      scheduler: "euler_a",
      num_inference_steps: 8,
      guidance_scale: 2.5,
    };

    console.log(
      `${logPrefix} Calling Replicate run (${REPLICATE_IMAGE_MODEL}:${REPLICATE_IMAGE_VERSION})...`,
    );

    // Corrected Replicate run call:
    const output: any = await safeReplicateCall(
      () =>
        replicate.run(`${REPLICATE_IMAGE_MODEL}`, {
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

    return { imageUrl: imageUrl, description, success };
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

// --- Video Generation (UPDATED for wavespeedai/wan-2.1-i2v-480p) ---
export async function generateVideoFromVariation(
  variationId: number,
): Promise<VideoGenerationResult> {
  const logPrefix = `[VidGen Var ${variationId}]`;
  try {
    const replicate = getReplicateClient();
    const variation = await storage.getSceneVariationById(variationId);

    if (!variation) throw new Error(`Variation ${variationId} not found.`);
    if (
      !variation.imageUrl ||
      variation.imageUrl === FALLBACK_IMAGE_URL ||
      (!isValidHttpUrl(variation.imageUrl) &&
        !variation.imageUrl.startsWith("data:image/"))
    ) {
      console.error(
        `${logPrefix} Cannot generate video. Invalid, missing, or fallback start image URL: ${variation.imageUrl}`,
      );
      throw new Error(
        `Cannot generate video for Variation ${variationId} due to invalid or missing source image.`,
      );
    }
    if (!variation.geminiPrompt) {
      console.warn(`${logPrefix} Missing Gemini prompt for variation ${variationId}. Using a generic motion prompt.`);
      // Fallback to a generic motion prompt if geminiPrompt is missing, or decide how to handle.
      // For wan-2.1-i2v-480p, the text prompt is optional but can guide motion.
      // If no specific textual guidance, the model will try to animate based on image content.
    }

    const videoPrompt = variation.geminiPrompt || "subtle cinematic motion"; // Use Gemini prompt or a fallback

    // Input parameters for wavespeedai/wan-2.1-i2v-480p
    const input = {
      image: variation.imageUrl,
      prompt: videoPrompt.substring(0, MAX_PROMPT_LENGTH), // Video model might have different prompt length needs
      // negative_prompt: "low quality, blurry, text, watermark, worst quality, lowres", // Optional
      motion_scale: 1.0,      // Default: 1. Adjust for more/less motion.
      cfg_scale: 7.0,         // Default: 7. Guidance scale.
      num_inference_steps: 20,// Default: 20
      fps: 12,                // Default: 12
      num_frames: 81,         // Default: 24 (results in 2s video at 12fps)
      resolution: "480p",     // Default and matches model name
      seed: Math.floor(Math.random() * 4294967295),
    };

    if (videoPrompt.length > MAX_PROMPT_LENGTH) {
      console.warn(
        `${logPrefix} Video prompt truncated to ${MAX_PROMPT_LENGTH} characters.`,
      );
    }

    console.log(
      `${logPrefix} Calling Replicate create prediction for video (${REPLICATE_VIDEO_MODEL}:${REPLICATE_VIDEO_VERSION})...`,
    );
    console.log(`${logPrefix} Input Image URL for video: ${variation.imageUrl.substring(0,100)}...`)

    const prediction = await safeReplicateCall(
      () =>
        replicate.predictions.create({
          version: REPLICATE_VIDEO_MODEL, // Pass only the version hash here
          input: input,
          // webhook: process.env.REPLICATE_WEBHOOK_URL, // Optional webhook
          // webhook_events_filter: ["completed", "failed"], // Optional
        }),
      `Create WAN-2.1 Video Prediction Var ${variationId}`,
    );

    console.log(
      `${logPrefix} Video prediction started. ID: ${prediction.id}, Status: ${prediction.status}`,
    );

    if (prediction.status === "failed" || prediction.status === "canceled") {
      const errMsg = prediction.error
        ? String(prediction.error)
        : `Prediction immediately ${prediction.status}`;
      console.error(
        `${logPrefix} Video prediction failed or canceled on start: ${errMsg}`,
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


// --- Prediction Status ---
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

    let outputUrl: string | null = null;
    if (prediction.output) {
      if (
        Array.isArray(prediction.output) &&
        prediction.output.length > 0 &&
        typeof prediction.output[0] === "string" &&
        isValidHttpUrl(prediction.output[0])
      ) {
        outputUrl = prediction.output[0];
      } else if (
        typeof prediction.output === "string" &&
        isValidHttpUrl(prediction.output)
      ) {
        outputUrl = prediction.output;
      } else {
        console.warn(
          `${logPrefix} Prediction output is present but not a valid URL string or array containing one. Output:`,
          prediction.output,
        );
      }
    }

    if (status === "succeeded" && !outputUrl) {
      console.warn(
        `${logPrefix} Prediction succeeded but valid output URL could not be extracted. Output received:`,
        prediction.output,
      );
    }

    const errorString = prediction.error ? String(prediction.error) : null;

    return {
      status: status,
      outputUrl: outputUrl,
      error: errorString,
      logs: prediction.logs,
    };
  } catch (error: any) {
    console.error(`${logPrefix} Failed to fetch prediction status overall:`, error);
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