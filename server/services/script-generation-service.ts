// // server/services/script-generation-service.ts
// import {
//   GoogleGenerativeAI,
//   HarmCategory,
//   HarmBlockThreshold,
//   GenerationConfig as SDKGenerationConfig,
// } from "@google/generative-ai";
// import { ScriptGenerationFormData, FilmRatingEnum, FilmRatingType } from "@shared/schema";

// let genAIInstance: GoogleGenerativeAI | null = null;

// function initializeGenAIClient(): GoogleGenerativeAI {
//   if (genAIInstance) {
//     return genAIInstance;
//   }
//   const apiKey = process.env.GEMINI_API_KEY;
//   if (!apiKey) {
//     console.error(
//       "CRITICAL: GEMINI_API_KEY environment variable is not set for Script Generation Service",
//     );
//     throw new Error("GEMINI_API_KEY environment variable is not set");
//   }
//   genAIInstance = new GoogleGenerativeAI(apiKey);
//   return genAIInstance;
// }

// const safetySettings = [
//   { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
//   { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
//   { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
//   { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
// ];

// // Helper to provide rating descriptions
// function getRatingDescription(ratingKey: FilmRatingType): string {
//     const ratingValue = FilmRatingEnum[ratingKey as keyof typeof FilmRatingEnum];
//     switch (ratingValue) {
//         case 'G': return "General Audiences. All ages admitted. No content that would be offensive to parents for viewing by children.";
//         case 'PG': return "Parental Guidance Suggested. Some material may not be suitable for children. Parents urged to give 'parental guidance'. May contain some material parents might not like for their young children.";
//         case 'PG-13': return "Parents Strongly Cautioned. Some material may be inappropriate for children under 13. Parents are urged to be cautious. Some material may be inappropriate for pre-teenagers.";
//         case 'R': return "Restricted. Children Under 17 Require Accompanying Parent or Adult Guardian. Contains some adult material. Parents are urged to learn more about the film before taking their young children with them.";
//         case 'NC-17': return "Adults Only. No One 17 and Under Admitted. Clearly adult. Children are not admitted.";
//         default: return "General content guidelines apply.";
//     }
// }


// export async function generateScriptWithGemini(formData: ScriptGenerationFormData): Promise<string> {
//   const logPrefix = "[Gemini Script Gen]";
//   console.log(`${logPrefix} Starting script generation for title: ${formData.projectTitle}`);

//   try {
//     const genAI = initializeGenAIClient();
//     const model = genAI.getGenerativeModel({
//       model: "gemini-1.5-pro-latest", 
//       safetySettings,
//       generationConfig: {
//         temperature: 0.7, 
//         topK: 40,
//         topP: 0.95,
//         maxOutputTokens: 24000, 
//         responseMimeType: "text/plain", // Ensure plain text output
//       } as SDKGenerationConfig,
//     });

//     const ratingDescription = getRatingDescription(formData.targetedRating);

//     const prompt = `
// You are an expert Hollywood screenwriter. Your task is to write a complete, original feature film screenplay based on the provided details. The screenplay should be approximately 90-120 pages long (standard screenplay format where 1 page equals roughly 1 minute of screen time).

// Project Details:
// - Project Title: "${formData.projectTitle}"
// - Logline: "${formData.logline}"
// - Description/Synopsis: "${formData.description}"
// - Genre: "${formData.genre}"
// - Core Concept/Idea: "${formData.concept}"
// - Targeted Rating: ${formData.targetedRating} (${ratingDescription})
// - Primary Story Location: "${formData.storyLocation}"
// - Special Requests (if any): "${formData.specialRequest || "None"}"

