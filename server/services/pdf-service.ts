// Simple interface for scene data
interface ExtractedScene {
  sceneNumber: number;
  heading: string;
  content: string;
}

interface ScriptParsingResult {
  title: string;
  content: string;
  scenes: ExtractedScene[];
}

import { extractTextFromImage, extractTextFromPdf } from './file-upload-service';

// Implementation for extracting text from files (PDF or images)
export async function extractScriptFromPdf(fileBuffer: Buffer, mimeType?: string): Promise<ScriptParsingResult> {
  try {
    // Check if the file is an image or PDF based on mime type
    const isImage = mimeType && mimeType.startsWith('image/');
    
    let extractedText = '';
    
    if (isImage && mimeType) {
      console.log(`Processing uploaded image file with MIME type: ${mimeType}`);
      
      // Use Gemini AI to extract text from image
      extractedText = await extractTextFromImage(fileBuffer, mimeType);
      console.log('Successfully extracted text from image using Gemini AI');
      
      // Log a sample of the extraction
      const truncatedText = extractedText.length > 100 
        ? extractedText.substring(0, 100) + '...' 
        : extractedText;
      console.log('Sample text extracted from image:', truncatedText);
    } else {
      // PDF processing
      console.log('Processing uploaded PDF file with Gemini AI...');
      
      // Use Gemini AI to extract text from PDF
      extractedText = await extractTextFromPdf(fileBuffer);
      console.log('Successfully extracted text from PDF using Gemini AI');
      
      // Log a sample of the extraction
      const truncatedText = extractedText.length > 100 
        ? extractedText.substring(0, 100) + '...' 
        : extractedText;
      console.log('Sample text extracted from PDF:', truncatedText);
    }
    
    // Extract a title from the first few lines
    const lines = extractedText.split('\n').filter((line: string) => line.trim() !== '');
    let title = "Untitled Script";
    
    // Look for a line that might be a title (all caps, early in document)
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      const line: string = lines[i].trim();
      if (line.toUpperCase() === line && line.length > 3 && !line.includes('EXT.') && !line.includes('INT.')) {
        title = line;
        break;
      }
    }
    
    // Extract scenes from the document
    const scenes = extractScenes(extractedText);
    console.log(`Extracted ${scenes.length} scenes from the uploaded file`);
    
    // If no scenes were found, create some basic ones
    const finalScenes = scenes.length > 0 ? scenes : createFallbackScenes(extractedText);
    
    return {
      title,
      content: extractedText,
      scenes: finalScenes
    };
  } catch (error) {
    console.error('Script processing error:', error);
    
    // Create a fallback response if everything fails
    const fallbackText = "Failed to process the uploaded file. The file may be corrupted or in an unsupported format.";
    
    return {
      title: "Untitled Script",
      content: fallbackText,
      scenes: [{
        sceneNumber: 1,
        heading: "UNTITLED SCENE",
        content: fallbackText
      }]
    };
  }
}

// Fallback method to create scenes if regular scene detection fails
function createFallbackScenes(scriptText: string): ExtractedScene[] {
  const scenes: ExtractedScene[] = [];
  const paragraphs = scriptText.split(/\n\s*\n/);
  
  // Create some scenes based on paragraphs or page breaks
  let sceneNumber = 1;
  let currentContent = '';
  
  // Group paragraphs into scenes (roughly 4-6 paragraphs per scene)
  const paragraphsPerScene = 5;
  
  for (let i = 0; i < paragraphs.length; i++) {
    currentContent += paragraphs[i] + '\n\n';
    
    // Create a new scene every few paragraphs
    if ((i + 1) % paragraphsPerScene === 0 || i === paragraphs.length - 1) {
      scenes.push({
        sceneNumber,
        heading: `SCENE ${sceneNumber}`,
        content: currentContent.trim()
      });
      
      sceneNumber++;
      currentContent = '';
    }
  }
  
  return scenes;
}

// function extractScenes(scriptText: string): ExtractedScene[] {
//   // Regular expression to find scene headings (INT./EXT. patterns)
//   // This pattern better captures standard screenplay format scene headings:
//   // They are usually all caps, start with INT/EXT, and sometimes include time of day
//   const sceneHeadingRegex = /\b(INT\.?|EXT\.?|INT\.?\/EXT\.?|I\/E\.?)[\s\.\-]+(.*?)(?:\s*-\s*|\s+)(DAY|NIGHT|MORNING|EVENING|AFTERNOON|DAWN|DUSK|LATER|CONTINUOUS|MOMENTS LATER|SAME TIME)(?:\b|$)/gi;
  
//   // For PDFs that don't have standard formatting, also look for numbered scenes
//   const numberedSceneRegex = /\bSCENE\s+(\d+)[:\.\s]+(.+?)$/gim;
  
