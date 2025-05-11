// // server/services/ai-suggestion-service.ts
// import {
//   GoogleGenerativeAI,
//   HarmCategory,
//   HarmBlockThreshold,
//   GenerationConfig,
// } from "@google/generative-ai";
// import { Actor as DbActor, Location as DbLocation, Scene as DbScene } from "@shared/schema";
// import { sanitizeForSafetyFilter, ExtractedCharacter } from "./file-upload-service"; // Import ExtractedCharacter

// // --- Gemini Client Initialization (can be shared or re-initialized) ---
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

// // --- Actor Suggestions ---
// export interface ActorAISuggestion {
//   actorName: string;
//   matchReason: string;
//   confidenceScore?: number;
//   // We don't add actor's age here, Gemini will use its knowledge and mention it in matchReason if relevant
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
// Strategic Fit Notes: ${sanitizeForSafetyFilter(actor.bestSuitedRolesStrategic)} 
// ---`; // Sanitized strategic fit notes
//   }).join("\n");
// }

// export async function suggestActorsForCharacterViaGemini(
//   scriptContent: string,
//   characterToCast: ExtractedCharacter, // Now accepts ExtractedCharacter with age
//   availableActorsFromDb: DbActor[],
//   criteria: { filmGenre?: string; roleType?: string; budgetTier?: string },
//   numberOfSuggestions: number = 3,
// ): Promise<ActorAISuggestion[]> {
//   const characterNameToCast = characterToCast.name;
//   const characterEstimatedAge = characterToCast.estimatedAgeRange || "Not Specified";
//   const logPrefix = `[Gemini Actor Suggestion for "${characterNameToCast}" (Age: ${characterEstimatedAge})]`;

//   if (!scriptContent || scriptContent.trim().length < 50) { console.warn(`${logPrefix} Script content too short.`); return []; }
//   if (availableActorsFromDb.length === 0) { console.warn(`${logPrefix} No actors in DB list.`); return []; }

//   const formattedActorsString = formatActorsForPrompt(availableActorsFromDb);
//   const safeScriptContent = sanitizeForSafetyFilter(scriptContent.substring(0, 700000));
//   const safeCharacterName = sanitizeForSafetyFilter(characterNameToCast);

//   try {
//     const { genAI, safetySettings } = initializeGeminiClient();
//     const model = genAI.getGenerativeModel({
//       model: "gemini-1.5-flash", safetySettings,
//       generationConfig: { responseMimeType: "application/json", temperature: 0.4, maxOutputTokens: 2048 } as GenerationConfig,
//     });

//     const prompt = `
//     You are an expert Casting Director AI. Recommend ${numberOfSuggestions} suitable actors for a specific character in a screenplay.

//     INPUTS:
//     1.  CHARACTER_TO_CAST:
//         - Name: "${safeCharacterName}"
//         - Estimated Age Range (from script analysis): "${characterEstimatedAge}"
//     2.  USER_CRITERIA_FOR_FILM:
//         - Film Genre: "${criteria.filmGenre || 'Not Specified'}"
//         - Role Type (for this character): "${criteria.roleType || 'Not Specified'}" (e.g., lead, supporting, cameo)
//         - Project Budget Tier: "${criteria.budgetTier || 'Not Specified'}" (e.g., low, medium, high)
//     3.  AVAILABLE_ACTORS_DATABASE (full list provided in context block): Contains actor profiles with details like gender, nationality, notable roles, genres, typical roles, estimated salary range, availability, and strategic fit notes.
//     4.  SCRIPT_CONTENT (full script provided in context block).

//     INSTRUCTIONS:
//     -   Analyze the SCRIPT_CONTENT to deeply understand "${safeCharacterName}": personality, actions, dialogue, relationships, and their role.
//     -   Compare this character profile against the AVAILABLE_ACTORS_DATABASE.
//     -   Crucially, consider the character's ESTIMATED_AGE_RANGE ("${characterEstimatedAge}"). Select actors from the database whose perceived age and typical roles align with this. You will need to use your general knowledge about actors for their perceived age, as it's not in the database.
//     -   Also consider USER_CRITERIA_FOR_FILM: Match actor's genres/roles with Film Genre/Role Type, and their salary range with Budget Tier. Prioritize 'Active' availability.
//     -   For each suggested actor, provide:
//         -   "actorName": The EXACT name from the AVAILABLE_ACTORS_DATABASE.
//         -   "matchReason": A concise (1-2 sentences) explanation. Justify why the actor is a good fit, referencing character traits, script context, the character's estimated age, and the actor's profile (including suitability for the character's age, typical roles, or past performances).
//         -   "confidenceScore": (Optional) A number between 0.0 and 1.0.

