// // server/services/file-upload-service.ts
// import {
//   GoogleGenerativeAI,
//   HarmCategory,
//   HarmBlockThreshold,
//   GenerationConfig,
//   Part,
// } from "@google/generative-ai";
// import * as fs from "fs";
// import path from "path";
// import os from "os";
// import { v4 as uuidv4 } from "uuid";
// import pdfParse from "./pdf-parse-wrapper";
// import { ProductCategory, Scene, Product } from "@shared/schema";

// // --- Utility to Sanitize Text for Safety Filters ---
// export function sanitizeForSafetyFilter(text: string): string {
//   if (!text) return "";
//   const profanityMap: Record<string, string> = {
//     shit: "stuff",
//     damn: "darn",
//     "fuckin'": "really",
//     fucking: "really",
//     hell: "heck",
//   };
//   let sanitized = text;
//   for (const word in profanityMap) {
//     const regex = new RegExp(`\\b${word}\\b`, "gi");
//     sanitized = sanitized.replace(regex, profanityMap[word]);
//   }
//   sanitized = sanitized.replace(/\u0000/g, "");
//   return sanitized;
// }

// // --- Gemini Client Initialization ---
// let genAIInstance: GoogleGenerativeAI | null = null;
// let geminiSafetySettings: any[] | null = null;

// function initializeGeminiClient() {
//   if (genAIInstance && geminiSafetySettings) {
//     return { genAI: genAIInstance, safetySettings: geminiSafetySettings };
//   }
//   const apiKey = process.env.GEMINI_API_KEY;
//   if (!apiKey) {
//     console.error("CRITICAL: GEMINI_API_KEY environment variable is not set");
//     throw new Error("GEMINI_API_KEY environment variable is not set");
//   }
//   genAIInstance = new GoogleGenerativeAI(apiKey);
//   geminiSafetySettings = [
//     {
//       category: HarmCategory.HARM_CATEGORY_HARASSMENT,
//       threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
//     },
//     {
//       category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
//       threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
//     },
//     {
//       category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
//       threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
//     },
//     {
//       category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
//       threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
//     },
//   ];
//   return { genAI: genAIInstance, safetySettings: geminiSafetySettings };
// }

// // --- File Handling Utilities ---
// async function bufferToTempFile(
//   buffer: Buffer,
//   extension: string,
// ): Promise<string> {
//   const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "vadis-"));
//   const tempFileName = `${uuidv4()}${extension}`;
//   const tempFilePath = path.join(tempDir, tempFileName);
//   try {
//     await fs.promises.writeFile(tempFilePath, buffer);
//     return tempFilePath;
//   } catch (err) {
//     console.error(`Error writing temp file ${tempFilePath}:`, err);
//     try {
//       await fs.promises.rm(tempDir, { recursive: true, force: true });
//     } catch {}
//     throw err;
//   }
// }

// function fileToGenerativePart(filePath: string, mimeType: string): Part {
//   try {
//     const fileData = fs.readFileSync(filePath);
//     return { inlineData: { data: fileData.toString("base64"), mimeType } };
//   } catch (error) {
//     console.error(`Error reading file ${filePath} for generative part:`, error);
//     throw new Error(`Could not read file: ${filePath}`);
//   }
// }

// async function cleanupTempFile(filePath: string) {
//   try {
//     const dirPath = path.dirname(filePath);
//     await fs.promises.unlink(filePath);
//     await fs.promises.rmdir(dirPath).catch(() => {});
//   } catch (cleanupErr) {
//     console.warn(`Failed to clean up temp file ${filePath}:`, cleanupErr);
//   }
// }

// // --- Text Extraction ---
// export async function extractTextFromImage(
//   imageBuffer: Buffer,
//   mimeType: string,
// ): Promise<string> {
//   let imagePath: string | null = null;
//   try {
//     const extension =
//       mimeType.includes("jpeg") || mimeType.includes("jpg") ? ".jpg" : ".png";
//     imagePath = await bufferToTempFile(imageBuffer, extension);
//     const { genAI, safetySettings } = initializeGeminiClient();
//     const model = genAI.getGenerativeModel({
//       model: "gemini-1.5-flash",
//       safetySettings,
//     });
//     const imagePart = fileToGenerativePart(imagePath, mimeType);
//     const prompt =
//       "Extract all text content from this image. If it appears to be a film script or screenplay, format it properly with scene headings, action, and dialogue. If no text is visible, describe the image.";
//     const result = await model.generateContent([prompt, imagePart]);
//     const response = await result.response;
//     console.log("Successfully extracted text from image via Gemini.");
//     return response.text();
//   } catch (error) {
//     console.error("Error extracting text from image with Gemini:", error);
//     return `Error: Failed to extract text from image. ${error instanceof Error ? error.message : "Unknown Gemini error"}`;
//   } finally {
//     if (imagePath) await cleanupTempFile(imagePath);
//   }
// }

