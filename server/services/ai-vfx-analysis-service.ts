// server/services/ai-vfx-analysis-service.ts
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
  GenerationConfig,
  SafetySetting,
} from "@google/generative-ai";
import { Scene } from "@shared/schema";
// --- BEGIN REVISED MODIFICATION FOR Subtask 3.1 ---
import { generateConceptualVfxImageDirectly as generateImageViaReplicate } from "./replicate-service"; // Import the new Replicate service function
// --- END REVISED MODIFICATION FOR Subtask 3.1 ---

// ... (sanitizeTextForPrompt, initializeGenAIClient, VfxSceneAnalysisResult, GeminiVfxResponse, identifyVfxInScenes - remain the same)
function sanitizeTextForPrompt(text: string | null | undefined): string {
  if (!text) return "";
  return text.replace(/\u0000/g, "").replace(/[^\x20-\x7E\u00A0-\uFFFF]/g, "");
}

let genAIInstance: GoogleGenerativeAI | null = null;
const MODEL_NAME_VFX_ID = "gemini-1.5-flash-latest"; 
const MODEL_NAME_VFX_PROMPT_GEN = "gemini-1.5-flash-latest"; 

const defaultSafetySettings: SafetySetting[] = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

function initializeGenAIClient(): GoogleGenerativeAI {
  if (genAIInstance) {
    return genAIInstance;
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("CRITICAL: GEMINI_API_KEY environment variable is not set for VFX Analysis Service.");
    throw new Error("GEMINI_API_KEY environment variable is not set");
  }
  genAIInstance = new GoogleGenerativeAI(apiKey);
  return genAIInstance;
}

export interface VfxSceneAnalysisResult {
  sceneId: number;
  isVfxScene: boolean;
  vfxDescription?: string; 
  vfxKeywords?: string[];  
  confidence?: number;     
}

interface GeminiVfxResponse {
  vfxAnalyses: Array<{
    sceneId: number | string; 
    isVfxScene: boolean;
    vfxDescription?: string;
    vfxKeywords?: string[];
    confidence?: number;
  }>;
}

