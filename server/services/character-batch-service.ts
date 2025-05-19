import { ActorAISuggestion, suggestActorsForCharacterViaGemini } from './ai-suggestion-service';
import { extractCharactersWithGemini } from './file-upload-service';
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

// Process all character suggestions in a batch
export async function getBatchCharacterSuggestions(
  scriptId: number,
  characterNames: string[],
  criteriaMap: Map<string, {
    filmGenre?: string;
    roleType?: string;
    budgetTier?: string;
    gender?: string;
  }>
) {
  // Get script content once
  const script = await storage.getScriptById(scriptId);
  if (!script || !script.content) {
    throw new Error(`Script with ID ${scriptId} not found or has no content`);
  }
  
  // Extract all characters once
  const allCharactersInScript = await extractCharactersWithGemini(script.content);
  
  // Results map to store suggestions for each character
  const results = new Map<string, ActorAISuggestion[]>();
  
  // Prepare batches of characters to process together
  // Start with prefiltering for all characters at once
  const characterDetailsMap = new Map();
  const actorPreFilterPromises = [];
  
  for (const charName of characterNames) {
    const characterDetails = allCharactersInScript.find(
      (c) => c.name === charName.toUpperCase()
    );
    
    if (!characterDetails) {
      console.warn(`Character "${charName}" not found in script ${scriptId}`);
      results.set(charName, []);
      continue;
    }
    
    characterDetailsMap.set(charName, characterDetails);
    
    // Get criteria for this character
    const criteria = criteriaMap.get(charName) || {};
    
    // Check cache first
    const cacheKey = createCacheKey(charName, scriptId, criteria);
    const cachedSuggestions = getCachedSuggestions(cacheKey);
    
    if (cachedSuggestions) {
      console.log(`[Batch Character Suggest] Using cached suggestions for "${charName}"`);
      results.set(charName, cachedSuggestions);
      continue;
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
    const preFilterPromise = storage.getActorsForAISuggestionByCriteria({
      estimatedAgeRange: characterDetails.estimatedAgeRange,
      gender: genderForDbFilter,
      limit: 100,
    }).then(actors => {
      return { charName, actors };
    });
    
    actorPreFilterPromises.push(preFilterPromise);
  }
  
  // Wait for all pre-filtering to complete
  const preFilteredActorsResults = await Promise.all(actorPreFilterPromises);
  
  // Now process suggestions for characters that weren't cached
  const suggestionPromises = [];
  
  for (const { charName, actors } of preFilteredActorsResults) {
    if (results.has(charName)) continue; // Skip if we already have cached results
    
    const characterDetails = characterDetailsMap.get(charName);
    const criteria = criteriaMap.get(charName) || {};
    
    if (actors.length === 0) {
      console.log(`No actors after pre-filtering for "${charName}"`);
      results.set(charName, []);
      continue;
    }
    
    console.log(`Pre-filtered ${actors.length} actors for "${charName}"`);
    
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
    
    // Add suggestion promise for this character
    const suggestionPromise = suggestActorsForCharacterViaGemini(
      script.content,
      characterDetails,
      actors,
      {
        filmGenre: finalFilmGenreForAI,
        roleType: finalRoleTypeForAI,
        budgetTier: finalBudgetTierForAI,
        gender: finalGenderForAIPrompt,
      },
      5
    ).then(suggestions => {
      // Cache the results
      const cacheKey = createCacheKey(charName, scriptId, criteria);
      cacheSuggestions(cacheKey, suggestions);
      
      return { charName, suggestions };
    });
    
    suggestionPromises.push(suggestionPromise);
  }
  
  // Process all remaining suggestions in parallel
  const suggestionResults = await Promise.all(suggestionPromises);
  
  // Add suggestion results to the final map
  for (const { charName, suggestions } of suggestionResults) {
    results.set(charName, suggestions);
  }
  
  return results;
}

// Prefetch character suggestions for all characters in a script
export async function prefetchAllCharacterSuggestions(scriptId: number) {
  console.log(`[Prefetch] Starting character suggestion prefetching for script ${scriptId}`);
  
  // Get script
  const script = await storage.getScriptById(scriptId);
  if (!script || !script.content) {
    console.error(`[Prefetch] Script with ID ${scriptId} not found or has no content`);
    return;
  }
  
  // Extract all characters
  const allCharactersInScript = await extractCharactersWithGemini(script.content);
  
  // Get character names
  const characterNames = allCharactersInScript.map(c => c.name);
  console.log(`[Prefetch] Found ${characterNames.length} characters to prefetch`);
  
  // Create default criteria for all characters
  const criteriaMap = new Map();
  for (const charName of characterNames) {
    criteriaMap.set(charName, {
      filmGenre: "",
      roleType: "lead",
      budgetTier: "medium",
      gender: "any"
    });
  }
  
  try {
    // Batch process in groups of 3 to avoid overloading
    const BATCH_SIZE = 3;
    for (let i = 0; i < characterNames.length; i += BATCH_SIZE) {
      const batchNames = characterNames.slice(i, i + BATCH_SIZE);
      console.log(`[Prefetch] Processing batch ${i/BATCH_SIZE + 1} with ${batchNames.length} characters`);
      
      const batchCriteriaMap = new Map();
      for (const name of batchNames) {
        batchCriteriaMap.set(name, criteriaMap.get(name));
      }
      
      await getBatchCharacterSuggestions(scriptId, batchNames, batchCriteriaMap);
      
      // Small delay between batches to prevent rate limiting
      if (i + BATCH_SIZE < characterNames.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log(`[Prefetch] Successfully prefetched suggestions for ${characterNames.length} characters`);
  } catch (error) {
    console.error(`[Prefetch] Error prefetching character suggestions:`, error);
  }
}