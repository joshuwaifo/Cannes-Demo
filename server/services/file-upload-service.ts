import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
  GenerationConfig,
} from "@google/generative-ai";
import * as fs from "fs";
import path from "path";
import os from "os";
import { v4 as uuidv4 } from "uuid";
import pdfParse from "./pdf-parse-wrapper";
import { ProductCategory, Scene } from "@shared/schema"; // Import Scene type

// Helper function to create a temporary file for the buffer
async function bufferToTempFile(
  buffer: Buffer,
  extension: string,
): Promise<string> {
  const tempDir = os.tmpdir();
  const tempFileName = `${uuidv4()}${extension}`;
  const tempFilePath = path.join(tempDir, tempFileName);

  return new Promise((resolve, reject) => {
    fs.writeFile(tempFilePath, buffer, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve(tempFilePath);
      }
    });
  });
}

// Convert file to base64 for Gemini's FileData
function fileToGenerativePart(filePath: string, mimeType: string) {
  const fileData = fs.readFileSync(filePath);
  return {
    inlineData: {
      data: fileData.toString("base64"),
      mimeType,
    },
  };
}

// Initialize Gemini client with safety settings
function initializeGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set");
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  // Configure safety settings
  const safetySettings = [
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

  return { genAI, safetySettings };
}

// Extract text from an image using Gemini AI
export async function extractTextFromImage(
  imageBuffer: Buffer,
  mimeType: string,
): Promise<string> {
  try {
    // Create a temporary file for the image
    const extension =
      mimeType === "image/jpeg" || mimeType === "image/jpg" ? ".jpg" : ".png";
    const imagePath = await bufferToTempFile(imageBuffer, extension);

    // Initialize Gemini client
    const { genAI, safetySettings } = initializeGeminiClient();

    // Use Gemini to extract text from the image
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-preview-04-17", // Use the flash preview model as requested
      safetySettings,
    });

    // Create a generative part from the file
    const imagePart = fileToGenerativePart(imagePath, mimeType);

    // Generate content from the image
    const prompt =
      "Please extract all text content from this image. If this is a film script or screenplay, please format it properly with scene headings, action, and dialogue. If there's no text visible, describe what you see in the image.";

    const result = await model.generateContent([imagePart, prompt]);
    const response = await result.response;
    const extractedText = response.text();

    console.log("Successfully extracted text from image using Gemini AI");

    // Clean up the temporary file
    try {
      fs.unlinkSync(imagePath);
    } catch (cleanupErr) {
      console.warn("Failed to clean up temporary image file:", cleanupErr);
    }

    return extractedText;
  } catch (error) {
    console.error("Error extracting text from image with Gemini:", error);
    return "Failed to extract text from the image. The AI service encountered an error.";
  }
}

// Extract text from a PDF using Gemini AI for enhancement
export async function extractTextFromPdf(pdfBuffer: Buffer): Promise<string> {
  try {
    // First try to extract text using pdf-parse
    let pdfData;
    try {
      pdfData = await pdfParse(pdfBuffer);
      const extractedText = pdfData.text;

      // If we got reasonable text, just return it
      if (extractedText && extractedText.length > 200) {
        return extractedText;
      }

      // If text is too short or empty, try Gemini AI
      console.log(
        "PDF text extraction yielded insufficient results, trying Gemini AI...",
      );
    } catch (pdfError) {
      console.error(
        "Error extracting text from PDF using pdf-parse:",
        pdfError,
      );
      console.log("Falling back to Gemini AI for PDF processing...");
    }

    // For PDFs, we'll use the text-based model since Gemini's PDF handling is limited
    const { genAI, safetySettings } = initializeGeminiClient();

    // Use text-only model for PDF content
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-preview-04-17", // Use the flash preview model as requested
      safetySettings,
    });

    // Extract some text with pdf-parse even if it's not perfect
    const basicPdfText = pdfData?.text || "Unable to extract text from PDF";

    // Enhance the extracted text with Gemini
    const prompt = `This is text extracted from a PDF document, but it may have formatting issues. 
    Please process this text and format it properly as a screenplay or film script if that's what it appears to be. 
    Add appropriate scene headings (INT/EXT), action descriptions, character names, and dialogue formatting.
    If it doesn't appear to be a screenplay, just clean up the formatting to be more readable.
    Here's the extracted text:
    
    ${basicPdfText.substring(0, 12000)}`; // Limit to avoid token limits

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const enhancedText = response.text();

    console.log("Successfully enhanced PDF text using Gemini AI");

    return enhancedText;
  } catch (error) {
    console.error("Error processing PDF with Gemini:", error);

    // Try one more time with pdf-parse as a fallback
    try {
      const pdfData = await pdfParse(pdfBuffer);
      return pdfData.text;
    } catch (fallbackError) {
      console.error("Fallback PDF extraction also failed:", fallbackError);
      return "Failed to extract text from the PDF. The file may be corrupted or in an unsupported format.";
    }
  }
}

