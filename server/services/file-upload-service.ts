// import {
//   GoogleGenerativeAI,
//   HarmCategory,
//   HarmBlockThreshold,
//   GenerationConfig,
// } from "@google/generative-ai";
// import * as fs from "fs";
// import path from "path";
// import os from "os";
// import { v4 as uuidv4 } from "uuid";
// import pdfParse from "./pdf-parse-wrapper";
// import { ProductCategory, Scene } from "@shared/schema"; // Import Scene type

// // Helper function to create a temporary file for the buffer
// async function bufferToTempFile(
//   buffer: Buffer,
//   extension: string,
// ): Promise<string> {
//   const tempDir = os.tmpdir();
//   const tempFileName = `${uuidv4()}${extension}`;
//   const tempFilePath = path.join(tempDir, tempFileName);

//   return new Promise((resolve, reject) => {
//     fs.writeFile(tempFilePath, buffer, (err) => {
//       if (err) {
//         reject(err);
//       } else {
//         resolve(tempFilePath);
//       }
//     });
//   });
// }

// // Convert file to base64 for Gemini's FileData
// function fileToGenerativePart(filePath: string, mimeType: string) {
//   const fileData = fs.readFileSync(filePath);
//   return {
//     inlineData: {
//       data: fileData.toString("base64"),
//       mimeType,
//     },
//   };
// }

// // Initialize Gemini client with safety settings
// function initializeGeminiClient() {
//   const apiKey = process.env.GEMINI_API_KEY;

//   if (!apiKey) {
//     throw new Error("GEMINI_API_KEY environment variable is not set");
//   }

//   const genAI = new GoogleGenerativeAI(apiKey);

//   // Configure safety settings
//   const safetySettings = [
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

//   return { genAI, safetySettings };
// }

// // Extract text from an image using Gemini AI
// export async function extractTextFromImage(
//   imageBuffer: Buffer,
//   mimeType: string,
// ): Promise<string> {
//   try {
//     // Create a temporary file for the image
//     const extension =
//       mimeType === "image/jpeg" || mimeType === "image/jpg" ? ".jpg" : ".png";
//     const imagePath = await bufferToTempFile(imageBuffer, extension);

//     // Initialize Gemini client
//     const { genAI, safetySettings } = initializeGeminiClient();

//     // Use Gemini to extract text from the image
//     const model = genAI.getGenerativeModel({
//       model: "gemini-2.5-flash-preview-04-17", // Use the flash preview model as requested
//       safetySettings,
//     });

//     // Create a generative part from the file
//     const imagePart = fileToGenerativePart(imagePath, mimeType);

//     // Generate content from the image
//     const prompt =
//       "Please extract all text content from this image. If this is a film script or screenplay, please format it properly with scene headings, action, and dialogue. If there's no text visible, describe what you see in the image.";

//     const result = await model.generateContent([imagePart, prompt]);
//     const response = await result.response;
//     const extractedText = response.text();

//     console.log("Successfully extracted text from image using Gemini AI");

//     // Clean up the temporary file
//     try {
//       fs.unlinkSync(imagePath);
//     } catch (cleanupErr) {
//       console.warn("Failed to clean up temporary image file:", cleanupErr);
//     }

//     return extractedText;
//   } catch (error) {
//     console.error("Error extracting text from image with Gemini:", error);
//     return "Failed to extract text from the image. The AI service encountered an error.";
//   }
// }

// // Extract text from a PDF using Gemini AI for enhancement
// export async function extractTextFromPdf(pdfBuffer: Buffer): Promise<string> {
//   try {
//     // First try to extract text using pdf-parse
//     let pdfData;
//     try {
//       pdfData = await pdfParse(pdfBuffer);
//       const extractedText = pdfData.text;

//       // If we got reasonable text, just return it
//       if (extractedText && extractedText.length > 200) {
//         return extractedText;
//       }

//       // If text is too short or empty, try Gemini AI
//       console.log(
//         "PDF text extraction yielded insufficient results, trying Gemini AI...",
//       );
//     } catch (pdfError) {
//       console.error(
//         "Error extracting text from PDF using pdf-parse:",
//         pdfError,
//       );
//       console.log("Falling back to Gemini AI for PDF processing...");
//     }