// Screenplay Requirements:
// 1.  Length: 90-120 pages. This is crucial. Approximate this length with your output.
// 2.  Originality: The story must be an original idea. Do NOT base it on any existing movies, books, TV shows, or other copyrighted properties.
// 3.  Formatting: Adhere strictly to standard screenplay format:
//     *   Scene Headings: ALL CAPS (e.g., INT. COFFEE SHOP - DAY).
//     *   Action/Description: Standard sentence case, describing visuals and character actions.
//     *   Character Names (before dialogue): ALL CAPS, indented.
//     *   Dialogue: Standard sentence case, indented under the character name.
//     *   Parentheticals: (e.g., (to herself), (beat)), indented under character name, before dialogue.
//     *   Transitions: (e.g., FADE IN:, FADE OUT., CUT TO:), ALL CAPS, typically right-aligned or on their own line.
//     *   Page numbers are NOT required in the generated text itself.
// 4.  Content Guidelines: Strictly adhere to the targeted rating: ${formData.targetedRating}. ${ratingDescription}.
// 5.  Character Development: Ensure main characters are well-developed with clear motivations and arcs. Secondary characters should also be distinct.
// 6.  Story Structure: Employ a clear three-act structure (or a suitable alternative narrative structure if appropriate for the genre and concept). Ensure a compelling plot with rising action, climax, and resolution.
// 7.  Pacing: Maintain appropriate pacing for the genre.
// 8.  Tone: Maintain a consistent tone throughout the script, aligned with the specified genre.
// 9.  Location Integration: The primary story location ("${formData.storyLocation}") should be integral to the story, not just a backdrop. Use it to enhance atmosphere, plot, and character interactions.
// 10. Dialogue: Write natural, engaging, and character-appropriate dialogue.
// 11. Special Requests: If special requests are provided, incorporate them naturally into the story.
// 12. Completeness: The screenplay should feel like a complete narrative, from start to finish.

// Begin with "FADE IN:" and end with "FADE OUT." or "THE END".

// Do NOT include any pre-amble, conversation, or text other than the screenplay itself.

// SCREENPLAY:
// `;

//     console.log(`${logPrefix} Sending prompt to Gemini. Title: ${formData.projectTitle}`);
//     const result = await model.generateContent(prompt);
//     const response = await result.response;
//     const scriptText = response.text();

//     if (!scriptText || scriptText.trim().length < 1000) { 
//       console.warn(`${logPrefix} Gemini returned a very short or empty script for "${formData.projectTitle}". Length: ${scriptText?.length}`);
//       throw new Error("AI failed to generate a substantial script. The response was too short.");
//     }

//     console.log(`${logPrefix} Successfully generated script for "${formData.projectTitle}". Length: ${scriptText.length}`);
//     return scriptText;

//   } catch (error: any) {
//     console.error(`${logPrefix} Error generating script with Gemini for "${formData.projectTitle}":`, error.message || error);
//     if (error.response && error.response.data) {
//       console.error(`${logPrefix} Gemini API error details:`, error.response.data);
//     }
//     const geminiError = error.message?.includes("Google API error") ? error.message : "An error occurred during AI script generation.";
//     throw new Error(geminiError);
//   }
// }


// server/services/script-generation-service.ts
import {
  GoogleGenAI,
  HarmCategory,
  HarmBlockThreshold,
  type GenerateContentRequest,
  type GenerateContentResult,
  type GenerationConfig as SDKGenerationConfig,
  type Content as SDKContent,
  type Tool as SDKTool,
  type SafetySetting as SDKSafetySetting,
  FinishReason,
} from "@google/genai";
import { ScriptGenerationFormData, FilmRatingEnum, FilmRatingType } from "@shared/schema";

let genAIClientInstance: GoogleGenAI | null = null;
const MODEL_NAME = "gemini-2.5-pro-preview-05-06"; 

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

// defaultTools might not be needed for pure text generation but kept for consistency if other parts of Gemini SDK are used.
const defaultTools: SDKTool[] = []; // Removed googleSearch as it's likely not needed for script writing

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

const APPROX_TOKENS_PER_PAGE = 256;
const NUM_AGENTS = 10;
const MIN_TOTAL_PAGES = 90;
const MAX_TOTAL_PAGES = 120;

