/**
 * Genre Prediction Agent
 * 
 * This agent analyzes a script and predicts its likely genre.
 * It runs after file upload and populates the genre dropdown.
 */

import { GenrePrediction } from '../../types';
import { getAIClient, extractJsonFromText, sanitizeText } from './ai-client';
import { GenerationConfig } from '@google/generative-ai';

/**
 * Predicts the genre of a script using Gemini AI
 * 
 * @param scriptContent The content of the uploaded script
 * @returns Predicted genre information
 */
export async function predictScriptGenre(
  scriptContent: string,
): Promise<GenrePrediction | null> {
  if (!scriptContent || scriptContent.trim().length < 100) {
    console.log(
      "[Genre Agent] Script content is too short or empty. Skipping genre prediction.",
    );
    return null;
  }

  const logPrefix = "[Genre Agent]";
  console.log(
    `${logPrefix} Starting genre prediction for script (length: ${scriptContent.length}).`,
  );

  try {
    // Get shared AI client
    const { client, safetySettings, modelName } = getAIClient();
    
    const model = client.getGenerativeModel({
      model: modelName,
      safetySettings,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1,
        maxOutputTokens: 2048,
      } as GenerationConfig,
    });

    // Truncate script content for the prompt if necessary
    const maxScriptCharsForPrompt = 350000;
    const scriptContentForPrompt =
      scriptContent.length > maxScriptCharsForPrompt
        ? scriptContent.substring(0, maxScriptCharsForPrompt) +
          "\n...[TRUNCATED FOR PROMPT]..."
        : scriptContent;

    const prompt = `
    You are an expert screenplay analyst specializing in genre identification. Your task is to analyze the provided screenplay and identify its most likely genre(s).

    Follow these specific steps:
    1. Analyze the provided screenplay content
    2. Identify the primary genre that best describes the script
    3. Identify any secondary genres that may also apply
    4. Assign a confidence level to your prediction (0.0-1.0)

    Consider standard film genres such as:
    - Action
    - Adventure
    - Animation
    - Comedy
    - Crime
    - Documentary
    - Drama
    - Family
    - Fantasy
    - Horror
    - Musical
    - Mystery
    - Romance
    - Science Fiction
    - Thriller
    - War
    - Western

    But don't limit yourself to these if you detect others.

    SCREENPLAY:
    ${sanitizeText(scriptContentForPrompt)}

    Reply with ONLY a JSON object in the following format, with no additional text or explanation:
    {
      "primaryGenre": "MOST_LIKELY_GENRE",
      "secondaryGenres": ["SECOND_GENRE", "THIRD_GENRE"],
      "confidence": CONFIDENCE_LEVEL_AS_DECIMAL
    }
    `;

    const result = await model.generateContent([prompt]);
    const response = await result.response;
    const responseText = response.text().trim();

    console.log(`${logPrefix} Got response from Gemini, parsing JSON...`);

    // Extract JSON from the response text
    const parsedData = extractJsonFromText(responseText) as GenrePrediction;
    
    // Validate the response format
    if (!parsedData || !parsedData.primaryGenre || !parsedData.secondaryGenres || !Array.isArray(parsedData.secondaryGenres)) {
      console.error(`${logPrefix} Invalid response format:`, parsedData);
      return null;
    }

    console.log(`${logPrefix} Successfully predicted genre: ${parsedData.primaryGenre}`);
    
    return parsedData;
  } catch (error) {
    console.error(`${logPrefix} Error predicting genre:`, error);
    return null;
  }
}