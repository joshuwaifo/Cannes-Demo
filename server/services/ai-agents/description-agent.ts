/**
 * Character Description Agent
 * 
 * This agent is responsible for analyzing a character and estimating
 * key information needed for casting, including role type, age, gender,
 * and budget tier. It runs when a character is selected in the UI.
 */

import { ExtractedCharacter } from './shared-types';
import { getAIClient, extractJsonFromText, sanitizeText } from './ai-client';
import { GenerationConfig } from '@google/generative-ai';

interface CharacterDetailsResponse {
  roleType: string;
  estimatedAge: string;
  gender: string;
  budgetTier: string;
  keyTraits: string[];
}

/**
 * Estimates character details for casting purposes
 * 
 * @param scriptContent The content of the script
 * @param characterName The name of the character to analyze
 * @returns Details about the character that help with casting
 */
export async function estimateCharacterDetails(
  scriptContent: string,
  characterName: string,
): Promise<CharacterDetailsResponse | null> {
  if (!scriptContent || !characterName) {
    console.log("[Description Agent] Missing script content or character name");
    return null;
  }

  const logPrefix = "[Description Agent]";
  console.log(`${logPrefix} Analyzing character "${characterName}"`);

  try {
    // Get shared AI client
    const { client, safetySettings, modelName } = getAIClient();
    
    const model = client.getGenerativeModel({
      model: modelName,
      safetySettings,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.2,
        maxOutputTokens: 2048,
      } as GenerationConfig,
    });

    // Prepare script content (truncate if needed)
    const maxScriptCharsForPrompt = 300000;
    const scriptContentForPrompt =
      scriptContent.length > maxScriptCharsForPrompt
        ? scriptContent.substring(0, maxScriptCharsForPrompt) +
          "\n...[TRUNCATED FOR PROMPT]..."
        : scriptContent;

    const prompt = `
    You are an expert casting director analyzing a screenplay character for an upcoming production.
    
    Your task is to analyze the character named "${characterName}" in the provided screenplay
    and determine key details needed for casting purposes.
    
    Focus specifically on:
    1. Role Type - Whether this character is a lead, supporting, or minor role
    2. Estimated Age - As a specific age or age range
    3. Gender - Based on context clues in the script
    4. Budget Tier - What budget level (low/medium/high) would be appropriate for this character
    5. Key Traits - What are 3-5 defining characteristics or traits of this character
    
    SCREENPLAY:
    ${sanitizeText(scriptContentForPrompt)}
    
    Reply with ONLY a JSON object in the following format, with no additional text or explanation:
    {
      "roleType": "lead/supporting/minor",
      "estimatedAge": "AGE_OR_AGE_RANGE (e.g., 25-30, 40s, teen, child, elderly)",
      "gender": "male/female/non-binary/unknown",
      "budgetTier": "low/medium/high",
      "keyTraits": ["trait1", "trait2", "trait3"]
    }
    `;

    const result = await model.generateContent([prompt]);
    const response = await result.response;
    const responseText = response.text().trim();

    console.log(`${logPrefix} Got response from Gemini, parsing JSON...`);

    // Extract JSON from the response text
    const parsedData = extractJsonFromText(responseText) as CharacterDetailsResponse;
    
    // Validate the response format
    if (!parsedData || !parsedData.roleType || !parsedData.estimatedAge || !parsedData.gender) {
      console.error(`${logPrefix} Invalid response format:`, parsedData);
      return null;
    }

    console.log(`${logPrefix} Successfully analyzed character "${characterName}"`);
    
    return parsedData;
  } catch (error) {
    console.error(`${logPrefix} Error analyzing character:`, error);
    return null;
  }
}