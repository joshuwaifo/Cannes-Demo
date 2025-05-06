import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import * as fs from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import pdfParse from './pdf-parse-wrapper';

// Helper function to create a temporary file for the buffer
async function bufferToTempFile(buffer: Buffer, extension: string): Promise<string> {
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
      data: fileData.toString('base64'),
      mimeType
    }
  };
}

// Initialize Gemini client with safety settings
function initializeGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
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
export async function extractTextFromImage(imageBuffer: Buffer, mimeType: string): Promise<string> {
  try {
    // Create a temporary file for the image
    const extension = mimeType === 'image/jpeg' || mimeType === 'image/jpg' ? '.jpg' : '.png';
    const imagePath = await bufferToTempFile(imageBuffer, extension);
    
    // Initialize Gemini client
    const { genAI, safetySettings } = initializeGeminiClient();
    
    // Use Gemini to extract text from the image
    const model = genAI.getGenerativeModel({
      model: "gemini-pro-vision",  // Use the stable gemini-pro-vision model
      safetySettings
    });
    
    // Create a generative part from the file
    const imagePart = fileToGenerativePart(imagePath, mimeType);
    
    // Generate content from the image
    const prompt = "Please extract all text content from this image. If this is a film script or screenplay, please format it properly with scene headings, action, and dialogue. If there's no text visible, describe what you see in the image.";
    
    const result = await model.generateContent([imagePart, prompt]);
    const response = await result.response;
    const extractedText = response.text();
    
    console.log("Successfully extracted text from image using Gemini AI");
    
    // Clean up the temporary file
    try {
      fs.unlinkSync(imagePath);
    } catch (cleanupErr) {
      console.warn('Failed to clean up temporary image file:', cleanupErr);
    }
    
    return extractedText;
  } catch (error) {
    console.error('Error extracting text from image with Gemini:', error);
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
      console.log('PDF text extraction yielded insufficient results, trying Gemini AI...');
    } catch (pdfError) {
      console.error('Error extracting text from PDF using pdf-parse:', pdfError);
      console.log('Falling back to Gemini AI for PDF processing...');
    }
    
    // For PDFs, we'll use the text-based model since Gemini's PDF handling is limited
    const { genAI, safetySettings } = initializeGeminiClient();
    
    // Use text-only model for PDF content
    const model = genAI.getGenerativeModel({
      model: "gemini-pro",  // Use stable text model
      safetySettings
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
    console.error('Error processing PDF with Gemini:', error);
    
    // Try one more time with pdf-parse as a fallback
    try {
      const pdfData = await pdfParse(pdfBuffer);
      return pdfData.text;
    } catch (fallbackError) {
      console.error('Fallback PDF extraction also failed:', fallbackError);
      return "Failed to extract text from the PDF. The file may be corrupted or in an unsupported format.";
    }
  }
}