export async function identifyVfxInScenes(
  scenesToAnalyze: Scene[],
  maxVfxScenesToIdentify: number = 10 
): Promise<VfxSceneAnalysisResult[]> {
  const logPrefix = "[VFX Scene ID Agent]";
  if (!scenesToAnalyze || scenesToAnalyze.length === 0) {
    console.log(`${logPrefix} No scenes provided for VFX analysis.`);
    return [];
  }

  console.log(`${logPrefix} Analyzing ${scenesToAnalyze.length} scenes for VFX content.`);

  const genAI = initializeGenAIClient();
  const model = genAI.getGenerativeModel({
    model: MODEL_NAME_VFX_ID,
    safetySettings: defaultSafetySettings,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.2, 
      maxOutputTokens: 8000, 
    } as GenerationConfig,
  });

  const maxCharsPerSceneContent = 1000;
  const scenesPromptPart = scenesToAnalyze
    .map(scene => {
      const sanitizedHeading = sanitizeTextForPrompt(scene.heading);
      const sanitizedContent = sanitizeTextForPrompt(scene.content);
      const truncatedContent = sanitizedContent.length > maxCharsPerSceneContent
        ? sanitizedContent.substring(0, maxCharsPerSceneContent) + "..."
        : sanitizedContent;
      return `SCENE_ID: ${scene.id}\nSCENE_NUMBER: ${scene.sceneNumber}\nHEADING: ${sanitizedHeading}\nCONTENT_SNIPPET:\n${truncatedContent}\n---`;
    })
    .join("\n\n");

  const prompt = `
You are an expert VFX Supervisor AI. Analyze the provided screenplay scene snippets.
For each scene, determine if it contains elements that would require significant Visual Effects (VFX) work.
Focus on identifying explicit actions, events, creatures, environments, or phenomena that cannot be practically filmed and would necessitate digital effects. Do not flag scenes for basic set dressing or minor practical effects unless they are very extensive.
Consider elements like:
- Explosions, fire, smoke (large scale or complex)
- Magical effects, energy blasts, supernatural events
- Creatures, monsters, fantastical beings (requiring CGI)
- Large-scale destruction, crumbling buildings, natural disasters
- Complex vehicle crashes or chases impossible to film practically
- Set extensions for futuristic or fantastical environments
- Complex digital matte paintings or environments
- Significant green screen work for compositing characters into CGI environments
For each scene, provide the following:
1.  "sceneId": The SCENE_ID number from the input.
2.  "isVfxScene": A boolean (true if significant VFX are implied, false otherwise).
3.  "vfxDescription": If isVfxScene is true, a brief (1-2 sentences) description of the core VFX elements. Otherwise, this can be null or an empty string.
4.  "vfxKeywords": If isVfxScene is true, an array of 1-5 relevant keywords (e.g., "explosion", "creature_cgi", "magic_spell", "set_extension", "destruction"). Otherwise, an empty array or null.
5.  "confidence": A confidence score (0.0 to 1.0) in your "isVfxScene" assessment.
PRIORITIZE: Identify up to ${maxVfxScenesToIdentify} scenes that MOST CLEARLY require substantial VFX. If fewer than ${maxVfxScenesToIdentify} scenes have strong VFX indicators, only return those.
OUTPUT FORMAT: Respond ONLY with a single valid JSON object. The JSON object must have a single key "vfxAnalyses".
The value of "vfxAnalyses" must be an array of objects, each corresponding to a scene analyzed.
Example:
{
  "vfxAnalyses": [
    {
      "sceneId": 101,
      "isVfxScene": true,
      "vfxDescription": "A large spaceship explodes in orbit, debris raining down.",
      "vfxKeywords": ["spaceship", "explosion", "orbit", "debris_cgi"],
      "confidence": 0.95
    },
    {
      "sceneId": 102,
      "isVfxScene": false,
      "vfxDescription": null,
      "vfxKeywords": [],
      "confidence": 0.90
    }
  ]
}
Do NOT include any text before or after the JSON object.
SCENES TO ANALYZE:
${scenesPromptPart}
`;

  try {
    console.log(`${logPrefix} Sending ${scenesToAnalyze.length} scenes to Gemini for VFX analysis.`);
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    if (!responseText || responseText.trim() === "") {
        console.error(`${logPrefix} Gemini returned an empty response for VFX scene ID.`);
        throw new Error("Gemini returned an empty response for VFX scene identification.");
    }

    const parsedResponse: GeminiVfxResponse = JSON.parse(responseText);

    if (!parsedResponse.vfxAnalyses || !Array.isArray(parsedResponse.vfxAnalyses)) {
      console.error(`${logPrefix} Gemini response is not in the expected format (missing vfxAnalyses array). Raw:`, responseText);
      return [];
    }

    const analysisResults: VfxSceneAnalysisResult[] = parsedResponse.vfxAnalyses.map(item => ({
      sceneId: typeof item.sceneId === 'string' ? parseInt(item.sceneId, 10) : item.sceneId,
      isVfxScene: item.isVfxScene,
      vfxDescription: item.vfxDescription || undefined,
      vfxKeywords: item.vfxKeywords || [],
      confidence: item.confidence !== undefined ? item.confidence : 0.5,
    })).filter(item => !isNaN(item.sceneId));

    console.log(`${logPrefix} Successfully analyzed scenes. Found ${analysisResults.filter(r => r.isVfxScene).length} VFX scenes.`);
    return analysisResults;

  } catch (error: any) {
    console.error(`${logPrefix} Error during VFX scene identification with Gemini:`, error.message || error);
    if (error.response && error.response.data) {
      console.error(`${logPrefix} Gemini API error details:`, error.response.data);
    }
    return [];
  }
}


interface ConceptualVfxImageRequest {
  sceneId: number;
  sceneHeading: string;
  vfxDescription: string;
  vfxKeywords: string[];
}

