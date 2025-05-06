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

import pdfParse from './pdf-parse-wrapper';

// Implementation for real PDF parsing
export async function extractScriptFromPdf(pdfBuffer: Buffer): Promise<ScriptParsingResult> {
  try {
    console.log('Processing uploaded PDF file...');
    
    // Use the PDF parse wrapper to extract text
    const pdfData = await pdfParse(pdfBuffer);
    const extractedText = pdfData.text;
    
    // Extract a title from the first few lines
    const lines = extractedText.split('\n').filter(line => line.trim() !== '');
    let title = "Untitled Script";
    
    // Look for a line that might be a title (all caps, early in document)
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      const line = lines[i].trim();
      if (line.toUpperCase() === line && line.length > 3 && !line.includes('EXT.') && !line.includes('INT.')) {
        title = line;
        break;
      }
    }
    
    // Get the sentences from the extracted text
    const sentences = extractedText
      .replace(/\n/g, ' ')
      .replace(/\s+/g, ' ')
      .split(/[.!?]+/)
      .filter(sentence => sentence.trim().length > 0);
    
    // Log the last sentence
    if (sentences.length > 0) {
      const lastSentence = sentences[sentences.length - 1].trim();
      console.log('Last sentence extracted from PDF:', lastSentence);
    } else {
      console.log('No complete sentences found in the PDF');
    }
    
    // Extract scenes from the document
    const scenes = extractScenes(extractedText);
    console.log(`Extracted ${scenes.length} scenes from the uploaded PDF`);
    
    return {
      title,
      content: extractedText,
      scenes: scenes.length > 0 ? scenes : createFallbackScenes(extractedText)
    };
  } catch (error) {
    console.error('Script processing error:', error);
    throw new Error('Failed to process script');
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

function extractScenes(scriptText: string): ExtractedScene[] {
  // Regular expression to find scene headings (INT./EXT. patterns)
  // This pattern better captures standard screenplay format scene headings:
  // They are usually all caps, start with INT/EXT, and sometimes include time of day
  const sceneHeadingRegex = /\b(INT\.?|EXT\.?|INT\.?\/EXT\.?|I\/E\.?)[\s\.\-]+(.*?)(?:\s*-\s*|\s+)(DAY|NIGHT|MORNING|EVENING|AFTERNOON|DAWN|DUSK|LATER|CONTINUOUS|MOMENTS LATER|SAME TIME)(?:\b|$)/gi;
  
  // For PDFs that don't have standard formatting, also look for numbered scenes
  const numberedSceneRegex = /\bSCENE\s+(\d+)[:\.\s]+(.+?)$/gim;
  
  const scenes: ExtractedScene[] = [];
  
  // Find potential scene headings
  let match;
  let lastIndex = 0;
  let sceneNumber = 1;
  let allMatches: {index: number, heading: string}[] = [];
  
  // Collect all matches from both regexes
  while ((match = sceneHeadingRegex.exec(scriptText)) !== null) {
    const fullMatch = match[0].trim();
    allMatches.push({
      index: match.index,
      heading: fullMatch
    });
  }
  
  // Reset regex lastIndex
  sceneHeadingRegex.lastIndex = 0;
  
  // Check for numbered scenes as well
  while ((match = numberedSceneRegex.exec(scriptText)) !== null) {
    const fullMatch = match[0].trim();
    allMatches.push({
      index: match.index,
      heading: fullMatch
    });
  }
  
  // Sort matches by their position in the text
  allMatches.sort((a, b) => a.index - b.index);
  
  // Now process matches in order
  for (const matchInfo of allMatches) {
    const heading = matchInfo.heading;
    const headingIndex = matchInfo.index;
    
    // If not the first scene, extract content of previous scene
    if (scenes.length > 0) {
      const previousScene = scenes[scenes.length - 1];
      previousScene.content = scriptText
        .substring(lastIndex, headingIndex)
        .trim();
    }
    
    // Add the new scene
    scenes.push({
      sceneNumber,
      heading,
      content: '' // Will be filled in the next iteration
    });
    
    lastIndex = headingIndex + heading.length;
    sceneNumber++;
  }
  
  // Handle the last scene's content
  if (scenes.length > 0) {
    const lastScene = scenes[scenes.length - 1];
    lastScene.content = scriptText
      .substring(lastIndex)
      .trim();
  }
  
  // If no scenes were found using the regex, create at least one scene with the entire content
  if (scenes.length === 0) {
    scenes.push({
      sceneNumber: 1,
      heading: "UNTITLED SCENE",
      content: scriptText.trim()
    });
  }
  
  return scenes;
}
