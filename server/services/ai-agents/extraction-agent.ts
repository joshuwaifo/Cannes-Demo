/**
 * Character Extraction Agent
 * 
 * This agent is responsible for extracting all character names from an uploaded script
 * using AI. It runs immediately after file upload completes and populates the
 * character selection dropdown.
 */

import { initializeGeminiClient } from '../ai-suggestion-service';
import { ExtractedCharacter } from '../../types';
import { GenerationConfig } from '@google/generative-ai';

interface GeminiCharacterResponse {
  characters: ExtractedCharacter[];
}

/**
 * Extracts characters from a script using Gemini AI
 * 
 * @param scriptContent The content of the uploaded script
 * @returns Array of extracted characters with name, estimatedAgeRange, etc.
 */
export async function extractCharactersFromScript(
  scriptContent: string,
): Promise<ExtractedCharacter[]> {
  if (!scriptContent || scriptContent.trim().length < 50) {
    console.log(
      "[Extraction Agent] Script content is too short or empty. Skipping character extraction.",
    );
    return [];
  }

  const logPrefix = "[Extraction Agent]";
  console.log(
    `${logPrefix} Starting character extraction and age estimation from script (length: ${scriptContent.length}).`,
  );

  try {
    const { genAI, safetySettings } = initializeGeminiClient();
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      safetySettings,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1,
        maxOutputTokens: 8192,
      } as GenerationConfig,
    });

    const maxScriptCharsForPrompt = 650000;
    const scriptContentForPrompt =
      scriptContent.length > maxScriptCharsForPrompt
        ? scriptContent.substring(0, maxScriptCharsForPrompt) +
          "\n...[TRUNCATED FOR PROMPT]..."
        : scriptContent;

    const prompt = `
    You are an expert script analyst. Your task is to analyze the provided screenplay content and extract all unique speaking character names, along with an estimated age or age range for each character.

    Follow these specific steps:
    1. Extract all character names that have speaking lines. Look for names in all-caps, which is standard screenplay format for character names. 
    2. For each character, analyze dialogue and context to identify their approximate age range.
    3. When possible, determine the gender of each character from context clues in the script.
    4. Analyze the character's importance in the story and categorize as (lead, supporting, or minor role).
    5. Provide a budget tier recommendation for casting (low, medium, high) based on the character's importance.

    Important: Only extract real characters who speak or are directly mentioned, not scene direction labels or camera instructions.

    SCREENPLAY:
    ${scriptContentForPrompt}

    Reply with ONLY a JSON object in the following format, with no additional text or explanation:
    {
      "characters": [
        {
          "name": "CHARACTER_NAME_IN_ALL_CAPS",
          "estimatedAgeRange": "AGE_OR_AGE_RANGE (e.g., 25-30, 40s, teen, child, elderly)",
          "gender": "male/female/non-binary/unknown",
          "roleType": "lead/supporting/minor",
          "recommendedBudgetTier": "low/medium/high",
          "description": "Brief 1-2 sentence description of character personality/role"
        },
        ...
      ]
    }
    `;

    const result = await model.generateContent([prompt]);
    const response = await result.response;
    const responseText = response.text().trim();

    console.log(`${logPrefix} Got response from Gemini, parsing JSON...`);

    try {
      // Extract JSON from the response text (in case there's surrounding text)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : responseText;
      
      const parsedData: GeminiCharacterResponse = JSON.parse(jsonStr);
      
      // Validate the response format
      if (!parsedData.characters || !Array.isArray(parsedData.characters)) {
        console.error(`${logPrefix} Invalid response format:`, parsedData);
        return [];
      }

      const characters = parsedData.characters;
      console.log(`${logPrefix} Successfully extracted ${characters.length} characters`);
      
      return characters;
    } catch (parseError) {
      console.error(`${logPrefix} Error parsing JSON response:`, parseError);
      console.error(`${logPrefix} Raw response:`, responseText);
      return [];
    }
  } catch (error) {
    console.error(`${logPrefix} Error extracting characters:`, error);
    return [];
  }
}