interface ConceptualVfxImageResult {
  sceneId: number;
  imageUrl: string;
  success: boolean;
  error?: string;
}

export async function generateConceptualVfxImage(
  request: ConceptualVfxImageRequest
): Promise<ConceptualVfxImageResult> {
  const { sceneId, sceneHeading, vfxDescription, vfxKeywords } = request;
  const logPrefix = `[VFX ImgCraft S:${sceneId}]`;

  console.log(`${logPrefix} Preparing to generate conceptual image. Desc: "${vfxDescription.substring(0,50)}...", Keywords: ${vfxKeywords.join(', ')}`);

  let imagePrompt = "";
  try {
    const genAI = initializeGenAIClient();
    const promptGenModel = genAI.getGenerativeModel({
      model: MODEL_NAME_VFX_PROMPT_GEN,
      safetySettings: defaultSafetySettings,
      generationConfig: {
        temperature: 0.6,
        maxOutputTokens: 250,
      } as GenerationConfig,
    });

    const vfxDetailsForPrompt = `Key VFX elements: ${vfxKeywords.join(", ")}. Description: ${vfxDescription}`;
    const geminiPromptForImagePrompt = `
      Given the following VFX details for a film scene, create a concise, visually descriptive prompt (max 80 words, ideally around 50-60) suitable for an AI image generator like Stable Diffusion or DALL-E.
      The prompt should evoke a cinematic keyframe or concept art.

      Scene Heading (for context): "${sanitizeTextForPrompt(sceneHeading)}"
      VFX Details: "${sanitizeTextForPrompt(vfxDetailsForPrompt)}"

      Image Prompt Guidelines:
      - Focus on strong visual nouns and adjectives.
      - Include keywords like "cinematic lighting," "epic scale," "dramatic angle," "photorealistic," "concept art," "VFX shot".
      - Describe the main action or visual centerpiece of the VFX.
      - Briefly incorporate the scene's setting if relevant to the VFX.
      - Do NOT include instructions like "Generate an image of..." - just the descriptive text itself.

      Example Output: "Epic explosion in a futuristic cityscape, debris flying, cinematic lighting, high detail, dramatic angle, photorealistic concept art, VFX shot."

      Generated Image Prompt:
    `;

    const imagePromptResult = await promptGenModel.generateContent(geminiPromptForImagePrompt);
    imagePrompt = imagePromptResult.response.text().trim();

    if (!imagePrompt) {
        throw new Error("Gemini returned an empty image prompt.");
    }
    console.log(`${logPrefix} Crafted image prompt for Replicate: "${imagePrompt.substring(0, 100)}..."`);

  } catch (error: any) {
    console.error(`${logPrefix} Error crafting image prompt with Gemini: ${error.message}. Using fallback.`, error);
    imagePrompt = `Cinematic keyframe concept art, VFX shot of ${vfxKeywords.join(", ")}, ${vfxDescription.substring(0,100)}, set in scene: ${sanitizeTextForPrompt(sceneHeading)}. Epic scale, dramatic lighting, photorealistic.`;
  }

  // Call the Replicate service using the NEW function
  const imageGenResult = await generateImageViaReplicate({ // Uses the imported generateConceptualVfxImageDirectly
    prompt: imagePrompt,
    sceneIdForLog: sceneId, // Pass sceneId for logging in Replicate service
  });

  return {
    sceneId,
    imageUrl: imageGenResult.imageUrl,
    success: imageGenResult.success,
    error: imageGenResult.error,
  };
}
// --- END MODIFICATION FOR Subtask 3.1 ---

// --- BEGIN MODIFICATION FOR Subtask 3.3 ---
interface VfxTierCost {
  cost: number;
  notes: string; // e.g., "Basic compositing, few elements" or "Complex CGI, multiple elements, high detail"
}

export interface VfxCostEstimate {
  lowTier: VfxTierCost;
  mediumTier: VfxTierCost;
  highTier: VfxTierCost;
  overallElementsSummary: string; // Summary of VFX elements considered for costing
}