//     // For PDFs, we'll use the text-based model since Gemini's PDF handling is limited
//     const { genAI, safetySettings } = initializeGeminiClient();

//     // Use text-only model for PDF content
//     const model = genAI.getGenerativeModel({
//       model: "gemini-2.5-flash-preview-04-17", // Use the flash preview model as requested
//       safetySettings,
//     });

//     // Extract some text with pdf-parse even if it's not perfect
//     const basicPdfText = pdfData?.text || "Unable to extract text from PDF";

//     // Enhance the extracted text with Gemini
//     const prompt = `This is text extracted from a PDF document, but it may have formatting issues. 
//     Please process this text and format it properly as a screenplay or film script if that's what it appears to be. 
//     Add appropriate scene headings (INT/EXT), action descriptions, character names, and dialogue formatting.
//     If it doesn't appear to be a screenplay, just clean up the formatting to be more readable.
//     Here's the extracted text:
    
//     ${basicPdfText.substring(0, 12000)}`; // Limit to avoid token limits

//     const result = await model.generateContent(prompt);
//     const response = await result.response;
//     const enhancedText = response.text();

//     console.log("Successfully enhanced PDF text using Gemini AI");

//     return enhancedText;
//   } catch (error) {
//     console.error("Error processing PDF with Gemini:", error);

//     // Try one more time with pdf-parse as a fallback
//     try {
//       const pdfData = await pdfParse(pdfBuffer);
//       return pdfData.text;
//     } catch (fallbackError) {
//       console.error("Fallback PDF extraction also failed:", fallbackError);
//       return "Failed to extract text from the PDF. The file may be corrupted or in an unsupported format.";
//     }
//   }
// }

// // Interface for the expected AI analysis result for brandable scenes
// interface BrandableSceneAnalysis {
//   sceneId: number; // This will be the original scene ID from your database
//   reason: string;
//   suggestedProducts: ProductCategory[]; // Use the enum from schema
// }
// export interface AIAnalysisResponseForRoutes {
//   brandableScenes: BrandableSceneAnalysis[];
// }

// /**
//  * Optimized function to identify brandable scenes using Gemini
//  * This function has been enhanced for speed and accuracy in identifying
//  * the best scenes for product placement.
//  */
// export async function identifyBrandableScenesWithGemini(
//   scenes: Scene[],
//   targetBrandableSceneCount: number = 5,
// ): Promise<AIAnalysisResponseForRoutes> {
//   if (!scenes || scenes.length === 0) {
//     return { brandableScenes: [] };
//   }

//   const { genAI, safetySettings } = initializeGeminiClient();
//   const model = genAI.getGenerativeModel({
//     model: "gemini-1.5-flash", // Using the flash model for faster inference
//     safetySettings,
//     generationConfig: {
//       responseMimeType: "application/json", // Explicitly request JSON output
//       temperature: 0.2, // Even lower temperature for more deterministic results
//       maxOutputTokens: 2048, // Limit token count for faster response
//     } as GenerationConfig,
//   });

//   // Optimize the content preparation for the prompt
//   // Only include the most relevant information to reduce token usage
//   const scenesTextForPrompt = scenes
//     .map((scene) => {
//       // Extract just enough context for analysis while keeping token count low
//       const truncatedContent = scene.content.substring(0, 800); // Reduce from 1000 to 800 chars
      
//       return `SCENE_ID: ${scene.id}
// SCENE_NUMBER: ${scene.sceneNumber}
// HEADING: ${scene.heading}
// CONTENT: ${truncatedContent}
// ---`;
//     })
//     .join("\n");

//   // Optimized prompt with clearer instructions for more accurate results
//   const prompt = `You are an expert in film production and product placement.

// TASK: Analyze the screenplay scenes below and identify exactly ${targetBrandableSceneCount} scenes that offer the most promising and natural opportunities for product placement.

// SELECTION CRITERIA:
// - Scenes with clear visual settings where products can be naturally integrated
// - Scenes with social interactions or natural product consumption scenarios
// - Scenes that have adequate description to understand the context
// - Scenes where a branded product would enhance realism rather than seem forced

