/**
 * Actor Selection Agent
 * 
 * This agent ranks actors for a specific character based on the character summary
 * and filtered actor list. It runs after the user clicks "Find Actors".
 */

import { getAIClient, extractJsonFromText, sanitizeText } from './ai-client';
import { GenerationConfig } from '@google/generative-ai';
import { Actor as DbActor } from '@shared/schema';
import { CharacterSummary } from '../../types';

export interface ActorRanking {
  actorName: string;
  matchReason: string;
  confidenceScore: number;
  controversyLevel: 'none' | 'low' | 'medium' | 'high';
}

/**
 * Ranks actors for a character based on the character summary and filtered actor list
 * 
 * @param characterSummary The summary of the character
 * @param filteredActors List of actors that passed the basic filtering criteria
 * @param maxResults Maximum number of actors to return
 * @returns Ranked list of actors with justifications
 */
export async function rankActorsForCharacter(
  characterSummary: CharacterSummary,
  filteredActors: DbActor[],
  additionalCriteria: {
    filmGenre?: string;
    roleType?: string;
    budgetTier?: string;
    gender?: string;
  },
  maxResults: number = 3
): Promise<ActorRanking[]> {
  if (!characterSummary || !filteredActors || filteredActors.length === 0) {
    console.log("[Selection Agent] Missing character summary or filtered actors");
    return [];
  }

  const logPrefix = "[Selection Agent]";
  console.log(`${logPrefix} Ranking ${filteredActors.length} actors for "${characterSummary.name}"`);

  try {
    // Get shared AI client
    const { client, safetySettings, modelName } = getAIClient();
    
    const model = client.getGenerativeModel({
      model: modelName,
      safetySettings,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.3,
        maxOutputTokens: 4096,
      } as GenerationConfig,
    });

    // Format actors for prompt
    const formattedActors = filteredActors.map(actor => {
      const notableRoles = actor.notableRoles?.slice(0, 3).join(", ") || "Unknown";
      const genres = Array.isArray(actor.genres) ? actor.genres.slice(0, 3).join(", ") : "Various";
      
      return `Actor Name: ${actor.name}, Gender: ${actor.gender || "Unknown"}, 
      Nationality: ${actor.nationality || "Unknown"}, 
      DOB: ${actor.dateOfBirth || "Unknown"}, 
      Popularity: ${actor.recentPopularity || "Medium"}, 
      Salary Range: ${actor.estSalaryRange || "Unknown"}, 
      Notable Roles: ${notableRoles}, 
      Typical Genres: ${genres}`;
    }).join("\n");

    const prompt = `
    You are an expert Casting Director AI tasked with selecting the ${maxResults} most suitable actors 
    for a character based on artistic fit, role interpretation, and strategic considerations.

    CHARACTER PROFILE:
    - Name: "${characterSummary.name}"
    - Description: "${characterSummary.description}"
    - Key Traits: ${characterSummary.keyTraits.join(", ")}
    - Importance Level (1-10): ${characterSummary.importanceLevel}
    ${additionalCriteria.filmGenre ? `- Film Genre: ${additionalCriteria.filmGenre}` : ''}
    ${additionalCriteria.roleType ? `- Role Type: ${additionalCriteria.roleType}` : ''}
    ${additionalCriteria.budgetTier ? `- Budget Tier: ${additionalCriteria.budgetTier}` : ''}
    ${additionalCriteria.gender ? `- Target Casting Gender: ${additionalCriteria.gender}` : ''}

    SELECT FROM THESE PRE-FILTERED ACTORS:
    ${formattedActors}

    For each actor you select, provide:
    1. A clear explanation of why they match this specific character
    2. A confidence score (0.0-1.0) indicating how well they fit
    3. A controversy level assessment (none/low/medium/high)

    Reply with ONLY a JSON object in the following format:
    {
      "rankedActors": [
        {
          "actorName": "ACTOR_NAME",
          "matchReason": "DETAILED_EXPLANATION_OF_FIT",
          "confidenceScore": CONFIDENCE_SCORE,
          "controversyLevel": "none/low/medium/high"
        },
        ...
      ]
    }
    `;

    const result = await model.generateContent([prompt]);
    const response = await result.response;
    const responseText = response.text().trim();

    console.log(`${logPrefix} Got response from Gemini, parsing JSON...`);

    // Extract JSON from the response text
    const parsedData = extractJsonFromText(responseText);
    
    // Validate the response format
    if (!parsedData || !parsedData.rankedActors || !Array.isArray(parsedData.rankedActors)) {
      console.error(`${logPrefix} Invalid response format:`, parsedData);
      return [];
    }

    // Map to our ActorRanking interface
    const rankings: ActorRanking[] = parsedData.rankedActors.map((actor: any) => ({
      actorName: actor.actorName,
      matchReason: actor.matchReason,
      confidenceScore: actor.confidenceScore || 0.5,
      controversyLevel: actor.controversyLevel || 'none'
    })).slice(0, maxResults);

    console.log(`${logPrefix} Successfully ranked ${rankings.length} actors for "${characterSummary.name}"`);
    
    return rankings;
  } catch (error) {
    console.error(`${logPrefix} Error ranking actors:`, error);
    return [];
  }
}