import { pool } from "./db/index.js";
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Function to process all actors in one go with COPY FROM
async function refreshActors() {
  const client = await pool.connect();

  try {
    console.log("Starting actor database refresh...");
    
    // Step 1: Clear existing actors
    console.log("Clearing existing actors...");
    await client.query('DELETE FROM actors');
    console.log("All existing actors deleted successfully.");
    
    // Step 2: Read the actor database file
    console.log("Reading actor database file...");
    const actorFilePath = path.join(__dirname, 'attached_assets', 'actorDatabase.txt');
    const actorFileContent = fs.readFileSync(actorFilePath, 'utf8');
    
    // Skip the header line and process each actor line
    const actorLines = actorFileContent.split('\n').filter(line => line.trim().length > 0);
    const header = actorLines[0]; // Skip header
    
    // Prepare values for bulk insert
    const valuesList = [];
    const valueParams = [];
    let paramCount = 1;
    
    console.log(`Processing ${actorLines.length - 1} actors...`);
    
    // Process each actor (starting from index 1 to skip header)
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
        const notableRoles = JSON.stringify(notableRolesText.split(',').map(role => role.trim()));
        
        // Split genres by comma
        const genres = JSON.stringify(parts[4].split(',').map(genre => genre.trim()));
        
        const recentPopularity = parts[5];
        
        // Split typical roles by comma
        const typicalRolesText = parts[6];
        const typicalRoles = JSON.stringify(typicalRolesText.split(',').map(role => role.trim()));
        
        const estSalaryRange = parts[7];
        const socialMediaFollowing = parts[8];
        const availability = parts[9];
        const bestSuitedRolesStrategic = parts[10];

        const now = new Date().toISOString();
        
        // Add values for this actor
        valuesList.push(`($${paramCount++}, $${paramCount++}, $${paramCount++}, $${paramCount++}, $${paramCount++}, $${paramCount++}, $${paramCount++}, $${paramCount++}, $${paramCount++}, $${paramCount++}, $${paramCount++}, $${paramCount++}, $${paramCount++})`);
        
        valueParams.push(
          name, gender, nationality, notableRoles, genres, 
          recentPopularity, typicalRoles, estSalaryRange, 
          socialMediaFollowing, availability, bestSuitedRolesStrategic, 
          now, now
        );
        
        // Log progress
        if (i % 100 === 0 || i === actorLines.length - 1) {
          console.log(`Processed ${i} of ${actorLines.length - 1} actors...`);
        }
      }
    }
    
    // Bulk insert all actors at once
    console.log("Inserting all actors into database...");
    const valuesString = valuesList.join(", ");
    
    const insertQuery = `
      INSERT INTO actors(
        name, gender, nationality, notable_roles, genres, 
        recent_popularity, typical_roles, est_salary_range, 
        social_media_following, availability, best_suited_roles_strategic, 
        created_at, updated_at
      ) VALUES ${valuesString}
    `;
    
    await client.query(insertQuery, valueParams);
    
    // Get final count
    const countResult = await client.query('SELECT COUNT(*) FROM actors');
    const count = parseInt(countResult.rows[0].count);
    
    console.log(`Successfully refreshed actor database with ${count} actors.`);
  } catch (error) {
    console.error("Error refreshing actors:", error);
  } finally {
    // Release client
    client.release();
  }
}

// Run the refresh
refreshActors().catch(error => {
  console.error("Fatal error:", error);
  process.exit(1);
});