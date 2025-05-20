/**
 * Character Casting Pipeline Coordinator
 * 
 * This module coordinates the various specialized AI agents to implement 
 * a modular pipeline for character casting suggestions.
 */

import { extractCharactersFromScript } from './extraction-agent';
import { predictScriptGenre } from './genre-agent';
import { estimateCharacterDetails } from './description-agent';
import { generateCharacterSummary } from './summary-agent';
import { rankActorsForCharacter, ActorRanking } from './selection-agent';
import { ExtractedCharacter, CharacterSummary, GenrePrediction } from '../../types';
import { Actor as DbActor } from '@shared/schema';

// Cache for character summaries to avoid redundant calls
const characterSummaryCache = new Map<string, CharacterSummary>();

/**
 * Extract all characters from a script using the extraction agent
 */
export async function extractCharacters(scriptContent: string): Promise<ExtractedCharacter[]> {
  console.log("[Casting Pipeline] Extracting characters from script");
  return extractCharactersFromScript(scriptContent);
}

/**
 * Predict the genre of a script using the genre agent
 */
export async function predictGenre(scriptContent: string): Promise<GenrePrediction | null> {
  console.log("[Casting Pipeline] Predicting script genre");
  return predictScriptGenre(scriptContent);
}

/**
 * Get character details for pre-filling search criteria
 * This runs when a user selects a character
 */
export async function getCharacterDetails(
  scriptContent: string, 
  characterName: string
): Promise<any> {
  console.log(`[Casting Pipeline] Getting details for character "${characterName}"`);
  
  // Run description agent
  const details = await estimateCharacterDetails(scriptContent, characterName);
  
  // In parallel, generate a character summary for later use in actor ranking
  generateAndCacheCharacterSummary(scriptContent, characterName);
  
  return details;
}

/**
 * Generate and cache a character summary in the background
 * This runs in parallel with getting character details
 */
async function generateAndCacheCharacterSummary(
  scriptContent: string,
  characterName: string
): Promise<void> {
  const cacheKey = `${characterName}`;
  
  // Check if we already have this character summary cached
  if (characterSummaryCache.has(cacheKey)) {
    console.log(`[Casting Pipeline] Using cached summary for "${characterName}"`);
    return;
  }
  
  console.log(`[Casting Pipeline] Generating summary for "${characterName}" in background`);
  
  try {
    const summary = await generateCharacterSummary(scriptContent, characterName);
    
    if (summary) {
      characterSummaryCache.set(cacheKey, summary);
      console.log(`[Casting Pipeline] Successfully cached summary for "${characterName}"`);
    }
  } catch (error) {
    console.error(`[Casting Pipeline] Error generating character summary:`, error);
    // Non-critical error, can continue without summary
  }
}

/**
 * Get character summary from cache or generate it if not available
 */
async function getCharacterSummary(
  scriptContent: string,
  characterName: string
): Promise<CharacterSummary | null> {
  const cacheKey = `${characterName}`;
  
  // Check if we have this character summary cached
  if (characterSummaryCache.has(cacheKey)) {
    return characterSummaryCache.get(cacheKey)!;
  }
  
  // If not cached, generate it now
  console.log(`[Casting Pipeline] Generating summary for "${characterName}" on demand`);
  const summary = await generateCharacterSummary(scriptContent, characterName);
  
  if (summary) {
    characterSummaryCache.set(cacheKey, summary);
  }
  
  return summary;
}

/**
 * Find and rank actors for a character using the selection agent
 * This runs when the user clicks "Find Actors"
 */
export async function findActorsForCharacter(
  scriptContent: string,
  characterName: string,
  filteredActors: DbActor[],
  criteria: {
    filmGenre?: string;
    roleType?: string;
    budgetTier?: string;
    gender?: string;
  }
): Promise<ActorRanking[]> {
  console.log(`[Casting Pipeline] Finding actors for "${characterName}" with ${filteredActors.length} filtered actors`);
  
  // Get character summary (from cache or generate it)
  const summary = await getCharacterSummary(scriptContent, characterName);
  
  if (!summary) {
    console.error(`[Casting Pipeline] Could not get character summary for "${characterName}"`);
    return [];
  }
  
  // Use the selection agent to rank actors
  return rankActorsForCharacter(summary, filteredActors, criteria);
}

/**
 * Clear character summary cache for a specific character or all characters
 */
export function clearCharacterSummaryCache(characterName?: string): void {
  if (characterName) {
    characterSummaryCache.delete(characterName);
    console.log(`[Casting Pipeline] Cleared summary cache for "${characterName}"`);
  } else {
    characterSummaryCache.clear();
    console.log(`[Casting Pipeline] Cleared all character summary caches`);
  }
}