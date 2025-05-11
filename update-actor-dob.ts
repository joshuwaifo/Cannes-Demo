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

// Manual dataset for common actors
// This serves as a fallback when API calls fail
const knownActorDOBs: Record<string, string> = {
  "Tom Hanks": "1956-07-09",
  "Meryl Streep": "1949-06-22",
  "Brad Pitt": "1963-12-18",
  "Angelina Jolie": "1975-06-04",
  "Leonardo DiCaprio": "1974-11-11",
  "Jennifer Lawrence": "1990-08-15",
  "Denzel Washington": "1954-12-28",
  "Viola Davis": "1965-08-11",
  "Robert Downey Jr.": "1965-04-04",
  "Scarlett Johansson": "1984-11-22",
  "Dwayne Johnson": "1972-05-02",
  "Emma Stone": "1988-11-06",
  "Will Smith": "1968-09-25",
  "Cate Blanchett": "1969-05-14",
  "Samuel L. Jackson": "1948-12-21",
  "Julia Roberts": "1967-10-28",
  "George Clooney": "1961-05-06",
  "Nicole Kidman": "1967-06-20",
  "Chris Hemsworth": "1983-08-11",
  "Jennifer Aniston": "1969-02-11",
  "Johnny Depp": "1963-06-09",
  "Sandra Bullock": "1964-07-26",
  "Ryan Gosling": "1980-11-12",
  "Emma Watson": "1990-04-15",
  "Anthony Hopkins": "1937-12-31",
  "Charlize Theron": "1975-08-07",
  "Joaquin Phoenix": "1974-10-28",
  "Natalie Portman": "1981-06-09",
  "Matt Damon": "1970-10-08",
  "Keanu Reeves": "1964-09-02",
  "Hugh Jackman": "1968-10-12",
  "Anne Hathaway": "1982-11-12",
  "Daniel Craig": "1968-03-02",
  "Jennifer Lopez": "1969-07-24",
  "Christian Bale": "1974-01-30",
  "Kate Winslet": "1975-10-05",
  "Tom Cruise": "1962-07-03",
  "Halle Berry": "1966-08-14",
  "Chris Evans": "1981-06-13",
  "Zoe Saldana": "1978-06-19",
  "Idris Elba": "1972-09-06",
  "Chadwick Boseman": "1976-11-29",
  "Robert De Niro": "1943-08-17",
  "Al Pacino": "1940-04-25",
  "Morgan Freeman": "1937-06-01",
  "Helen Mirren": "1945-07-26",
  "Judi Dench": "1934-12-09",
  "Ian McKellen": "1939-05-25",
  "Kevin Spacey": "1959-07-26",
  "Gary Oldman": "1958-03-21"
};

// Get date of birth for actor using Gemini or fallback to static data
async function getActorDOB(actorName: string, retryCount = 0): Promise<string> {
  console.log(`Getting DOB for actor: ${actorName}`);
  
  // Check if we have this actor in our manual dataset first
  if (knownActorDOBs[actorName]) {
    console.log(`Using manual dataset for ${actorName}`);
    return knownActorDOBs[actorName];
  }
  
  // Max retries
  const MAX_RETRIES = 2;
  
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
      
      // If we haven't reached max retries, try again
      if (retryCount < MAX_RETRIES) {
        console.log(`Retrying (${retryCount + 1}/${MAX_RETRIES}) for ${actorName}...`);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait before retry
        return getActorDOB(actorName, retryCount + 1);
      }
      
      return "";
    }
  } catch (error) {
    console.error(`Error getting DOB for ${actorName}:`, error);
    
    // If we haven't reached max retries, try again
    if (retryCount < MAX_RETRIES) {
      console.log(`Retrying (${retryCount + 1}/${MAX_RETRIES}) for ${actorName}...`);
      await new Promise(resolve => setTimeout(resolve, 3000)); // Longer wait for network errors
      return getActorDOB(actorName, retryCount + 1);
    }
    
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
    
    // If there are too many actors, just process a limited number to avoid timeouts
    const MAX_BATCHES_TO_PROCESS = 5; // Process at most 25 actors (5 batches * 5 actors)
    const batchesToProcess = Math.min(batches, MAX_BATCHES_TO_PROCESS);
    
    let updatedCount = 0;
    let actorsProcessed = 0;
    
    for (let i = 0; i < batchesToProcess; i++) {
      console.log(`Processing batch ${i + 1} of ${batchesToProcess}...`);
      
      const startIdx = i * BATCH_SIZE;
      const endIdx = Math.min(startIdx + BATCH_SIZE, actorsToUpdate.length);
      const batchActors = actorsToUpdate.slice(startIdx, endIdx);
      
      // Process actors in sequence to avoid overwhelming the API
      for (const actor of batchActors) {
        actorsProcessed++;
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
      
      console.log(`Completed batch ${i + 1} of ${batchesToProcess}`);
      
      // Add a delay between batches
      if (i < batchesToProcess - 1) {
        console.log("Pausing between batches...");
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    
    console.log(`✨ DOB update process completed. Updated ${updatedCount}/${actorsProcessed} actors (out of ${actorsToUpdate.length} total without DOB).`);
    
    if (actorsProcessed < actorsToUpdate.length) {
      console.log(`⚠️ Note: Only processed ${actorsProcessed} out of ${actorsToUpdate.length} actors without DOB to avoid timeouts.`);
      console.log("Run this script multiple times to process more actors.");
    }
  } catch (error) {
    console.error("Error updating actor DOBs:", error);
  }
}

// Run the update process
updateActorDOBs().catch(error => {
  console.error("Fatal error:", error);
  process.exit(1);
});