export async function generateScriptWithGemini(formData: ScriptGenerationFormData): Promise<string> {
  const logPrefix = `[Gemini Script Gen Segments - Title: ${formData.projectTitle}]`;
  console.log(`${logPrefix} Starting segmented script generation.`);

  const genAI = initializeGenAIClient();

  // 1. Determine total pages and segment size
  const targetTotalPages = Math.floor(Math.random() * (MAX_TOTAL_PAGES - MIN_TOTAL_PAGES + 1)) + MIN_TOTAL_PAGES;
  const pagesPerAgent = Math.ceil(targetTotalPages / NUM_AGENTS); // Ensure we cover all pages
  const approxTokensPerAgent = pagesPerAgent * APPROX_TOKENS_PER_PAGE;

  console.log(`${logPrefix} Target: ${targetTotalPages} pages total, ~${pagesPerAgent} pages per agent (~${approxTokensPerAgent} tokens).`);

  let fullScriptText = "";
  let previousSegmentContext = ""; // For providing continuation context

  for (let i = 1; i <= NUM_AGENTS; i++) {
    console.log(`${logPrefix} Starting Agent ${i} of ${NUM_AGENTS}.`);

    const ratingDescription = getRatingDescription(formData.targetedRating);
    let agentSpecificInstructions = "";

    if (i === 1) {
      agentSpecificInstructions = `This is segment 1 of ${NUM_AGENTS}. Start the screenplay with "FADE IN:". Establish the beginning of the story. Generate approximately ${pagesPerAgent} pages of script content.`;
      previousSegmentContext = `Project Details:\n- Project Title: "${formData.projectTitle}"\n- Logline: "${formData.logline}"\n- Description/Synopsis: "${formData.description}"\n- Genre: "${formData.genre}"\n- Core Concept/Idea: "${formData.concept}"\n- Targeted Rating: ${formData.targetedRating} (${ratingDescription})\n- Primary Story Location: "${formData.storyLocation}"\n- Special Requests (if any): "${formData.specialRequest || "None"}"\n\nBegin with "FADE IN:".`;
    } else {
      // For subsequent agents, provide the tail of the previous content
      const contextLines = 20; // Number of lines from the end of previous segment to provide as context
      const previousLines = previousSegmentContext.split('\n').slice(-contextLines).join('\n');

      agentSpecificInstructions = `This is segment ${i} of ${NUM_AGENTS}. Continue the story coherently from the following excerpt of the previous segment. Generate approximately ${pagesPerAgent} pages of script content to advance the plot.

PREVIOUS SCRIPT EXCERPT (for continuation):
---
${previousLines}
---
`;
      if (i === NUM_AGENTS) {
        agentSpecificInstructions += `\nThis is the FINAL segment. Bring the story to a satisfying conclusion. Ensure all major plot points are resolved. End with "FADE OUT." or "THE END".`;
      }
    }

    const prompt = `
You are an expert Hollywood screenwriter contributing to a larger screenplay. Your task is to write a specific segment of an original feature film screenplay.

Overall Project Details (for context):
- Project Title: "${formData.projectTitle}"
- Logline: "${formData.logline}"
- Genre: "${formData.genre}"
- Targeted Rating: ${formData.targetedRating} (${ratingDescription})
- Primary Story Location: "${formData.storyLocation}"

Segment-Specific Instructions:
${agentSpecificInstructions}

Formatting Requirements (Strictly Adhere):
- Scene Headings: ALL CAPS (e.g., INT. COFFEE SHOP - DAY).
- Action/Description: Standard sentence case.
- Character Names (before dialogue): ALL CAPS, indented.
- Dialogue: Standard sentence case, indented under the character name.
- Parentheticals: (e.g., (to herself)), indented.
- Transitions: (e.g., CUT TO:), ALL CAPS.
- Do NOT include page numbers.
- Do NOT repeat "FADE IN:" unless it's the very first segment.
- Do NOT include any pre-amble, notes, or text other than the screenplay segment itself.

CONTINUE SCRIPT SEGMENT HERE:
`;

    const generationConfigForRequest: SDKGenerationConfig = {
      temperature: 0.7, // Maintain some creativity
      topK: 40,
      topP: 0.95,
      maxOutputTokens: Math.min(8000, approxTokensPerAgent + 1000), // Max for safety, but aim for segment size + buffer
      responseMimeType: "text/plain",
    };

    const contentsForRequest: SDKContent[] = [{ role: "user", parts: [{ text: prompt }] }];
    const request: GenerateContentRequest = {
      model: MODEL_NAME,
      contents: contentsForRequest,
      tools: defaultTools, // Kept for consistency, might not be used for text generation
      generationConfig: generationConfigForRequest,
      safetySettings: defaultSafetySettings,
    };

    try {
      console.log(`${logPrefix} Agent ${i}: Sending request to Gemini.`);
      const result: GenerateContentResult = await genAIClientInstance.models.generateContent(request);

      if (result.promptFeedback?.blockReason) {
        throw new Error(`Request blocked by API (Agent ${i}): ${result.promptFeedback.blockReason}`);
      }
      if (!result.candidates || result.candidates.length === 0 || result.candidates[0].finishReason === FinishReason.SAFETY) {
         const safetyRatings = result.candidates?.[0]?.safetyRatings;
         console.error(`${logPrefix} Agent ${i}: No valid candidates or blocked due to safety. Finish Reason: ${result.candidates?.[0]?.finishReason}. Safety: ${JSON.stringify(safetyRatings)}`);
        throw new Error(`No valid candidates or blocked by safety filter (Agent ${i}). Finish Reason: ${result.candidates?.[0]?.finishReason}`);
      }

      let segmentText = "";
      if (result.candidates[0]?.content?.parts) {
        const textPart = result.candidates[0].content.parts.find((part) => "text" in part);
        if (textPart && "text" in textPart) {
          segmentText = textPart.text;
        }
      }
      if (!segmentText && typeof (result.candidates[0].content as any).text === 'string') {
        segmentText = (result.candidates[0].content as any).text;
      }
      if (!segmentText) {
        throw new Error(`Agent ${i}: Empty response text from Gemini.`);
      }

      console.log(`${logPrefix} Agent ${i}: Received segment of length ${segmentText.length}.`);
      fullScriptText += (fullScriptText ? "\n\n" : "") + segmentText.trim(); // Add segment
      previousSegmentContext = fullScriptText; // Update context for next agent

    } catch (agentError: any) {
      console.error(`${logPrefix} Error during Agent ${i} generation:`, agentError.message || agentError);
      // Allow other agents to attempt, but log the error
      // If a critical error occurs for multiple agents, the overall script might be incomplete
      // For now, we continue and assemble what we have. A more robust retry or error handling strategy could be added.
      if (i < NUM_AGENTS) { // If not the last agent, add a note about the error
          fullScriptText += (fullScriptText ? "\n\n" : "") + `[AI_NOTE: Segment ${i} generation encountered an issue. The story may be disjointed here.]\n\n`;
      } else { // If last agent fails, it's more critical
          throw new Error(`Failed to generate final segment (Agent ${i}): ${agentError.message}`);
      }
    }
     // Artificial delay to help avoid rate limits if any
     if (i < NUM_AGENTS) {
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  if (fullScriptText.trim().length < MIN_TOTAL_PAGES * APPROX_TOKENS_PER_PAGE * 0.5) { // Check if total output is too small
    console.warn(`${logPrefix} Final generated script is very short. Length: ${fullScriptText.length}. Target pages: ${targetTotalPages}`);
    throw new Error("AI failed to generate a substantial script. The combined output was too short.");
  }

  console.log(`${logPrefix} Successfully generated all segments. Total script length: ${fullScriptText.length}.`);
  return fullScriptText.trim();
}