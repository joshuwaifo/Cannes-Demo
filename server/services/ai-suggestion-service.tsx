// // server/services/ai-suggestion-service.ts
// import {
//   GoogleGenerativeAI,
//   HarmCategory,
//   HarmBlockThreshold,
//   GenerationConfig,
// } from "@google/generative-ai";
// import { Actor as DbActor } from "@shared/schema"; // Use aliased DbActor
// import { sanitizeForSafetyFilter } from "./file-upload-service"; // Reuse sanitization

// // Initialize Gemini Client (can be shared or re-initialized)
// // For simplicity, copying the initialization logic from file-upload-service
// // In a larger app, this would be a shared utility.
// let genAIInstance: GoogleGenerativeAI | null = null;
// let geminiSafetySettings: any[] | null = null;

// function initializeGeminiClient() {
//   if (genAIInstance && geminiSafetySettings) {
//     return { genAI: genAIInstance, safetySettings: geminiSafetySettings };
//   }
//   const apiKey = process.env.GEMINI_API_KEY;
//   if (!apiKey) {
//     console.error("CRITICAL: GEMINI_API_KEY environment variable is not set for AI Suggestion Service");
//     throw new Error("GEMINI_API_KEY environment variable is not set");
//   }
//   genAIInstance = new GoogleGenerativeAI(apiKey);
//   geminiSafetySettings = [
//     { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
//     { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
//     { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
//     { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
//   ];
//   return { genAI: genAIInstance, safetySettings: geminiSafetySettings };
// }

// export interface ActorAISuggestion {
//   actorName: string; // Gemini should return the exact name from the provided actor list
//   matchReason: string;
//   confidenceScore?: number; // Optional: 0.0 to 1.0
// }

// interface GeminiActorSuggestionResponse {
//   suggestedActors: ActorAISuggestion[];
// }

// function formatActorsForPrompt(actorsToFormat: DbActor[]): string {
//   return actorsToFormat.map(actor => {
//     return `
// Actor Name: ${actor.name}
// Gender: ${actor.gender}
// Nationality: ${actor.nationality}
// Notable Roles: ${(Array.isArray(actor.notableRoles) ? actor.notableRoles : []).join(", ")}
// Genres: ${(Array.isArray(actor.genres) ? actor.genres : []).join(", ")}
// Typical Roles: ${(Array.isArray(actor.typicalRoles) ? actor.typicalRoles : []).join(", ")}
// Recent Popularity: ${actor.recentPopularity}
// Est. Salary Range: ${actor.estSalaryRange}
// Availability: ${actor.availability}
// Strategic Fit Notes: ${actor.bestSuitedRolesStrategic}
// ---`;
//   }).join("\n");
// }

// export async function suggestActorsForCharacterViaGemini(
//   scriptContent: string,
//   characterNameToCast: string,
//   availableActorsFromDb: DbActor[],
//   criteria: { filmGenre?: string; roleType?: string; budgetTier?: string },
//   numberOfSuggestions: number = 3, // How many suggestions to ask for
// ): Promise<ActorAISuggestion[]> {
//   const logPrefix = `[Gemini Actor Suggestion for "${characterNameToCast}"]`;
//   console.log(`${logPrefix} Starting... Criteria: Genre=${criteria.filmGenre}, Role=${criteria.roleType}, Budget=${criteria.budgetTier}`);

//   if (!scriptContent || scriptContent.trim().length < 50) {
//     console.warn(`${logPrefix} Script content is too short. Cannot provide meaningful suggestions.`);
//     return [];
//   }
//   if (availableActorsFromDb.length === 0) {
//     console.warn(`${logPrefix} No actors provided in the database list.`);
//     return [];
//   }

//   const formattedActorsString = formatActorsForPrompt(availableActorsFromDb);
//   const safeScriptContent = sanitizeForSafetyFilter(scriptContent.substring(0, 700000)); // Generous limit for script part
//   const safeCharacterName = sanitizeForSafetyFilter(characterNameToCast);

//   try {
//     const { genAI, safetySettings } = initializeGeminiClient();
//     const model = genAI.getGenerativeModel({
//       model: "gemini-1.5-flash",
//       safetySettings,
//       generationConfig: {
//         responseMimeType: "application/json",
//         temperature: 0.4, // Slightly creative but still grounded
//         maxOutputTokens: 2048, // Enough for a few actor suggestions with reasons
//       } as GenerationConfig,
//     });

