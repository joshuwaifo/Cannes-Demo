// server/services/ai-suggestion-service.tsx
import {
    GoogleGenAI,
    HarmCategory,
    HarmBlockThreshold,
    type GenerateContentRequest,
    type GenerateContentResult,
    type GenerationConfig as SDKGenerationConfig,
    type Content as SDKContent,
    type Tool as SDKTool,
    type SafetySetting as SDKSafetySetting,
    FinishReason,
} from "@google/genai";
import {
    Actor as DbActor,
    Location as DbLocation,
    // Scene as DbScene, // No longer directly needed as input for script-wide location suggestions
} from "@shared/schema";
import {
    sanitizeForSafetyFilter,
    ExtractedCharacter,
} from "./file-upload-service";

// --- Gemini Client Initialization ---
let genAIClientInstance: GoogleGenAI | null = null;
const MODEL_NAME = "gemini-2.5-flash-preview-04-17";

function initializeGenAIClient(): GoogleGenAI {
    if (genAIClientInstance) {
        return genAIClientInstance;
    }
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error(
            "CRITICAL: GEMINI_API_KEY environment variable is not set for AI Suggestion Service",
        );
        throw new Error("GEMINI_API_KEY environment variable is not set");
    }
    genAIClientInstance = new GoogleGenAI({ apiKey: apiKey });
    return genAIClientInstance;
}

const defaultSafetySettings: SDKSafetySetting[] = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

const defaultTools: SDKTool[] = [{ googleSearch: {} }];

// --- Helper function to extract JSON from a potentially dirty string ---
function extractJsonFromString(str: string): string | null {
    if (!str || typeof str !== 'string') return null;
    let cleanedStr = str.trim();
    const markdownMatch = cleanedStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (markdownMatch && markdownMatch[1]) {
        cleanedStr = markdownMatch[1].trim();
    }
    const coreJsonMatch = cleanedStr.match(/^[^\{\[]*([\{\[][\s\S]*[\}\]])[^\]\}]*$/);
    if (coreJsonMatch && coreJsonMatch[1]) {
        cleanedStr = coreJsonMatch[1];
    } else {
        const firstBrace = cleanedStr.indexOf('{');
        const lastBrace = cleanedStr.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            cleanedStr = cleanedStr.substring(firstBrace, lastBrace + 1);
        } else {
            console.warn("[extractJsonFromString] Could not find valid JSON structure markers ({...} or [...]). Original string:", str);
            return null;
        }
    }
    if ((cleanedStr.startsWith("{") && cleanedStr.endsWith("}")) || (cleanedStr.startsWith("[") && cleanedStr.endsWith("]"))) {
        return cleanedStr;
    }
    console.warn("[extractJsonFromString] Final cleaned string does not appear to be valid JSON. Original:", str, "Cleaned attempt:", cleanedStr);
    return null;
}

// --- Actor Suggestions ---
export type ControversyLevel = "none" | "low" | "medium" | "high";
export interface ActorAISuggestion {
    actorName: string;
    matchReason: string;
    confidenceScore?: number;
    controversyLevel?: ControversyLevel;
}
interface GeminiActorSuggestionResponse {
    suggestedActors: ActorAISuggestion[];
}

function formatActorsForPrompt(actorsToFormat: DbActor[]): string {
    return actorsToFormat
        .map((actor) => {
            return `Actor Name: ${actor.name} Gender: ${actor.gender} Nationality: ${actor.nationality} Date of Birth (if available): ${actor.dateOfBirth || "N/A"} Notable Roles: ${(Array.isArray(actor.notableRoles) ? actor.notableRoles : []).join(", ")} Genres: ${(Array.isArray(actor.genres) ? actor.genres : []).join(", ")} Typical Roles: ${(Array.isArray(actor.typicalRoles) ? actor.typicalRoles : []).join(", ")} Recent Popularity: ${actor.recentPopularity} Est. Salary Range: ${actor.estSalaryRange} Availability: ${actor.availability} Strategic Fit Notes: ${sanitizeForSafetyFilter(actor.bestSuitedRolesStrategic)} ---`;
        })
        .join("\n");
}

