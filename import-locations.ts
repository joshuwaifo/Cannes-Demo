import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './db';
import { locations } from './shared/schema';

// Handle ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function importLocations() {
  try {
    console.log('Starting location import...');
    
    // Read the file
    const filePath = path.join(__dirname, 'attached_assets', 'LocationsDatabase.txt');
    const fileContent = fs.readFileSync(filePath, 'utf8');
    
    // Split content into lines
    const lines = fileContent.split('\n');
    
    // Skip header and separator lines (first 2 lines)
    const dataLines = lines.slice(2);
    
    let importCount = 0;
    
    for (const line of dataLines) {
      // Skip empty lines
      if (!line.trim()) continue;
      
      // Parse line using regex to handle the | separators properly
      const columns = line.split('|').map(col => col.trim()).filter(Boolean);
      
      if (columns.length < 9) {
        console.log(`Skipping line with insufficient columns: ${line}`);
        continue;
      }
      
      // Extract data
      let country = columns[0].replace(/\*\*/g, '').trim();
      const region = columns[1].trim();
      const incentiveProgram = columns[2].trim();
      const incentiveDetails = columns[3].trim();
      const minimumSpend = columns[4].trim();
      const eligibleProductionTypes = columns[5].trim();
      const applicationProcess = columns[6] ? columns[6].trim() : '';
      const limitsCaps = ''; // Not directly available in the data
      const qualifyingExpenses = ''; // Not directly available in the data
      const applicationDeadlines = ''; // Not directly available in the data
      
      // Generate a placeholder image URL based on country
      const imageUrl = `https://source.unsplash.com/random/800x600/?${encodeURIComponent(country.toLowerCase())}`;
      
      // Insert into database
      await db.insert(locations).values({
        country,
        region,
        incentiveProgram,
        incentiveDetails,
        minimumSpend,
        eligibleProductionTypes,
        limitsCaps,
        qualifyingExpenses,
        applicationProcess,
        applicationDeadlines,
        imageUrl,
      });
      
      importCount++;
      console.log(`Imported: ${country} - ${region}`);
    }
    
    console.log(`Import complete. ${importCount} locations imported.`);
  } catch (error) {
    console.error('Error importing locations:', error);
  } finally {
    process.exit(0);
  }
}

importLocations();