//     OUTPUT FORMAT:
//     Return ONLY a valid JSON object: { "suggestedActors": [ { "actorName": "EXACT_DB_NAME", "matchReason": "...", "confidenceScore": 0.85 }, ... ] }
//     Return up to ${numberOfSuggestions} best matches. If fewer good matches, return fewer. Do NOT invent actors.

//     CONTEXT_BLOCK_ACTORS:
//     ${formattedActorsString}

//     CONTEXT_BLOCK_SCRIPT:
//     ${safeScriptContent}
//     `;
//     // console.log(`${logPrefix} Sending request to Gemini for actor suggestions... (Prompt length: ~${prompt.length} chars)`); // Less verbose

//     const result = await model.generateContent(prompt);
//     const responseText = result.response.text();

//     try {
//       const parsedResponse: GeminiActorSuggestionResponse = JSON.parse(responseText);
//       if (!parsedResponse.suggestedActors || !Array.isArray(parsedResponse.suggestedActors)) { console.error(`${logPrefix} Format error. Raw:`, responseText); return []; }
//       const validActorNames = new Set(availableActorsFromDb.map(a => a.name.toUpperCase()));
//       const validatedSuggestions = parsedResponse.suggestedActors.filter(sugg => {
//         if (!sugg.actorName || typeof sugg.actorName !== 'string' || !sugg.matchReason || typeof sugg.matchReason !== 'string') return false;
//         if (!validActorNames.has(sugg.actorName.toUpperCase())) { console.warn(`${logPrefix} Suggested actor "${sugg.actorName}" not in DB.`); return false; }
//         const originalActor = availableActorsFromDb.find(a => a.name.toUpperCase() === sugg.actorName.toUpperCase());
//         if (originalActor) sugg.actorName = originalActor.name; // Ensure original casing
//         return true;
//       }).slice(0, numberOfSuggestions);
//       console.log(`${logPrefix} Received ${validatedSuggestions.length} valid suggestions.`);
//       return validatedSuggestions;
//     } catch (parseError) { console.error(`${logPrefix} Parse JSON error:`, parseError, "\nRaw:", responseText); return []; }
//   } catch (error: any) { console.error(`${logPrefix} Error:`, error.message || error); if (error.response?.data) console.error("Details:", error.response.data); return []; }
// }