export async function suggestActorsForCharacterViaGemini(
    scriptContent: string,
    characterToCast: ExtractedCharacter,
    availableActorsFromDb: DbActor[],
    criteria: { filmGenre?: string; roleType?: string; budgetTier?: string },
    numberOfSuggestions: number = 3,
): Promise<ActorAISuggestion[]> {
    const characterNameToCast = characterToCast.name;
    const characterEstimatedAge = characterToCast.estimatedAgeRange || "Not Specified";
    const logPrefix = `[Gemini Actor Suggestion for "${characterNameToCast}" (Age: ${characterEstimatedAge}) with ${MODEL_NAME}]`;

    if (!scriptContent || scriptContent.trim().length < 50) { console.warn(`${logPrefix} Script content too short.`); return []; }
    if (availableActorsFromDb.length === 0) { console.warn(`${logPrefix} No actors in DB list.`); return []; }

    const formattedActorsString = formatActorsForPrompt(availableActorsFromDb);
    const safeScriptContent = sanitizeForSafetyFilter(scriptContent.substring(0, 1000000));
    const safeCharacterName = sanitizeForSafetyFilter(characterNameToCast);

    try {
        const aiClient = initializeGenAIClient();
        const generationConfigForRequest: SDKGenerationConfig = {
            responseMimeType: "application/json", temperature: 0.3, maxOutputTokens: 8192,
        };
        const prompt = `
You are an expert Casting Director AI. Recommend ${numberOfSuggestions} suitable actors for a specific character in a screenplay.
Leverage Google Search to ensure actor information (age perception, recent work, availability, public sentiment/controversy) is current.
INPUTS:
1.  CHARACTER_TO_CAST: - Name: "${safeCharacterName}" - Estimated Age Range (from script analysis): "${characterEstimatedAge}"
2.  USER_CRITERIA_FOR_FILM: - Film Genre: "${criteria.filmGenre || "Not Specified"}" - Role Type (for this character): "${criteria.roleType || "Not Specified"}" - Project Budget Tier: "${criteria.budgetTier || "Not Specified"}"
3.  AVAILABLE_ACTORS_DATABASE (full list provided in context block).
4.  SCRIPT_CONTENT (full script provided in context block).
INSTRUCTIONS:
-   Analyze SCRIPT_CONTENT for "${safeCharacterName}" details.
-   Compare with AVAILABLE_ACTORS_DATABASE, considering character's ESTIMATED_AGE_RANGE ("${characterEstimatedAge}"). Use actor's Date of Birth and Google Search for age alignment.
-   Factor in USER_CRITERIA_FOR_FILM.
-   For each suggested actor: "actorName" (EXACT from DB), "matchReason" (1-2 sentences), "controversyLevel" ("none", "low", "medium", "high" via search), "confidenceScore" (optional 0.0-1.0).
OUTPUT FORMAT: Return ONLY a valid JSON object: { "suggestedActors": [ { "actorName": "...", "matchReason": "...", "controversyLevel": "low", "confidenceScore": 0.85 }, ... ] }
Up to ${numberOfSuggestions} best matches. Do NOT invent actors. Ensure the output is a single, clean JSON object without any surrounding text or markdown.
CONTEXT_BLOCK_ACTORS: ${formattedActorsString}
CONTEXT_BLOCK_SCRIPT: ${safeScriptContent}`;

        const contentsForRequest: SDKContent[] = [{ role: "user", parts: [{ text: prompt }] }];
        const request: GenerateContentRequest = {
            model: MODEL_NAME, contents: contentsForRequest, tools: defaultTools,
            generationConfig: generationConfigForRequest, safetySettings: defaultSafetySettings,
        };

        const result: GenerateContentResult = await aiClient.models.generateContent(request);

        if (!result) { console.error(`${logPrefix} Gemini SDK returned a null or undefined result.`); throw new Error("Gemini SDK returned a null or undefined result."); }

        if (result.promptFeedback?.blockReason) { console.error(`${logPrefix} Request blocked. Reason: ${result.promptFeedback.blockReason}`, result.promptFeedback); throw new Error(`Request blocked by API: ${result.promptFeedback.blockReason}`); }
        if (!result.candidates || result.candidates.length === 0) { const safetyRatings = result.candidates?.[0]?.safetyRatings; const finishReason = result.candidates?.[0]?.finishReason; console.error(`${logPrefix} No valid candidates. Finish Reason: ${finishReason}, Safety Ratings:`, JSON.stringify(safetyRatings, null, 2)); throw new Error(`No valid candidates or blocked. Finish Reason: ${finishReason}. Safety: ${JSON.stringify(safetyRatings)}`); }

        let rawResponseText = "";
        if (result.candidates[0]?.content?.parts) { const textPart = result.candidates[0].content.parts.find((part) => "text" in part); if (textPart && "text" in textPart) { rawResponseText = textPart.text; } }
        if (!rawResponseText && typeof (result as any).text === "function") { rawResponseText = (result as any).text(); }
        else if (!rawResponseText && typeof (result as any).text === "string" && (result as any).text) { rawResponseText = (result as any).text; }

        if (!rawResponseText) { console.error(`${logPrefix} Empty response text from Gemini. Full result object:`, JSON.stringify(result, null, 2)); throw new Error("Empty response text from Gemini."); }

        const cleanJsonText = extractJsonFromString(rawResponseText);
        if (!cleanJsonText) { console.error(`${logPrefix} Could not extract valid JSON from Gemini response. Raw:`, rawResponseText); return []; }

        try {
            const parsedResponse: GeminiActorSuggestionResponse = JSON.parse(cleanJsonText);
            if (!parsedResponse.suggestedActors || !Array.isArray(parsedResponse.suggestedActors)) { console.error(`${logPrefix} Format error after cleaning. Cleaned JSON:`, cleanJsonText, "Original Raw:", rawResponseText); return []; }
            const validActorNames = new Set(availableActorsFromDb.map((a) => a.name.toUpperCase()));
            const validControversyLevels: ControversyLevel[] = ["none", "low", "medium", "high"];
            const validatedSuggestions = parsedResponse.suggestedActors
                .filter((sugg) => {
                    if (!sugg.actorName || typeof sugg.actorName !== "string" || !sugg.matchReason || typeof sugg.matchReason !== "string") return false;
                    if (!validActorNames.has(sugg.actorName.toUpperCase())) { console.warn(`${logPrefix} Suggested actor "${sugg.actorName}" not in DB.`); return false; }
                    if (sugg.controversyLevel && !validControversyLevels.includes(sugg.controversyLevel)) { console.warn(`${logPrefix} Invalid controversyLevel "${sugg.controversyLevel}" for actor "${sugg.actorName}". Defaulting to 'none'.`); sugg.controversyLevel = "none"; }
                    if (!sugg.controversyLevel) sugg.controversyLevel = "none";
                    const originalActor = availableActorsFromDb.find((a) => a.name.toUpperCase() === sugg.actorName.toUpperCase());
                    if (originalActor) sugg.actorName = originalActor.name;
                    return true;
                }).slice(0, numberOfSuggestions);
            console.log(`${logPrefix} Received ${validatedSuggestions.length} valid suggestions.`);
            return validatedSuggestions;
        } catch (parseError) {
            console.error(`${logPrefix} Parse JSON error after cleaning. Cleaned JSON:`, cleanJsonText, "Original Raw:", rawResponseText, "Parse Error:", parseError);
            return [];
        }
    } catch (error: any) {
        console.error(`${logPrefix} Error:`, error.message || error);
        if (error.response && typeof error.response !== "undefined") { console.error("Error has a 'response' property (likely API error details):", JSON.stringify(error.response, null, 2)); }
        else { console.error("Caught error object. Full error:", error); }
        return [];
    }
}

