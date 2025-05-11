import dotenv from 'dotenv';
import { db } from './db';
import { actors } from './shared/schema';
import { eq } from 'drizzle-orm';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

// Initialize Google Generative AI
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');
const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

interface ActorWithoutBirthdate {
  id: number;
  name: string;
}

async function getActorsWithoutBirthdate(): Promise<ActorWithoutBirthdate[]> {
  const result = await db.select({ id: actors.id, name: actors.name })
    .from(actors)
    .where(
      eq(actors.dateOfBirth, '')
      .or(
        eq(actors.dateOfBirth, null as any)
      )
    );
  
  return result;
}

async function getBirthdateFromAI(actorName: string): Promise<string | null> {
  try {
    const prompt = `Please provide the date of birth for actor ${actorName} in YYYY-MM-DD format. Return only the date in that exact format.`;
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text().trim();
    
    // Validate the response format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (dateRegex.test(text)) {
      return text;
    } else {
      // Try to extract a date from the response
      const dateMatch = text.match(/\d{4}-\d{2}-\d{2}/);
      if (dateMatch) {
        return dateMatch[0];
      }
      console.log(`Invalid date format received for ${actorName}: ${text}`);
      return null;
    }
  } catch (error) {
    console.error(`Error getting birthdate for ${actorName}:`, error);
    return null;
  }
}

async function updateActorBirthdate(id: number, dateOfBirth: string): Promise<void> {
  try {
    await db.update(actors)
      .set({ dateOfBirth, updatedAt: new Date() })
      .where(eq(actors.id, id));
    
    console.log(`Updated birthdate for actor ID ${id} to ${dateOfBirth}`);
  } catch (error) {
    console.error(`Error updating birthdate for actor ID ${id}:`, error);
  }
}

async function run() {
  try {
    console.log("Starting update of actor birthdates...");
    
    // Get actors without birthdates
    const actorsWithoutBirthdate = await getActorsWithoutBirthdate();
    console.log(`Found ${actorsWithoutBirthdate.length} actors without birthdates.`);
    
    // Process in batches to avoid rate limiting
    const batchSize = 5;
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    
    for (let i = 0; i < actorsWithoutBirthdate.length; i += batchSize) {
      const batch = actorsWithoutBirthdate.slice(i, i + batchSize);
      console.log(`Processing batch ${i/batchSize + 1} of ${Math.ceil(actorsWithoutBirthdate.length/batchSize)}`);
      
      const promises = batch.map(async (actor) => {
        console.log(`Getting birthdate for ${actor.name}...`);
        const birthdate = await getBirthdateFromAI(actor.name);
        
        if (birthdate) {
          await updateActorBirthdate(actor.id, birthdate);
          return { name: actor.name, success: true, birthdate };
        } else {
          return { name: actor.name, success: false };
        }
      });
      
      const results = await Promise.all(promises);
      
      // Log results
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      console.log(`Batch results: ${successful} successful, ${failed} failed.`);
      
      // Add a delay between batches to avoid rate limiting
      if (i + batchSize < actorsWithoutBirthdate.length) {
        console.log("Waiting before processing next batch...");
        await delay(2000);
      }
    }
    
    console.log("Actor birthdate update completed.");
  } catch (error) {
    console.error("An error occurred:", error);
  } finally {
    process.exit(0);
  }
}

// Execute the script
run();