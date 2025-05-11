// update-actor-dob.ts
import { db } from "./db";
import { actors } from "./shared/schema";
import { eq } from "drizzle-orm";
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
  GenerationConfig,
} from "@google/generative-ai";
import * as dotenv from "dotenv";

// Load environment variables if using dotenv
dotenv.config();

// Type for Gemini response
interface ActorDOBResponse {
  dateOfBirth: string;
}

// Initialize Gemini client
function initializeGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("CRITICAL: GEMINI_API_KEY environment variable is not set");
    throw new Error("GEMINI_API_KEY environment variable is not set");
  }
  
  const genAI = new GoogleGenerativeAI(apiKey);
  const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  ];
  
  return { genAI, safetySettings };
}

// Get date of birth for actor using Gemini
async function getActorDOB(actorName: string): Promise<string> {
  console.log(`Getting DOB for actor: ${actorName}`);
  try {
    const { genAI, safetySettings } = initializeGeminiClient();
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      safetySettings,
      generationConfig: { 
        responseMimeType: "application/json", 
        temperature: 0.1,
        maxOutputTokens: 1024
      } as GenerationConfig,
    });

    const prompt = `
    You are a film industry database expert. I need the date of birth for the actor "${actorName}".

    INSTRUCTIONS:
    - Research the date of birth for "${actorName}" using your knowledge.
    - Return in YYYY-MM-DD format if known precisely.
    - If only year and month are known, use YYYY-MM format.
    - If only year is known, use YYYY format.
    - Do not guess or provide incorrect information. If the information is not available, return "unknown".
    - Ensure the date is accurate and fact-checked.

    OUTPUT FORMAT:
    Return ONLY a valid JSON object with this structure: 
    { "dateOfBirth": "YYYY-MM-DD" }
    or if only partial info is known: 
    { "dateOfBirth": "YYYY-MM" } or { "dateOfBirth": "YYYY" }
    or if unknown: 
    { "dateOfBirth": "unknown" }

    Provide no explanations or additional text outside of the JSON.
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    try {
      const parsedResponse = JSON.parse(responseText) as ActorDOBResponse;
      if (parsedResponse.dateOfBirth) {
        return parsedResponse.dateOfBirth === "unknown" ? "" : parsedResponse.dateOfBirth;
      }
      return "";
    } catch (parseError) {
      console.error(`Failed to parse JSON for ${actorName}:`, parseError);
      console.error("Raw response:", responseText);
      return "";
    }
  } catch (error) {
    console.error(`Error getting DOB for ${actorName}:`, error);
    return "";
  }
}

// Update actors with DOB information
async function updateActorDOBs() {
  try {
    console.log("Starting actor DOB update process...");
    
    // Get all actors without DOB
    const allActors = await db.select().from(actors);
    const actorsToUpdate = allActors.filter(actor => !actor.dateOfBirth);
    
    console.log(`Found ${actorsToUpdate.length} actors without DOB information.`);
    
    // Process in batches to avoid API rate limits
    const BATCH_SIZE = 5;
    const batches = Math.ceil(actorsToUpdate.length / BATCH_SIZE);
    
    let updatedCount = 0;
    
    for (let i = 0; i < batches; i++) {
      console.log(`Processing batch ${i + 1} of ${batches}...`);
      
      const startIdx = i * BATCH_SIZE;
      const endIdx = Math.min(startIdx + BATCH_SIZE, actorsToUpdate.length);
      const batchActors = actorsToUpdate.slice(startIdx, endIdx);
      
      // Process actors in sequence to avoid overwhelming the API
      for (const actor of batchActors) {
        const dob = await getActorDOB(actor.name);
        
        if (dob) {
          await db.update(actors)
            .set({ dateOfBirth: dob })
            .where(eq(actors.id, actor.id));
          
          console.log(`✅ Updated DOB for ${actor.name}: ${dob}`);
          updatedCount++;
        } else {
          console.log(`❌ No DOB found for ${actor.name}`);
        }
        
        // Add a small delay between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      console.log(`Completed batch ${i + 1} of ${batches}`);
      
      // Add a delay between batches
      if (i < batches - 1) {
        console.log("Pausing between batches...");
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    
    console.log(`✨ DOB update process completed. Updated ${updatedCount} actors out of ${actorsToUpdate.length}.`);
  } catch (error) {
    console.error("Error updating actor DOBs:", error);
  }
}

// Run the update process
updateActorDOBs().catch(error => {
  console.error("Fatal error:", error);
  process.exit(1);
});