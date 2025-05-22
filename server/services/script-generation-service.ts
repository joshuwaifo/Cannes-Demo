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
import {
  ScriptGenerationFormData,
  FilmRatingEnum,
  FilmRatingType,
} from "@shared/schema";

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
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
];

// defaultTools might not be needed for pure text generation but kept for consistency
const defaultTools: SDKTool[] = [];

function getRatingDescription(ratingKey: FilmRatingType): string {
  const ratingValue = FilmRatingEnum[ratingKey as keyof typeof FilmRatingEnum];
  switch (ratingValue) {
    case "G":
      return "General Audiences. All ages admitted. No content that would be offensive to parents for viewing by children.";
    case "PG":
      return "Parental Guidance Suggested. Some material may not be suitable for children. Parents urged to give 'parental guidance'. May contain some material parents might not like for their young children.";
    case "PG-13":
      return "Parents Strongly Cautioned. Some material may be inappropriate for children under 13. Parents are urged to be cautious. Some material may be inappropriate for pre-teenagers.";
    case "R":
      return "Restricted. Children Under 17 Require Accompanying Parent or Adult Guardian. Contains some adult material. Parents are urged to learn more about the film before taking their young children with them.";
    case "NC-17":
      return "Adults Only. No One 17 and Under Admitted. Clearly adult. Children are not admitted.";
    default:
      return "General content guidelines apply.";
  }
}

// Constants for token estimation and generation targets
const APPROX_TOKENS_PER_CHAR = 0.25; // Rough estimate of tokens per character
const MIN_TOTAL_TOKENS = 32000;
const MAX_TOTAL_TOKENS = 48000;
const MAX_ITERATION_TOKENS = 2000; // Maximum tokens per API call
const CONTEXT_LINES = 20; // Number of lines to provide as context from previous generation

