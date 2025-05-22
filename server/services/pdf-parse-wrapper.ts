import fs from 'fs';
import path from 'path';
import originalPdfParse from 'pdf-parse';

// Create a wrapper around pdf-parse to handle PDF parsing safely
const pdfParse = async (dataBuffer: Buffer, options?: any): Promise<any> => {
  try {
    // Call the original pdf-parse function directly
    return await originalPdfParse(dataBuffer, options);
  } catch (error) {
    console.error('Error in pdf-parse wrapper:', error);
    
    // If we encounter an error, attempt to return a minimal result structure
    // This ensures the application doesn't crash completely on PDF parsing issues
    return {
      text: "Failed to parse PDF content. The file may be corrupted or in an unsupported format.",
      numpages: 1,
      info: {},
      metadata: {},
      version: "1.0",
    };
  }
};

export default pdfParse;