// --- Location Suggestions (Modified for Script-wide analysis) ---
export interface LocationAISuggestion {
    locationId: number;
    matchReason: string;
    estimatedIncentiveNotes: string;
    confidenceScore?: number;
}
interface GeminiLocationSuggestionResponse {
    suggestedLocations: LocationAISuggestion[];
}

function formatLocationsForPrompt(locationsToFormat: DbLocation[]): string {
    return locationsToFormat
        .map((loc) => {
            return `Location ID: ${loc.id} Country: ${loc.country} Region: ${loc.region || "N/A"} Incentive Program: ${loc.incentiveProgram || "N/A"} Incentive Details (Summary): ${sanitizeForSafetyFilter((loc.incentiveDetails || "N/A").substring(0, 200))}... Minimum Spend: ${loc.minimumSpend || "N/A"} Eligible Production Types: ${sanitizeForSafetyFilter(loc.eligibleProductionTypes || "N/A")} Application Deadlines: ${loc.applicationDeadlines || "N/A"} ---`;
        })
        .join("\n");
}

export async function suggestLocationsForScriptViaGemini(
    scriptContent: string,
    scriptIdForLog: number,
    availableLocationsFromDb: DbLocation[],
    projectBudget: number | undefined,
    numberOfSuggestions: number = 5,
): Promise<LocationAISuggestion[]> {
    const logPrefix = `[Gemini Script Location Suggestion for Script ID:${scriptIdForLog} with ${MODEL_NAME}]`;
    if (availableLocationsFromDb.length === 0) { console.warn(`${logPrefix} No locations provided in the database list.`); return []; }
    if (!scriptContent || scriptContent.trim().length < 100) { console.warn(`${logPrefix} Script content is too short for meaningful location suggestions.`); return []; }

    const formattedLocationsString = formatLocationsForPrompt(availableLocationsFromDb);
    const safeScriptContent = sanitizeForSafetyFilter(scriptContent.substring(0, 1000000));

    try {
        const aiClient = initializeGenAIClient();
        const generationConfigForRequest: SDKGenerationConfig = {
            responseMimeType: "application/json", temperature: 0.5, maxOutputTokens: 4096,
        };

        const prompt = `
You are an expert Location Scout AI. Based on the ENTIRE SCRIPT provided, recommend ${numberOfSuggestions} diverse types of real-world filming locations from the AVAILABLE_LOCATIONS_DATABASE that would be suitable for various scenes or the overall production.
INPUTS:
1.  SCRIPT_CONTENT (full script or substantial portion provided in context block).
2.  PROJECT_BUDGET: "${projectBudget !== undefined ? `$${projectBudget.toLocaleString()}` : "Not Specified"}"
3.  AVAILABLE_LOCATIONS_DATABASE (full list provided in context block).
INSTRUCTIONS:
-   Read the SCRIPT_CONTENT to understand the primary settings, themes, moods, and recurring location types required throughout the script.
-   From the AVAILABLE_LOCATIONS_DATABASE, select up to ${numberOfSuggestions} locations that offer good general utility or match key settings described in the script. Aim for a diverse set of location *types* if possible.
-   For each suggested location: "locationId" (EXACT DB_ID_AS_NUMBER), "matchReason" (1-2 sentences explaining fit for script's needs), "estimatedIncentiveNotes" (relevance of incentive to budget/production type, use search if needed), "confidenceScore" (optional 0.0-1.0).
OUTPUT FORMAT: Return ONLY a valid JSON object: { "suggestedLocations": [ { "locationId": DB_ID_AS_NUMBER, "matchReason": "...", "estimatedIncentiveNotes": "...", "confidenceScore": 0.9 }, ... ] }
Ensure "locationId" is a number. Only use IDs from AVAILABLE_LOCATIONS_DATABASE. Ensure the output is a single, clean JSON object without any surrounding text or markdown.
CONTEXT_BLOCK_LOCATIONS_DATABASE: ${formattedLocationsString}
CONTEXT_BLOCK_SCRIPT: ${safeScriptContent}`;

        const contentsForRequest: SDKContent[] = [{ role: "user", parts: [{ text: prompt }] }];
        const request: GenerateContentRequest = {
            model: MODEL_NAME, contents: contentsForRequest, tools: defaultTools,
            generationConfig: generationConfigForRequest, safetySettings: defaultSafetySettings,
        };

        const result: GenerateContentResult = await aiClient.models.generateContent(request);

        if (!result) { console.error(`${logPrefix} Gemini SDK returned a null or undefined result.`); throw new Error("Gemini SDK returned a null or undefined result.");}

        if (result.promptFeedback?.blockReason) { console.error(`${logPrefix} Request blocked. Reason: ${result.promptFeedback.blockReason}`, result.promptFeedback); throw new Error(`Request blocked by API: ${result.promptFeedback.blockReason}`);}
        if (!result.candidates || result.candidates.length === 0) { const safetyRatings = result.candidates?.[0]?.safetyRatings; const finishReason = result.candidates?.[0]?.finishReason; console.error(`${logPrefix} No valid candidates. Finish Reason: ${finishReason}, Safety Ratings:`, JSON.stringify(safetyRatings, null, 2)); throw new Error(`No valid candidates or blocked. Finish Reason: ${finishReason}. Safety: ${JSON.stringify(safetyRatings)}`); }

        let rawResponseText = "";
        if (result.candidates[0]?.content?.parts) { const textPart = result.candidates[0].content.parts.find((part) => "text" in part); if (textPart && "text" in textPart) { rawResponseText = textPart.text; }}
        if (!rawResponseText && typeof (result as any).text === "function") { rawResponseText = (result as any).text(); }
        else if (!rawResponseText && typeof (result as any).text === "string" && (result as any).text) { rawResponseText = (result as any).text; }

        if (!rawResponseText) { console.error(`${logPrefix} Empty response text from Gemini. Full result object:`, JSON.stringify(result, null, 2)); throw new Error("Empty response text from Gemini."); }

        const cleanJsonText = extractJsonFromString(rawResponseText);
        if (!cleanJsonText) { console.error(`${logPrefix} Could not extract valid JSON from Gemini response. Raw:`, rawResponseText); return []; }

        try {
            const parsedResponse: GeminiLocationSuggestionResponse = JSON.parse(cleanJsonText);
            if (!parsedResponse.suggestedLocations || !Array.isArray(parsedResponse.suggestedLocations)) { console.error(`${logPrefix} Format error after cleaning. Cleaned JSON:`, cleanJsonText, "Original Raw:", rawResponseText); return []; }
            const validLocationIds = new Set(availableLocationsFromDb.map((loc) => loc.id));
            const validatedSuggestions = parsedResponse.suggestedLocations
                .filter((sugg) => {
                    const locId = typeof sugg.locationId === "string" ? parseInt(sugg.locationId, 10) : sugg.locationId;
                    if (isNaN(locId) || !validLocationIds.has(locId)) { console.warn(`${logPrefix} Invalid or unknown locationId "${sugg.locationId}".`); return false; }
                    if (!sugg.matchReason || typeof sugg.matchReason !== "string" || !sugg.estimatedIncentiveNotes || typeof sugg.estimatedIncentiveNotes !== "string") { console.warn(`${logPrefix} Suggestion for locId ${locId} missing required fields.`); return false; }
                    sugg.locationId = locId;
                    return true;
                }).slice(0, numberOfSuggestions);
            console.log(`${logPrefix} Received ${validatedSuggestions.length} valid location suggestions.`);
            return validatedSuggestions;
        } catch (parseError) {
            console.error(`${logPrefix} Parse JSON error after cleaning. Cleaned JSON:`, cleanJsonText, "Original Raw:", rawResponseText, "Parse Error:", parseError);
            return [];
        }
    } catch (error: any) {
        console.error(`${logPrefix} Error:`, error.message || error);
        if (error.response && typeof error.response !== "undefined") { console.error("Error has a 'response' property (likely API error details):", JSON.stringify(error.response, null, 2)); }
        else { console.error("Caught error object. Full error:", error); }
        return [];
    }
}

