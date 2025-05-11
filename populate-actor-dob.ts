
import { GoogleGenAI } from '@google/genai';
import { db } from "./db";
import { actors } from "./shared/schema";
import { eq } from "drizzle-orm";

async function getDOBFromGemini(name: string): Promise<string> {
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });
  
  const tools = [{ googleSearch: {} }];
  const config = {
    tools,
    responseMimeType: 'text/plain',
  };
  const model = 'gemini-2.5-pro-preview-05-06';
  const contents = [
    {
      role: 'user',
      parts: [{
        text: `I only want the date of birth in YYYY-MM-DD for: ${name}

For example:
Given the question: I only want the date of birth in YYYY-MM-DD for: Abbie Cornish
Answer: 1982-08-07`
      }]
    }
  ];

  try {
    const response = await ai.models.generateContentStream({
      model,
      config,
      contents,
    });

    let result = '';
    for await (const chunk of response) {
      result += chunk.text;
    }

    // Basic validation of date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (dateRegex.test(result.trim())) {
      return result.trim();
    }
    throw new Error(`Invalid date format received for ${name}: ${result}`);
  } catch (error) {
    console.error(`Error getting DOB for ${name}:`, error);
    return '';
  }
}

async function populateActorDOB() {
  try {
    console.log("Starting to populate actor DOB...");
    
    // Get all actors without DOB
    const allActors = await db.select().from(actors);
    
    for (const actor of allActors) {
      if (!actor.dateOfBirth) {
        console.log(`Getting DOB for ${actor.name}...`);
        const dob = await getDOBFromGemini(actor.name);
        
        if (dob) {
          await db.update(actors)
            .set({ 
              dateOfBirth: dob,
              updatedAt: new Date()
            })
            .where(eq(actors.id, actor.id));
          console.log(`Updated DOB for ${actor.name} to ${dob}`);
        } else {
          console.log(`Could not find DOB for ${actor.name}`);
        }
        
        // Add a small delay to avoid hitting rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log("Finished populating actor DOB");
  } catch (error) {
    console.error("Error in populateActorDOB:", error);
  }
}

// Run the population
if (!process.env.GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY environment variable is not set");
  process.exit(1);
}

populateActorDOB().then(() => {
  console.log("Script completed");
  process.exit(0);
}).catch(error => {
  console.error("Script failed:", error);
  process.exit(1);
});
