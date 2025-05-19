// server/services/enhanced-script-generation-service.ts
import {
  GoogleGenAI,
  HarmCategory,
  HarmBlockThreshold,
  type GenerationConfig as SDKGenerationConfig,
  type Content as SDKContent,
  type Tool as SDKTool,
  type SafetySetting as SDKSafetySetting,
  type GenerateContentResponse,
} from "@google/genai";
import { ScriptGenerationFormData, FilmRatingEnum, FilmRatingType } from "@shared/schema";

// Constants for script generation
const MODEL_NAME = "gemini-2.5-pro-preview-05-06";
const TOKENS_PER_PAGE = 400; // Approximate tokens per screenplay page
const MIN_PAGES = 90;
const MAX_PAGES = 120;
const PAGE_CHUNK_SIZE = 10; // Generate in chunks of 10 pages
const MAX_RETRIES = 3; // Maximum retries for a failed chunk

let genAIClientInstance: GoogleGenAI | null = null;

// Status updates interface
export interface ScriptGenerationProgress {
  currentChunk: number;
  totalChunks: number;
  pagesGenerated: number;
  targetPages: number;
  status: 'starting' | 'generating' | 'completed' | 'failed';
  statusMessage: string;
}

// Progress callback type
export type ProgressCallback = (progress: ScriptGenerationProgress) => void;

function initializeGenAIClient(): GoogleGenAI {
  if (genAIClientInstance) {
    return genAIClientInstance;
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error(
      "CRITICAL: GEMINI_API_KEY environment variable is not set for Script Generation Service",
    );
    throw new Error("GEMINI_API_KEY environment variable is not set");
  }
  genAIClientInstance = new GoogleGenAI({ apiKey: apiKey });
  return genAIClientInstance;
}

const defaultSafetySettings: SDKSafetySetting[] = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

const defaultTools: SDKTool[] = [{ googleSearch: {} }];

// Helper to provide rating descriptions
function getRatingDescription(ratingKey: FilmRatingType): string {
  const ratingValue = FilmRatingEnum[ratingKey as keyof typeof FilmRatingEnum];
  switch (ratingValue) {
    case 'G': return "General Audiences. All ages admitted. No content that would be offensive to parents for viewing by children.";
    case 'PG': return "Parental Guidance Suggested. Some material may not be suitable for children. Parents urged to give 'parental guidance'. May contain some material parents might not like for their young children.";
    case 'PG-13': return "Parents Strongly Cautioned. Some material may be inappropriate for children under 13. Parents are urged to be cautious. Some material may be inappropriate for pre-teenagers.";
    case 'R': return "Restricted. Children Under 17 Require Accompanying Parent or Adult Guardian. Contains some adult material. Parents are urged to learn more about the film before taking their young children with them.";
    case 'NC-17': return "Adults Only. No One 17 and Under Admitted. Clearly adult. Children are not admitted.";
    default: return "General content guidelines apply.";
  }
}

/**
 * Generates a random integer within a range (inclusive)
 */
function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Extracts the last few scenes from a script chunk to provide context
 * for the next chunk generation
 */
function extractLastScenes(scriptChunk: string, numScenes: number = 2): string {
  const scenes = scriptChunk.split(/INT\.|EXT\./).filter(s => s.trim().length > 0);
  let lastScenes = scenes.slice(-numScenes);
  
  if (lastScenes.length === 0) {
    // If we couldn't split by INT./EXT., use the last 1500 characters
    return scriptChunk.slice(-1500);
  }
  
  return 'INT.' + lastScenes[0];
}

/**
 * Generates a single chunk of the screenplay
 */