// Simplified keyword-to-cost mapping.
// In a real system, this would be much more extensive and nuanced.
const VfxKeywordCostMap: Record<string, { baseLow: number; baseMedium: number; baseHigh: number; complexityFactor: number }> = {
  // Explosions
  "explosion_small": { baseLow: 3000, baseMedium: 10000, baseHigh: 25000, complexityFactor: 1.0 },
  "explosion_medium": { baseLow: 10000, baseMedium: 40000, baseHigh: 100000, complexityFactor: 1.2 },
  "explosion_large": { baseLow: 25000, baseMedium: 100000, baseHigh: 300000, complexityFactor: 1.5 },
  "explosion": { baseLow: 8000, baseMedium: 30000, baseHigh: 80000, complexityFactor: 1.1 }, // Generic
  // Fire
  "fire_small": { baseLow: 2000, baseMedium: 7000, baseHigh: 18000, complexityFactor: 1.0 },
  "fire_large": { baseLow: 8000, baseMedium: 30000, baseHigh: 75000, complexityFactor: 1.3 },
  "fire": { baseLow: 5000, baseMedium: 15000, baseHigh: 40000, complexityFactor: 1.1 },
  "fire_effects": { baseLow: 5000, baseMedium: 15000, baseHigh: 40000, complexityFactor: 1.1 },
  // Creatures/Characters
  "creature_simple_cgi": { baseLow: 15000, baseMedium: 60000, baseHigh: 180000, complexityFactor: 1.2 },
  "creature_complex_cgi": { baseLow: 60000, baseMedium: 250000, baseHigh: 800000, complexityFactor: 2.0 },
  "creature_cgi": { baseLow: 30000, baseMedium: 120000, baseHigh: 400000, complexityFactor: 1.5 },
  "digital_double": { baseLow: 5000, baseMedium: 20000, baseHigh: 60000, complexityFactor: 1.1 },
  // Magic/Energy
  "magic_spell_basic": { baseLow: 1500, baseMedium: 6000, baseHigh: 15000, complexityFactor: 1.0 },
  "magic_spell_complex": { baseLow: 5000, baseMedium: 20000, baseHigh: 50000, complexityFactor: 1.4 },
  "energy_blast": { baseLow: 2000, baseMedium: 8000, baseHigh: 20000, complexityFactor: 1.1 },
  // Environments/Destruction
  "set_extension_simple": { baseLow: 8000, baseMedium: 30000, baseHigh: 70000, complexityFactor: 1.0 },
  "set_extension_complex": { baseLow: 20000, baseMedium: 80000, baseHigh: 250000, complexityFactor: 1.5 },
  "matte_painting": { baseLow: 5000, baseMedium: 15000, baseHigh: 40000, complexityFactor: 1.0 },
  "destruction_minor": { baseLow: 5000, baseMedium: 20000, baseHigh: 50000, complexityFactor: 1.1 },
  "destruction_major": { baseLow: 30000, baseMedium: 120000, baseHigh: 400000, complexityFactor: 1.8 },
  "destruction": { baseLow: 15000, baseMedium: 60000, baseHigh: 200000, complexityFactor: 1.4 },
  // Vehicles/Chases
  "vehicle_cgi_simple": { baseLow: 10000, baseMedium: 35000, baseHigh: 80000, complexityFactor: 1.1 },
  "vehicle_cgi_complex": { baseLow: 25000, baseMedium: 90000, baseHigh: 250000, complexityFactor: 1.6 },
  // Other common terms
  "cgi": { baseLow: 5000, baseMedium: 20000, baseHigh: 60000, complexityFactor: 1.0 }, // Generic CGI
  "compositing": { baseLow: 1000, baseMedium: 5000, baseHigh: 15000, complexityFactor: 1.0 },
  "green_screen": { baseLow: 2000, baseMedium: 8000, baseHigh: 20000, complexityFactor: 1.0 },
  "muzzle_flashes": { baseLow: 500, baseMedium: 1500, baseHigh: 3000, complexityFactor: 1.0 },
  "wire_removal": { baseLow: 1000, baseMedium: 4000, baseHigh: 10000, complexityFactor: 1.0 },
};

