// server/services/character-details-cache.ts

interface CacheEntry<T> {
  timestamp: number;
  data: T;
}

const cache = new Map<string, CacheEntry<any>>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

export function getFromCache<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) {
    return null;
  }
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setToCache<T>(key: string, data: T): void {
  cache.set(key, { timestamp: Date.now(), data });
}

export function clearCacheForKey(key: string): void {
  cache.delete(key);
}

export function clearAllCharacterCache(): void {
  cache.clear();
  console.log("[Cache] All character-related cache cleared.");
}