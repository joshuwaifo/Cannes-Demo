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

// Mocked function for PDF processing - to be replaced with real implementation later
export async function extractScriptFromPdf(pdfBuffer: Buffer): Promise<ScriptParsingResult> {
  try {
    // Create a sample script result instead of processing the PDF for now
    // This is a temporary solution until PDF.js issues are resolved
    const mockContent = `
INT. COFFEE SHOP - DAY

SARAH (28) sits by the window, typing on her laptop. The coffee shop is moderately busy.

MICHAEL (30) enters, spots Sarah, and approaches her table.

MICHAEL
Hey, sorry I'm late. Traffic was a nightmare.

SARAH
(looking up)
No worries, I just got here.

EXT. STREET - DAY

Michael and Sarah walk along a busy downtown street.

SARAH
So what did you think of the proposal?

MICHAEL
It has potential, but I think we need more market research.

INT. OFFICE BUILDING - LATER

Michael presents to a room full of EXECUTIVES.

MICHAEL
As you can see from these numbers, the opportunity is significant.
    `;
    
    // Extract scenes
    const scenes = extractScenes(mockContent);
    
    return {
      title: "SAMPLE SCRIPT",
      content: mockContent,
      scenes
    };
  } catch (error) {
    console.error('Script processing error:', error);
    throw new Error('Failed to process script');
  }
}

function extractScenes(scriptText: string): ExtractedScene[] {
  // Regular expression to find scene headings (INT./EXT. patterns)
  const sceneHeadingRegex = /(INT\.|EXT\.|INT\/EXT\.)[^\n]+/gi;
  const scenes: ExtractedScene[] = [];
  
  // Find potential scene headings
  let match;
  let lastIndex = 0;
  let sceneNumber = 1;
  
  while ((match = sceneHeadingRegex.exec(scriptText)) !== null) {
    // Get the heading
    const heading = match[0].trim();
    const headingIndex = match.index;
    
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
  
  return scenes;
}
