// populate-remaining-actors.ts
import { db } from "./db";
import { actors } from "./shared/schema";
import { eq } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Initialize the Google GenAI client
function initializeGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("CRITICAL: GEMINI_API_KEY environment variable is not set");
    throw new Error("GEMINI_API_KEY environment variable is not set");
  }
  
  return new GoogleGenAI({ apiKey });
}

// Get DOB for actor using the Gemini 2.5 Pro model with Google Search
async function getActorDOBWithSearch(actorName: string, retryCount = 0): Promise<string> {
  console.log(`Getting DOB for actor: ${actorName}`);
  
  // Max retries
  const MAX_RETRIES = 2;
  
  try {
    const ai = initializeGeminiClient();
    const config = {
      temperature: 0.1,
      maxOutputTokens: 1024,
      responseMimeType: 'text/plain',
    };
    const model = 'gemini-1.5-pro'; // Using the Gemini 1.5 Pro model which has better quota allowances
    
    // Create an enhanced prompt for the model
    const contents = [
      {
        role: 'user',
        parts: [
          {
            text: `You are a film database specialist with comprehensive knowledge of actors' birthdates.

I need ONLY the date of birth in YYYY-MM-DD format for the actor: ${actorName}

RULES:
1. Return ONLY the date in YYYY-MM-DD format, nothing else
2. If you're not absolutely certain, return nothing
3. For example, if I ask for Will Smith, you would simply return: 1968-09-25
4. Do not include any explanations, just the date

Remember, I need only the YYYY-MM-DD date and nothing else.`,
          },
        ],
      }
    ];

    // Make the API call with stream
    const response = await ai.models.generateContentStream({
      model,
      config,
      contents,
    });
    
    let fullResponse = '';
    for await (const chunk of response) {
      fullResponse += chunk.text || '';
    }
    
    // Extract the DOB from the response (should be just YYYY-MM-DD)
    // Clean up the response to handle potential explanations
    const lines = fullResponse.split('\n');
    for (const line of lines) {
      // Find a line that looks like a date in YYYY-MM-DD format
      const dateMatch = line.match(/(\d{4}-\d{2}-\d{2})/);
      if (dateMatch) {
        return dateMatch[1];
      }
    }
    
    // If no match was found but we have a response, try to extract it
    if (fullResponse.trim().length > 0) {
      // Attempt to clean the response and find a date pattern
      const datePattern = /\b(\d{4}-\d{2}-\d{2})\b/;
      const match = fullResponse.match(datePattern);
      if (match) {
        return match[1];
      }
      
      // If it looks like a valid date but might have different separators
      const altDatePattern = /\b(\d{4})[\/\.](\d{1,2})[\/\.](\d{1,2})\b/;
      const altMatch = fullResponse.match(altDatePattern);
      if (altMatch) {
        const year = altMatch[1];
        // Ensure month and day are two digits
        const month = altMatch[2].padStart(2, '0');
        const day = altMatch[3].padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    }

    // If we couldn't find a valid date format and haven't reached max retries, try again
    if (retryCount < MAX_RETRIES) {
      console.log(`No valid date format found, retrying (${retryCount + 1}/${MAX_RETRIES}) for ${actorName}...`);
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 2000));
      return getActorDOBWithSearch(actorName, retryCount + 1);
    }
    
    console.error(`No valid date found in response for ${actorName}:`, fullResponse);
    return "";
  } catch (error) {
    console.error(`Error getting DOB for ${actorName}:`, error);
    
    // If we haven't reached max retries, try again
    if (retryCount < MAX_RETRIES) {
      console.log(`Retrying (${retryCount + 1}/${MAX_RETRIES}) for ${actorName}...`);
      // Longer wait for network errors
      await new Promise(resolve => setTimeout(resolve, 3000));
      return getActorDOBWithSearch(actorName, retryCount + 1);
    }
    
    return "";
  }
}

// Update actors with DOB information
async function populateRemainingActorDOBs() {
  try {
    console.log("Starting actor DOB population process for remaining actors...");
    
    // Get all actors without DOB
    const allActors = await db.select().from(actors);
    const actorsToUpdate = allActors.filter(actor => !actor.dateOfBirth);
    
    console.log(`Found ${actorsToUpdate.length} actors without DOB information.`);
    
    // If no actors to update, exit
    if (actorsToUpdate.length === 0) {
      console.log("✨ No actors need updating. All actors have DOB information.");
      return;
    }
    
    // Process in batches to avoid API rate limits and timeout issues
    const BATCH_SIZE = 5;
    const batches = Math.ceil(actorsToUpdate.length / BATCH_SIZE);
    
    // If there are too many actors, just process a limited number in this run
    const MAX_BATCHES_TO_PROCESS = 3; // Adjust as needed based on time constraints
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
        const dob = await getActorDOBWithSearch(actor.name);
        
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
        await new Promise(resolve => setTimeout(resolve, 2000));
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
      console.log(`Remaining actors without DOB: ${actorsToUpdate.length - actorsProcessed}`);
    }
  } catch (error) {
    console.error("Error updating actor DOBs:", error);
  }
}

// Run the update process
populateRemainingActorDOBs().catch(error => {
  console.error("Fatal error:", error);
  process.exit(1);
});