async function generateScriptChunk(
  genAI: GoogleGenAI,
  formData: ScriptGenerationFormData,
  chunkNumber: number,
  totalChunks: number,
  targetPages: number,
  previousChunkSummary: string = '',
  isFirstChunk: boolean = false,
  isFinalChunk: boolean = false
): Promise<string> {
  const logPrefix = `[Script Gen Chunk ${chunkNumber}/${totalChunks}]`;
  console.log(`${logPrefix} Starting generation for chunk ${chunkNumber} of ${totalChunks}`);
  
  // Calculate pages for this chunk and overall progress
  const pagesStart = (chunkNumber - 1) * PAGE_CHUNK_SIZE + 1;
  const pagesEnd = isFinalChunk ? targetPages : Math.min(chunkNumber * PAGE_CHUNK_SIZE, targetPages);
  const pageRange = `${pagesStart}-${pagesEnd}`;
  
  // Determine screenwriting agent role for this chunk
  let agentRole = "experienced screenwriter";
  if (chunkNumber === 1) {
    agentRole = "expert screenwriter specializing in openings and act 1 setup";
  } else if (isFinalChunk) {
    agentRole = "expert screenwriter specializing in climax and resolution";
  } else if (chunkNumber === Math.ceil(totalChunks / 2)) {
    agentRole = "expert screenwriter specializing in midpoint turns and act 2 development";
  }
  
  // Build the prompt
  const ratingDescription = getRatingDescription(formData.targetedRating);
  
  let prompt = `
You are an ${agentRole}, part of a collaborative screenwriting team. Your specific task is to write pages ${pageRange} of a ${targetPages}-page feature film screenplay.

Project Details:
- Project Title: "${formData.projectTitle}"
- Logline: "${formData.logline}"
- Description/Synopsis: "${formData.description}"
- Genre: "${formData.genre}"
- Core Concept/Idea: "${formData.concept}"
- Targeted Rating: ${formData.targetedRating} (${ratingDescription})
- Primary Story Location: "${formData.storyLocation}"
- Special Requests (if any): "${formData.specialRequest || "None"}"

${isFirstChunk ? `
This is the FIRST CHUNK (pages ${pageRange}) of the screenplay.
You must begin with "FADE IN:" and establish the main characters, setting, and initial conflict.
Your goal is to write approximately ${pagesEnd} pages of content that will engage the audience immediately.
` : ''}

${!isFirstChunk ? `
This is ${isFinalChunk ? 'the FINAL CHUNK' : 'CHUNK #' + chunkNumber} (pages ${pageRange}) of the screenplay.
You must continue from the previous material:

${previousChunkSummary}

Pick up exactly where the last part left off, maintaining consistent characters, plot, and tone.
` : ''}

${isFinalChunk ? `
As this is the FINAL CHUNK, you must bring the story to a satisfying conclusion.
Resolve the main conflicts and character arcs in a way that fits the established genre and tone.
Your section should end with "FADE OUT." or "THE END"
` : ''}

Screenplay Requirements:
1. Format: Adhere strictly to standard screenplay format:
   * Scene Headings: ALL CAPS (e.g., INT. COFFEE SHOP - DAY)
   * Action: Standard sentence case, describing visuals and actions
   * Character Names: ALL CAPS, centered above dialogue
   * Dialogue: Standard sentence case, indented under character name
   * Parentheticals: (e.g., (to herself)), indented between character name and dialogue
   * Transitions: (e.g., CUT TO:), ALL CAPS, right-aligned

2. Length: Focus on writing approximately ${pagesEnd - pagesStart + 1} screenplay pages (${TOKENS_PER_PAGE * (pagesEnd - pagesStart + 1)} tokens).

3. Character & Plot Consistency: Maintain consistency with any established characters, plot points, and tone.

4. Content Rating: Adhere to the specified rating: ${formData.targetedRating}. ${ratingDescription}

5. Do NOT include any explanation, commentary, or meta-text about the script. Only write the screenplay content itself.

6. If this is NOT the first chunk, do not repeat "FADE IN:" or any other opening elements.

7. If this is NOT the final chunk, do not include "FADE OUT." or "THE END".

YOUR TASK: Continue the script in proper screenplay format from exactly where the previous section left off.
`;

  // Create the content structure for the request
  const contentsForRequest: SDKContent[] = [{ role: "user", parts: [{ text: prompt }] }];

  // Build the request object
  const request: GenerateContentRequest = {
    model: MODEL_NAME,
    contents: contentsForRequest,
    tools: defaultTools,
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: PAGE_CHUNK_SIZE * TOKENS_PER_PAGE * 1.5, // Add buffer space
      responseMimeType: "text/plain",
    },
    safetySettings: defaultSafetySettings,
  };

  try {
    // Send the generation request
    console.log(`${logPrefix} Sending chunk generation request to Gemini`);
    const result: GenerateContentResult = await genAI.models.generateContent(request);

    // Error handling
    if (!result) {
      console.error(`${logPrefix} Gemini SDK returned a null or undefined result.`);
      throw new Error("Gemini SDK returned a null or undefined result.");
    }

    if (result.promptFeedback?.blockReason) {
      console.error(`${logPrefix} Request blocked. Reason: ${result.promptFeedback.blockReason}`, result.promptFeedback);
      throw new Error(`Request blocked by API: ${result.promptFeedback.blockReason}`);
    }

    if (!result.candidates || result.candidates.length === 0) {
      const safetyRatings = result.candidates?.[0]?.safetyRatings;
      const finishReason = result.candidates?.[0]?.finishReason;
      console.error(`${logPrefix} No valid candidates. Finish Reason: ${finishReason}, Safety Ratings:`, JSON.stringify(safetyRatings, null, 2));
      throw new Error(`No valid candidates or blocked. Finish Reason: ${finishReason}. Safety: ${JSON.stringify(safetyRatings)}`);
    }

    // Extract the text from the response
    let chunkText = "";
    if (result.candidates[0]?.content?.parts) {
      const textPart = result.candidates[0].content.parts.find((part) => "text" in part);
      if (textPart && "text" in textPart) {
        chunkText = textPart.text;
      }
    }

    // Alternative extraction methods if needed
    if (!chunkText && typeof (result.candidates[0].content as any).text === 'string') {
      chunkText = (result.candidates[0].content as any).text;
    }

    if (!chunkText) {
      console.error(`${logPrefix} Empty response text from Gemini. Full result object:`, JSON.stringify(result, null, 2));
      throw new Error("Empty response text from Gemini.");
    }

    // Basic validation to ensure we got back a substantial chunk
    if (chunkText.trim().length < 500) {
      console.warn(`${logPrefix} Gemini returned a very short chunk: ${chunkText.length} characters`);
      throw new Error("Generated chunk was too short");
    }

    console.log(`${logPrefix} Successfully generated chunk ${chunkNumber} (${chunkText.length} chars)`);
    return chunkText;
  } catch (error: any) {
    console.error(`${logPrefix} Error generating script chunk:`, error.message || error);
    throw error;
  }
}

