import { db } from "./db";
import { actors } from "./shared/schema";
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function refreshActors() {
  try {
    console.log("Starting actor database refresh...");
    
    // Step 1: Clear existing actors
    console.log("Clearing existing actors...");
    await db.delete(actors);
    console.log("All existing actors deleted successfully.");
    
    // Step 2: Read the actor database file
    console.log("Reading actor database file...");
    const actorFilePath = path.join(__dirname, 'attached_assets', 'actorDatabase.txt');
    const actorFileContent = fs.readFileSync(actorFilePath, 'utf8');
    
    // Skip the header line and process each actor line
    const actorLines = actorFileContent.split('\n').filter(line => line.trim().length > 0);
    const header = actorLines[0]; // Skip header
    
    const actorsData = [];
    
    // Process each actor line starting from line 2 (index 1)
    console.log("Processing actor data...");
    for (let i = 1; i < actorLines.length; i++) {
      const line = actorLines[i];
      
      // Split by pipe character and trim spaces
      const parts = line.split('|').map(part => part.trim());
      
      if (parts.length >= 11) {
        const name = parts[0].replace(/\*\*/g, ''); // Remove ** from names
        const gender = parts[1];
        const nationality = parts[2];
        
        // Extract notable roles - remove * markers and split by comma
        const notableRolesText = parts[3].replace(/\*/g, '');
        const notableRoles = notableRolesText.split(',').map(role => role.trim());
        
        // Split genres by comma
        const genres = parts[4].split(',').map(genre => genre.trim());
        
        const recentPopularity = parts[5];
        
        // Split typical roles by comma
        const typicalRolesText = parts[6];
        const typicalRoles = typicalRolesText.split(',').map(role => role.trim());
        
        const estSalaryRange = parts[7];
        const socialMediaFollowing = parts[8];
        const availability = parts[9];
        const bestSuitedRolesStrategic = parts[10];
        
        actorsData.push({
          name,
          gender,
          nationality,
          notableRoles,
          genres,
          recentPopularity,
          typicalRoles,
          estSalaryRange,
          socialMediaFollowing,
          availability,
          bestSuitedRolesStrategic,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    }
    
    // Step 3: Insert the new actors in batches
    if (actorsData.length > 0) {
      console.log(`Inserting ${actorsData.length} actors into database...`);
      // Insert actors in batches to avoid very large queries
      const batchSize = 20;
      for (let i = 0; i < actorsData.length; i += batchSize) {
        const batch = actorsData.slice(i, i + batchSize);
        await db.insert(actors).values(batch);
        console.log(`Inserted batch ${Math.floor(i/batchSize) + 1} of ${Math.ceil(actorsData.length/batchSize)}`);
      }
      
      console.log(`Successfully refreshed actor database with ${actorsData.length} actors.`);
    } else {
      console.log("No actor data found to insert.");
    }
  } catch (error) {
    console.error("Error refreshing actors:", error);
  }
}

// Run the refresh
refreshActors().catch(error => {
  console.error("Fatal error:", error);
  process.exit(1);
});