// export async function extractTextFromPdf(pdfBuffer: Buffer): Promise<string> {
//   try {
//     const pdfData = await pdfParse(pdfBuffer);
//     const extractedText = pdfData?.text || "";
//     if (extractedText.length > 100) {
//       console.log("Successfully extracted text from PDF using pdf-parse.");
//       return extractedText;
//     }
//     console.log(
//       "pdf-parse extraction insufficient, trying Gemini AI for enhancement...",
//     );
//     const { genAI, safetySettings } = initializeGeminiClient();
//     const model = genAI.getGenerativeModel({
//       model: "gemini-1.5-flash",
//       safetySettings,
//     });
//     const prompt = `The following text was extracted from a PDF, but might be incomplete or badly formatted. Please analyze it. If it appears to be a film script or screenplay, reformat it accurately with scene headings (INT./EXT.), action lines, character names (centered), and dialogue. If it's not a script, simply clean up the formatting for readability. Preserve as much original content as possible. Extracted Text: --- ${extractedText.substring(0, 25000)} --- Formatted Output:`;
//     const result = await model.generateContent(prompt);
//     console.log("Successfully enhanced/extracted PDF text using Gemini AI.");
//     return result.response.text();
//   } catch (error) {
//     console.error("Error processing PDF with pdf-parse and/or Gemini:", error);
//     return `Error: Failed to process PDF. ${error instanceof Error ? error.message : "Unknown processing error"}`;
//   }
// }

// // --- Brandable Scene Analysis ---
// interface BrandableSceneAnalysis {
//   sceneId: number;
//   reason: string;
//   suggestedProducts: ProductCategory[];
// }
// export interface AIAnalysisResponseForRoutes {
//   brandableScenes: BrandableSceneAnalysis[];
// }

// export async function identifyBrandableScenesWithGemini(
//   scenes: Scene[],
//   targetBrandableSceneCount: number = 5,
// ): Promise<AIAnalysisResponseForRoutes> {
//   if (!scenes || scenes.length === 0) {
//     console.log("[Gemini Analysis] No scenes provided for analysis.");
//     return { brandableScenes: [] };
//   }
//   console.log(
//     `[Gemini Analysis] Analyzing ${scenes.length} scenes for ${targetBrandableSceneCount} brandable candidates...`,
//   );
//   try {
//     const { genAI, safetySettings } = initializeGeminiClient();
//     const model = genAI.getGenerativeModel({
//       model: "gemini-1.5-flash",
//       safetySettings,
//       generationConfig: {
//         responseMimeType: "application/json",
//         temperature: 0.3,
//         maxOutputTokens: 4096,
//       } as GenerationConfig,
//     });
//     const scenesTextForPrompt = scenes
//       .map((scene) => {
//         const safeHeading = sanitizeForSafetyFilter(scene.heading);
//         const safeContent = sanitizeForSafetyFilter(
//           scene.content.substring(0, 500),
//         );
//         return `SCENE_ID: ${scene.id}\nHEADING: ${safeHeading}\nCONTENT_SNIPPET: ${safeContent}...\n---`;
//       })
//       .join("\n");
//     const prompt = `You are an expert film production assistant specializing in identifying product placement opportunities. TASK: Analyze the following screenplay scene summaries. Identify exactly ${targetBrandableSceneCount} scenes that offer the MOST promising and natural opportunities for integrating branded products. SELECTION CRITERIA: Visual Clarity, Natural Integration, Context Relevance, Sufficient Detail, Safety. RESPONSE FORMAT: Return ONLY a valid JSON object. The JSON object must have a single key "brandableScenes". The value of "brandableScenes" must be an array of objects. Each object MUST contain keys: "sceneId" (number), "reason" (string), "suggestedProducts" (array of 1-3 categories from: ${Object.values(ProductCategory).join(", ")}). Example: { "sceneId": 123, "reason": "Characters eating breakfast.", "suggestedProducts": ["FOOD", "BEVERAGE"] }. Do NOT include any text before or after the JSON object. SCREENPLAY SCENES: --- ${scenesTextForPrompt} ---`;
//     console.log("[Gemini Analysis] Sending request to Gemini...");
//     const result = await model.generateContent(prompt);
//     const responseText = result.response.text();
//     try {
//       const parsedResponse: { brandableScenes?: BrandableSceneAnalysis[] } =
//         JSON.parse(responseText);
//       if (
//         !parsedResponse.brandableScenes ||
//         !Array.isArray(parsedResponse.brandableScenes)
//       ) {
//         console.error(
//           "[Gemini Analysis] Response not in expected format. Raw:",
//           responseText,
//         );
//         return { brandableScenes: [] };
//       }
//       const sceneIdMap = new Map(scenes.map((s) => [s.id, true]));
//       const validCategories = new Set(Object.values(ProductCategory));
//       const validatedBrandableScenes = parsedResponse.brandableScenes
//         .filter((bs, index) => {
//           const sceneId =
//             typeof bs.sceneId === "string"
//               ? parseInt(bs.sceneId, 10)
//               : bs.sceneId;
//           if (isNaN(sceneId) || !sceneIdMap.has(sceneId)) {
//             console.warn(
//               `[Gemini Val] Invalid sceneId ${bs.sceneId} at ${index}.`,
//             );
//             return false;
//           }
//           if (typeof bs.reason !== "string" || bs.reason.length < 10) {
//             console.warn(
//               `[Gemini Val] Invalid reason for ${sceneId} at ${index}.`,
//             );
//             return false;
//           }
//           if (
//             !Array.isArray(bs.suggestedProducts) ||
//             bs.suggestedProducts.length === 0 ||
//             bs.suggestedProducts.length > 3
//           ) {
//             console.warn(
//               `[Gemini Val] Invalid suggestedProducts for ${sceneId} at ${index}.`,
//             );
//             return false;
//           }
//           if (
//             !bs.suggestedProducts.every((p) =>
//               validCategories.has(p as ProductCategory),
//             )
//           ) {
//             console.warn(
//               `[Gemini Val] Invalid category in suggestedProducts for ${sceneId} at ${index}.`,
//             );
//             return false;
//           }
//           bs.sceneId = sceneId;
//           bs.suggestedProducts = bs.suggestedProducts.filter((p) =>
//             validCategories.has(p as ProductCategory),
//           );
//           return true;
//         })
//         .slice(0, targetBrandableSceneCount);
//       console.log(
//         `[Gemini Analysis] Identified ${validatedBrandableScenes.length} valid brandable scenes.`,
//       );
//       return { brandableScenes: validatedBrandableScenes };
//     } catch (parseError) {
//       console.error(
//         "[Gemini Analysis] Failed to parse JSON:",
//         parseError,
//         "\nRaw:",
//         responseText,
//       );
//       return { brandableScenes: [] };
//     }
//   } catch (error: any) {
//     console.error(
//       "[Gemini Analysis] Error analyzing scenes:",
//       error.message || error,
//     );
//     return { brandableScenes: [] };
//   }
// }