// // --- Location Suggestions (remains the same as your previous version) ---
// export interface LocationAISuggestion {
//   locationId: number;
//   matchReason: string;
//   estimatedIncentiveNotes: string;
//   confidenceScore?: number;
// }
// interface GeminiLocationSuggestionResponse {
//   suggestedLocations: LocationAISuggestion[];
// }
// function formatLocationsForPrompt(locationsToFormat: DbLocation[]): string {
//   return locationsToFormat.map(loc => {
//     return `
// Location ID: ${loc.id}
// Country: ${loc.country}
// Region: ${loc.region || 'N/A'}
// Incentive Program: ${loc.incentiveProgram || 'N/A'}
// Incentive Details (Summary): ${sanitizeForSafetyFilter((loc.incentiveDetails || 'N/A').substring(0, 150))}...
// Minimum Spend: ${loc.minimumSpend || 'N/A'}
// Eligible Production Types: ${sanitizeForSafetyFilter(loc.eligibleProductionTypes || 'N/A')}
// ---`;
//   }).join("\n");
// }
// export async function suggestLocationsForSceneViaGemini(
//   scene: DbScene,
//   availableLocationsFromDb: DbLocation[],
//   projectBudget: number | undefined,
//   numberOfSuggestions: number = 3,
// ): Promise<LocationAISuggestion[]> {
//   const logPrefix = `[Gemini Location Suggestion for Scene ID:${scene.id}]`;
//   // console.log(`${logPrefix} Starting... Budget: ${projectBudget === undefined ? 'N/A' : `$${projectBudget.toLocaleString()}`}`); // Less verbose
//   if (availableLocationsFromDb.length === 0) { console.warn(`${logPrefix} No locations provided in the database list.`); return []; }
//   const formattedLocationsString = formatLocationsForPrompt(availableLocationsFromDb);
//   const safeSceneHeading = sanitizeForSafetyFilter(scene.heading);
//   const safeSceneContent = sanitizeForSafetyFilter(scene.content.substring(0, 1500));
//   try {
//     const { genAI, safetySettings } = initializeGeminiClient();
//     const model = genAI.getGenerativeModel({
//       model: "gemini-1.5-flash", safetySettings,
//       generationConfig: { responseMimeType: "application/json", temperature: 0.5, maxOutputTokens: 2048 } as GenerationConfig,
//     });
//     const prompt = `
//     You are an expert Location Scout AI. Recommend ${numberOfSuggestions} locations for a scene.
//     INPUTS:
//     1. SCENE_DETAILS: Scene ID: ${scene.id}, Heading: "${safeSceneHeading}", Content: "${safeSceneContent}..."
//     2. PROJECT_BUDGET: "${projectBudget !== undefined ? `$${projectBudget.toLocaleString()}` : 'Not Specified'}"
//     3. AVAILABLE_LOCATIONS_DATABASE (full list in context): ${formattedLocationsString.substring(0, 800)}...
//     INSTRUCTIONS: Analyze scene for setting, mood, period. Select up to ${numberOfSuggestions} locations. For each: "matchReason" (why fit?), "estimatedIncentiveNotes" (relevance to budget/scene), "confidenceScore" (optional).
//     OUTPUT: ONLY JSON: { "suggestedLocations": [ { "locationId": DB_ID, "matchReason": "...", "estimatedIncentiveNotes": "...", "confidenceScore": 0.9 }, ... ] }
//     Only use IDs from AVAILABLE_LOCATIONS_DATABASE.
//     CONTEXT_BLOCK_LOCATIONS_DATABASE:
//     ${formattedLocationsString}
//     `;
//     // console.log(`${logPrefix} Sending request to Gemini for location suggestions... (Prompt len: ~${prompt.length})`); // Less verbose
//     const result = await model.generateContent(prompt);
//     const responseText = result.response.text();
//     try {
//       const parsedResponse: GeminiLocationSuggestionResponse = JSON.parse(responseText);
//       if (!parsedResponse.suggestedLocations || !Array.isArray(parsedResponse.suggestedLocations)) { console.error(`${logPrefix} Format error. Raw:`, responseText); return []; }
//       const validLocationIds = new Set(availableLocationsFromDb.map(loc => loc.id));
//       const validatedSuggestions = parsedResponse.suggestedLocations.filter(sugg => {
//          const locId = typeof sugg.locationId === 'string' ? parseInt(sugg.locationId, 10) : sugg.locationId;
//         if (isNaN(locId) || !validLocationIds.has(locId)) { console.warn(`${logPrefix} Invalid locationId "${sugg.locationId}".`); return false; }
//         if (!sugg.matchReason || typeof sugg.matchReason !== 'string' || !sugg.estimatedIncentiveNotes || typeof sugg.estimatedIncentiveNotes !== 'string' ) { console.warn(`${logPrefix} Suggestion for locId ${locId} missing fields.`); return false; }
//         sugg.locationId = locId;
//         return true;
//       }).slice(0, numberOfSuggestions);
//       console.log(`${logPrefix} Received ${validatedSuggestions.length} valid location suggestions.`);
//       return validatedSuggestions;
//     } catch (parseError) { console.error(`${logPrefix} Parse JSON error:`, parseError, "\nRaw:", responseText); return []; }
//   } catch (error: any) { console.error(`${logPrefix} Error:`, error.message || error); if (error.response?.data) console.error("Details:", error.response.data); return []; }
// }

// server/services/ai-suggestion-service.ts
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
  GenerationConfig,
} from "@google/generative-ai";
import { Actor as DbActor, Location as DbLocation, Scene as DbScene } from "@shared/schema";
import { sanitizeForSafetyFilter, ExtractedCharacter } from "./file-upload-service";

