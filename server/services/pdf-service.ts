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

// Real implementation for PDF processing
export async function extractScriptFromPdf(pdfBuffer: Buffer): Promise<ScriptParsingResult> {
  try {
    // Load pdf.js
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
    
    // Load PDF document from buffer
    const loadingTask = pdfjsLib.getDocument({ data: pdfBuffer });
    const pdf = await loadingTask.promise;
    
    console.log(`PDF loaded with ${pdf.numPages} pages`);
    
    // Extract text from all pages
    let fullText = '';
    let title = 'Untitled Script';
    
    // Process each page
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      
      // Extract text items
      const pageText = textContent.items.map((item: any) => 
        item.str
      ).join(' ').replace(/\s+/g, ' ');
      
      fullText += pageText + '\n\n';
      
      // Try to extract title from the first page
      if (i === 1) {
        // Attempt to find title (usually in all caps near the top of the first page)
        const titleMatch = pageText.match(/^[\s\n]*([A-Z][A-Z\s]+)[\s\n]/);
        if (titleMatch && titleMatch[1]) {
          title = titleMatch[1].trim();
        }
      }
    }
    
    // Clean up the text
    fullText = fullText
      .replace(/\r\n/g, '\n')                 // Normalize line endings
      .replace(/\n{3,}/g, '\n\n')             // Remove excessive line breaks
      .replace(/\s{2,}/g, ' ')                // Remove excessive spaces
      .trim();
    
    console.log(`Extracted ${fullText.length} characters of text`);
    
    // Extract scenes from the text
    const scenes = extractScenes(fullText);
    console.log(`Identified ${scenes.length} scenes`);
    
    return {
      title,
      content: fullText,
      scenes
    };
  } catch (error) {
    console.error('Script processing error:', error);
    throw new Error('Failed to process script: ' + (error instanceof Error ? error.message : String(error)));
  }
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