// // server/services/ai-suggestion-service.tsx
// import {
//     GoogleGenAI,
//     HarmCategory,
//     HarmBlockThreshold,
//     type GenerateContentRequest,
//     type GenerateContentResult,
//     type GenerationConfig as SDKGenerationConfig,
//     type Content as SDKContent,
//     type Tool as SDKTool,
//     type SafetySetting as SDKSafetySetting,
//     FinishReason,
// } from "@google/genai";
// import {
//     Actor as DbActor,
//     Location as DbLocation,
// } from "@shared/schema";
// import { sanitizeForSafetyFilter } from "./file-upload-service";
// import { ScriptCharacter } from "../../../client/src/lib/types"; // Use the richer client-side ScriptCharacter

// // --- Gemini Client Initialization ---
// let genAIClientInstance: GoogleGenAI | null = null;
// const MODEL_NAME = "gemini-2.5-flash-preview-04-17"; // Corrected model name for flash

// function initializeGenAIClient(): GoogleGenAI {
//     if (genAIClientInstance) {
//         return genAIClientInstance;
//     }
//     const apiKey = process.env.GEMINI_API_KEY;
//     if (!apiKey) {
//         console.error(
//             "CRITICAL: GEMINI_API_KEY environment variable is not set for AI Suggestion Service",
//         );
//         throw new Error("GEMINI_API_KEY environment variable is not set");
//     }
//     genAIClientInstance = new GoogleGenAI({ apiKey: apiKey });
//     return genAIClientInstance;
// }

// const defaultSafetySettings: SDKSafetySetting[] = [
//     { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
//     { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
//     { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
//     { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
// ];

// const defaultTools: SDKTool[] = [{ googleSearch: {} }];

// // --- Helper function to extract JSON from a potentially dirty string ---
// function extractJsonFromString(str: string): string | null {
//     if (!str || typeof str !== 'string') return null;
//     let cleanedStr = str.trim();

//     // 1. Remove markdown code block fences
//     const markdownMatch = cleanedStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
//     if (markdownMatch && markdownMatch[1]) {
//         cleanedStr = markdownMatch[1].trim();
//     }

//     // 2. Attempt to find the core JSON structure ({...} or [...])
//     const coreJsonMatch = cleanedStr.match(/^[^\{\[]*([\{\[][\s\S]*[\}\]])[^\]\}]*$/);
//     if (coreJsonMatch && coreJsonMatch[1]) {
//         cleanedStr = coreJsonMatch[1];
//     } else {
//         const firstBrace = cleanedStr.indexOf('{');
//         const firstBracket = cleanedStr.indexOf('[');
//         let startIndex = -1;

//         if (firstBrace !== -1 && firstBracket !== -1) {
//             startIndex = Math.min(firstBrace, firstBracket);
//         } else if (firstBrace !== -1) {
//             startIndex = firstBrace;
//         } else {
//             startIndex = firstBracket;
//         }

//         if (startIndex === -1) {
//             console.warn("[extractJsonFromString] No opening brace or bracket found in: ", str.substring(0, 100) + "...");
//             return null;
//         }

//         const lastBrace = cleanedStr.lastIndexOf('}');
//         const lastBracket = cleanedStr.lastIndexOf(']');
//         let endIndex = -1;

//         if (lastBrace !== -1 && lastBracket !== -1) {
//             endIndex = Math.max(lastBrace, lastBracket);
//         } else if (lastBrace !== -1) {
//             endIndex = lastBrace;
//         } else {
//             endIndex = lastBracket;
//         }

//         if (endIndex === -1 || endIndex < startIndex) {
//             console.warn("[extractJsonFromString] No closing brace or bracket found or order is wrong in: ", str.substring(0, 100) + "...");
//             return null;
//         }
//         cleanedStr = cleanedStr.substring(startIndex, endIndex + 1);
//     }