// --- Gemini Client Initialization (remains the same) ---
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
export type ControversyLevel = 'none' | 'low' | 'medium' | 'high'; // Define type for clarity

export interface ActorAISuggestion {
  actorName: string;
  matchReason: string;
  confidenceScore?: number;
  controversyLevel?: ControversyLevel; // NEW: Added controversy level
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
Strategic Fit Notes: ${sanitizeForSafetyFilter(actor.bestSuitedRolesStrategic)}
---`;
  }).join("\n");
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
  const logPrefix = `[Gemini Actor Suggestion for "${characterNameToCast}" (Age: ${characterEstimatedAge})]`;

  if (!scriptContent || scriptContent.trim().length < 50) { console.warn(`${logPrefix} Script content too short.`); return []; }
  if (availableActorsFromDb.length === 0) { console.warn(`${logPrefix} No actors in DB list.`); return []; }

  const formattedActorsString = formatActorsForPrompt(availableActorsFromDb);
  const safeScriptContent = sanitizeForSafetyFilter(scriptContent.substring(0, 700000));
  const safeCharacterName = sanitizeForSafetyFilter(characterNameToCast);

  try {
    const { genAI, safetySettings } = initializeGeminiClient();
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash", safetySettings,
      generationConfig: { responseMimeType: "application/json", temperature: 0.4, maxOutputTokens: 4096 } as GenerationConfig, // Increased tokens for more detail
    });

    const prompt = `
    You are an expert Casting Director AI. Recommend ${numberOfSuggestions} suitable actors for a specific character in a screenplay.

    INPUTS:
    1.  CHARACTER_TO_CAST:
        - Name: "${safeCharacterName}"
        - Estimated Age Range (from script analysis): "${characterEstimatedAge}"
    2.  USER_CRITERIA_FOR_FILM:
        - Film Genre: "${criteria.filmGenre || 'Not Specified'}"
        - Role Type (for this character): "${criteria.roleType || 'Not Specified'}"
        - Project Budget Tier: "${criteria.budgetTier || 'Not Specified'}"
    3.  AVAILABLE_ACTORS_DATABASE (full list in context block).
    4.  SCRIPT_CONTENT (full script in context block).

    INSTRUCTIONS:
    -   Analyze SCRIPT_CONTENT for "${safeCharacterName}" details.
    -   Compare with AVAILABLE_ACTORS_DATABASE, considering character's ESTIMATED_AGE_RANGE ("${characterEstimatedAge}"). Use general knowledge for actors' perceived age.
    -   Factor in USER_CRITERIA_FOR_FILM.
    -   For each suggested actor, provide:
        -   "actorName": EXACT name from AVAILABLE_ACTORS_DATABASE.
        -   "matchReason": Concise justification (1-2 sentences) linking character (traits, age) to actor's profile (age suitability, roles).
        -   "controversyLevel": Assess general public perception based on your knowledge. Use ONE of: "none", "low", "medium", "high". If unknown or truly none, use "none".
        -   "confidenceScore": (Optional) 0.0 to 1.0.

    OUTPUT FORMAT:
    Return ONLY a valid JSON object: { "suggestedActors": [ { "actorName": "...", "matchReason": "...", "controversyLevel": "low", "confidenceScore": 0.85 }, ... ] }
    Up to ${numberOfSuggestions} best matches. Do NOT invent actors.

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
      const validControversyLevels: ControversyLevel[] = ['none', 'low', 'medium', 'high'];

      const validatedSuggestions = parsedResponse.suggestedActors.filter(sugg => {
        if (!sugg.actorName || typeof sugg.actorName !== 'string' || !sugg.matchReason || typeof sugg.matchReason !== 'string') return false;
        if (!validActorNames.has(sugg.actorName.toUpperCase())) { console.warn(`${logPrefix} Suggested actor "${sugg.actorName}" not in DB.`); return false; }
        if (sugg.controversyLevel && !validControversyLevels.includes(sugg.controversyLevel)) {
            console.warn(`${logPrefix} Invalid controversyLevel "${sugg.controversyLevel}" for actor "${sugg.actorName}". Defaulting to 'none'.`);
            sugg.controversyLevel = 'none';
        }
        if (!sugg.controversyLevel) sugg.controversyLevel = 'none'; // Default if not provided

        const originalActor = availableActorsFromDb.find(a => a.name.toUpperCase() === sugg.actorName.toUpperCase());
        if (originalActor) sugg.actorName = originalActor.name;
        return true;
      }).slice(0, numberOfSuggestions);
      console.log(`${logPrefix} Received ${validatedSuggestions.length} valid suggestions with controversy levels.`);
      return validatedSuggestions;
    } catch (parseError) { console.error(`${logPrefix} Parse JSON error:`, parseError, "\nRaw:", responseText); return []; }
  } catch (error: any) { console.error(`${logPrefix} Error:`, error.message || error); if (error.response?.data) console.error("Details:", error.response.data); return []; }
}