// // --- Creative Prompt Generation ---
// export async function generateCreativePlacementPrompt(
//   scene: Scene,
//   product: Product,
// ): Promise<string> {
//   const logPrefix = `[Gemini Creative S:${scene.sceneNumber}/P:${product.id}]`;
//   console.log(`${logPrefix} Generating prompt...`);
//   const safeHeadingFallback = sanitizeForSafetyFilter(scene.heading);
//   const fallbackPrompt = `Cinematic film still, ${safeHeadingFallback}. A ${product.name} is naturally integrated into the scene. Photorealistic, high detail.`;
//   try {
//     const { genAI, safetySettings } = initializeGeminiClient();
//     const model = genAI.getGenerativeModel({
//       model: "gemini-1.5-flash",
//       safetySettings,
//       generationConfig: {
//         responseMimeType: "text/plain",
//         temperature: 0.7,
//         maxOutputTokens: 150,
//         stopSequences: ["\n\n", "---"],
//       } as GenerationConfig,
//     });
//     const safeSceneContextSummary = sanitizeForSafetyFilter(
//       scene.content?.substring(0, 500) || "No scene content provided.",
//     );
//     const safeHeading = sanitizeForSafetyFilter(scene.heading);
//     const safeReason = sanitizeForSafetyFilter(scene.brandableReason || "N/A");
//     const promptToGemini = `Act as a creative director for film product placement. Generate a single, descriptive, visually rich prompt (max 100 tokens) for an AI image generator. The prompt must depict the SCENE CONTEXT (Heading: ${safeHeading}, Summary: ${safeSceneContextSummary}..., Brandable Reason: ${safeReason}) and naturally incorporate the PRODUCT (${product.name}, Category: ${product.category}, Brand: ${product.companyName}). Emphasize photorealism, cinematic lighting, high detail. Ensure natural integration. Adhere to ~100 token limit. IMPORTANT: Maintain a neutral, professional tone. Avoid violence, explicit language, or controversial elements. Focus on visual composition. OUTPUT: Respond ONLY with the generated prompt text. No introductions, explanations, or formatting. Start directly with the prompt.`;
//     // console.log(`${logPrefix} Prompting Gemini...`); // Less verbose
//     const result = await model.generateContent(promptToGemini);
//     let generatedPrompt = result.response
//       .text()
//       .trim()
//       .replace(/^["']|["']$/g, "")
//       .replace(/^Prompt:\s*/i, "")
//       .split("\n")[0];
//     if (!generatedPrompt) {
//       console.warn(`${logPrefix} Empty prompt. Using fallback.`);
//       return fallbackPrompt;
//     }
//     const approxTokens = generatedPrompt.split(/\s+/).filter(Boolean).length;
//     if (approxTokens > 110) {
//       console.warn(
//         `${logPrefix} Prompt too long (${approxTokens} words), truncating.`,
//       );
//       generatedPrompt =
//         generatedPrompt.split(/\s+/).slice(0, 100).join(" ") + "...";
//     }
//     console.log(
//       `${logPrefix} Received prompt: ${generatedPrompt.substring(0, 100)}...`,
//     );
//     return generatedPrompt;
//   } catch (error: any) {
//     console.error(`${logPrefix} Failed to generate creative prompt:`, error);
//     console.warn(`${logPrefix} Using fallback due to error.`);
//     return fallbackPrompt;
//   }
// }

// // --- Character Extraction with Gemini (includes age estimation) ---
// export interface ExtractedCharacter {
//   name: string;
//   estimatedAgeRange?: string; // New field for estimated age
// }

// interface GeminiCharacterResponse {
//   characters: ExtractedCharacter[];
// }

// export async function extractCharactersWithGemini(
//   scriptContent: string,
// ): Promise<ExtractedCharacter[]> {
//   if (!scriptContent || scriptContent.trim().length < 50) {
//     console.log(
//       "[Gemini Characters] Script content is too short or empty. Skipping character extraction.",
//     );
//     return [];
//   }

//   const logPrefix = "[Gemini Characters]";
//   console.log(
//     `${logPrefix} Starting character extraction and age estimation from script (length: ${scriptContent.length}).`,
//   );

//   try {
//     const { genAI, safetySettings } = initializeGeminiClient();
//     const model = genAI.getGenerativeModel({
//       model: "gemini-1.5-flash",
//       safetySettings,
//       generationConfig: {
//         responseMimeType: "application/json",
//         temperature: 0.1,
//         maxOutputTokens: 8192,
//       } as GenerationConfig,
//     });