// RESPONSE FORMAT:
// Return a valid JSON object with a single key "brandableScenes", containing an array of objects with these exact fields:
// {
//   "brandableScenes": [
//     {
//       "sceneId": number,          // MUST be the exact SCENE_ID provided in input
//       "reason": string,           // 1-2 sentence explanation of placement opportunity
//       "suggestedProducts": array  // 1-3 categories from: BEVERAGE, ELECTRONICS, FOOD, AUTOMOTIVE, FASHION, OTHER
//     },
//     ...
//   ]
// }

// SCREENPLAY SCENES:
// ${scenesTextForPrompt}`;

//   console.log(
//     "Sending optimized prompt to Gemini for brandable scene analysis:",
//     prompt.substring(0, 300) + "..."
//   );

//   try {
//     const result = await model.generateContent(prompt);
//     const response = await result.response;
//     const responseText = response.text();
//     console.log("Gemini raw response for brandable scenes:", responseText);

//     try {
//       // Parse the JSON response with error handling
//       const parsedResponse: AIAnalysisResponseForRoutes = JSON.parse(responseText);

//       // Validate the structure and content
//       if (!parsedResponse.brandableScenes || !Array.isArray(parsedResponse.brandableScenes)) {
//         console.error("Gemini response is not in the expected format (missing brandableScenes array).");
//         return { brandableScenes: [] };
//       }

//       // Enhanced validation to ensure only valid scenes with correct data structure are included
//       const validatedBrandableScenes = parsedResponse.brandableScenes
//         .filter((bs) => {
//           // Ensure scene ID is a number and exists in our scenes array
//           const sceneId = typeof bs.sceneId === 'string' ? parseInt(bs.sceneId) : bs.sceneId;
//           const sceneExists = scenes.some(s => s.id === sceneId);
          
//           // Validate other fields
//           const hasValidReason = typeof bs.reason === 'string' && bs.reason.length > 10;
//           const hasValidProducts = Array.isArray(bs.suggestedProducts) && 
//                                   bs.suggestedProducts.length > 0 &&
//                                   bs.suggestedProducts.every(p => 
//                                     Object.values(ProductCategory).includes(p as any));
          
//           const isValid = sceneExists && hasValidReason && hasValidProducts;
          
//           if (!isValid) {
//             console.log(`Filtering out invalid brandable scene: ${JSON.stringify(bs)}`);
//           }
          
//           return isValid;
//         })
//         .slice(0, targetBrandableSceneCount);

//       console.log(`Gemini identified ${validatedBrandableScenes.length} valid brandable scenes.`);
      
//       // Convert string IDs to numbers if necessary
//       const finalScenes = validatedBrandableScenes.map(scene => ({
//         ...scene,
//         sceneId: typeof scene.sceneId === 'string' ? parseInt(scene.sceneId) : scene.sceneId
//       }));
      
//       return { brandableScenes: finalScenes };
//     } catch (parseError) {
//       console.error("Failed to parse Gemini response as JSON:", parseError);
//       // If JSON parsing fails, make a second attempt with a more explicit prompt
//       return await retryWithExplicitJsonPrompt(scenes, targetBrandableSceneCount, model);
//     }
//   } catch (error: any) {
//     console.error("Error analyzing scenes with Gemini:", error.message || error);
//     return { brandableScenes: [] }; // Return empty on error
//   }
// }

// /**
//  * Backup function to retry scene analysis with an even more explicit JSON prompt
//  * if the first attempt fails to produce valid JSON.
//  */
// async function retryWithExplicitJsonPrompt(
//   scenes: Scene[],
//   targetBrandableSceneCount: number,
//   model: any
// ): Promise<AIAnalysisResponseForRoutes> {
//   console.log("Retrying brandable scene analysis with explicit JSON prompt...");
  
//   // Create an even simpler prompt focusing solely on proper JSON formatting
//   const simplifiedScenesText = scenes
//     .map(scene => `Scene ID ${scene.id}: ${scene.heading} - ${scene.content.substring(0, 200)}...`)
//     .join("\n");
  