// --- Location Suggestions (remains the same) ---
// ... (rest of the location suggestion code) ...
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
  if (availableLocationsFromDb.length === 0) { console.warn(`${logPrefix} No locations provided in the database list.`); return []; }
  const formattedLocationsString = formatLocationsForPrompt(availableLocationsFromDb);
  const safeSceneHeading = sanitizeForSafetyFilter(scene.heading);
  const safeSceneContent = sanitizeForSafetyFilter(scene.content.substring(0, 1500));
  try {
    const { genAI, safetySettings } = initializeGeminiClient();
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash", safetySettings,
      generationConfig: { responseMimeType: "application/json", temperature: 0.5, maxOutputTokens: 2048 } as GenerationConfig,
    });
    const prompt = `
    You are an expert Location Scout AI. Recommend ${numberOfSuggestions} locations for a scene.
    INPUTS:
    1. SCENE_DETAILS: Scene ID: ${scene.id}, Heading: "${safeSceneHeading}", Content: "${safeSceneContent}..."
    2. PROJECT_BUDGET: "${projectBudget !== undefined ? `$${projectBudget.toLocaleString()}` : 'Not Specified'}"
    3. AVAILABLE_LOCATIONS_DATABASE (full list in context): ${formattedLocationsString.substring(0, 800)}...
    INSTRUCTIONS: Analyze scene for setting, mood, period. Select up to ${numberOfSuggestions} locations. For each: "matchReason" (why fit?), "estimatedIncentiveNotes" (relevance to budget/scene), "confidenceScore" (optional).
    OUTPUT: ONLY JSON: { "suggestedLocations": [ { "locationId": DB_ID, "matchReason": "...", "estimatedIncentiveNotes": "...", "confidenceScore": 0.9 }, ... ] }
    Only use IDs from AVAILABLE_LOCATIONS_DATABASE.
    CONTEXT_BLOCK_LOCATIONS_DATABASE:
    ${formattedLocationsString}
    `;
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    try {
      const parsedResponse: GeminiLocationSuggestionResponse = JSON.parse(responseText);
      if (!parsedResponse.suggestedLocations || !Array.isArray(parsedResponse.suggestedLocations)) { console.error(`${logPrefix} Format error. Raw:`, responseText); return []; }
      const validLocationIds = new Set(availableLocationsFromDb.map(loc => loc.id));
      const validatedSuggestions = parsedResponse.suggestedLocations.filter(sugg => {
         const locId = typeof sugg.locationId === 'string' ? parseInt(sugg.locationId, 10) : sugg.locationId;
        if (isNaN(locId) || !validLocationIds.has(locId)) { console.warn(`${logPrefix} Invalid locationId "${sugg.locationId}".`); return false; }
        if (!sugg.matchReason || typeof sugg.matchReason !== 'string' || !sugg.estimatedIncentiveNotes || typeof sugg.estimatedIncentiveNotes !== 'string' ) { console.warn(`${logPrefix} Suggestion for locId ${locId} missing fields.`); return false; }
        sugg.locationId = locId;
        return true;
      }).slice(0, numberOfSuggestions);
      console.log(`${logPrefix} Received ${validatedSuggestions.length} valid location suggestions.`);
      return validatedSuggestions;
    } catch (parseError) { console.error(`${logPrefix} Parse JSON error:`, parseError, "\nRaw:", responseText); return []; }
  } catch (error: any) { console.error(`${logPrefix} Error:`, error.message || error); if (error.response?.data) console.error("Details:", error.response.data); return []; }
}