//     const maxScriptCharsForPrompt = 650000;
//     const scriptContentForPrompt =
//       scriptContent.length > maxScriptCharsForPrompt
//         ? scriptContent.substring(0, maxScriptCharsForPrompt) +
//           "\n...[TRUNCATED FOR PROMPT]..."
//         : scriptContent;

//     const prompt = `
//     You are an expert script analyst. Your task is to analyze the provided screenplay content and extract all unique speaking character names, along with an estimated age or age range for each character.

//     Instructions:
//     1.  Carefully read the screenplay. Identify names that are clearly designated as characters (typically ALL CAPS before dialogue or described in action lines).
//     2.  For each identified character, estimate their age or an age range (e.g., "25-30", "teenager", "early 40s", "senior", "around 50"). Base this estimation on their dialogue, actions, relationships, and context within the script. If age is explicitly stated, use that. If it's ambiguous, provide a reasonable estimate or state "Adult" or "Unclear".
//     3.  The list of characters must be unique. Do not repeat names.
//     4.  Exclude common non-character, all-caps elements (V.O., O.S., CONT'D, scene headings, parentheticals, sound effects).
//     5.  Focus on names that would appear in a cast list. Character names are typically short (1-3 words).
//     6.  Return the result STRICTLY as a single JSON object. This JSON object must have a single key "characters".
//     7.  The value of "characters" must be an array of objects. Each object MUST have "name" (string, ALL CAPS) and "estimatedAgeRange" (string).
//     8.  If no distinct characters are found, return an empty array for "characters".
//     9.  Do NOT include any explanatory text, markdown formatting, or anything else before or after the JSON object.

//     Example of desired JSON output:
//     {
//       "characters": [
//         {"name": "JOHN", "estimatedAgeRange": "30-35"},
//         {"name": "MARY", "estimatedAgeRange": "late 20s"},
//         {"name": "DR. SMITH", "estimatedAgeRange": "around 50"}
//       ]
//     }

//     Screenplay Content to Analyze:
//     ---
//     ${scriptContentForPrompt}
//     ---
//     JSON Output:
//     `;

//     // console.log(`${logPrefix} Sending request to Gemini for character extraction & age estimation...`); // Less verbose
//     const result = await model.generateContent(prompt);
//     const response = await result.response;
//     const responseText = response.text();

//     try {
//       const parsedResponse: GeminiCharacterResponse = JSON.parse(responseText);

//       if (
//         !parsedResponse.characters ||
//         !Array.isArray(parsedResponse.characters)
//       ) {
//         console.error(
//           `${logPrefix} Gemini response is not in the expected format. Raw text:`,
//           responseText,
//         );
//         return [];
//       }

//       const extractedCharacters = parsedResponse.characters
//         .map((charObj) => ({
//           name: (charObj.name || "").toString().trim().toUpperCase(),
//           estimatedAgeRange: (charObj.estimatedAgeRange || "Unclear")
//             .toString()
//             .trim(),
//         }))
//         .filter(
//           (charObj) =>
//             charObj.name && charObj.name.length > 1 && charObj.name.length < 50,
//         )
//         .filter(
//           (charObj, index, self) =>
//             self.findIndex((c) => c.name === charObj.name) === index,
//         );

//       console.log(
//         `${logPrefix} Successfully extracted ${extractedCharacters.length} unique characters with age estimates.`,
//       );
//       return extractedCharacters;
//     } catch (parseError) {
//       console.error(
//         `${logPrefix} Failed to parse Gemini JSON response for characters:`,
//         parseError,
//         "\nRaw Response Text:",
//         responseText,
//       );
//       if (!responseText.trim().startsWith("{")) {
//         const lines = responseText.split("\n").map((l) =>
//           l
//             .trim()
//             .toUpperCase()
//             .replace(/[^A-Z0-9\s'-]/g, ""),
//         );
//         const potentialChars = lines.filter(
//           (l) =>
//             l &&
//             l.length > 1 &&
//             l.length < 50 &&
//             !l.startsWith("SCENE") &&
//             !l.startsWith("INT") &&
//             !l.startsWith("EXT"),
//         );
//         if (potentialChars.length > 0) {
//           console.warn(
//             `${logPrefix} Attempting fallback text parsing for characters (no age).`,
//           );
//           return potentialChars
//             .map((name) => ({ name, estimatedAgeRange: "Unclear" }))
//             .filter(
//               (charObj, index, self) =>
//                 self.findIndex((c) => c.name === charObj.name) === index,
//             );
//         }
//       }
//       return [];
//     }
//   } catch (error: any) {
//     console.error(
//       `${logPrefix} Error extracting characters with Gemini:`,
//       error.message || error,
//     );
//     if (error.response && error.response.data) {
//       console.error(
//         `${logPrefix} Gemini API error details:`,
//         error.response.data,
//       );
//     }
//     return [];
//   }
// }

// server/services/file-upload-service.ts
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
  GenerationConfig,
  Part,
} from "@google/generative-ai";
import * as fs from "fs";
import path from "path";
import os from "os";
import { v4 as uuidv4 } from "uuid";
import pdfParse from "./pdf-parse-wrapper";
import { ProductCategory, Scene, Product } from "@shared/schema";
// --- MODIFIED: Import ScriptCharacter type from client types as it's now richer ---
import { ScriptCharacter } from "../../../client/src/lib/types";


