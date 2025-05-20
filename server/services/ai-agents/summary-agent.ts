/**
 * Character Summary Agent
 * 
 * This agent generates a concise summary of a character from a script.
 * It runs in parallel with the description agent when a character is selected.
 */

import { CharacterSummary } from './shared-types';
import { getAIClient, extractJsonFromText, sanitizeText } from './ai-client';
import { GenerationConfig } from '@google/generative-ai';

/**
 * Generates a concise summary of a character from a script
 * 
 * @param scriptContent The content of the script
 * @param characterName The name of the character to summarize
 * @returns A concise summary of the character
 */
export async function generateCharacterSummary(
  scriptContent: string,
  characterName: string,
): Promise<CharacterSummary | null> {
  if (!scriptContent || !characterName) {
    console.log("[Summary Agent] Missing script content or character name");
    return null;
  }

  const logPrefix = "[Summary Agent]";
  console.log(`${logPrefix} Generating summary for "${characterName}"`);

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
    You are an expert screenplay analyst focusing on character analysis.
    
    Your task is to create a concise but insightful summary of the character named "${characterName}" 
    from the provided screenplay. This summary will be used to match the character with appropriate actors.
    
    Focus on:
    1. Overall personality and defining characteristics
    2. Character arc or development (if any)
    3. Key relationships with other characters
    4. Specific acting challenges this role might present
    5. Importance to the overall story
    
    SCREENPLAY:
    ${sanitizeText(scriptContentForPrompt)}
    
    Reply with ONLY a JSON object in the following format, with no additional text or explanation:
    {
      "name": "${characterName}",
      "description": "A 1-2 sentence concise character summary",
      "keyTraits": ["trait1", "trait2", "trait3", "trait4", "trait5"],
      "importanceLevel": IMPORTANCE_LEVEL_1_TO_10
    }
    `;

    const result = await model.generateContent([prompt]);
    const response = await result.response;
    const responseText = response.text().trim();

    console.log(`${logPrefix} Got response from Gemini, parsing JSON...`);

    // Extract JSON from the response text
    const parsedData = extractJsonFromText(responseText) as CharacterSummary;
    
    // Validate the response format
    if (!parsedData || !parsedData.name || !parsedData.description || !parsedData.keyTraits) {
      console.error(`${logPrefix} Invalid response format:`, parsedData);
      return null;
    }

    console.log(`${logPrefix} Successfully generated summary for "${characterName}"`);
    
    return parsedData;
  } catch (error) {
    console.error(`${logPrefix} Error generating character summary:`, error);
    return null;
  }
}