//     const prompt = `
//     You are an expert Casting Director AI. Your task is to recommend ${numberOfSuggestions} suitable actors for a specific character in a screenplay, based on the script content and a provided database of actors.

//     INPUTS:
//     1.  CHARACTER_NAME_TO_CAST: "${safeCharacterName}"
//     2.  USER_CRITERIA:
//         - Film Genre: "${criteria.filmGenre || 'Not Specified'}"
//         - Role Type: "${criteria.roleType || 'Not Specified'}" (e.g., lead, supporting, cameo)
//         - Project Budget Tier: "${criteria.budgetTier || 'Not Specified'}" (e.g., low, medium, high - consider actor's salary range)
//     3.  AVAILABLE_ACTORS_DATABASE (excerpt below, full list provided in context):
//         ${formattedActorsString.substring(0, 1000)}... (Full list has ${availableActorsFromDb.length} actors)
//     4.  SCRIPT_CONTENT (excerpt below, full script provided in context):
//         ${safeScriptContent.substring(0, 2000)}...

//     INSTRUCTIONS:
//     -   Analyze the SCRIPT_CONTENT to understand the character "${safeCharacterName}": their personality, actions, dialogue, age (if implied), physical characteristics (if described), and overall role in the story.
//     -   From the AVAILABLE_ACTORS_DATABASE, select the ${numberOfSuggestions} actors who best fit this character.
//     -   Consider the USER_CRITERIA:
//         - Match actor's typical genres and roles with the Film Genre and Role Type.
//         - Match actor's Est. Salary Range with the Project Budget Tier (e.g., A-List for high budget).
//         - Prioritize actors whose 'Availability' is 'Active' or suitable.
//     -   For each suggested actor, provide a concise "matchReason" (1-2 sentences) explaining why they are a good fit, referencing both script details and actor profile.
//     -   Optionally, provide a "confidenceScore" (0.0 to 1.0) for each suggestion.

//     OUTPUT FORMAT:
//     Return ONLY a valid JSON object. The JSON object must have a single key "suggestedActors".
//     The value of "suggestedActors" must be an array of exactly ${numberOfSuggestions} objects (or fewer if not enough good matches). Each object MUST contain these exact keys:
//     -   "actorName": string (The EXACT name of the actor from the AVAILABLE_ACTORS_DATABASE)
//     -   "matchReason": string
//     -   "confidenceScore": number (optional, between 0.0 and 1.0)

//     Example of a single element in the "suggestedActors" array:
//     { "actorName": "Tom Hanks", "matchReason": "Tom Hanks' portrayal of everyman heroes aligns well with ${safeCharacterName}'s journey in the script. His experience in [User Genre] and suitable salary range make him a strong contender.", "confidenceScore": 0.85 }

//     IMPORTANT: Only suggest actors present in the provided AVAILABLE_ACTORS_DATABASE. Ensure actor names in the output match exactly. Do not invent actors. If you cannot find ${numberOfSuggestions} good matches, return as many as you confidently can.

//     CONTEXT_BLOCK_ACTORS:
//     ${formattedActorsString}

//     CONTEXT_BLOCK_SCRIPT:
//     ${safeScriptContent}
//     `;

//     console.log(`${logPrefix} Sending request to Gemini for actor suggestions... (Prompt length: ~${prompt.length} chars)`);
//     const result = await model.generateContent(prompt);
//     const responseText = result.response.text();
//     // console.log(`${logPrefix} Raw Gemini response:`, responseText); // Debug if needed

//     try {
//       const parsedResponse: GeminiActorSuggestionResponse = JSON.parse(responseText);
//       if (!parsedResponse.suggestedActors || !Array.isArray(parsedResponse.suggestedActors)) {
//         console.error(`${logPrefix} Gemini response format error. Raw:`, responseText);
//         return [];
//       }

//       // Validate actor names against the provided list (case-insensitive check for robustness)
//       const validActorNames = new Set(availableActorsFromDb.map(a => a.name.toUpperCase()));
//       const validatedSuggestions = parsedResponse.suggestedActors.filter(sugg => {
//         if (!sugg.actorName || typeof sugg.actorName !== 'string' || !sugg.matchReason || typeof sugg.matchReason !== 'string') {
//             console.warn(`${logPrefix} Invalid suggestion structure from Gemini:`, sugg);
//             return false;
//         }
//         if (!validActorNames.has(sugg.actorName.toUpperCase())) {
//             console.warn(`${logPrefix} Gemini suggested actor "${sugg.actorName}" not in provided database. Skipping.`);
//             return false;
//         }
//         // Find the original casing for the actor's name
//         const originalActor = availableActorsFromDb.find(a => a.name.toUpperCase() === sugg.actorName.toUpperCase());
//         if (originalActor) {
//             sugg.actorName = originalActor.name; // Use original casing
//         }
//         return true;
//       });