//     // 3. Attempt to parse. If it fails, try specific cleanup for trailing words.
//     try {
//         JSON.parse(cleanedStr); // Test if it's valid now
//         return cleanedStr;
//     } catch (e) {
//         const originalError = e as Error;
//         console.warn(`[extractJsonFromString] Initial JSON parse failed ('${originalError.message}'). Attempting cleanup for trailing words...`);

//         // Regex to find a valid JSON value (string, number, boolean, null)
//         // followed by whitespace, then an unexpected word (not a keyword, not starting with { " [),
//         // then optional whitespace, and finally a comma or closing brace/bracket.
//         const trailingWordRegex = /((?:"(?:\\.|[^"\\])*"|\btrue\b|\bfalse\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?))\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*([,\}\]])/g;

//         let lastCleanedStr = cleanedStr;
//         let iterations = 0;
//         const MAX_CLEANUP_ITERATIONS = 5; // Prevent infinite loops

//         // Iteratively apply cleanup as there might be multiple occurrences
//         while (iterations < MAX_CLEANUP_ITERATIONS) {
//             let madeChangeThisIteration = false;
//             cleanedStr = cleanedStr.replace(trailingWordRegex, (match, p1_value, p2_trailingWord, p3_delimiter) => {
//                 // p1_value is the valid JSON value
//                 // p2_trailingWord is the word we want to remove
//                 // p3_delimiter is the comma or closing brace/bracket
//                 console.warn(`[extractJsonFromString] Removing detected trailing word: "${p2_trailingWord}" after value "${p1_value.substring(0,30)}..." and before delimiter "${p3_delimiter}"`);
//                 madeChangeThisIteration = true;
//                 return `${p1_value}${p3_delimiter}`; // Reconstruct without the trailing word
//             });

//             if (!madeChangeThisIteration || cleanedStr === lastCleanedStr) {
//                 break; // No more changes, or stuck
//             }
//             lastCleanedStr = cleanedStr;
//             iterations++;
//         }

//         if (iterations > 0) {
//             console.log("[extractJsonFromString] Applied trailing word removal. New attempt at parsing:", cleanedStr.substring(0,500)+"...");
//         }
//     }

//     // Final check and parse attempt
//     if ((cleanedStr.startsWith("{") && cleanedStr.endsWith("}")) || (cleanedStr.startsWith("[") && cleanedStr.endsWith("]"))) {
//         try {
//             JSON.parse(cleanedStr); // Final test parse
//             return cleanedStr;
//         } catch (finalError) {
//             console.error("[extractJsonFromString] Final JSON parse failed even after cleanup. Original:", str.substring(0, 200)+"...", "Final attempt:", cleanedStr.substring(0, 200)+"...", "Error:", (finalError as Error).message);
//             return null;
//         }
//     }

//     console.warn("[extractJsonFromString] Final cleaned string does not appear to be valid JSON structure. Original:", str.substring(0, 200)+"...", "Cleaned attempt:", cleanedStr.substring(0, 200)+"...");
//     return null;
// }


// // --- Actor Suggestions ---
// export type ControversyLevel = "none" | "low" | "medium" | "high";
// export interface ActorAISuggestion {
//     actorName: string;
//     matchReason: string;
//     confidenceScore?: number;
//     controversyLevel?: ControversyLevel;
// }
// interface GeminiActorSuggestionResponse {
//     suggestedActors: ActorAISuggestion[];
// }

// function formatActorsForPrompt(actorsToFormat: DbActor[]): string {
//     return actorsToFormat
//         .map((actor) => {
//             // Make descriptions more concise for the prompt
//             const notableRolesSummary = (Array.isArray(actor.notableRoles) ? actor.notableRoles.slice(0, 3) : []).join(", ") + (actor.notableRoles && actor.notableRoles.length > 3 ? "..." : "");
//             const genresSummary = (Array.isArray(actor.genres) ? actor.genres.slice(0, 3) : []).join(", ") + (actor.genres && actor.genres.length > 3 ? "..." : "");
//             const typicalRolesSummary = (Array.isArray(actor.typicalRoles) ? actor.typicalRoles.slice(0, 2) : []).join(", ") + (actor.typicalRoles && actor.typicalRoles.length > 2 ? "..." : "");
//             const strategicFitSummary = sanitizeForSafetyFilter((actor.bestSuitedRolesStrategic || "").substring(0, 100)) + (actor.bestSuitedRolesStrategic && actor.bestSuitedRolesStrategic.length > 100 ? "..." : "");

//             return `Actor Name: ${actor.name}, Gender: ${actor.gender}, Nationality: ${actor.nationality}, DOB: ${actor.dateOfBirth || "N/A"}, Popularity: ${actor.recentPopularity}, Salary: ${actor.estSalaryRange}, Notable Roles: ${notableRolesSummary}, Genres: ${genresSummary}, Typical Roles: ${typicalRolesSummary}, Strategic Fit: ${strategicFitSummary} ---`;
//         })
//         .join("\n");
// }

// export async function suggestActorsForCharacterViaGemini(
//     characterConciseDescription: string,
//     characterFullProfile: ScriptCharacter,
//     preFilteredActors: DbActor[],
//     uiCriteria: { filmGenre?: string; roleType?: string; budgetTier?: string },
//     numberOfSuggestions: number = 5,
// ): Promise<ActorAISuggestion[]> {
//     const characterNameToCast = characterFullProfile.name;
//     const ageForPrompt = characterFullProfile.estimatedAgeRange || "Not Specified";
//     const genderForPrompt = characterFullProfile.gender || "Unknown";
//     const roleForPrompt = uiCriteria.roleType || characterFullProfile.roleType || "Unknown";
//     const budgetForPrompt = uiCriteria.budgetTier || characterFullProfile.recommendedBudgetTier || "Any";
//     const filmGenreForPrompt = uiCriteria.filmGenre || "Any";

