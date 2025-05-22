/**
 * Shared AI Client for all agents
 * 
 * This module provides a consistent way to initialize and access
 * the Google Generative AI client across all specialized agents.
 */

import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
  type GenerationConfig,
  type SafetySetting
} from "@google/generative-ai";

// --- Client Singleton ---
let genAIInstance: GoogleGenerativeAI | null = null;
const MODEL_NAME = "gemini-1.5-flash-8b"; // Use consistent model version

// Standard safety settings to use across all agents
const safetySettings: SafetySetting[] = [
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
];

/**
 * Initialize and get the Google Generative AI client
 */
export function getAIClient() {
  if (genAIInstance) {
    return { client: genAIInstance, safetySettings, modelName: MODEL_NAME };
  }
  
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[AI Client] CRITICAL: GEMINI_API_KEY environment variable is not set");
    throw new Error("GEMINI_API_KEY environment variable is not set");
  }
  
  genAIInstance = new GoogleGenerativeAI(apiKey);
  
  return { client: genAIInstance, safetySettings, modelName: MODEL_NAME };
}

/**
 * Sanitize text to avoid safety filter issues
 */
export function sanitizeText(text: string): string {
  if (!text) return "";
  
  const profanityMap: Record<string, string> = {
    shit: "stuff",
    damn: "darn",
    "fuckin'": "really",
    fucking: "really",
    hell: "heck",
  };
  
  let sanitized = text;
  for (const word in profanityMap) {
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    sanitized = sanitized.replace(regex, profanityMap[word]);
  }
  
  // Remove null characters
  sanitized = sanitized.replace(/\u0000/g, "");
  
  return sanitized;
}

/**
 * Extract valid JSON from potentially messy AI response text
 */
export function extractJsonFromText(text: string): any {
  try {
    // Try to extract just the JSON part using regex
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : text;
    
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("[AI Client] Error parsing JSON response:", error);
    console.error("[AI Client] Raw text:", text);
    return null;
  }
}