// --- Utility to Sanitize Text for Safety Filters ---
export function sanitizeForSafetyFilter(text: string): string {
  if (!text) return "";
  // Basic profanity replacement - expand as needed
  const profanityMap: Record<string, string> = {
    shit: "stuff",
    damn: "darn",
    "fuckin'": "really",
    fucking: "really",
    fuck: "forget", // Softer replacement
    hell: "heck",
    // Add more common variations or sensitive terms if needed
  };
  let sanitized = text;
  for (const word in profanityMap) {
    // Use word boundaries to avoid replacing parts of words (e.g., 'hell' in 'hello')
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    sanitized = sanitized.replace(regex, profanityMap[word]);
  }
  // Remove null characters which can cause issues
  sanitized = sanitized.replace(/\u0000/g, "");
  return sanitized;
}

// --- Gemini Client Initialization ---
let genAIInstance: GoogleGenerativeAI | null = null;
let geminiSafetySettings: any[] | null = null;

function initializeGeminiClient() {
  if (genAIInstance && geminiSafetySettings) {
    return { genAI: genAIInstance, safetySettings: geminiSafetySettings };
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("CRITICAL: GEMINI_API_KEY environment variable is not set");
    throw new Error("GEMINI_API_KEY environment variable is not set");
  }
  genAIInstance = new GoogleGenerativeAI(apiKey);
  geminiSafetySettings = [
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
  ];
  return { genAI: genAIInstance, safetySettings: geminiSafetySettings };
}

// --- File Handling Utilities ---
async function bufferToTempFile(
  buffer: Buffer,
  extension: string,
): Promise<string> {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "vadis-"));
  const tempFileName = `${uuidv4()}${extension}`;
  const tempFilePath = path.join(tempDir, tempFileName);
  try {
    await fs.promises.writeFile(tempFilePath, buffer);
    return tempFilePath;
  } catch (err) {
    console.error(`Error writing temp file ${tempFilePath}:`, err);
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch {} // Attempt to clean up directory even if file write failed
    throw err;
  }
}

function fileToGenerativePart(filePath: string, mimeType: string): Part {
  try {
    const fileData = fs.readFileSync(filePath);
    return { inlineData: { data: fileData.toString("base64"), mimeType } };
  } catch (error) {
    console.error(`Error reading file ${filePath} for generative part:`, error);
    throw new Error(`Could not read file: ${filePath}`);
  }
}

async function cleanupTempFile(filePath: string) {
  try {
    const dirPath = path.dirname(filePath);
    await fs.promises.unlink(filePath);
    // Try to remove the directory. This might fail if other operations are pending.
    await fs.promises.rmdir(dirPath).catch(() => {
      // console.warn(`Could not immediately remove temp directory ${dirPath}, it might be cleaned up later.`);
    });
  } catch (cleanupErr) {
    console.warn(`Failed to clean up temp file ${filePath}:`, cleanupErr);
  }
}

// --- Text Extraction ---
export async function extractTextFromImage(
  imageBuffer: Buffer,
  mimeType: string,
): Promise<string> {
  let imagePath: string | null = null;
  try {
    const extension =
      mimeType.includes("jpeg") || mimeType.includes("jpg") ? ".jpg" : ".png";
    imagePath = await bufferToTempFile(imageBuffer, extension);
    const { genAI, safetySettings } = initializeGeminiClient();
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash", // Using "gemini-1.5-flash"
      safetySettings,
    });
    const imagePart = fileToGenerativePart(imagePath, mimeType);
    const prompt =
      "Extract all text content from this image. If it appears to be a film script or screenplay, format it properly with scene headings, action, and dialogue. If no text is visible, describe the image.";
    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    console.log("Successfully extracted text from image via Gemini AI");
    return response.text();
  } catch (error) {
    console.error("Error extracting text from image with Gemini:", error);
    return `Error: Failed to extract text from image. ${error instanceof Error ? error.message : "Unknown Gemini error"}`;
  } finally {
    if (imagePath) await cleanupTempFile(imagePath);
  }
}

export async function extractTextFromPdf(pdfBuffer: Buffer): Promise<string> {
  try {
    const pdfData = await pdfParse(pdfBuffer); // Using the wrapper
    const extractedText = pdfData?.text || "";

    if (extractedText.length > 100) {
      console.log("Successfully extracted text from PDF using pdf-parse.");
      return extractedText; // Return if pdf-parse was successful
    }

    // If pdf-parse result is too short, try Gemini (Vision model for PDFs is gemini-pro-vision)
    // For pure text extraction and reformatting from potentially garbled text, gemini-flash is fine.
    console.log(
      "pdf-parse extraction insufficient or empty, trying Gemini AI for enhancement/extraction...",
    );
    const { genAI, safetySettings } = initializeGeminiClient();
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash", // Use flash for text processing
      safetySettings,
    });

    // Construct a prompt that guides Gemini to reformat or extract from potentially garbled text
    const prompt = `The following text was extracted from a PDF, but might be incomplete or badly formatted. Please analyze it. If it appears to be a film script or screenplay, reformat it accurately with scene headings (INT./EXT.), action lines, character names (centered), and dialogue. If it's not a script, simply clean up the formatting for readability. Preserve as much original content as possible. If the input text is very short or nonsensical, indicate that no meaningful script content could be derived.

    Extracted Text:
    ---
    ${extractedText.substring(0, 25000)} 
    ---

    Formatted Output:`;

    const result = await model.generateContent(prompt);
    console.log("Successfully enhanced/extracted PDF text using Gemini AI.");
    return result.response.text();
  } catch (error) {
    console.error("Error processing PDF with pdf-parse and/or Gemini:", error);
    return `Error: Failed to process PDF. ${error instanceof Error ? error.message : "Unknown processing error"}`;
  }
}