//     const logPrefix = `[Gemini Actor Suggest for "${characterNameToCast}" (Profiled Age: ${ageForPrompt}, Role: ${roleForPrompt})]`;

//     if (preFilteredActors.length === 0) {
//         console.warn(`${logPrefix} No pre-filtered actors provided. Cannot make AI suggestions.`);
//         return [];
//     }
//     if (!characterConciseDescription || characterConciseDescription.trim().length < 5) {
//         console.warn(`${logPrefix} Character concise description is very short. Suggestions might be less targeted.`);
//     }

//     const formattedActorsString = formatActorsForPrompt(preFilteredActors);
//     const safeCharacterDesc = sanitizeForSafetyFilter(characterConciseDescription.substring(0, 1500)); // Context limit for this part
//     const safeCharacterName = sanitizeForSafetyFilter(characterNameToCast);

//     try {
//         const aiClient = initializeGenAIClient();
//         const generationConfigForRequest: SDKGenerationConfig = {
//             responseMimeType: "application/json",
//             temperature: 0.25, 
//             maxOutputTokens: 2048, 
//         };

//         const prompt = `
// You are an expert Casting Director AI. From the PRE-FILTERED_ACTOR_LIST below, select the top ${numberOfSuggestions} actors who best fit the CHARACTER_PROFILE.
// Your primary task is to rank and select from this pre-filtered list, not to discover new actors.
// Use Google Search only if absolutely necessary to verify very recent public sentiment for actors *from the provided list*.

// INPUTS:
// 1.  CHARACTER_PROFILE:
//     - Name: "${safeCharacterName}"
//     - Estimated Age Range: "${ageForPrompt}"
//     - Inferred Gender: "${genderForPrompt}"
//     - Inferred Role Type: "${roleForPrompt}"
//     - Recommended Casting Budget Tier: "${budgetForPrompt}"
//     - Description/Key Traits: "${safeCharacterDesc}"
// 2.  USER_PREFERENCES (consider these as guidance if they differ from inferred profile):
//     - Film Genre: "${filmGenreForPrompt}"
//     - Desired Role Type (if overriding AI): "${uiCriteria.roleType || "Use Profiled"}"
//     - Desired Budget Tier (if overriding AI): "${uiCriteria.budgetTier || "Use Profiled"}"
// 3.  PRE-FILTERED_ACTOR_LIST: (A small, curated list of actors already matching basic criteria. Your job is to pick the best from *this list*.)
//     ${formattedActorsString}

// INSTRUCTIONS:
// -   Focus on the PRE-FILTERED_ACTOR_LIST. Select up to ${numberOfSuggestions} actors.
// -   Prioritize actors whose age (from DOB) aligns well with the character's ESTIMATED_AGE_RANGE.
// -   Consider how well the actor's typical roles and strategic fit (from their profile in PRE-FILTERED_ACTOR_LIST) match the CHARACTER_PROFILE and USER_PREFERENCES.
// -   For each chosen actor: "actorName" (EXACT name from PRE-FILTERED_ACTOR_LIST), "matchReason" (1-2 concise sentences explaining why they are a superior fit *compared to others in the provided list*, referencing character traits and actor's profile.), "controversyLevel" ("none", "low", "medium", "high" - quick Google Search for recent sentiment if unsure, default to "none" if nothing significant), "confidenceScore" (0.0-1.0, your confidence in this actor being a top choice *from the given list* for this specific role.)
// OUTPUT FORMAT: Return ONLY a valid JSON object: { "suggestedActors": [ ... ] }
// Do NOT invent actors or select outside the PRE-FILTERED_ACTOR_LIST. Output must be a single, clean JSON object. No markdown.
// EXAMPLE OF BAD OUTPUT (DO NOT DO THIS): { "suggestedActors": [ { "actorName": "Some Actor", "reason": "Good." oops_stray_word }, ... ] }`;

//         const contentsForRequest: SDKContent[] = [{ role: "user", parts: [{ text: prompt }] }];
//         const request: GenerateContentRequest = {
//             model: MODEL_NAME, contents: contentsForRequest, tools: defaultTools,
//             generationConfig: generationConfigForRequest, safetySettings: defaultSafetySettings,
//         };

//         console.log(`${logPrefix} Sending request to Gemini with ${preFilteredActors.length} pre-filtered actors and character profile.`);
//         const result: GenerateContentResult = await aiClient.models.generateContent(request);

//         if (!result) { console.error(`${logPrefix} Gemini SDK returned a null or undefined result.`); throw new Error("Gemini SDK returned a null or undefined result."); }
//         if (result.promptFeedback?.blockReason) { console.error(`${logPrefix} Request blocked. Reason: ${result.promptFeedback.blockReason}`, result.promptFeedback); throw new Error(`Request blocked by API: ${result.promptFeedback.blockReason}`); }
//         if (!result.candidates || result.candidates.length === 0) { const safetyRatings = result.candidates?.[0]?.safetyRatings; const finishReason = result.candidates?.[0]?.finishReason; console.error(`${logPrefix} No valid candidates. Finish Reason: ${finishReason}, Safety Ratings:`, JSON.stringify(safetyRatings, null, 2)); throw new Error(`No valid candidates or blocked. Finish Reason: ${finishReason}. Safety: ${JSON.stringify(safetyRatings)}`); }

//         let rawResponseText = "";
//         if (result.candidates[0]?.content?.parts) { 
//             const textPart = result.candidates[0].content.parts.find((part) => "text" in part); 
//             if (textPart && "text" in textPart) { rawResponseText = textPart.text; } 
//         }
//         // Fallback if text isn't in parts (less common for newer models but safe to check)
//         if (!rawResponseText && typeof (result.candidates[0].content as any).text === 'string') {
//              rawResponseText = (result.candidates[0].content as any).text;
//         }


//         if (!rawResponseText) { console.error(`${logPrefix} Empty response text from Gemini. Full result object:`, JSON.stringify(result, null, 2)); throw new Error("Empty response text from Gemini."); }

