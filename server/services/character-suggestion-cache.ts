/**
 * Character Suggestion Cache Service
 * 
 * This service provides caching for character casting suggestions to improve performance.
 * It reduces the number of AI API calls by storing previously generated suggestions in memory.
 */

import { ActorAISuggestion } from './ai-suggestion-service';

// Cache structure for storing character suggestions
interface SuggestionCacheEntry {
  timestamp: number;
  suggestions: ActorAISuggestion[];
}

// Cache with character name, script ID, and criteria as the key
const suggestionCache = new Map<string, SuggestionCacheEntry>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30-minute cache TTL

/**
 * Create a cache key from character name and criteria
 */
export function createCacheKey(
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

/**
 * Get cached suggestions if they exist and are valid
 */
export function getCachedSuggestions(cacheKey: string): ActorAISuggestion[] | null {
  const cachedEntry = suggestionCache.get(cacheKey);
  if (!cachedEntry) return null;
  
  // Check if cache entry is still valid (within TTL)
  if (Date.now() - cachedEntry.timestamp > CACHE_TTL_MS) {
    suggestionCache.delete(cacheKey);
    return null;
  }
  
  return cachedEntry.suggestions;
}

/**
 * Cache suggestions for future use
 */
export function cacheSuggestions(cacheKey: string, suggestions: ActorAISuggestion[]): void {
  suggestionCache.set(cacheKey, {
    timestamp: Date.now(),
    suggestions
  });
}

/**
 * Clear the suggestion cache
 */
export function clearCache(): void {
  suggestionCache.clear();
}