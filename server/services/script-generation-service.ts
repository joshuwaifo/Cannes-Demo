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
const MODEL_NAME = "gemini-2.5-pro-preview-05-06"; // Using the same model as in ai-suggestion-service

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

export async function generateScriptWithGemini(formData: ScriptGenerationFormData): Promise<string> {
  const logPrefix = "[Gemini Script Gen]";
  console.log(`${logPrefix} Starting script generation for title: ${formData.projectTitle}`);

  try {
    const genAI = initializeGenAIClient();

    // Build the prompt
    const ratingDescription = getRatingDescription(formData.targetedRating);

    const prompt = `
You are an expert Hollywood screenwriter. Your task is to write a complete, original feature film screenplay based on the provided details. The screenplay should be approximately 90-120 pages long (standard screenplay format where 1 page equals roughly 1 minute of screen time). Each page is approximately 268 tokens, and in total, at least 24000 tokens should be generated.

Project Details:
- Project Title: "${formData.projectTitle}"
- Logline: "${formData.logline}"
- Description/Synopsis: "${formData.description}"
- Genre: "${formData.genre}"
- Core Concept/Idea: "${formData.concept}"
- Targeted Rating: ${formData.targetedRating} (${ratingDescription})
- Primary Story Location: "${formData.storyLocation}"
- Special Requests (if any): "${formData.specialRequest || "None"}"

Screenplay Requirements:
1.  Length: 90-120 pages. This is crucial. Approximate this length with your output.
2.  Originality: The story must be an original idea. Do NOT base it on any existing movies, books, TV shows, or other copyrighted properties.
3.  Formatting: Adhere strictly to standard screenplay format:
    *   Scene Headings: ALL CAPS (e.g., INT. COFFEE SHOP - DAY).
    *   Action/Description: Standard sentence case, describing visuals and character actions.
    *   Character Names (before dialogue): ALL CAPS, indented.
    *   Dialogue: Standard sentence case, indented under the character name.
    *   Parentheticals: (e.g., (to herself), (beat)), indented under character name, before dialogue.
    *   Transitions: (e.g., FADE IN:, FADE OUT., CUT TO:), ALL CAPS, typically right-aligned or on their own line.
    *   Page numbers are NOT required in the generated text itself.
4.  Content Guidelines: Strictly adhere to the targeted rating: ${formData.targetedRating}. ${ratingDescription}.
5.  Character Development: Ensure main characters are well-developed with clear motivations and arcs. Secondary characters should also be distinct.
6.  Story Structure: Employ a clear three-act structure (or a suitable alternative narrative structure if appropriate for the genre and concept). Ensure a compelling plot with rising action, climax, and resolution.
7.  Pacing: Maintain appropriate pacing for the genre.
8.  Tone: Maintain a consistent tone throughout the script, aligned with the specified genre.
9.  Location Integration: The primary story location ("${formData.storyLocation}") should be integral to the story, not just a backdrop. Use it to enhance atmosphere, plot, and character interactions.
10. Dialogue: Write natural, engaging, and character-appropriate dialogue.
11. Special Requests: If special requests are provided, incorporate them naturally into the story.
12. Completeness: The screenplay should feel like a complete narrative, from start to finish.

Begin with "FADE IN:" and end with "FADE OUT." or "THE END".

Do NOT include any pre-amble, conversation, or text other than the screenplay itself.

SCREENPLAY:
`;

    console.log(`${logPrefix} Sending prompt to Gemini. Title: ${formData.projectTitle}`);
    console.log(`${logPrefix} Prompt: ${prompt}`)

    // Set up the generation request using the new GoogleGenAI SDK format
    const generationConfigForRequest: SDKGenerationConfig = {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 60000,
      // minOutputTokens: 24000
      responseMimeType: "text/plain", // Ensure plain text output
    };

    // Create the content structure for the request
    const contentsForRequest: SDKContent[] = [{ role: "user", parts: [{ text: prompt }] }];

    // Build the request object
    const request: GenerateContentRequest = {
      model: MODEL_NAME, 
      contents: contentsForRequest,
      tools: defaultTools,
      generationConfig: generationConfigForRequest, 
      safetySettings: defaultSafetySettings,
    };

    // Send the generation request
    const result: GenerateContentResult = await genAI.models.generateContent(request);

    // Error handling based on ai-suggestion-service pattern
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
    let scriptText = "";
    if (result.candidates[0]?.content?.parts) { 
      const textPart = result.candidates[0].content.parts.find((part) => "text" in part); 
      if (textPart && "text" in textPart) { 
        scriptText = textPart.text; 
      }
    }

    // Alternative extraction methods if needed
    if (!scriptText && typeof (result.candidates[0].content as any).text === 'string') {
      scriptText = (result.candidates[0].content as any).text;
    }

    if (!scriptText) { 
      console.error(`${logPrefix} Empty response text from Gemini. Full result object:`, JSON.stringify(result, null, 2)); 
      throw new Error("Empty response text from Gemini."); 
    }

    if (!scriptText || scriptText.trim().length < 1000) { 
      console.warn(`${logPrefix} Gemini returned a very short or empty script for "${formData.projectTitle}". Length: ${scriptText?.length}`);
      throw new Error("AI failed to generate a substantial script. The response was too short.");
    }

    console.log(`${logPrefix} Successfully generated script for "${formData.projectTitle}". Length: ${scriptText.length}`);
    return scriptText;

  } catch (error: any) {
    console.error(`${logPrefix} Error generating script with Gemini for "${formData.projectTitle}":`, error.message || error);
    if (error.response && error.response.data) {
      console.error(`${logPrefix} Gemini API error details:`, error.response.data);
    }
    const geminiError = error.message?.includes("Google API error") ? error.message : "An error occurred during AI script generation.";
    throw new Error(geminiError);
  }
}