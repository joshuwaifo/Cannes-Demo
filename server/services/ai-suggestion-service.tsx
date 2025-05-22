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
import { Actor as DbActor, Location as DbLocation } from "@shared/schema";
import {
    sanitizeForSafetyFilter,
    ExtractedCharacter, // This is the BackendExtractedCharacter
} from "./file-upload-service";

// --- Gemini Client Initialization ---
let genAIClientInstance: GoogleGenAI | null = null;
const MODEL_NAME = "gemini-1.5-flash-8b";

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

const defaultTools: SDKTool[] = [{ googleSearch: {} }];

// --- Helper function to extract JSON from a potentially dirty string ---
function extractJsonFromString(str: string): string | null {
    if (!str || typeof str !== "string") return null;
    let cleanedStr = str.trim();
    const markdownMatch = cleanedStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (markdownMatch && markdownMatch[1]) {
        cleanedStr = markdownMatch[1].trim();
    }
    const coreJsonMatch = cleanedStr.match(
        /^[^\{\[]*([\{\[][\s\S]*[\}\]])[^\]\}]*$/,
    );
    if (coreJsonMatch && coreJsonMatch[1]) {
        cleanedStr = coreJsonMatch[1];
    } else {
        const firstBrace = cleanedStr.indexOf("{");
        const lastBrace = cleanedStr.lastIndexOf("}");
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            cleanedStr = cleanedStr.substring(firstBrace, lastBrace + 1);
        } else {
            console.warn(
                "[extractJsonFromString] Could not find valid JSON structure markers ({...} or [...]). Original string:",
                str,
            );
            return null;
        }
    }
    if (
        (cleanedStr.startsWith("{") && cleanedStr.endsWith("}")) ||
        (cleanedStr.startsWith("[") && cleanedStr.endsWith("]"))
    ) {
        return cleanedStr;
    }
    console.warn(
        "[extractJsonFromString] Final cleaned string does not appear to be valid JSON. Original:",
        str,
        "Cleaned attempt:",
        cleanedStr,
    );
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
            const notableRolesSummary =
                (Array.isArray(actor.notableRoles)
                    ? actor.notableRoles.slice(0, 3)
                    : []
                ).join(", ") +
                (actor.notableRoles && actor.notableRoles.length > 3
                    ? "..."
                    : "");
            const genresSummary =
                (Array.isArray(actor.genres)
                    ? actor.genres.slice(0, 3)
                    : []
                ).join(", ") +
                (actor.genres && actor.genres.length > 3 ? "..." : "");
            const typicalRolesSummary =
                (Array.isArray(actor.typicalRoles)
                    ? actor.typicalRoles.slice(0, 2)
                    : []
                ).join(", ") +
                (actor.typicalRoles && actor.typicalRoles.length > 2
                    ? "..."
                    : "");
            const strategicFitSummary =
                sanitizeForSafetyFilter(
                    (actor.bestSuitedRolesStrategic || "").substring(0, 100),
                ) +
                (actor.bestSuitedRolesStrategic &&
                actor.bestSuitedRolesStrategic.length > 100
                    ? "..."
                    : "");

            return `Actor Name: ${actor.name}, Gender: ${actor.gender}, Nationality: ${actor.nationality}, DOB: ${actor.dateOfBirth || "N/A"}, Popularity: ${actor.recentPopularity}, Salary: ${actor.estSalaryRange}, Notable Roles: ${notableRolesSummary}, Genres: ${genresSummary}, Typical Roles: ${typicalRolesSummary}, Strategic Fit: ${strategicFitSummary} ---`;
        })
        .join("\n");
}