/**
 * Generates a feature-length screenplay using multiple collaborative agents,
 * chunking the script generation process for reliability
 */
export async function generateFeatureLengthScript(
  formData: ScriptGenerationFormData, 
  onProgress?: ProgressCallback
): Promise<string> {
  const logPrefix = "[Enhanced Script Gen]";
  console.log(`${logPrefix} Starting enhanced feature-length script generation for "${formData.projectTitle}"`);
  
  try {
    // Initialize the AI client
    const genAI = initializeGenAIClient();
    
    // Determine target script length (random between min-max pages)
    const targetPages = getRandomInt(MIN_PAGES, MAX_PAGES);
    const totalChunks = Math.ceil(targetPages / PAGE_CHUNK_SIZE);
    
    console.log(`${logPrefix} Target script length: ${targetPages} pages (${totalChunks} chunks)`);
    
    // Report initial progress
    if (onProgress) {
      onProgress({
        currentChunk: 0,
        totalChunks,
        pagesGenerated: 0,
        targetPages,
        status: 'starting',
        statusMessage: `Planning ${targetPages}-page screenplay in ${totalChunks} chunks`,
      });
    }
    
    // Generate script in chunks
    let completeScript = "";
    let previousChunkSummary = "";
    
    for (let chunkNumber = 1; chunkNumber <= totalChunks; chunkNumber++) {
      // Update progress
      if (onProgress) {
        onProgress({
          currentChunk: chunkNumber,
          totalChunks,
          pagesGenerated: (chunkNumber - 1) * PAGE_CHUNK_SIZE,
          targetPages,
          status: 'generating',
          statusMessage: `Writing pages ${(chunkNumber - 1) * PAGE_CHUNK_SIZE + 1}–${Math.min(chunkNumber * PAGE_CHUNK_SIZE, targetPages)}...`,
        });
      }
      
      // Determine if this is first or last chunk
      const isFirstChunk = (chunkNumber === 1);
      const isFinalChunk = (chunkNumber === totalChunks);
      
      // Try to generate this chunk with retries
      let chunkText = "";
      let attempts = 0;
      
      while (attempts < MAX_RETRIES && !chunkText) {
        try {
          attempts++;
          chunkText = await generateScriptChunk(
            genAI,
            formData,
            chunkNumber,
            totalChunks,
            targetPages,
            previousChunkSummary,
            isFirstChunk,
            isFinalChunk
          );
        } catch (error) {
          console.error(`${logPrefix} Attempt ${attempts} failed for chunk ${chunkNumber}:`, error);
          if (attempts >= MAX_RETRIES) {
            // If all retries failed, report progress and throw error
            if (onProgress) {
              onProgress({
                currentChunk: chunkNumber,
                totalChunks,
                pagesGenerated: (chunkNumber - 1) * PAGE_CHUNK_SIZE,
                targetPages,
                status: 'failed',
                statusMessage: `Failed to generate chunk ${chunkNumber} after ${MAX_RETRIES} attempts`,
              });
            }
            throw new Error(`Failed to generate chunk ${chunkNumber} after ${MAX_RETRIES} attempts: ${error.message}`);
          }
          // Short pause before retry
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      // Fix potential formatting issues between chunks
      if (!isFirstChunk) {
        // Add proper spacing between chunks - ensure we don't have missing line breaks
        if (!completeScript.endsWith('\n\n') && !chunkText.startsWith('\n')) {
          completeScript += '\n\n';
        } else if (!completeScript.endsWith('\n') && !chunkText.startsWith('\n')) {
          completeScript += '\n';
        }
        
        // Remove any redundant "CONTINUED:" or other overlapping scene headings
        if (chunkText.startsWith('CONTINUED:') || chunkText.startsWith('(CONTINUED)')) {
          chunkText = chunkText.replace(/^CONTINUED:|\(CONTINUED\)/i, '').trim();
        }
      }
      
      // Append this chunk to the complete script
      completeScript += chunkText;
      
      // For the next chunk, extract the last scene(s) as context/summary
      if (!isFinalChunk) {
        previousChunkSummary = extractLastScenes(chunkText);
      }
      
      // Log progress
      console.log(`${logPrefix} Completed chunk ${chunkNumber}/${totalChunks}, total script length: ${completeScript.length} chars`);
    }
    
    // Final post-processing to ensure script formatting is correct and complete
    // Ensure we start with FADE IN: and end with FADE OUT. or THE END
    if (!completeScript.trim().toUpperCase().startsWith('FADE IN:')) {
      completeScript = 'FADE IN:\n\n' + completeScript;
    }
    
    if (!completeScript.trim().toUpperCase().endsWith('FADE OUT.') && 
        !completeScript.trim().toUpperCase().endsWith('THE END')) {
      completeScript += '\n\nFADE OUT.\n\nTHE END';
    }
    
    // Report completion
    if (onProgress) {
      onProgress({
        currentChunk: totalChunks,
        totalChunks,
        pagesGenerated: targetPages,
        targetPages,
        status: 'completed',
        statusMessage: `Completed ${targetPages}-page screenplay`,
      });
    }
    
    console.log(`${logPrefix} Successfully generated complete script for "${formData.projectTitle}". Length: ${completeScript.length} chars`);
    return completeScript;
    
  } catch (error: any) {
    console.error(`${logPrefix} Error in feature-length script generation:`, error.message || error);
    throw new Error(`Script generation failed: ${error.message}`);
  }
}