//         const cleanJsonText = extractJsonFromString(rawResponseText);
//         if (!cleanJsonText) { 
//             console.error(`${logPrefix} Could not extract valid JSON from Gemini response. Raw:`, rawResponseText); 
//             // Attempt to provide more context on why extraction failed
//             if (rawResponseText.length < 10) console.error(`${logPrefix} Raw response was very short: "${rawResponseText}"`);
//             else if (!rawResponseText.includes("{") || !rawResponseText.includes("}")) console.error(`${logPrefix} Raw response missing JSON braces: "${rawResponseText.substring(0,100)}..."`);

//             return []; 
//         }

//         try {
//             const parsedResponse: GeminiActorSuggestionResponse = JSON.parse(cleanJsonText);
//             if (!parsedResponse.suggestedActors || !Array.isArray(parsedResponse.suggestedActors)) { 
//                 console.error(`${logPrefix} Format error after cleaning. Cleaned JSON:`, cleanJsonText, "Original Raw:", rawResponseText); 
//                 return []; 
//             }

//             const validActorNamesFromPreFiltered = new Set(preFilteredActors.map((a) => a.name.toUpperCase()));
//             const validControversyLevels: ControversyLevel[] = ["none", "low", "medium", "high"];

//             const validatedSuggestions = parsedResponse.suggestedActors
//                 .filter((sugg) => {
//                     if (!sugg.actorName || typeof sugg.actorName !== "string" || !sugg.matchReason || typeof sugg.matchReason !== "string") { 
//                         console.warn(`${logPrefix} Suggestion missing actorName or matchReason. Suggestion:`, sugg); 
//                         return false; 
//                     }
//                     if (!validActorNamesFromPreFiltered.has(sugg.actorName.toUpperCase())) { 
//                         console.warn(`${logPrefix} AI suggested actor "${sugg.actorName}" who was NOT in the pre-filtered list. Discarding.`); 
//                         return false; 
//                     }
//                     if (sugg.controversyLevel && !validControversyLevels.includes(sugg.controversyLevel)) { 
//                         console.warn(`${logPrefix} Invalid controversyLevel "${sugg.controversyLevel}" for actor "${sugg.actorName}". Defaulting to 'none'.`); 
//                         sugg.controversyLevel = "none"; 
//                     }
//                     if (!sugg.controversyLevel) sugg.controversyLevel = "none";

//                     const originalActor = preFilteredActors.find((a) => a.name.toUpperCase() === sugg.actorName.toUpperCase());
//                     if (originalActor) sugg.actorName = originalActor.name; 
//                     else {
//                         console.warn(`${logPrefix} Could not find original casing for actor: ${sugg.actorName}. This is unexpected.`);
//                         return false; 
//                     }
//                     return true;
//                 }).slice(0, numberOfSuggestions); 

//             console.log(`${logPrefix} Received ${validatedSuggestions.length} valid suggestions from AI.`);
//             return validatedSuggestions;
//         } catch (parseError) {
//             console.error(`${logPrefix} Parse JSON error after cleaning. Cleaned JSON:`, cleanJsonText, "Original Raw:", rawResponseText, "Parse Error:", parseError);
//             return [];
//         }

//     } catch (error: any) {
//         console.error(`${logPrefix} Error in suggestActorsForCharacterViaGemini:`, error.message || error);
//         if (error.response && typeof error.response !== "undefined") { 
//             console.error("Error has a 'response' property (likely API error details):", JSON.stringify(error.response, null, 2)); 
//         } else { 
//             console.error("Caught error object. Full error:", error); 
//         }
//         return [];
//     }
// }

// // --- Location Suggestions ---
// export interface LocationAISuggestion {
//     locationId: number;
//     matchReason: string;
//     estimatedIncentiveNotes: string;
//     confidenceScore?: number;
// }
// interface GeminiLocationSuggestionResponse {
//     suggestedLocations: LocationAISuggestion[];
// }

// function formatLocationsForPrompt(locationsToFormat: DbLocation[]): string {
//     return locationsToFormat
//         .map((loc) => {
//             return `Location ID: ${loc.id} Country: ${loc.country} Region: ${loc.region || "N/A"} Incentive Program: ${loc.incentiveProgram || "N/A"} Incentive Details (Summary): ${sanitizeForSafetyFilter((loc.incentiveDetails || "N/A").substring(0, 200))}... Minimum Spend: ${loc.minimumSpend || "N/A"} Eligible Production Types: ${sanitizeForSafetyFilter(loc.eligibleProductionTypes || "N/A")} Application Deadlines: ${loc.applicationDeadlines || "N/A"} ---`;
//         })
//         .join("\n");
// }

// export async function suggestLocationsForScriptViaGemini(
//     scriptContent: string,
//     scriptIdForLog: number,
//     availableLocationsFromDb: DbLocation[],
//     projectBudget: number | undefined,
//     numberOfSuggestions: number = 5,
// ): Promise<LocationAISuggestion[]> {
//     const logPrefix = `[Gemini Script Location Suggestion for Script ID:${scriptIdForLog} with ${MODEL_NAME}]`;
//     if (availableLocationsFromDb.length === 0) { console.warn(`${logPrefix} No locations provided in the database list.`); return []; }
//     if (!scriptContent || scriptContent.trim().length < 100) { console.warn(`${logPrefix} Script content is too short for meaningful location suggestions.`); return []; }

//     const formattedLocationsString = formatLocationsForPrompt(availableLocationsFromDb);
//     const safeScriptContent = sanitizeForSafetyFilter(scriptContent.substring(0, 1000000)); // Max context length

//     try {
//         const aiClient = initializeGenAIClient();
//         const generationConfigForRequest: SDKGenerationConfig = {
//             responseMimeType: "application/json", temperature: 0.5, maxOutputTokens: 4096,
//         };