export async function suggestActorsForCharacterViaGemini(
    scriptContent: string,
    characterToCast: ExtractedCharacter, // BackendExtractedCharacter
    availableActorsFromDb: DbActor[], // This is the pre-filtered list
    criteria: {
        filmGenre?: string;
        roleType?: string;
        budgetTier?: string;
        gender?: string;
    }, // gender here is finalGenderForAIPrompt
    numberOfSuggestions: number = 3,
): Promise<ActorAISuggestion[]> {
    const characterNameToCast = characterToCast.name;
    const characterEstimatedAge =
        characterToCast.estimatedAgeRange || "Not Specified";
    const characterProfiledGender = characterToCast.gender || "Unknown"; // Gender from script analysis

    // The 'criteria.gender' is the TARGET GENDER for casting, potentially from UI or refined logic
    const targetCastingGender =
        criteria.gender &&
        criteria.gender.toLowerCase() !== "any" &&
        criteria.gender.toLowerCase() !== "all" &&
        criteria.gender.toLowerCase() !== "unknown"
            ? criteria.gender
            : "Any"; // If UI/logic says 'any', AI can use broader artistic fit

    const logPrefix = `[Gemini Actor Suggest for "${characterNameToCast}" (Age: ${characterEstimatedAge}, TargetCastingGender: ${targetCastingGender})]`;

    if (availableActorsFromDb.length === 0) {
        console.warn(`${logPrefix} No actors in the pre-filtered DB list.`);
        return [];
    }

    const formattedActorsString = formatActorsForPrompt(availableActorsFromDb);
    const safeCharacterName = sanitizeForSafetyFilter(characterNameToCast);
    const safeCharacterDescription = sanitizeForSafetyFilter(
        characterToCast.description ||
            `A character named ${characterNameToCast}.`,
    );

    try {
        const aiClient = initializeGenAIClient();
        const generationConfigForRequest: SDKGenerationConfig = {
            responseMimeType: "application/json",
            temperature: 0.2,
            maxOutputTokens: 4096,
        };
        const prompt = `
You are an expert Casting Director AI. Your task is to select the ${numberOfSuggestions} most suitable actors from the PROVIDED_ACTOR_LIST for the given CHARACTER_PROFILE.
The PROVIDED_ACTOR_LIST has ALREADY been pre-filtered by the system for basic age and, if specified by the user, gender compatibility.
Your primary focus should be on artistic fit, role interpretation, and strategic considerations *within this pre-filtered list*.

CHARACTER_PROFILE:
- Name: "${safeCharacterName}"
- Estimated Age Range: "${characterEstimatedAge}"
- Profiled Gender (from script analysis, for context): "${characterProfiledGender}"
- **TARGET_CASTING_GENDER (primary gender to match from list): "${targetCastingGender}"**
- Description/Key Traits: "${safeCharacterDescription}"
- Inferred Role Type (from script analysis): "${characterToCast.roleType || "Not Specified"}"
- Recommended Budget Tier (from script analysis): "${characterToCast.recommendedBudgetTier || "Not Specified"}"

USER_CRITERIA_FOR_FILM (use as tie-breakers or further refinement):
- Film Genre: "${criteria.filmGenre || "Not Specified"}"
- Desired Role Type (UI override): "${criteria.roleType || "Use Profiled Role Type"}"
- Desired Budget Tier (UI override): "${criteria.budgetTier || "Use Profiled Budget Tier"}"

PROVIDED_ACTOR_LIST (Only select from this list. Actors here generally meet age/gender basics):
${formattedActorsString}

INSTRUCTIONS:
1.  **MANDATORY**: Select actors ONLY from the PROVIDED_ACTOR_LIST. Do NOT suggest actors outside this list.
2.  **MANDATORY GENDER MATCH**: If TARGET_CASTING_GENDER is specific (e.g., "Female", "Male"), you MUST select actors whose gender in the PROVIDED_ACTOR_LIST matches it. If TARGET_CASTING_GENDER is "Any", you have more flexibility but should still consider the Profiled Gender for artistic fit.
3.  **AGE ALIGNMENT**: Prioritize actors whose actual age (derived from their DOB in the list) closely matches the character's ESTIMATED_AGE_RANGE.
4.  **ARTISTIC & STRATEGIC FIT**: Evaluate how well the actor's typical roles, strategic fit notes, and perceived persona (from the list) match the CHARACTER_PROFILE and USER_CRITERIA.
5.  For each chosen actor, provide:
    - "actorName": (EXACTLY as it appears in the PROVIDED_ACTOR_LIST).
    - "matchReason": (1-2 concise sentences. Explain the fit, explicitly mentioning age and gender alignment. If TARGET_CASTING_GENDER was "Any" and you picked based on Profiled Gender or artistic choice, state that. If there's a slight age variance within the pre-filtered actors, justify if other factors compensate).
    - "controversyLevel": ("none", "low", "medium", "high" - based on general knowledge or a quick simulated search if needed for actors in the list. Default to "none" if unsure).
    - "confidenceScore": (0.0-1.0, your confidence in this actor being a top choice *from the given list* for this specific role, considering all factors).
6.  Return up to ${numberOfSuggestions} suggestions. If fewer than ${numberOfSuggestions} actors from the list are a strong match (especially for gender), return only those strong matches. It's better to have fewer, highly relevant suggestions than to force poor fits.

OUTPUT FORMAT: Return ONLY a valid JSON object: { "suggestedActors": [ { "actorName": "...", "matchReason": "...", "controversyLevel": "low", "confidenceScore": 0.85 }, ... ] }
Ensure the output is a single, clean JSON object without any surrounding text or markdown.`;

        const contentsForRequest: SDKContent[] = [
            { role: "user", parts: [{ text: prompt }] },
        ];
        const request: GenerateContentRequest = {
            model: MODEL_NAME,
            contents: contentsForRequest,
            tools: defaultTools,
            generationConfig: generationConfigForRequest,
            safetySettings: defaultSafetySettings,
        };

        console.log(
            `${logPrefix} Sending request to Gemini with ${availableActorsFromDb.length} pre-filtered actors. Target Casting Gender for AI: ${targetCastingGender}`,
        );
        const result: GenerateContentResult =
            await aiClient.models.generateContent(request);

        if (!result) {
            console.error(
                `${logPrefix} Gemini SDK returned a null or undefined result.`,
            );
            throw new Error("Gemini SDK returned a null or undefined result.");
        }

        if (result.promptFeedback?.blockReason) {
            console.error(
                `${logPrefix} Request blocked. Reason: ${result.promptFeedback.blockReason}`,
                result.promptFeedback,
            );
            throw new Error(
                `Request blocked by API: ${result.promptFeedback.blockReason}`,
            );
        }
        if (!result.candidates || result.candidates.length === 0) {
            const safetyRatings = result.candidates?.[0]?.safetyRatings;
            const finishReason = result.candidates?.[0]?.finishReason;
            console.error(
                `${logPrefix} No valid candidates. Finish Reason: ${finishReason}, Safety Ratings:`,
                JSON.stringify(safetyRatings, null, 2),
            );
            throw new Error(
                `No valid candidates or blocked. Finish Reason: ${finishReason}. Safety: ${JSON.stringify(safetyRatings)}`,
            );
        }

        let rawResponseText = "";
        if (result.candidates[0]?.content?.parts) {
            const textPart = result.candidates[0].content.parts.find(
                (part) => "text" in part,
            );
            if (textPart && "text" in textPart) {
                rawResponseText = textPart.text;
            }
        }
        if (
            !rawResponseText &&
            typeof (result.candidates[0].content as any).text === "string"
        ) {
            rawResponseText = (result.candidates[0].content as any).text;
        } // Fallback

        if (!rawResponseText) {
            console.error(
                `${logPrefix} Empty response text from Gemini. Full result object:`,
                JSON.stringify(result, null, 2),
            );
            throw new Error("Empty response text from Gemini.");
        }

        const cleanJsonText = extractJsonFromString(rawResponseText);
        if (!cleanJsonText) {
            console.error(
                `${logPrefix} Could not extract valid JSON from Gemini response. Raw:`,
                rawResponseText,
            );
            return [];
        }

        try {
            const parsedResponse: GeminiActorSuggestionResponse =
                JSON.parse(cleanJsonText);
            if (
                !parsedResponse.suggestedActors ||
                !Array.isArray(parsedResponse.suggestedActors)
            ) {
                console.error(
                    `${logPrefix} Format error after cleaning. Cleaned JSON:`,
                    cleanJsonText,
                    "Original Raw:",
                    rawResponseText,
                );
                return [];
            }
            const validActorNamesFromPreFiltered = new Set(
                availableActorsFromDb.map((a) => a.name.toUpperCase()),
            );
            const validControversyLevels: ControversyLevel[] = [
                "none",
                "low",
                "medium",
                "high",
            ];
            const validatedSuggestions = parsedResponse.suggestedActors
                .filter((sugg) => {
                    if (
                        !sugg.actorName ||
                        typeof sugg.actorName !== "string" ||
                        !sugg.matchReason ||
                        typeof sugg.matchReason !== "string"
                    )
                        return false;
                    if (
                        !validActorNamesFromPreFiltered.has(
                            sugg.actorName.toUpperCase(),
                        )
                    ) {
                        console.warn(
                            `${logPrefix} AI suggested actor "${sugg.actorName}" who was NOT in the pre-filtered list. Discarding.`,
                        );
                        return false;
                    }
                    if (
                        sugg.controversyLevel &&
                        !validControversyLevels.includes(sugg.controversyLevel)
                    ) {
                        sugg.controversyLevel = "none";
                    }
                    if (!sugg.controversyLevel) sugg.controversyLevel = "none";
                    const originalActor = availableActorsFromDb.find(
                        (a) =>
                            a.name.toUpperCase() ===
                            sugg.actorName.toUpperCase(),
                    );
                    if (originalActor) sugg.actorName = originalActor.name;
                    else {
                        return false;
                    }
                    return true;
                })
                .slice(0, numberOfSuggestions);
            console.log(
                `${logPrefix} Received ${validatedSuggestions.length} valid suggestions.`,
            );
            return validatedSuggestions;
        } catch (parseError) {
            console.error(
                `${logPrefix} Parse JSON error after cleaning. Cleaned JSON:`,
                cleanJsonText,
                "Original Raw:",
                rawResponseText,
                "Parse Error:",
                parseError,
            );
            return [];
        }
    } catch (error: any) {
        console.error(`${logPrefix} Error:`, error.message || error);
        if (error.response && typeof error.response !== "undefined") {
            console.error(
                "Error has a 'response' property (likely API error details):",
                JSON.stringify(error.response, null, 2),
            );
        } else {
            console.error("Caught error object. Full error:", error);
        }
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
    if (availableLocationsFromDb.length === 0) {
        console.warn(
            `${logPrefix} No locations provided in the database list.`,
        );
        return [];
    }
    if (!scriptContent || scriptContent.trim().length < 100) {
        console.warn(
            `${logPrefix} Script content is too short for meaningful location suggestions.`,
        );
        return [];
    }

    const formattedLocationsString = formatLocationsForPrompt(
        availableLocationsFromDb,
    );
    const safeScriptContent = sanitizeForSafetyFilter(
        scriptContent.substring(0, 1000000),
    );

    try {
        const aiClient = initializeGenAIClient();
        const generationConfigForRequest: SDKGenerationConfig = {
            responseMimeType: "application/json",
            temperature: 0.5,
            maxOutputTokens: 4096,
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

        const contentsForRequest: SDKContent[] = [
            { role: "user", parts: [{ text: prompt }] },
        ];
        const request: GenerateContentRequest = {
            model: MODEL_NAME,
            contents: contentsForRequest,
            tools: defaultTools,
            generationConfig: generationConfigForRequest,
            safetySettings: defaultSafetySettings,
        };

        const result: GenerateContentResult =
            await aiClient.models.generateContent(request);

        if (!result) {
            console.error(
                `${logPrefix} Gemini SDK returned a null or undefined result.`,
            );
            throw new Error("Gemini SDK returned a null or undefined result.");
        }

        if (result.promptFeedback?.blockReason) {
            console.error(
                `${logPrefix} Request blocked. Reason: ${result.promptFeedback.blockReason}`,
                result.promptFeedback,
            );
            throw new Error(
                `Request blocked by API: ${result.promptFeedback.blockReason}`,
            );
        }
        if (!result.candidates || result.candidates.length === 0) {
            const safetyRatings = result.candidates?.[0]?.safetyRatings;
            const finishReason = result.candidates?.[0]?.finishReason;
            console.error(
                `${logPrefix} No valid candidates. Finish Reason: ${finishReason}, Safety Ratings:`,
                JSON.stringify(safetyRatings, null, 2),
            );
            throw new Error(
                `No valid candidates or blocked. Finish Reason: ${finishReason}. Safety: ${JSON.stringify(safetyRatings)}`,
            );
        }

        let rawResponseText = "";
        if (result.candidates[0]?.content?.parts) {
            const textPart = result.candidates[0].content.parts.find(
                (part) => "text" in part,
            );
            if (textPart && "text" in textPart) {
                rawResponseText = textPart.text;
            }
        }
        if (
            !rawResponseText &&
            typeof (result.candidates[0].content as any).text === "string"
        ) {
            rawResponseText = (result.candidates[0].content as any).text;
        }

        if (!rawResponseText) {
            console.error(
                `${logPrefix} Empty response text from Gemini. Full result object:`,
                JSON.stringify(result, null, 2),
            );
            throw new Error("Empty response text from Gemini.");
        }

        const cleanJsonText = extractJsonFromString(rawResponseText);
        if (!cleanJsonText) {
            console.error(
                `${logPrefix} Could not extract valid JSON from Gemini response. Raw:`,
                rawResponseText,
            );
            return [];
        }

        try {
            const parsedResponse: GeminiLocationSuggestionResponse =
                JSON.parse(cleanJsonText);
            if (
                !parsedResponse.suggestedLocations ||
                !Array.isArray(parsedResponse.suggestedLocations)
            ) {
                console.error(
                    `${logPrefix} Format error after cleaning. Cleaned JSON:`,
                    cleanJsonText,
                    "Original Raw:",
                    rawResponseText,
                );
                return [];
            }
            const validLocationIds = new Set(
                availableLocationsFromDb.map((loc) => loc.id),
            );
            const validatedSuggestions = parsedResponse.suggestedLocations
                .filter((sugg) => {
                    const locId =
                        typeof sugg.locationId === "string"
                            ? parseInt(sugg.locationId, 10)
                            : sugg.locationId;
                    if (isNaN(locId) || !validLocationIds.has(locId)) {
                        console.warn(
                            `${logPrefix} Invalid or unknown locationId "${sugg.locationId}".`,
                        );
                        return false;
                    }
                    if (
                        !sugg.matchReason ||
                        typeof sugg.matchReason !== "string" ||
                        !sugg.estimatedIncentiveNotes ||
                        typeof sugg.estimatedIncentiveNotes !== "string"
                    ) {
                        console.warn(
                            `${logPrefix} Suggestion for locId ${locId} missing required fields.`,
                        );
                        return false;
                    }
                    sugg.locationId = locId; // Ensure it's a number
                    return true;
                })
                .slice(0, numberOfSuggestions);
            console.log(
                `${logPrefix} Received ${validatedSuggestions.length} valid location suggestions.`,
            );
            return validatedSuggestions;
        } catch (parseError) {
            console.error(
                `${logPrefix} Parse JSON error after cleaning. Cleaned JSON:`,
                cleanJsonText,
                "Original Raw:",
                rawResponseText,
                "Parse Error:",
                parseError,
            );
            return [];
        }
    } catch (error: any) {
        console.error(
            `${logPrefix} Error in suggestLocationsForScriptViaGemini:`,
            error.message || error,
        );
        if (error.response && typeof error.response !== "undefined") {
            console.error(
                "Error has a 'response' property (likely API error details):",
                JSON.stringify(error.response, null, 2),
            );
        } else {
            console.error("Caught error object. Full error:", error);
        }
        return [];
    }
}