//   const retryPrompt = `CRITICAL: You must return a valid JSON object containing exactly this structure:
// {
//   "brandableScenes": [
//     {
//       "sceneId": 123,
//       "reason": "Brief reason for selection",
//       "suggestedProducts": ["BEVERAGE", "FOOD"]
//     }
//   ]
// }

// Analyze these screenplay scenes and select ${targetBrandableSceneCount} best for product placement:
// ${simplifiedScenesText}

// AGAIN, YOUR RESPONSE MUST BE ONLY VALID JSON WITH NO OTHER TEXT.`;

//   try {
//     const retryResult = await model.generateContent(retryPrompt);
//     const retryResponse = await retryResult.response;
//     const retryText = retryResponse.text();
    
//     // Extract JSON if there's any surrounding text
//     const jsonMatch = retryText.match(/\{[\s\S]*\}/);
//     const jsonStr = jsonMatch ? jsonMatch[0] : retryText;
    
//     const parsedResponse = JSON.parse(jsonStr);
    
//     if (!parsedResponse.brandableScenes || !Array.isArray(parsedResponse.brandableScenes)) {
//       console.error("Retry also failed to produce correct format.");
//       return { brandableScenes: [] };
//     }
    
//     // Basic validation
//     const validScenes = parsedResponse.brandableScenes
//       .filter(bs => bs.sceneId && bs.reason && Array.isArray(bs.suggestedProducts))
//       .slice(0, targetBrandableSceneCount);
      
//     return { brandableScenes: validScenes };
//   } catch (retryError) {
//     console.error("Retry also failed:", retryError);
//     return { brandableScenes: [] };
//   }
// }


// server/services/file-upload-service.ts
// server/services/file-upload-service.ts
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
  GenerationConfig,
  Part, // Import Part type
} from "@google/generative-ai";
import * as fs from "fs";
import path from "path";
import os from "os";
import { v4 as uuidv4 } from "uuid";
import pdfParse from "./pdf-parse-wrapper"; // Assuming the wrapper is correctly set up
import { ProductCategory, Scene, Product } from "@shared/schema"; // Import Scene, Product type

// --- Utility to Sanitize Text for Safety Filters ---
/**
 * Basic sanitization to remove potentially problematic words.
 * This is a simple approach; more sophisticated NLP might be needed.
 * @param text The input text.
 * @returns Sanitized text.
 */
export function sanitizeForSafetyFilter(text: string): string {
    if (!text) return "";
    // Case-insensitive replacement using regex with word boundaries
    const profanityMap: Record<string, string> = {
        'shit': 'stuff',
        'damn': 'darn',
        'fuckin\'': 'really',
        'fucking': 'really',
        'hell': 'heck', // Add more as needed
        // Add variations if needed (e.g., 'asshole': 'person')
    };
    let sanitized = text;
    for (const word in profanityMap) {
        // Use RegExp constructor for dynamic pattern with word boundaries and case insensitivity
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        sanitized = sanitized.replace(regex, profanityMap[word]);
    }
    // Also remove potential null characters just in case
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
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  ];

  return { genAI: genAIInstance, safetySettings: geminiSafetySettings };
}


// --- File Handling Utilities ---
async function bufferToTempFile(buffer: Buffer, extension: string): Promise<string> {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vadis-')); // Create unique temp dir
    const tempFileName = `${uuidv4()}${extension}`;
    const tempFilePath = path.join(tempDir, tempFileName);

    try {
        await fs.promises.writeFile(tempFilePath, buffer);
        return tempFilePath;
    } catch (err) {
        console.error(`Error writing temp file ${tempFilePath}:`, err);
        // Attempt to clean up directory on write failure
        try { await fs.promises.rm(tempDir, { recursive: true, force: true }); } catch {}
        throw err; // Re-throw the error
    }
}

function fileToGenerativePart(filePath: string, mimeType: string): Part { // Return type is Part
  try {
     const fileData = fs.readFileSync(filePath);
     return {
        inlineData: {
          data: fileData.toString("base64"),
          mimeType,
        },
      };
  } catch (error) {
      console.error(`Error reading file ${filePath} for generative part:`, error);
      throw new Error(`Could not read file: ${filePath}`); // Propagate error
  }
}