// Interface for the expected AI analysis result for brandable scenes
interface BrandableSceneAnalysis {
  sceneId: number; // This will be the original scene ID from your database
  reason: string;
  suggestedProducts: ProductCategory[]; // Use the enum from schema
}
export interface AIAnalysisResponseForRoutes {
  brandableScenes: BrandableSceneAnalysis[];
}

// New function to identify brandable scenes using Gemini
export async function identifyBrandableScenesWithGemini(
  scenes: Scene[], // Pass the full scene objects
  targetBrandableSceneCount: number = 5,
): Promise<AIAnalysisResponseForRoutes> {
  if (!scenes || scenes.length === 0) {
    return { brandableScenes: [] };
  }

  const { genAI, safetySettings } = initializeGeminiClient();
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash", // Changed to 1.5-flash as it's generally better for complex tasks
    safetySettings,
    generationConfig: {
      responseMimeType: "application/json", // Request JSON output
      temperature: 0.3, // Lower temperature for more factual/constrained output
    } as GenerationConfig, // Cast to GenerationConfig if the property is valid for the SDK version
  });

  // Prepare content for the prompt - include scene number and heading for context
  const scenesTextForPrompt = scenes
    .map(
      (scene) =>
        `SCENE_ID: ${scene.id}\nSCENE_NUMBER: ${scene.sceneNumber}\nHEADING: ${scene.heading}\nCONTENT:\n${scene.content.substring(0, 1000)}\n---\n`,
    )
    .join("\n");

  const prompt = `
    You are an expert in film production and product placement.
    Analyze the following screenplay scenes. Your goal is to identify up to ${targetBrandableSceneCount} scenes that offer the MOST promising and natural opportunities for product placement.

    For each identified scene, you MUST provide:
    1. "sceneId": The EXACT SCENE_ID provided for that scene in the input.
    2. "reason": A brief (1-2 sentences) explanation of why this scene is suitable for product placement.
    3. "suggestedProducts": An array of 1 to 3 relevant product categories from this list: BEVERAGE, ELECTRONICS, FOOD, AUTOMOTIVE, FASHION, OTHER.

    Output MUST be a valid JSON object with a single key "brandableScenes", which is an array of objects, each representing a brandable scene.
    If no scenes are suitable, return an empty array for "brandableScenes".
    Prioritize scenes where placement would feel organic and enhance realism.

    Screenplay Scenes:
    ${scenesTextForPrompt}
  `;

  console.log(
    "Sending prompt to Gemini for brandable scene analysis (first 300 chars):",
    prompt.substring(0, 300),
  );

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const responseText = response.text();
    console.log("Gemini raw response for brandable scenes:", responseText);

    // Attempt to parse the JSON response
    const parsedResponse: AIAnalysisResponseForRoutes =
      JSON.parse(responseText);

    // Validate the structure and content
    if (
      !parsedResponse.brandableScenes ||
      !Array.isArray(parsedResponse.brandableScenes)
    ) {
      console.error(
        "Gemini response for brandable scenes is not in the expected format (missing brandableScenes array).",
      );
      return { brandableScenes: [] };
    }

    const validatedBrandableScenes = parsedResponse.brandableScenes
      .filter(
        (bs) =>
          bs.sceneId &&
          scenes.find((s) => s.id === bs.sceneId) && // Ensure sceneId from Gemini exists in original scenes
          bs.reason &&
          Array.isArray(bs.suggestedProducts) &&
          bs.suggestedProducts.every((p) =>
            Object.values(ProductCategory).includes(p as any),
          ),
      )
      .slice(0, targetBrandableSceneCount); // Limit to target count

    console.log(
      `Gemini identified ${validatedBrandableScenes.length} valid brandable scenes.`,
    );
    return { brandableScenes: validatedBrandableScenes };
  } catch (error: any) {
    console.error(
      "Error analyzing scenes with Gemini:",
      error.message || error,
    );
    return { brandableScenes: [] }; // Return empty on error
  }
}