//   const scenes: ExtractedScene[] = [];
  
//   // Find potential scene headings
//   let match;
//   let lastIndex = 0;
//   let sceneNumber = 1;
//   let allMatches: {index: number, heading: string}[] = [];
  
//   // Collect all matches from both regexes
//   while ((match = sceneHeadingRegex.exec(scriptText)) !== null) {
//     const fullMatch = match[0].trim();
//     allMatches.push({
//       index: match.index,
//       heading: fullMatch
//     });
//   }
  
//   // Reset regex lastIndex
//   sceneHeadingRegex.lastIndex = 0;
  
//   // Check for numbered scenes as well
//   while ((match = numberedSceneRegex.exec(scriptText)) !== null) {
//     const fullMatch = match[0].trim();
//     allMatches.push({
//       index: match.index,
//       heading: fullMatch
//     });
//   }
  
//   // Sort matches by their position in the text
//   allMatches.sort((a, b) => a.index - b.index);
  
//   // Now process matches in order
//   for (const matchInfo of allMatches) {
//     const heading = matchInfo.heading;
//     const headingIndex = matchInfo.index;
    
//     // If not the first scene, extract content of previous scene
//     if (scenes.length > 0) {
//       const previousScene = scenes[scenes.length - 1];
//       previousScene.content = scriptText
//         .substring(lastIndex, headingIndex)
//         .trim();
//     }
    
//     // Add the new scene
//     scenes.push({
//       sceneNumber,
//       heading,
//       content: '' // Will be filled in the next iteration
//     });
    
//     lastIndex = headingIndex + heading.length;
//     sceneNumber++;
//   }
  
//   // Handle the last scene's content
//   if (scenes.length > 0) {
//     const lastScene = scenes[scenes.length - 1];
//     lastScene.content = scriptText
//       .substring(lastIndex)
//       .trim();
//   }
  
//   // If no scenes were found using the regex, create at least one scene with the entire content
//   if (scenes.length === 0) {
//     scenes.push({
//       sceneNumber: 1,
//       heading: "UNTITLED SCENE",
//       content: scriptText.trim()
//     });
//   }
  
//   return scenes;
// }

type ExtractedScene = {
  sceneNumber: number;
  heading: string;
  content: string;
};

function extractScenes(scriptText: string): ExtractedScene[] {
  const sceneHeadingRegex = /\b(?:\d+\.\s*)?(INT\.?|EXT\.?|I\/E\.?|INT\/EXT\.?)[\s\.\-]+(.*?)(?:\s*[-\s]+\s*)(DAY|NIGHT|EVENING|MORNING|AFTERNOON|DUSK|DAWN|LATER|CONTINUOUS|MOMENTS LATER|SAME TIME)?\b/gi;
  const looseNumberedSceneRegex = /^\s*(\d+)[\.\)]\s+(?!INT\.?|EXT\.?|I\/E\.?|INT\/EXT\.?)([^\n]+)$/gim;

  type MatchInfo = { index: number; heading: string };
  const allMatches: MatchInfo[] = [];
  let match: RegExpExecArray | null;

  const seenIndices = new Set<number>();

  // Match standard and semi-standard scene headings
  while ((match = sceneHeadingRegex.exec(scriptText)) !== null) {
    if (!seenIndices.has(match.index)) {
      allMatches.push({
        index: match.index,
        heading: match[0].trim()
      });
      seenIndices.add(match.index);
    }
  }

  // Match scenes that are only numbered like: "1. SOME SCENE LABEL"
  while ((match = looseNumberedSceneRegex.exec(scriptText)) !== null) {
    const fullMatch = match[0].trim();
    if (!/\b(INT\.?|EXT\.?|I\/E\.?)\b/i.test(fullMatch) && !seenIndices.has(match.index)) {
      allMatches.push({
        index: match.index,
        heading: fullMatch
      });
      seenIndices.add(match.index);
    }
  }

  allMatches.sort((a, b) => a.index - b.index);

  const scenes: ExtractedScene[] = [];
  let sceneNumber = 1;
  let lastIndex = 0;

  for (const matchInfo of allMatches) {
    const headingIndex = matchInfo.index;

    if (scenes.length > 0) {
      scenes[scenes.length - 1].content = scriptText.substring(lastIndex, headingIndex).trim();
    }

    scenes.push({
      sceneNumber,
      heading: matchInfo.heading,
      content: ''
    });

    lastIndex = headingIndex + matchInfo.heading.length;
    sceneNumber++;
  }

  // Add final scene content
  if (scenes.length > 0) {
    scenes[scenes.length - 1].content = scriptText.substring(lastIndex).trim();
  } else {
    scenes.push({
      sceneNumber: 1,
      heading: 'UNTITLED SCENE',
      content: scriptText.trim()
    });
  }

  return scenes;
}