//       console.log(`${logPrefix} Received ${validatedSuggestions.length} valid suggestions from Gemini.`);
//       return validatedSuggestions;

//     } catch (parseError) {
//       console.error(`${logPrefix} Failed to parse Gemini JSON response:`, parseError, "\nRaw Response:", responseText);
//       return [];
//     }

//   } catch (error: any) {
//     console.error(`${logPrefix} Error suggesting actors with Gemini:`, error.message || error);
//     if (error.response?.data) console.error("Gemini API error details:", error.response.data);
//     return [];
//   }
// }

// server/services/ai-suggestion-service.ts
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
  GenerationConfig,
} from "@google/generative-ai";
import { Actor as DbActor, Location as DbLocation, Scene as DbScene } from "@shared/schema";
import { sanitizeForSafetyFilter } from "./file-upload-service";

// --- Gemini Client Initialization ---
let genAIInstance: GoogleGenerativeAI | null = null;
let geminiSafetySettings: any[] | null = null;

function initializeGeminiClient() {
  if (genAIInstance && geminiSafetySettings) {
    return { genAI: genAIInstance, safetySettings: geminiSafetySettings };
  }
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("CRITICAL: GEMINI_API_KEY environment variable is not set for AI Suggestion Service");
    throw new Error("GEMINI_API_KEY environment variable is not set");
  }
  genAIInstance = new GoogleGenerativeAI(apiKey);
  geminiSafetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  ];
  return { genAI: genAIInstance, safetySettings: geminiSafetySettings };
}

// --- Actor Suggestions ---
export interface ActorAISuggestion {
  actorName: string;
  matchReason: string;
  confidenceScore?: number;
}
interface GeminiActorSuggestionResponse {
  suggestedActors: ActorAISuggestion[];
}
function formatActorsForPrompt(actorsToFormat: DbActor[]): string {
  return actorsToFormat.map(actor => {
    return `
Actor Name: ${actor.name}
Gender: ${actor.gender}
Nationality: ${actor.nationality}
Notable Roles: ${(Array.isArray(actor.notableRoles) ? actor.notableRoles : []).join(", ")}
Genres: ${(Array.isArray(actor.genres) ? actor.genres : []).join(", ")}
Typical Roles: ${(Array.isArray(actor.typicalRoles) ? actor.typicalRoles : []).join(", ")}
Recent Popularity: ${actor.recentPopularity}
Est. Salary Range: ${actor.estSalaryRange}
Availability: ${actor.availability}
Strategic Fit Notes: ${actor.bestSuitedRolesStrategic}
---`;
  }).join("\n");
}
export async function suggestActorsForCharacterViaGemini(
  scriptContent: string,
  characterNameToCast: string,
  availableActorsFromDb: DbActor[],
  criteria: { filmGenre?: string; roleType?: string; budgetTier?: string },
  numberOfSuggestions: number = 3,
): Promise<ActorAISuggestion[]> {
  const logPrefix = `[Gemini Actor Suggestion for "${characterNameToCast}"]`;
  // console.log(`${logPrefix} Starting... Criteria: Genre=${criteria.filmGenre}, Role=${criteria.roleType}, Budget=${criteria.budgetTier}`); // Less verbose
  if (!scriptContent || scriptContent.trim().length < 50) { console.warn(`${logPrefix} Script content too short.`); return []; }
  if (availableActorsFromDb.length === 0) { console.warn(`${logPrefix} No actors in DB list.`); return []; }

  const formattedActorsString = formatActorsForPrompt(availableActorsFromDb);
  const safeScriptContent = sanitizeForSafetyFilter(scriptContent.substring(0, 700000));
  const safeCharacterName = sanitizeForSafetyFilter(characterNameToCast);

  try {
    const { genAI, safetySettings } = initializeGeminiClient();
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash", safetySettings,
      generationConfig: { responseMimeType: "application/json", temperature: 0.4, maxOutputTokens: 2048 } as GenerationConfig,
    });
    const prompt = `
    You are an expert Casting Director AI. Recommend ${numberOfSuggestions} actors for "${safeCharacterName}" based on SCRIPT_CONTENT, USER_CRITERIA (Genre: "${criteria.filmGenre || 'N/A'}", Role: "${criteria.roleType || 'N/A'}", Budget: "${criteria.budgetTier || 'N/A'}"), and AVAILABLE_ACTORS_DATABASE.
    Prioritize actors matching genre, role type, salary to budget, and 'Active' availability.
    OUTPUT: ONLY JSON: { "suggestedActors": [ { "actorName": "EXACT_DB_NAME", "matchReason": "Concise reason linking script & actor profile.", "confidenceScore": 0.0-1.0 (optional) }, ... ] }
    Only suggest actors from AVAILABLE_ACTORS_DATABASE. Match names EXACTLY.
    CONTEXT_BLOCK_ACTORS:
    ${formattedActorsString}
    CONTEXT_BLOCK_SCRIPT:
    ${safeScriptContent}
    `;
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    try {
      const parsedResponse: GeminiActorSuggestionResponse = JSON.parse(responseText);
      if (!parsedResponse.suggestedActors || !Array.isArray(parsedResponse.suggestedActors)) { console.error(`${logPrefix} Format error. Raw:`, responseText); return []; }
      const validActorNames = new Set(availableActorsFromDb.map(a => a.name.toUpperCase()));
      const validatedSuggestions = parsedResponse.suggestedActors.filter(sugg => {
        if (!sugg.actorName || typeof sugg.actorName !== 'string' || !sugg.matchReason || typeof sugg.matchReason !== 'string') return false;
        if (!validActorNames.has(sugg.actorName.toUpperCase())) { console.warn(`${logPrefix} Suggested actor "${sugg.actorName}" not in DB.`); return false; }
        const originalActor = availableActorsFromDb.find(a => a.name.toUpperCase() === sugg.actorName.toUpperCase());
        if (originalActor) sugg.actorName = originalActor.name;
        return true;
      }).slice(0, numberOfSuggestions); // Ensure we don't exceed the requested number
      console.log(`${logPrefix} Received ${validatedSuggestions.length} valid suggestions.`);
      return validatedSuggestions;
    } catch (parseError) { console.error(`${logPrefix} Parse JSON error:`, parseError, "\nRaw:", responseText); return []; }
  } catch (error: any) { console.error(`${logPrefix} Error:`, error.message || error); if (error.response?.data) console.error("Details:", error.response.data); return []; }
}


