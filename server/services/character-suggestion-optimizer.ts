/**
 * Character Suggestion Optimizer
 * 
 * This service improves performance of the character casting suggestions
 * by adding caching and prefetching capabilities.
 */
import { extractCharactersWithGemini, ExtractedCharacter } from './file-upload-service';
import { suggestActorsForCharacterViaGemini, ActorAISuggestion } from './ai-suggestion-service';
import * as storage from '../storage';

// Cache structure
interface CacheEntry {
  timestamp: number;
  suggestions: ActorAISuggestion[];
}

// In-memory cache for suggestions (cleared on server restart)
const suggestionCache = new Map<string, CacheEntry>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

/**
 * Creates a cache key based on character and search parameters
 */
function createCacheKey(
  scriptId: number,
  characterName: string,
  filmGenre?: string,
  roleType?: string,
  budgetTier?: string,
  gender?: string
): string {
  return `${scriptId}:${characterName}:${filmGenre || ''}:${roleType || ''}:${budgetTier || ''}:${gender || ''}`;
}

/**
 * Retrieves actor suggestions for a character with caching
 */
export async function getActorSuggestionsWithCaching(
  scriptId: number,
  characterName: string,
  filmGenre?: string,
  roleType?: string,
  budgetTier?: string,
  gender?: string
): Promise<ActorAISuggestion[]> {
  const cacheKey = createCacheKey(scriptId, characterName, filmGenre, roleType, budgetTier, gender);
  
  // Check cache first
  const cached = suggestionCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    console.log(`[Cache Hit] Using cached actor suggestions for "${characterName}"`);
    return cached.suggestions;
  }
  
  console.log(`[Cache Miss] Generating new actor suggestions for "${characterName}"`);
  
  // Get script content
  const script = await storage.getScriptById(scriptId);
  if (!script?.content) {
    throw new Error(`Script with ID ${scriptId} not found or has no content`);
  }
  
  // Extract characters from script
  const characters = await extractCharactersWithGemini(script.content);
  const characterDetails = characters.find(c => c.name === characterName.toUpperCase());
  
  if (!characterDetails) {
    throw new Error(`Character "${characterName}" not found in script`);
  }
  
  // Process gender filter for database query
  let genderForDbFilter: string | undefined = undefined;
  if (gender && gender.toLowerCase() !== "any" && gender.toLowerCase() !== "all" && gender.toLowerCase() !== "unknown") {
    genderForDbFilter = gender;
  }
  
  // Pre-filter actors from database
  const preFilteredActors = await storage.getActorsForAISuggestionByCriteria({
    estimatedAgeRange: characterDetails.estimatedAgeRange,
    gender: genderForDbFilter,
    limit: 100,
  });
  
  if (preFilteredActors.length === 0) {
    return [];
  }
  
  // Generate suggestions using AI
  const suggestions = await suggestActorsForCharacterViaGemini(
    script.content,
    characterDetails,
    preFilteredActors,
    {
      filmGenre: filmGenre || "Any",
      roleType: roleType || "Unknown",
      budgetTier: budgetTier || "Any",
      gender: gender || "Any",
    },
    5
  );
  
  // Cache the results
  suggestionCache.set(cacheKey, {
    timestamp: Date.now(),
    suggestions,
  });
  
  return suggestions;
}

/**
 * Prefetches character suggestions for the most important characters in a script
 * This runs in the background to speed up future user interactions
 */
export async function prefetchMainCharacterSuggestions(scriptId: number): Promise<void> {
  try {
    console.log(`[Prefetch] Starting prefetching for script ${scriptId}`);
    
    // Get script
    const script = await storage.getScriptById(scriptId);
    if (!script?.content) {
      console.error(`[Prefetch] Script with ID ${scriptId} not found or has empty content`);
      return;
    }
    
    // Extract characters
    const characters = await extractCharactersWithGemini(script.content);
    if (characters.length === 0) {
      console.log(`[Prefetch] No characters found in script ${scriptId}`);
      return;
    }
    
    // Take only top 5 characters to avoid too many API calls
    const mainCharacters = characters.slice(0, 5);
    console.log(`[Prefetch] Found ${characters.length} characters, prefetching top ${mainCharacters.length}`);
    
    // Process characters in sequence to avoid overwhelming API
    for (const character of mainCharacters) {
      try {
        // Use default parameters for prefetching
        await getActorSuggestionsWithCaching(
          scriptId,
          character.name,
          undefined, // filmGenre
          "lead",    // roleType
          "medium",  // budgetTier
          "any"      // gender
        );
        console.log(`[Prefetch] Successfully prefetched suggestions for "${character.name}"`);
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`[Prefetch] Error prefetching suggestions for "${character.name}":`, error);
      }
    }
    
    console.log(`[Prefetch] Completed prefetching for script ${scriptId}`);
  } catch (error) {
    console.error(`[Prefetch] Error during prefetch process:`, error);
  }
}