async function cleanupTempFile(filePath: string) {
    try {
        const dirPath = path.dirname(filePath);
        await fs.promises.unlink(filePath);
        // Optionally remove the directory if it's empty
        await fs.promises.rmdir(dirPath).catch(() => { /* Ignore error if dir not empty */ });
        // console.log(`Cleaned up temp file: ${filePath}`);
    } catch (cleanupErr) {
        console.warn(`Failed to clean up temp file ${filePath}:`, cleanupErr);
    }
}


// --- Text Extraction ---
export async function extractTextFromImage(imageBuffer: Buffer, mimeType: string): Promise<string> {
  let imagePath: string | null = null;
  try {
    const extension = mimeType.includes('jpeg') || mimeType.includes('jpg') ? '.jpg' : '.png';
    imagePath = await bufferToTempFile(imageBuffer, extension);

    const { genAI, safetySettings } = initializeGeminiClient();
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash", safetySettings });

    const imagePart = fileToGenerativePart(imagePath, mimeType);
    const prompt = "Extract all text content from this image. If it appears to be a film script or screenplay, format it properly with scene headings, action, and dialogue. If no text is visible, describe the image.";

    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const extractedText = response.text();

    console.log("Successfully extracted text from image via Gemini.");
    return extractedText;
  } catch (error) {
    console.error("Error extracting text from image with Gemini:", error);
    return `Error: Failed to extract text from image. ${error instanceof Error ? error.message : 'Unknown Gemini error'}`;
  } finally {
      if (imagePath) {
        await cleanupTempFile(imagePath);
      }
  }
}