// --- Brandable Scene Analysis ---
interface BrandableSceneAnalysis {
  sceneId: number;
  reason: string;
  suggestedProducts: ProductCategory[];
}
export interface AIAnalysisResponseForRoutes {
  brandableScenes: BrandableSceneAnalysis[];
}

export async function identifyBrandableScenesWithGemini(
  scenes: Scene[],
  targetBrandableSceneCount: number = 5,
): Promise<AIAnalysisResponseForRoutes> {
  if (!scenes || scenes.length === 0) {
    console.log("[Gemini Analysis] No scenes provided for analysis.");
    return { brandableScenes: [] };
  }
  console.log(
    `[Gemini Analysis] Analyzing ${scenes.length} scenes for ${targetBrandableSceneCount} brandable candidates...`,
  );

  try {
    const { genAI, safetySettings } = initializeGeminiClient();
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash", // Using flash for this task
      safetySettings,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.3, // Lower temperature for more deterministic output
        maxOutputTokens: 4096, // Adjust as needed
      } as GenerationConfig, // Cast to GenerationConfig for responseMimeType
    });

    const scenesTextForPrompt = scenes
      .map((scene) => {
        const safeHeading = sanitizeForSafetyFilter(scene.heading);
        const safeContent = sanitizeForSafetyFilter(
          scene.content.substring(0, 500), // Limit snippet length
        ); // Sanitize content
        return `SCENE_ID: ${scene.id}\nHEADING: ${safeHeading}\nCONTENT_SNIPPET: ${safeContent}...\n---`;
      })
      .join("\n");

    const prompt = `You are an expert film production assistant specializing in identifying product placement opportunities.
TASK: Analyze the following screenplay scene summaries. Identify exactly ${targetBrandableSceneCount} scenes that offer the MOST promising and natural opportunities for integrating branded products.
SELECTION CRITERIA:
- Visual Clarity: Scenes with clear visual settings where products can be naturally seen.
- Natural Integration: Opportunities where a product would not feel forced or out of place.
- Context Relevance: Product categories should align with the scene's context (e.g., food in a kitchen, car in a driving scene).
- Sufficient Detail: Scenes described with enough detail to imagine a product placement.
- Safety: Avoid scenes with overtly negative connotations for product association (e.g., extreme violence directly involving the product type, drug use).
RESPONSE FORMAT: Return ONLY a valid JSON object. The JSON object must have a single key "brandableScenes". The value of "brandableScenes" must be an array of objects. Each object MUST contain keys: "sceneId" (number, corresponding to SCENE_ID provided), "reason" (string, concise explanation of why it's brandable), "suggestedProducts" (array of 1-3 product categories from: ${Object.values(ProductCategory).join(", ")}).
Example: { "brandableScenes": [ { "sceneId": 123, "reason": "Characters are shown eating breakfast in a diner setting, offering clear views of table items.", "suggestedProducts": ["FOOD", "BEVERAGE"] } ] }
Do NOT include any text before or after the JSON object. Ensure the response is a single, clean JSON.

SCREENPLAY SCENES:
---
${scenesTextForPrompt}
---
JSON Output:`;

    console.log(
      "[Gemini Analysis] Sending request to Gemini for brandable scenes...",
    );
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Attempt to parse the JSON response
    try {
      const parsedResponse: { brandableScenes?: BrandableSceneAnalysis[] } =
        JSON.parse(responseText);
      if (
        !parsedResponse.brandableScenes ||
        !Array.isArray(parsedResponse.brandableScenes)
      ) {
        console.error(
          "[Gemini Analysis] Gemini response not in expected JSON format. Raw response:",
          responseText,
        );
        return { brandableScenes: [] }; // Return empty if format is wrong
      }

      // Validate the content of the parsed response
      const sceneIdMap = new Map(scenes.map((s) => [s.id, true]));
      const validCategories = new Set(Object.values(ProductCategory));

      const validatedBrandableScenes = parsedResponse.brandableScenes
        .filter((bs, index) => {
          const sceneId =
            typeof bs.sceneId === "string"
              ? parseInt(bs.sceneId, 10)
              : bs.sceneId;
          if (isNaN(sceneId) || !sceneIdMap.has(sceneId)) {
            console.warn(
              `[Gemini Val] Invalid or unknown sceneId ${bs.sceneId} received at index ${index}.`,
            );
            return false;
          }
          if (typeof bs.reason !== "string" || bs.reason.length < 10) {
            console.warn(
              `[Gemini Val] Invalid or too short reason for sceneId ${sceneId} at index ${index}.`,
            );
            return false;
          }
          if (
            !Array.isArray(bs.suggestedProducts) ||
            bs.suggestedProducts.length === 0 ||
            bs.suggestedProducts.length > 3
          ) {
            console.warn(
              `[Gemini Val] Invalid suggestedProducts array (size or type) for sceneId ${sceneId} at index ${index}.`,
            );
            return false;
          }
          if (
            !bs.suggestedProducts.every((p) =>
              validCategories.has(p as ProductCategory),
            )
          ) {
            console.warn(
              `[Gemini Val] One or more invalid categories in suggestedProducts for sceneId ${sceneId} at index ${index}. Received: ${bs.suggestedProducts.join(", ")}`,
            );
            return false;
          }
          // Ensure sceneId is a number if parsed from string
          bs.sceneId = sceneId;
          // Filter out any invalid product categories that might have slipped through (shouldn't if above check works)
          bs.suggestedProducts = bs.suggestedProducts.filter((p) =>
            validCategories.has(p as ProductCategory),
          );
          return true;
        })
        .slice(0, targetBrandableSceneCount); // Ensure we don't exceed the target count

      console.log(
        `[Gemini Analysis] Identified ${validatedBrandableScenes.length} valid brandable scenes.`,
      );
      return { brandableScenes: validatedBrandableScenes };
    } catch (parseError) {
      console.error(
        "[Gemini Analysis] Failed to parse JSON response from Gemini:",
        parseError,
        "\nRaw Gemini Response Text:",
        responseText,
      );
      return { brandableScenes: [] }; // Return empty on parse error
    }
  } catch (error: any) {
    console.error(
      "[Gemini Analysis] Error during communication with Gemini API for scene analysis:",
      error.message || error,
    );
    return { brandableScenes: [] }; // Return empty on API communication error
  }
}

