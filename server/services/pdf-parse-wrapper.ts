import fs from 'fs';
import path from 'path';
import originalPdfParse from 'pdf-parse';

// Create a wrapper around pdf-parse to handle the file system check it does
const pdfParse = async (dataBuffer: Buffer, options?: any): Promise<any> => {
  // Override the fs.readFileSync to prevent it from looking for test files
  const originalReadFileSync = fs.readFileSync;
  
  // Mock readFileSync for the specific test file path
  const mockReadFileSync = function(filePath: fs.PathLike, options?: any) {
    if (filePath === './test/data/05-versions-space.pdf') {
      // Return an empty buffer to avoid the file not found error
      return Buffer.from([]);
    }
    return originalReadFileSync(filePath, options);
  };
  
  // Replace the readFileSync function with our mock version
  (fs as any).readFileSync = mockReadFileSync;
  
  try {
    // Call the original pdf-parse function
    return await originalPdfParse(dataBuffer, options);
  } finally {
    // Restore the original readFileSync function
    (fs as any).readFileSync = originalReadFileSync;
  }
};

export default pdfParse;