export async function extractTextFromPdf(pdfBuffer: Buffer): Promise<string> {
  try {
    // Try pdf-parse first
    const pdfData = await pdfParse(pdfBuffer);
    const extractedText = pdfData?.text || "";

    if (extractedText.length > 100) {
      console.log("Successfully extracted text from PDF using pdf-parse.");
      return extractedText;
    }
    console.log("pdf-parse extraction insufficient, trying Gemini AI for enhancement...");

    // Fallback to Gemini
     const { genAI, safetySettings } = initializeGeminiClient();
     const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash", safetySettings });

     const prompt = `The following text was extracted from a PDF, but might be incomplete or badly formatted.
     Please analyze it. If it appears to be a film script or screenplay, reformat it accurately with scene headings (INT./EXT.), action lines, character names (centered), and dialogue.
     If it's not a script, simply clean up the formatting for readability. Preserve as much original content as possible.

     Extracted Text:
     ---
     ${extractedText.substring(0, 25000)}
     ---
     Formatted Output:`; // Increased limit slightly

     const result = await model.generateContent(prompt);
     const response = await result.response;
     const enhancedText = response.text();
     console.log("Successfully enhanced/extracted PDF text using Gemini AI.");
     return enhancedText;

  } catch (error) {
    console.error("Error processing PDF with pdf-parse and/or Gemini:", error);
    return `Error: Failed to process PDF. ${error instanceof Error ? error.message : 'Unknown processing error'}`;
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

    console.log(`[Gemini Analysis] Analyzing ${scenes.length} scenes for ${targetBrandableSceneCount} brandable candidates...`);

    try {
        const { genAI, safetySettings } = initializeGeminiClient();
        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash",
            safetySettings,
            generationConfig: {
                responseMimeType: "application/json",
                temperature: 0.3,
                maxOutputTokens: 4096,
            } as GenerationConfig,
        });

        // Prepare scene data, sanitizing potentially problematic content
        const scenesTextForPrompt = scenes
            .map((scene) => {
                const safeHeading = sanitizeForSafetyFilter(scene.heading);
                const safeContent = sanitizeForSafetyFilter(scene.content.substring(0, 500)); // Sanitize snippet
                return `SCENE_ID: ${scene.id}\nHEADING: ${safeHeading}\nCONTENT_SNIPPET: ${safeContent}...\n---`;
            })
            .join("\n");

        // Optimized prompt
        const prompt = `
        You are an expert film production assistant specializing in identifying product placement opportunities.
        TASK: Analyze the following screenplay scene summaries. Identify exactly ${targetBrandableSceneCount} scenes that offer the MOST promising and natural opportunities for integrating branded products.

        SELECTION CRITERIA:
        - Visual Clarity: The scene description allows easy visualization of where a product could fit.
        - Natural Integration: The product wouldn't feel forced (e.g., consuming food/drinks, using electronics, driving cars, wearing clothes).
        - Context Relevance: The product category aligns with the scene's setting and action.
        - Sufficient Detail: The summary provides enough context to make a judgment.
        - Safety: Prioritize scenes less likely to involve explicit content, violence, or controversial themes that might conflict with brand safety.

        RESPONSE FORMAT:
        Return ONLY a valid JSON object. The JSON object must have a single key "brandableScenes".
        The value of "brandableScenes" must be an array of objects. Each object in the array represents a selected scene and MUST contain these exact keys:
        - "sceneId": number (The exact SCENE_ID from the input)
        - "reason": string (Concise, 1-2 sentence explanation for the placement opportunity)
        - "suggestedProducts": array (1-3 relevant categories from: ${Object.values(ProductCategory).join(", ")})

        Example single element in the array:
        { "sceneId": 123, "reason": "Characters are eating breakfast, suitable for food/beverage placement.", "suggestedProducts": ["FOOD", "BEVERAGE"] }

        Do NOT include any text before or after the JSON object.

        SCREENPLAY SCENES:
        ---
        ${scenesTextForPrompt}
        ---
        `;

        console.log("[Gemini Analysis] Sending request to Gemini...");
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const responseText = response.text();
        // console.log("[Gemini Analysis] Raw response:", responseText); // Log raw for debugging if needed

        try {
            const parsedResponse: { brandableScenes?: BrandableSceneAnalysis[] } = JSON.parse(responseText);

            if (!parsedResponse.brandableScenes || !Array.isArray(parsedResponse.brandableScenes)) {
                console.error("[Gemini Analysis] Response is not in the expected format (missing or invalid 'brandableScenes' array). Raw text:", responseText);
                return { brandableScenes: [] };
            }

            // Validate and filter the results rigorously
            const sceneIdMap = new Map(scenes.map(s => [s.id, true]));
            const validCategories = new Set(Object.values(ProductCategory));

            const validatedBrandableScenes = parsedResponse.brandableScenes
                .filter((bs, index) => {
                    const sceneId = typeof bs.sceneId === 'string' ? parseInt(bs.sceneId, 10) : bs.sceneId;
                    if (isNaN(sceneId) || !sceneIdMap.has(sceneId)) {
                        console.warn(`[Gemini Validation] Invalid or unknown sceneId ${bs.sceneId} at index ${index}. Skipping.`);
                        return false;
                    }
                    if (typeof bs.reason !== 'string' || bs.reason.length < 10) {
                         console.warn(`[Gemini Validation] Invalid or short reason for sceneId ${sceneId} at index ${index}. Skipping.`);
                        return false;
                    }
                     if (!Array.isArray(bs.suggestedProducts) || bs.suggestedProducts.length === 0 || bs.suggestedProducts.length > 3) {
                          console.warn(`[Gemini Validation] Invalid suggestedProducts array for sceneId ${sceneId} at index ${index}. Skipping.`);
                         return false;
                     }
                     if (!bs.suggestedProducts.every(p => validCategories.has(p as ProductCategory))) { // Ensure type check
                         console.warn(`[Gemini Validation] Invalid category found in suggestedProducts for sceneId ${sceneId} at index ${index}. Skipping.`);
                         return false;
                     }
                    bs.sceneId = sceneId; // Ensure it's a number
                    bs.suggestedProducts = bs.suggestedProducts.filter(p => validCategories.has(p as ProductCategory)); // Clean array just in case
                    return true;
                })
                .slice(0, targetBrandableSceneCount); // Ensure we don't exceed the target count

            console.log(`[Gemini Analysis] Identified ${validatedBrandableScenes.length} valid brandable scenes.`);
            return { brandableScenes: validatedBrandableScenes };

        } catch (parseError) {
            console.error("[Gemini Analysis] Failed to parse Gemini JSON response:", parseError, "\nRaw Response Text:", responseText);
            return { brandableScenes: [] }; // Return empty on parse error
        }
    } catch (error: any) {
        console.error("[Gemini Analysis] Error analyzing scenes with Gemini:", error.message || error);
        return { brandableScenes: [] }; // Return empty on API error
    }
}


