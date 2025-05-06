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

// Implementation with mock data for testing
export async function extractScriptFromPdf(pdfBuffer: Buffer): Promise<ScriptParsingResult> {
  try {
    console.log('Processing script with sample script data for testing');
    
    // Sample script for testing
    const mockContent = `
TITLE: PROJECT AURORA

INT. TECH STARTUP OFFICE - DAY

ALEX (35), focused and ambitious, stares at multiple screens displaying code. The office is modern but cluttered with gadgets and empty coffee cups.

JORDAN (28) enters, carrying a tablet.

JORDAN
The investors are waiting in the conference room.

ALEX
(not looking away from screens)
Tell them I'm finalizing the demo. Five more minutes.

JORDAN
That's what you said half an hour ago. They're getting impatient.

Alex sighs, stands up and grabs a sleek prototype device from the desk.

ALEX
Fine. Let's go wow them.

INT. CONFERENCE ROOM - DAY

Five INVESTORS in business attire sit around a large table. Alex connects the prototype to a large display.

ALEX
Project Aurora isn't just another smart device. It's the first AI assistant that truly understands human emotion.

Alex activates the device. A soft blue light pulses.

DEVICE
Hello Alex. Your stress levels are elevated. Would you like me to play your relaxation playlist?

The investors look impressed.

EXT. COFFEE SHOP - LATER

Alex and Jordan sit at an outdoor table, celebratory coffees in hand.

JORDAN
They loved it! Two million in seed funding!

ALEX
(smiling)
Now the real work begins.

A sleek ELECTRIC CAR drives by, catching Alex's attention.

INT. ALEX'S APARTMENT - NIGHT

Alex works on the prototype at a home desk. The device glows.

DEVICE
You've been working for six hours straight, Alex. May I suggest ordering dinner?

ALEX
Good call. Order from that Thai place I like.

Alex continues typing as the device processes the request.

EXT. CITY PARK - DAY

Alex jogs through the park wearing SMART RUNNING SHOES that glow with each step. The prototype device is strapped to Alex's arm like a fitness tracker.

DEVICE
Your pace is 15% faster than yesterday. Great improvement!

Alex smiles and picks up the pace as modern music plays through wireless earbuds.
`;

    const scenes = extractScenes(mockContent);
    console.log(`Created ${scenes.length} test scenes for demo purposes`);
    
    return {
      title: "PROJECT AURORA",
      content: mockContent,
      scenes
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
