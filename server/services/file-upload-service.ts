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
    
    // Upload the file to Google Generative AI
    const fileModel = genAI.files;
    const uploadedFile = await fileModel.upload({
      file: imagePath,
      config: { mimeType }
    });
    
    console.log("Successfully uploaded image file to Google AI");
    
    // Use Gemini to extract text from the image
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      safetySettings
    });
    
    // Create content parts for the model
    const createUserContent = model.startContentChat().createUserContent;
    const createPartFromUri = model.startContentChat().createPartFromUri;
    
    const result = await model.generateContent({
      contents: [
        createUserContent([
          createPartFromUri(uploadedFile.uri, uploadedFile.mimeType),
          "\n\n",
          "Please extract all text content from this image. If this is a film script or screenplay, please format it properly with scene headings, action, and dialogue. If there's no text visible, describe what you see in the image."
        ])
      ]
    });
    
    // Extract text from response
    const response = await result.response;
    const extractedText = response.text();
    
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
    
    // Create a temporary file for the PDF
    const pdfPath = await bufferToTempFile(pdfBuffer, '.pdf');
    
    // Initialize Gemini client
    const { genAI, safetySettings } = initializeGeminiClient();
    
    // Upload the file to Google Generative AI
    const fileModel = genAI.files;
    const uploadedFile = await fileModel.upload({
      file: pdfPath,
      config: { mimeType: 'application/pdf' }
    });
    
    console.log("Successfully uploaded PDF file to Google AI");
    
    // Use Gemini to extract and enhance text from the PDF
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      safetySettings
    });
    
    // Create content parts for the model
    const createUserContent = model.startContentChat().createUserContent;
    const createPartFromUri = model.startContentChat().createPartFromUri;
    
    const result = await model.generateContent({
      contents: [
        createUserContent([
          createPartFromUri(uploadedFile.uri, uploadedFile.mimeType),
          "\n\n",
          "Please extract the text content from this PDF. If this is a film script or screenplay, please format it properly with scene headings, action, and dialogue. Preserve the proper script format as much as possible."
        ])
      ]
    });
    
    // Extract text from response
    const response = await result.response;
    const extractedText = response.text();
    
    // Clean up the temporary file
    try {
      fs.unlinkSync(pdfPath);
    } catch (cleanupErr) {
      console.warn('Failed to clean up temporary PDF file:', cleanupErr);
    }
    
    return extractedText;
  } catch (error) {
    console.error('Error extracting text from PDF with Gemini:', error);
    
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