// Description-based modifiers (very basic for now)
const descriptionModifiers: Record<string, number> = {
  "massive": 1.5, "multiple": 1.4, "complex": 1.3, "intricate": 1.2, "large scale": 1.4, "many": 1.3,
  "minor": 0.7, "brief": 0.8, "simple": 0.9, "small": 0.85, "few": 0.9,
};

export function estimateVfxCostForRuleBased(
  vfxDescription: string,
  vfxKeywords: string[]
): VfxCostEstimate {
  const logPrefix = "[VFX Cost Estimator RuleBased]";
  let totalLowCost = 0;
  let totalMediumCost = 0;
  let totalHighCost = 0;
  const contributingElements: string[] = [];

  const lowerDesc = vfxDescription.toLowerCase();

  // Apply keyword-based costs
  for (const keyword of vfxKeywords) {
    const keywordKey = keyword.toLowerCase().replace(/\s+/g, '_'); // Normalize keyword
    if (VfxKeywordCostMap[keywordKey]) {
      const item = VfxKeywordCostMap[keywordKey];
      totalLowCost += item.baseLow;
      totalMediumCost += item.baseMedium;
      totalHighCost += item.baseHigh;
      contributingElements.push(keyword);
    } else {
        // Add a smaller default for unrecognized keywords if they seem significant
        if (keyword.includes("cgi") || keyword.includes("effect") || keyword.includes("digital")) {
            totalLowCost += 1000;
            totalMediumCost += 3000;
            totalHighCost += 8000;
            contributingElements.push(`${keyword} (generic)`);
        }
    }
  }

  // Apply description-based modifiers (very simple)
  let overallModifier = 1.0;
  for (const term in descriptionModifiers) {
    if (lowerDesc.includes(term)) {
      overallModifier *= descriptionModifiers[term];
    }
  }
  // Cap modifier to avoid extreme swings from simple text
  overallModifier = Math.max(0.5, Math.min(overallModifier, 2.0)); 

  totalLowCost = Math.round(totalLowCost * overallModifier);
  totalMediumCost = Math.round(totalMediumCost * overallModifier);
  totalHighCost = Math.round(totalHighCost * overallModifier);

  // Ensure costs are not negative and have some floor if elements were found
  const minCost = contributingElements.length > 0 ? 500 : 0;
  totalLowCost = Math.max(minCost, totalLowCost);
  totalMediumCost = Math.max(minCost * 2, totalMediumCost);
  totalHighCost = Math.max(minCost * 4, totalHighCost);

  // Round to nearest $100 or $1000 for realism
  const roundTo = (num: number, nearest: number) => Math.round(num / nearest) * nearest;
  totalLowCost = roundTo(totalLowCost, 100);
  totalMediumCost = roundTo(totalMediumCost, 500);
  totalHighCost = roundTo(totalHighCost, 1000);

  const elementsSummary = contributingElements.length > 0 
    ? `Based on: ${contributingElements.join(", ")}.` 
    : "No specific VFX keywords matched for costing.";

  const notesPrefix = `${elementsSummary} Description modifier: ${overallModifier.toFixed(2)}x. `;

  console.log(`${logPrefix} Estimated costs for "${vfxDescription.substring(0,30)}..." - Low: ${totalLowCost}, Med: ${totalMediumCost}, High: ${totalHighCost}. Elements: ${elementsSummary}`);

  return {
    lowTier: { cost: totalLowCost, notes: `${notesPrefix}Low complexity implementation.` },
    mediumTier: { cost: totalMediumCost, notes: `${notesPrefix}Standard industry quality implementation.` },
    highTier: { cost: totalHighCost, notes: `${notesPrefix}High detail, complex CGI implementation.` },
    overallElementsSummary: elementsSummary,
  };
}
// --- END MODIFICATION FOR Subtask 3.3 ---