export async function generateScriptWithGemini(
  formData: ScriptGenerationFormData,
): Promise<string> {
  const logPrefix = `[Gemini Script Gen - Title: ${formData.projectTitle}]`;
  console.log(`${logPrefix} Starting single-agent looped script generation.`);

  const genAI = initializeGenAIClient();
  let fullScriptText = "";
  let estimatedTokensGenerated = 0;
  let iterationCount = 0;
  const ratingDescription = getRatingDescription(formData.targetedRating);

  while (estimatedTokensGenerated < MIN_TOTAL_TOKENS) {
    iterationCount++;
    console.log(
      `${logPrefix} Starting iteration ${iterationCount}. Current token estimate: ${estimatedTokensGenerated}`,
    );

    let iterationInstructions = "";
    let previousContext = "";

    if (iterationCount === 1) {
      // First iteration - start the screenplay
      iterationInstructions = `This is the beginning of the screenplay. Start with "FADE IN:". Establish the beginning of the story.`;
      previousContext = `Project Details:
- Project Title: "${formData.projectTitle}"
- Logline: "${formData.logline}"
- Description/Synopsis: "${formData.description}"
- Genre: "${formData.genre}"
- Core Concept/Idea: "${formData.concept}"
- Targeted Rating: ${formData.targetedRating} (${ratingDescription})
- Primary Story Location: "${formData.storyLocation}"
- Special Requests (if any): "${formData.specialRequest || "None"}"

Begin with "FADE IN:".`;
    } else {
      // Subsequent iterations - continue from previous content
      const previousLines = fullScriptText
        .split("\n")
        .slice(-CONTEXT_LINES)
        .join("\n");

      previousContext = `PREVIOUS SCRIPT EXCERPT (for continuation):
${previousLines}`;

      // If we're close to the target token count, instruct to wrap up
      if (estimatedTokensGenerated > MIN_TOTAL_TOKENS * 0.8) {
        iterationInstructions = `Continue the screenplay from the previous excerpt. You're approaching the end of the story, so begin wrapping up plot points and moving toward a conclusion.`;
      } else {
        iterationInstructions = `Continue the screenplay from the previous excerpt. Develop the story further, adding new scenes and advancing the plot.`;
      }

      // If we're very close to or exceeding the minimum, instruct to conclude
      if (estimatedTokensGenerated > MIN_TOTAL_TOKENS * 0.95) {
        iterationInstructions = `This should be the final segment of the screenplay. Bring the story to a satisfying conclusion. Ensure all major plot points are resolved. End with "FADE OUT." or "THE END".`;
      }
    }

    const prompt = `
You are an expert Hollywood screenwriter creating an original feature film screenplay.

Overall Project Details:
Project Title: "${formData.projectTitle}"
Logline: "${formData.logline}"
Genre: "${formData.genre}"
Targeted Rating: ${formData.targetedRating} (${ratingDescription})
Primary Story Location: "${formData.storyLocation}"

${previousContext}

Segment-Specific Instructions:
${iterationInstructions}

Formatting Requirements (Strictly Adhere):
- Scene Headings: ALL CAPS (e.g., INT. COFFEE SHOP - DAY).
- Action/Description: Standard sentence case.
- Character Names (before dialogue): ALL CAPS, indented.
- Dialogue: Standard sentence case, indented under the character name.
- Parentheticals: (e.g., (to herself)), indented.
- Transitions: (e.g., CUT TO:), ALL CAPS.
- Do NOT include page numbers.
- Do NOT repeat "FADE IN:" unless this is the first segment.
- Do NOT include any pre-amble, notes, or text other than the screenplay segment itself.

CONTINUE SCRIPT SEGMENT HERE:
`;

    const generationConfigForRequest: SDKGenerationConfig = {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: MAX_ITERATION_TOKENS,
      responseMimeType: "text/plain",
    };

    const contentsForRequest: SDKContent[] = [
      { role: "user", parts: [{ text: prompt }] },
    ];
    const request: GenerateContentRequest = {
      model: MODEL_NAME,
      contents: contentsForRequest,
      tools: defaultTools,
      generationConfig: generationConfigForRequest,
      safetySettings: defaultSafetySettings,
    };

    try {
      console.log(
        `${logPrefix} Iteration ${iterationCount}: Sending request to Gemini.`,
      );
      const result: GenerateContentResult =
        await genAI.models.generateContent(request);

      if (result.promptFeedback?.blockReason) {
        throw new Error(
          `Request blocked by API (Iteration ${iterationCount}): ${result.promptFeedback.blockReason}`,
        );
      }

      if (
        !result.candidates ||
        result.candidates.length === 0 ||
        result.candidates[0].finishReason === FinishReason.SAFETY
      ) {
        const safetyRatings = result.candidates?.[0]?.safetyRatings;
        console.error(
          `${logPrefix} Iteration ${iterationCount}: No valid candidates or blocked due to safety. Finish Reason: ${result.candidates?.[0]?.finishReason}. Safety: ${JSON.stringify(safetyRatings)}`,
        );
        throw new Error(
          `No valid candidates or blocked by safety filter (Iteration ${iterationCount}). Finish Reason: ${result.candidates?.[0]?.finishReason}`,
        );
      }

      let segmentText = "";
      if (result.candidates[0]?.content?.parts) {
        const textPart = result.candidates[0].content.parts.find(
          (part) => "text" in part,
        );
        if (textPart && "text" in textPart) {
          segmentText = textPart.text;
        }
      }

      if (
        !segmentText &&
        typeof (result.candidates[0].content as any).text === "string"
      ) {
        segmentText = (result.candidates[0].content as any).text;
      }

      if (!segmentText) {
        throw new Error(
          `Iteration ${iterationCount}: Empty response text from Gemini.`,
        );
      }

      // Add the segment to full script
      fullScriptText += (fullScriptText ? "\n\n" : "") + segmentText.trim();

      // Estimate tokens generated (rough approximation)
      const segmentTokens = Math.ceil(
        segmentText.length * APPROX_TOKENS_PER_CHAR,
      );
      estimatedTokensGenerated += segmentTokens;

      console.log(
        `${logPrefix} Iteration ${iterationCount}: Generated ~${segmentTokens} tokens. Total estimate: ${estimatedTokensGenerated}.`,
      );

      // Check if we've reached our target token count
      if (estimatedTokensGenerated >= MIN_TOTAL_TOKENS) {
        // If we don't have an ending yet and we're in range, let's add one more segment to wrap up
        if (
          !fullScriptText.includes("FADE OUT") &&
          !fullScriptText.includes("THE END") &&
          estimatedTokensGenerated < MAX_TOTAL_TOKENS
        ) {
          console.log(
            `${logPrefix} Reached minimum token count. Adding final segment to wrap up.`,
          );
          continue; // One more iteration with conclusion instructions
        } else {
          console.log(
            `${logPrefix} Script generation complete. Token estimate: ${estimatedTokensGenerated}.`,
          );
          break; // We're done!
        }
      }

      // Add a small delay between iterations to avoid rate limits
      if (estimatedTokensGenerated < MIN_TOTAL_TOKENS) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (error: any) {
      console.error(
        `${logPrefix} Error during iteration ${iterationCount}:`,
        error.message || error,
      );

      // If we have some content already, we can try to continue despite the error
      if (fullScriptText && estimatedTokensGenerated > MIN_TOTAL_TOKENS * 0.5) {
        console.warn(
          `${logPrefix} Error occurred, but we have generated ${estimatedTokensGenerated} tokens. Attempting to continue.`,
        );
        // Add a note about the error (will be visible in the output)
        fullScriptText += `\n\n[AI_NOTE: Generation encountered an issue here. The story may be disjointed.]\n\n`;
        continue;
      } else {
        // Not enough content to salvage, rethrow the error
        throw new Error(
          `Failed during iteration ${iterationCount}: ${error.message}`,
        );
      }
    }
  }

  // Final validation check
  if (
    fullScriptText.trim().length <
    MIN_TOTAL_TOKENS * APPROX_TOKENS_PER_CHAR * 0.5
  ) {
    console.warn(
      `${logPrefix} Final generated script is very short. Length: ${fullScriptText.length}. Target tokens: ${MIN_TOTAL_TOKENS}`,
    );
    throw new Error(
      "AI failed to generate a substantial script. The combined output was too short.",
    );
  }

  // Ensure we have a proper ending
  if (
    !fullScriptText.includes("FADE OUT") &&
    !fullScriptText.includes("THE END")
  ) {
    fullScriptText += "\n\nFADE OUT.\n\nTHE END";
  }

  console.log(
    `${logPrefix} Successfully generated complete script in ${iterationCount} iterations. Total script length: ${fullScriptText.length} chars, ~${estimatedTokensGenerated} tokens.`,
  );
  return fullScriptText.trim();
}