//         const prompt = `
// You are an expert Location Scout AI. Based on the ENTIRE SCRIPT provided, recommend ${numberOfSuggestions} diverse types of real-world filming locations from the AVAILABLE_LOCATIONS_DATABASE that would be suitable for various scenes or the overall production.
// INPUTS:
// 1.  SCRIPT_CONTENT (full script or substantial portion provided in context block).
// 2.  PROJECT_BUDGET: "${projectBudget !== undefined ? `$${projectBudget.toLocaleString()}` : "Not Specified"}"
// 3.  AVAILABLE_LOCATIONS_DATABASE (full list provided in context block).
// INSTRUCTIONS:
// -   Read the SCRIPT_CONTENT to understand the primary settings, themes, moods, and recurring location types required throughout the script.
// -   From the AVAILABLE_LOCATIONS_DATABASE, select up to ${numberOfSuggestions} locations that offer good general utility or match key settings described in the script. Aim for a diverse set of location *types* if possible.
// -   For each suggested location: "locationId" (EXACT DB_ID_AS_NUMBER), "matchReason" (1-2 sentences explaining fit for script's needs), "estimatedIncentiveNotes" (relevance of incentive to budget/production type, use search if needed), "confidenceScore" (optional 0.0-1.0).
// OUTPUT FORMAT: Return ONLY a valid JSON object: { "suggestedLocations": [ { "locationId": DB_ID_AS_NUMBER, "matchReason": "...", "estimatedIncentiveNotes": "...", "confidenceScore": 0.9 }, ... ] }
// Ensure "locationId" is a number. Only use IDs from AVAILABLE_LOCATIONS_DATABASE. Ensure the output is a single, clean JSON object without any surrounding text or markdown.
// CONTEXT_BLOCK_LOCATIONS_DATABASE: ${formattedLocationsString}
// CONTEXT_BLOCK_SCRIPT: ${safeScriptContent}`;

//         const contentsForRequest: SDKContent[] = [{ role: "user", parts: [{ text: prompt }] }];
//         const request: GenerateContentRequest = {
//             model: MODEL_NAME, contents: contentsForRequest, tools: defaultTools,
//             generationConfig: generationConfigForRequest, safetySettings: defaultSafetySettings,
//         };

//         const result: GenerateContentResult = await aiClient.models.generateContent(request);

//         if (!result) { console.error(`${logPrefix} Gemini SDK returned a null or undefined result.`); throw new Error("Gemini SDK returned a null or undefined result.");}
//         if (result.promptFeedback?.blockReason) { console.error(`${logPrefix} Request blocked. Reason: ${result.promptFeedback.blockReason}`, result.promptFeedback); throw new Error(`Request blocked by API: ${result.promptFeedback.blockReason}`);}
//         if (!result.candidates || result.candidates.length === 0) { const safetyRatings = result.candidates?.[0]?.safetyRatings; const finishReason = result.candidates?.[0]?.finishReason; console.error(`${logPrefix} No valid candidates. Finish Reason: ${finishReason}, Safety Ratings:`, JSON.stringify(safetyRatings, null, 2)); throw new Error(`No valid candidates or blocked. Finish Reason: ${finishReason}. Safety: ${JSON.stringify(safetyRatings)}`); }

//         let rawResponseText = "";
//         if (result.candidates[0]?.content?.parts) { const textPart = result.candidates[0].content.parts.find((part) => "text" in part); if (textPart && "text" in textPart) { rawResponseText = textPart.text; }}
//         if (!rawResponseText && typeof (result.candidates[0].content as any).text === 'string') { rawResponseText = (result.candidates[0].content as any).text;}


//         if (!rawResponseText) { console.error(`${logPrefix} Empty response text from Gemini. Full result object:`, JSON.stringify(result, null, 2)); throw new Error("Empty response text from Gemini."); }

//         const cleanJsonText = extractJsonFromString(rawResponseText);
//         if (!cleanJsonText) { console.error(`${logPrefix} Could not extract valid JSON from Gemini response. Raw:`, rawResponseText); return []; }

//         try {
//             const parsedResponse: GeminiLocationSuggestionResponse = JSON.parse(cleanJsonText);
//             if (!parsedResponse.suggestedLocations || !Array.isArray(parsedResponse.suggestedLocations)) { console.error(`${logPrefix} Format error after cleaning. Cleaned JSON:`, cleanJsonText, "Original Raw:", rawResponseText); return []; }
//             const validLocationIds = new Set(availableLocationsFromDb.map((loc) => loc.id));
//             const validatedSuggestions = parsedResponse.suggestedLocations
//                 .filter((sugg) => {
//                     const locId = typeof sugg.locationId === "string" ? parseInt(sugg.locationId, 10) : sugg.locationId;
//                     if (isNaN(locId) || !validLocationIds.has(locId)) { console.warn(`${logPrefix} Invalid or unknown locationId "${sugg.locationId}".`); return false; }
//                     if (!sugg.matchReason || typeof sugg.matchReason !== "string" || !sugg.estimatedIncentiveNotes || typeof sugg.estimatedIncentiveNotes !== "string") { console.warn(`${logPrefix} Suggestion for locId ${locId} missing required fields.`); return false; }
//                     sugg.locationId = locId; // Ensure it's a number
//                     return true;
//                 }).slice(0, numberOfSuggestions);
//             console.log(`${logPrefix} Received ${validatedSuggestions.length} valid location suggestions.`);
//             return validatedSuggestions;
//         } catch (parseError) {
//             console.error(`${logPrefix} Parse JSON error after cleaning. Cleaned JSON:`, cleanJsonText, "Original Raw:", rawResponseText, "Parse Error:", parseError);
//             return [];
//         }
//     } catch (error: any) {
//         console.error(`${logPrefix} Error in suggestLocationsForScriptViaGemini:`, error.message || error);
//         if (error.response && typeof error.response !== "undefined") { console.error("Error has a 'response' property (likely API error details):", JSON.stringify(error.response, null, 2)); }
//         else { console.error("Caught error object. Full error:", error); }
//         return [];
//     }
// }