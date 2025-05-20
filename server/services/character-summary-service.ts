/**
 * Character Summary Service
 * 
 * This service generates and caches character summaries from script content.
 * It provides detailed character information for the actor suggestion process.
 */

import { extractCharactersWithGemini } from './file-upload-service';
import * as storage from '../storage';
import { GoogleGenAI, HarmCategory, HarmBlockThreshold, GenerateContentRequest } from '@google/genai';

// Cache structure for storing character summaries
interface SummaryCacheEntry {
  timestamp: number;
  summary: string;
}

type SummaryCache = Map<string, SummaryCacheEntry>;
const characterSummaryCache: SummaryCache = new Map();
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

// Create a unique cache key for a character in a script
function createSummaryKey(characterName: string, scriptId: number): string {
  return `${scriptId}:${characterName}`;
}

// Retrieve a cached summary if one exists and is valid
export function getCachedSummary(characterName: string, scriptId: number): string | null {
  const cacheKey = createSummaryKey(characterName, scriptId);
  const cached = characterSummaryCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_EXPIRY_MS) {
    console.log(`[Cache] Using cached summary for "${characterName}"`);
    return cached.summary;
  }
  
  return null;
}

// Store a character summary in the cache
export function cacheSummary(characterName: string, scriptId: number, summary: string): void {
  const cacheKey = createSummaryKey(characterName, scriptId);
  characterSummaryCache.set(cacheKey, {
    timestamp: Date.now(),
    summary
  });
  console.log(`[Cache] Stored summary for "${characterName}" (scriptId: ${scriptId})`);
}

// Clear character summary cache for a specific script
export function clearScriptSummaryCache(scriptId: number): void {
  let count = 0;
  for (const key of characterSummaryCache.keys()) {
    if (key.startsWith(`${scriptId}:`)) {
      characterSummaryCache.delete(key);
      count++;
    }
  }
  console.log(`[Cache] Cleared ${count} character summaries for script ${scriptId}`);
}

// Clear all character summaries
export function clearAllSummaryCache(): void {
  const count = characterSummaryCache.size;
  characterSummaryCache.clear();
  console.log(`[Cache] Cleared all ${count} character summaries`);
}

// Initialize Gemini client
let genAIClientInstance: GoogleGenAI | null = null;
const MODEL_NAME = "gemini-2.5-flash-preview-04-17";

function initializeGenAIClient(): GoogleGenAI {
  if (genAIClientInstance) return genAIClientInstance;
  
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set");
  }
  
  genAIClientInstance = new GoogleGenAI(apiKey);
  return genAIClientInstance;
}

/**
 * Generate a detailed character summary from the script
 * This extracts information about the character's personality, role, and background
 */
export async function generateCharacterSummary(
  scriptId: number,
  characterName: string
): Promise<string> {
  // Check cache first
  const cachedSummary = getCachedSummary(characterName, scriptId);
  if (cachedSummary) return cachedSummary;
  
  console.log(`[CharSummary] Generating summary for "${characterName}" in script ${scriptId}`);
  
  try {
    // Get script content
    const script = await storage.getScriptById(scriptId);
    if (!script || !script.content) {
      throw new Error(`Script with ID ${scriptId} not found or has no content`);
    }
    
    // Initialize AI client
    const genAI = initializeGenAIClient();
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
      ],
    });
    
    // Prepare prompt for character summary
    const prompt = `
    You are an expert script analyst. Your task is to analyze the provided screenplay content and create a detailed summary for the character "${characterName}".
    
    Focus on the following aspects:
    1. Physical description (if provided)
    2. Personality traits and temperament
    3. Background and history
    4. Relationships with other characters
    5. Character arc and development
    6. Key scenes or moments
    
    Instructions:
    - Be concise but thorough, focus only on information directly from the script
    - Don't include subjective interpretations or assumptions unless strongly implied
    - Limit the summary to 200-300 words
    - Exclude dialogue quotes unless they're critical to understanding the character
    
    Screenplay Content:
    ---
    ${script.content.substring(0, 650000)}
    ---
    
    Character Summary for ${characterName}:
    `;
    
    const request: GenerateContentRequest = {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1024,
        topP: 0.8,
        topK: 40,
      },
    };
    
    console.log(`[CharSummary] Sending request to Gemini for "${characterName}"`);
    const result = await model.generateContent(request);
    const summary = result.response.text().trim();
    
    // Cache the summary
    cacheSummary(characterName, scriptId, summary);
    
    return summary;
  } catch (error) {
    console.error(`[CharSummary] Error generating summary: ${error}`);
    return `Failed to generate summary for ${characterName}. Please try again later.`;
  }
}