// --- Creative Prompt Generation ---
export async function generateCreativePlacementPrompt(scene: Scene, product: Product): Promise<string> {
  const logPrefix = `[Gemini Creative S:${scene.sceneNumber}/P:${product.id}]`;
  console.log(`${logPrefix} Generating prompt...`);

  // Prepare a fallback prompt in case Gemini fails
  const safeHeadingFallback = sanitizeForSafetyFilter(scene.heading);
  const fallbackPrompt = `Cinematic film still, ${safeHeadingFallback}. A ${product.name} is naturally integrated into the scene. Photorealistic, high detail.`;

  try {
    const { genAI, safetySettings } = initializeGeminiClient();
    const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        safetySettings,
        generationConfig: {
             responseMimeType: "text/plain",
             temperature: 0.7, // Balance creativity and relevance
             maxOutputTokens: 150, // Slightly more than 100 target for flexibility
             stopSequences: ["\n\n", "---"] // Try to prevent extra text
        } as GenerationConfig
    });

    // Sanitize context before sending
    const safeSceneContextSummary = sanitizeForSafetyFilter(scene.content?.substring(0, 500) || "No scene content provided.");
    const safeHeading = sanitizeForSafetyFilter(scene.heading);
    const safeReason = sanitizeForSafetyFilter(scene.brandableReason || 'N/A');

    const promptToGemini = `
      Act as a creative director for film product placement.
      Generate a single, descriptive, visually rich prompt (max 100 tokens) for an AI image generator (like SDXL).
      The prompt must depict the following scene and naturally incorporate the specified product.

      SCENE CONTEXT:
      - Heading: ${safeHeading}
      - Summary: ${safeSceneContextSummary}...
      - Brandable Reason (if available): ${safeReason}

      PRODUCT TO INTEGRATE:
      - Name: ${product.name}
      - Category: ${product.category}
      - Brand: ${product.companyName}

      PROMPT REQUIREMENTS:
      - Seamlessly weave the "${product.name}" into the scene described by the heading and summary.
      - Emphasize photorealism, cinematic lighting, and high detail.
      - Ensure the integration feels natural and not forced.
      - Adhere strictly to the ~100 token limit.
      - IMPORTANT: Maintain a neutral, professional tone. Avoid generating prompts containing or explicitly depicting violence, explicit language, or controversial elements, even if hinted at in the source context. Focus solely on the visual composition and product integration.

      OUTPUT: Respond ONLY with the generated prompt text. No introductions, explanations, or formatting. Start the response directly with the prompt.
    `;

    console.log(`${logPrefix} Prompting Gemini...`);
    const result = await model.generateContent(promptToGemini);
    const response = await result.response;
    let generatedPrompt = response.text().trim();

    // Cleanup and validation
    generatedPrompt = generatedPrompt.replace(/^["']|["']$/g, ''); // Remove surrounding quotes
    generatedPrompt = generatedPrompt.replace(/^Prompt:\s*/i, ''); // Remove "Prompt: " prefix
    generatedPrompt = generatedPrompt.split('\n')[0]; // Take only the first line

    if (!generatedPrompt) {
      console.warn(`${logPrefix} Gemini returned an empty prompt. Using fallback.`);
      return fallbackPrompt;
    }

    // Simple token check (approximation by words)
    const approxTokens = generatedPrompt.split(/\s+/).filter(Boolean).length;
    if (approxTokens > 110) { // Allow slightly more overshoot
        console.warn(`${logPrefix} Prompt too long (${approxTokens} words), truncating.`);
        generatedPrompt = generatedPrompt.split(/\s+/).slice(0, 100).join(' ') + '...';
    }

    console.log(`${logPrefix} Received prompt: ${generatedPrompt.substring(0, 100)}...`);
    return generatedPrompt;

  } catch (error: any) {
    console.error(`${logPrefix} Failed to generate creative prompt:`, error);
    console.warn(`${logPrefix} Using fallback prompt due to error.`);
    return fallbackPrompt;
  }
}