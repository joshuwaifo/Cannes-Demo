import { ActorAISuggestion, suggestActorsForCharacterViaGemini } from './ai-suggestion-service';
import { extractCharactersWithGemini, ExtractedCharacter } from './file-upload-service';
import * as storage from '../storage';
import { Actor as DbActor } from '@shared/schema';

// Cache structure for storing character suggestions
interface SuggestionCacheEntry {
  timestamp: number;
  suggestions: ActorAISuggestion[];
}

// Cache with character name, script ID, and criteria as the key
const suggestionCache = new Map<string, SuggestionCacheEntry>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30-minute cache TTL

// Create a cache key from character name and criteria
function createCacheKey(
  characterName: string, 
  scriptId: number,
  criteria: {
    filmGenre?: string;
    roleType?: string;
    budgetTier?: string;
    gender?: string;
  }
): string {
  return `${characterName}|${scriptId}|${criteria.filmGenre || ''}|${criteria.roleType || ''}|${criteria.budgetTier || ''}|${criteria.gender || ''}`;
}

// Function to get cached suggestions if they exist and are valid
function getCachedSuggestions(cacheKey: string): ActorAISuggestion[] | null {
  const cachedEntry = suggestionCache.get(cacheKey);
  if (!cachedEntry) return null;
  
  // Check if cache entry is still valid (within TTL)
  if (Date.now() - cachedEntry.timestamp > CACHE_TTL_MS) {
    suggestionCache.delete(cacheKey);
    return null;
  }
  
  return cachedEntry.suggestions;
}

// Cache suggestions for future use
function cacheSuggestions(cacheKey: string, suggestions: ActorAISuggestion[]): void {
  suggestionCache.set(cacheKey, {
    timestamp: Date.now(),
    suggestions
  });
}

// Process a single character suggestion with caching
export async function getCachedCharacterSuggestion(
  scriptId: number,
  characterName: string,
  criteria: {
    filmGenre?: string;
    roleType?: string;
    budgetTier?: string;
    gender?: string;
  }
): Promise<ActorAISuggestion[]> {
  const cacheKey = createCacheKey(characterName, scriptId, criteria);
  const cachedSuggestions = getCachedSuggestions(cacheKey);
  
  if (cachedSuggestions) {
    console.log(`[Cache] Using cached suggestions for "${characterName}"`);
    return cachedSuggestions;
  }
  
  // Get script content
  const script = await storage.getScriptById(scriptId);
  if (!script || !script.content) {
    throw new Error(`Script with ID ${scriptId} not found or has no content`);
  }
  
  // Extract characters from script
  const allCharactersInScript = await extractCharactersWithGemini(script.content);
  const characterDetails = allCharactersInScript.find(
    (c) => c.name === characterName.toUpperCase()
  );
  
  if (!characterDetails) {
    console.warn(`Character "${characterName}" not found in script ${scriptId}`);
    return [];
  }
  
  // Determine gender filter for DB query
  let genderForDbFilter: string | undefined = undefined;
  if (
    criteria.gender &&
    criteria.gender.toLowerCase() !== "any" &&
    criteria.gender.toLowerCase() !== "all" &&
    criteria.gender.toLowerCase() !== "unknown"
  ) {
    genderForDbFilter = criteria.gender;
  }
  
  // Pre-filter actors for this character
  const preFilteredActors = await storage.getActorsForAISuggestionByCriteria({
    estimatedAgeRange: characterDetails.estimatedAgeRange,
    gender: genderForDbFilter,
    limit: 100,
  });
  
  if (preFilteredActors.length === 0) {
    console.log(`No actors after pre-filtering for "${characterName}"`);
    return [];
  }
  
  // Prepare final criteria for AI
  const finalFilmGenreForAI = criteria.filmGenre || "Any";
  const finalRoleTypeForAI = criteria.roleType || characterDetails.roleType || "Unknown";
  const finalBudgetTierForAI = criteria.budgetTier || characterDetails.recommendedBudgetTier || "Any";
  
  const finalGenderForAIPrompt =
    criteria.gender &&
    criteria.gender.toLowerCase() !== "any" &&
    criteria.gender.toLowerCase() !== "all" &&
    criteria.gender.toLowerCase() !== "unknown"
      ? criteria.gender
      : characterDetails.gender &&
        characterDetails.gender.toLowerCase() !== "unknown"
        ? characterDetails.gender
        : "Any";
  
  // Get suggestions from AI
  const suggestions = await suggestActorsForCharacterViaGemini(
    script.content,
    characterDetails,
    preFilteredActors,
    {
      filmGenre: finalFilmGenreForAI,
      roleType: finalRoleTypeForAI,
      budgetTier: finalBudgetTierForAI,
      gender: finalGenderForAIPrompt,
    },
    5
  );
  
  // Cache the results
  cacheSuggestions(cacheKey, suggestions);
  
  return suggestions;
}

// Prefetch character suggestions for all characters in a script
export async function prefetchScriptCharacterSuggestions(scriptId: number): Promise<void> {
  console.log(`[Prefetch] Starting character suggestion prefetching for script ${scriptId}`);
  
  try {
    // Get script
    const script = await storage.getScriptById(scriptId);
    if (!script || !script.content) {
      console.error(`[Prefetch] Script with ID ${scriptId} not found or has no content`);
      return;
    }
    
    // Extract all characters
    const allCharactersInScript = await extractCharactersWithGemini(script.content);
    
    if (allCharactersInScript.length === 0) {
      console.log(`[Prefetch] No characters found in script ${scriptId}`);
      return;
    }
    
    console.log(`[Prefetch] Found ${allCharactersInScript.length} characters to prefetch`);
    
    // Process main characters first (limit to top 5 to avoid overloading)
    const mainCharacters = allCharactersInScript.slice(0, 5);
    
    // Process each character with default criteria
    for (const character of mainCharacters) {
      const defaultCriteria = {
        filmGenre: "",
        roleType: "lead",
        budgetTier: "medium",
        gender: "any"
      };
      
      try {
        console.log(`[Prefetch] Processing character "${character.name}"`);
        await getCachedCharacterSuggestion(scriptId, character.name, defaultCriteria);
      } catch (error) {
        console.error(`[Prefetch] Error processing character "${character.name}":`, error);
      }
      
      // Small delay between characters to prevent rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log(`[Prefetch] Successfully prefetched suggestions for ${mainCharacters.length} main characters`);
  } catch (error) {
    console.error(`[Prefetch] Error prefetching character suggestions:`, error);
  }
}