// --- Creative Prompt Generation ---
export async function generateCreativePlacementPrompt(
  scene: Scene,
  product: Product,
): Promise<string> {
  const logPrefix = `[Gemini Creative S:${scene.sceneNumber}/P:${product.id}]`;
  console.log(`${logPrefix} Generating creative prompt for image generation...`);

  // Fallback prompt in case Gemini fails or returns an unusable prompt
  const safeHeadingFallback = sanitizeForSafetyFilter(scene.heading);
  const fallbackPrompt = `Cinematic film still, ${safeHeadingFallback}. A ${product.name} is naturally integrated into the scene. Photorealistic, high detail.`;

  try {
    const { genAI, safetySettings } = initializeGeminiClient();
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      safetySettings,
      generationConfig: {
        responseMimeType: "text/plain", // Expecting plain text for the prompt
        temperature: 0.7,
        maxOutputTokens: 150, // Max length for the generated prompt itself
        stopSequences: ["\n\n", "---"], // Stop generation if it starts creating paragraphs
      } as GenerationConfig,
    });

    const safeSceneContextSummary = sanitizeForSafetyFilter(
      scene.content?.substring(0, 500) || "No scene content provided.",
    );
    const safeHeading = sanitizeForSafetyFilter(scene.heading);
    const safeReason = sanitizeForSafetyFilter(scene.brandableReason || "N/A");

    const promptToGemini = `Act as a creative director for film product placement.
Generate a single, descriptive, visually rich prompt (max 100 tokens) for an AI image generator.
The prompt must depict the SCENE CONTEXT (Heading: ${safeHeading}, Summary: ${safeSceneContextSummary}..., Brandable Reason: ${safeReason}) and naturally incorporate the PRODUCT (${product.name}, Category: ${product.category}, Brand: ${product.companyName}).
Emphasize photorealism, cinematic lighting, high detail. Ensure natural integration.
Adhere to ~100 token limit.
IMPORTANT: Maintain a neutral, professional tone. Avoid violence, explicit language, or controversial elements. Focus on visual composition.
OUTPUT: Respond ONLY with the generated prompt text. No introductions, explanations, or formatting. Start directly with the prompt.`;

    const result = await model.generateContent(promptToGemini);
    let generatedPrompt = result.response
      .text()
      .trim()
      .replace(/^["']|["']$/g, "") // Remove surrounding quotes if any
      .replace(/^Prompt:\s*/i, "") // Remove "Prompt: " prefix if any
      .split("\n")[0]; // Take only the first line if multiple are returned

    if (!generatedPrompt) {
      console.warn(
        `${logPrefix} Gemini returned an empty prompt. Using fallback.`,
      );
      return fallbackPrompt;
    }

    // Basic token approximation (word count)
    const approxTokens = generatedPrompt.split(/\s+/).filter(Boolean).length;
    if (approxTokens > 110) {
      // A bit more lenient than 100 due to word vs token diff
      console.warn(
        `${logPrefix} Generated prompt is too long (${approxTokens} words), truncating.`,
      );
      generatedPrompt =
        generatedPrompt.split(/\s+/).slice(0, 100).join(" ") + "...";
    }

    console.log(
      `${logPrefix} Received creative prompt: ${generatedPrompt.substring(0, 100)}...`,
    );
    return generatedPrompt;
  } catch (error: any) {
    console.error(
      `${logPrefix} Failed to generate creative prompt with Gemini:`,
      error,
    );
    console.warn(`${logPrefix} Using fallback prompt due to error.`);
    return fallbackPrompt;
  }
}


// --- MODIFIED Character Extraction (includes role, budget tier, description, gender) ---
interface GeminiCharacterProfileResponse {
  characters: ScriptCharacter[]; // Expecting the richer ScriptCharacter structure
}