// --- Location Suggestions ---
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
  return locationsToFormat.map(loc => {
    // Basic formatting, can be expanded
    return `
Location ID: ${loc.id}
Country: ${loc.country}
Region: ${loc.region || 'N/A'}
Incentive Program: ${loc.incentiveProgram || 'N/A'}
Incentive Details (Summary): ${sanitizeForSafetyFilter((loc.incentiveDetails || 'N/A').substring(0, 150))}...
Minimum Spend: ${loc.minimumSpend || 'N/A'}
Eligible Production Types: ${sanitizeForSafetyFilter(loc.eligibleProductionTypes || 'N/A')}
---`;
  }).join("\n");
}

export async function suggestLocationsForSceneViaGemini(
  scene: DbScene,
  availableLocationsFromDb: DbLocation[],
  projectBudget: number | undefined,
  numberOfSuggestions: number = 3,
): Promise<LocationAISuggestion[]> {
  const logPrefix = `[Gemini Location Suggestion for Scene ID:${scene.id}]`;
  console.log(`${logPrefix} Starting... Budget: ${projectBudget === undefined ? 'N/A' : `$${projectBudget.toLocaleString()}`}`);

  if (availableLocationsFromDb.length === 0) {
    console.warn(`${logPrefix} No locations provided in the database list.`);
    return [];
  }

  const formattedLocationsString = formatLocationsForPrompt(availableLocationsFromDb);
  const safeSceneHeading = sanitizeForSafetyFilter(scene.heading);
  const safeSceneContent = sanitizeForSafetyFilter(scene.content.substring(0, 1500)); // Increased snippet size for better context

  try {
    const { genAI, safetySettings } = initializeGeminiClient();
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      safetySettings,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.5,
        maxOutputTokens: 2048,
      } as GenerationConfig,
    });

    const prompt = `
    You are an expert Location Scout AI. Your task is to recommend ${numberOfSuggestions} suitable filming locations for a specific screenplay scene, based on the scene's content and a provided database of locations with their incentive programs.

    INPUTS:
    1.  SCENE_DETAILS:
        - Scene ID: ${scene.id}
        - Scene Heading: "${safeSceneHeading}"
        - Scene Content Snippet (Focus on setting, mood, key elements): "${safeSceneContent}..."
    2.  PROJECT_BUDGET (Optional): "${projectBudget !== undefined ? `$${projectBudget.toLocaleString()}` : 'Not Specified'}"
    3.  AVAILABLE_LOCATIONS_DATABASE (excerpt below, full list provided in context block):
        ${formattedLocationsString.substring(0, 800)}... (Full list has ${availableLocationsFromDb.length} locations)

    INSTRUCTIONS:
    -   Analyze the SCENE_DETAILS for its core requirements: setting type (e.g., urban, rural, desert, modern office, period mansion), mood (e.g., tense, romantic, desolate), time period (if inferable), and any specific visual cues or actions that impact location choice.
    -   From the AVAILABLE_LOCATIONS_DATABASE, select up to ${numberOfSuggestions} locations whose general characteristics (country, region, incentive types) seem most aligned with the scene.
    -   For each selected location, provide:
        -   "matchReason": A concise (1-2 sentences) explanation of why this location *could* be a good fit for the scene, considering its general profile.
        -   "estimatedIncentiveNotes": A brief (1-2 sentences) commentary on the incentive program's potential relevance. If PROJECT_BUDGET is provided, relate the incentive to it (e.g., "The tax credit might be substantial for a budget of this size." or "Minimum spend for incentive might be too high/low for this budget."). If no budget, state "Incentive potential cannot be estimated without project budget."
    -   Optionally, include a "confidenceScore" (0.0 to 1.0) reflecting your confidence in the match.

    OUTPUT FORMAT:
    Return ONLY a valid JSON object. The JSON object must have a single key "suggestedLocations".
    The value of "suggestedLocations" must be an array of up to ${numberOfSuggestions} objects. Each object MUST contain these exact keys: "locationId" (number, from DB), "matchReason" (string), "estimatedIncentiveNotes" (string), and optionally "confidenceScore" (number).

    Example:
    { "suggestedLocations": [ { "locationId": 789, "matchReason": "The 'Old Warehouse District' in this location matches the gritty urban setting described.", "estimatedIncentiveNotes": "Offers a 20% tax credit, which could be significant for the specified $5M budget.", "confidenceScore": 0.9 } ] }

    IMPORTANT: Only use location IDs from the provided AVAILABLE_LOCATIONS_DATABASE.

    CONTEXT_BLOCK_LOCATIONS_DATABASE:
    ${formattedLocationsString}
    `;

    console.log(`${logPrefix} Sending request to Gemini for location suggestions... (Prompt len: ~${prompt.length})`);
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    // console.log(`${logPrefix} Raw Gemini location response:`, responseText); // For debugging

    try {
      const parsedResponse: GeminiLocationSuggestionResponse = JSON.parse(responseText);
      if (!parsedResponse.suggestedLocations || !Array.isArray(parsedResponse.suggestedLocations)) {
        console.error(`${logPrefix} Gemini response format error. Raw:`, responseText);
        return [];
      }

      const validLocationIds = new Set(availableLocationsFromDb.map(loc => loc.id));
      const validatedSuggestions = parsedResponse.suggestedLocations.filter(sugg => {
         const locId = typeof sugg.locationId === 'string' ? parseInt(sugg.locationId, 10) : sugg.locationId;
        if (isNaN(locId) || !validLocationIds.has(locId)) {
            console.warn(`${logPrefix} Gemini suggested invalid locationId "${sugg.locationId}". Skipping.`);
            return false;
        }
        if (!sugg.matchReason || typeof sugg.matchReason !== 'string' || !sugg.estimatedIncentiveNotes || typeof sugg.estimatedIncentiveNotes !== 'string' ) {
             console.warn(`${logPrefix} Gemini suggestion for locationId ${locId} missing required fields. Skipping.`);
            return false;
        }
        sugg.locationId = locId;
        return true;
      }).slice(0, numberOfSuggestions); // Ensure we don't exceed the requested number

      console.log(`${logPrefix} Received ${validatedSuggestions.length} valid location suggestions from Gemini.`);
      return validatedSuggestions;

    } catch (parseError) {
      console.error(`${logPrefix} Failed to parse Gemini JSON response for locations:`, parseError, "\nRaw Response:", responseText);
      return [];
    }

  } catch (error: any) {
    console.error(`${logPrefix} Error suggesting locations with Gemini:`, error.message || error);
    if (error.response?.data) console.error("Gemini API error details:", error.response.data);
    return [];
  }
}