export async function extractCharactersWithGemini(
  scriptContent: string,
): Promise<ScriptCharacter[]> { // Return type is now the richer ScriptCharacter[]
  if (!scriptContent || scriptContent.trim().length < 50) {
    console.log("[Gemini Characters] Script content is too short or empty. Skipping character extraction.");
    return [];
  }

  const logPrefix = "[Gemini Character Profiles]";
  console.log(`${logPrefix} Starting character profile extraction (name, age, role, budget, desc, gender)...`);

  try {
    const { genAI, safetySettings } = initializeGeminiClient();
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      safetySettings,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.2,
        maxOutputTokens: 8192,
      } as GenerationConfig,
    });

    const maxScriptCharsForPrompt = 600000;
    const scriptContentForPrompt =
      scriptContent.length > maxScriptCharsForPrompt
        ? scriptContent.substring(0, maxScriptCharsForPrompt) + "\n...[TRUNCATED FOR PROMPT]..."
        : scriptContent;

    const prompt = `
    You are an expert script analyst. Your task is to analyze the provided screenplay content and extract all unique speaking character names, along with a detailed profile for each.

    For each character, provide:
    1.  "name": (string, ALL CAPS, typically 1-3 words)
    2.  "estimatedAgeRange": (string, e.g., "25-30", "teenager", "early 40s", "senior", "around 50", "Adult", or "Unclear" if not determinable from context)
    3.  "roleType": (string, one of: "Lead", "Supporting", "Cameo", "Unknown". Infer based on prominence, dialogue quantity, plot impact, and interactions.)
    4.  "recommendedBudgetTier": (string, one of: "Low", "Medium", "High", "Any". Infer based on the role's significance and typical casting costs associated with such roles.)
    5.  "description": (string, a concise 1-2 sentence description of the character's key traits, motivations, significant actions, or role in the story.)
    6.  "gender": (string, one of: "Male", "Female", "Non-Binary", "Unknown". Infer from names, pronouns, descriptions, or dialogue.)

    Instructions:
    -   Carefully read the screenplay. Identify names clearly designated as characters.
    -   The list of characters must be unique. Do not repeat names.
    -   Exclude common non-character, all-caps elements (V.O., O.S., CONT'D, scene headings, sound effects, parentheticals like (beat)).
    -   Focus on names that would appear in a cast list. Character names are typically short.
    -   Return the result STRICTLY as a single JSON object. This JSON object must have a single key "characters".
    -   The value of "characters" must be an array of objects, each matching the structure above.
    -   If no distinct characters are found, return an empty array for "characters".
    -   Do NOT include any explanatory text, markdown formatting, or anything else before or after the JSON object.

    Example of desired JSON output:
    {
      "characters": [
        {
          "name": "JOHN DOE",
          "estimatedAgeRange": "30-35",
          "roleType": "Lead",
          "recommendedBudgetTier": "Medium",
          "description": "A world-weary detective obsessed with a cold case that mirrors his own personal tragedy. He is driven but cynical.",
          "gender": "Male"
        },
        {
          "name": "DR. ELARA VANCE",
          "estimatedAgeRange": "early 40s",
          "roleType": "Supporting",
          "recommendedBudgetTier": "Medium",
          "description": "A brilliant but unconventional astrophysicist who holds the key to understanding the anomaly. She is eccentric and fiercely independent.",
          "gender": "Female"
        }
      ]
    }

    Screenplay Content:
    ---
    ${scriptContentForPrompt}
    ---
    JSON Output:
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    try {
      const parsedResponse: GeminiCharacterProfileResponse = JSON.parse(responseText);

      if (!parsedResponse.characters || !Array.isArray(parsedResponse.characters)) {
        console.error(`${logPrefix} Gemini response not in expected format (missing 'characters' array). Raw:`, responseText);
        return [];
      }

      const roleTypes: ScriptCharacter["roleType"][] = ["Lead", "Supporting", "Cameo", "Unknown"];
      const budgetTiers: ScriptCharacter["recommendedBudgetTier"][] = ["Low", "Medium", "High", "Any"];
      const genders: ScriptCharacter["gender"][] = ["Male", "Female", "Non-Binary", "Unknown"];

      const extractedCharacters: ScriptCharacter[] = parsedResponse.characters
        .map((charObj) => ({
          name: (charObj.name || "").toString().trim().toUpperCase(),
          estimatedAgeRange: (charObj.estimatedAgeRange || "Unclear").toString().trim(),
          roleType: roleTypes.includes(charObj.roleType) ? charObj.roleType : "Unknown",
          recommendedBudgetTier: budgetTiers.includes(charObj.recommendedBudgetTier) ? charObj.recommendedBudgetTier : "Any",
          description: sanitizeForSafetyFilter((charObj.description || "No description provided.").toString().trim()),
          gender: genders.includes(charObj.gender) ? charObj.gender : "Unknown",
        }))
        .filter(charObj => charObj.name && charObj.name.length > 1 && charObj.name.length < 50) // Basic validation
        .filter((charObj, index, self) => self.findIndex((c) => c.name === charObj.name) === index); // Ensure uniqueness

      console.log(`${logPrefix} Successfully extracted ${extractedCharacters.length} unique character profiles.`);
      return extractedCharacters;
    } catch (parseError) {
      console.error(`${logPrefix} Failed to parse Gemini JSON response for character profiles:`, parseError, "\nRaw Response:", responseText);
      return []; // Return empty on parse error
    }
  } catch (error: any) {
    console.error(`${logPrefix} Error extracting character profiles with Gemini:`, error.message || error);
    if (error.response && error.response.data) { console.error(`${logPrefix} Gemini API error details:`, error.response.data); }
    return [];
  }
}
// --- END MODIFIED ---