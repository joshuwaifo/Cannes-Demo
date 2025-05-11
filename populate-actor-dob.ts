// populate-actor-dob.ts
import { db } from "./db";
import { actors } from "./shared/schema";
import { eq } from "drizzle-orm";

// Expanded dataset of actor DOBs
// This data is compiled from public knowledge about celebrities
const actorDOBs: Record<string, string> = {
  // A
  "Aamir Khan": "1965-03-14",
  "Aaron Paul": "1979-08-27",
  "Adam Driver": "1983-11-19",
  "Adam Sandler": "1966-09-09",
  "Al Pacino": "1940-04-25",
  "Alan Rickman": "1946-02-21",
  "Amy Adams": "1974-08-20",
  "Andrew Garfield": "1983-08-20",
  "Angelina Jolie": "1975-06-04",
  "Anne Hathaway": "1982-11-12",
  "Anthony Hopkins": "1937-12-31",
  "Audrey Hepburn": "1929-05-04",
  
  // B
  "Benedict Cumberbatch": "1976-07-19",
  "Ben Affleck": "1972-08-15",
  "Benicio Del Toro": "1967-02-19",
  "Bill Murray": "1950-09-21",
  "Brad Pitt": "1963-12-18",
  "Bruce Willis": "1955-03-19",
  
  // C
  "Cameron Diaz": "1972-08-30",
  "Cate Blanchett": "1969-05-14",
  "Charlize Theron": "1975-08-07",
  "Chris Evans": "1981-06-13",
  "Chris Hemsworth": "1983-08-11",
  "Chris Pratt": "1979-06-21",
  "Christian Bale": "1974-01-30",
  "Clint Eastwood": "1930-05-31",
  "Chadwick Boseman": "1976-11-29",
  
  // D
  "Dakota Johnson": "1989-10-04",
  "Daniel Craig": "1968-03-02",
  "Daniel Day-Lewis": "1957-04-29",
  "Daniel Radcliffe": "1989-07-23",
  "Denzel Washington": "1954-12-28",
  "Diane Keaton": "1946-01-05",
  "Dwayne Johnson": "1972-05-02",
  
  // E
  "Eddie Murphy": "1961-04-03",
  "Edward Norton": "1969-08-18",
  "Elizabeth Taylor": "1932-02-27",
  "Emma Stone": "1988-11-06",
  "Emma Watson": "1990-04-15",
  "Ethan Hawke": "1970-11-06",
  
  // F
  "Forest Whitaker": "1961-07-15",
  "Frances McDormand": "1957-06-23",
  
  // G
  "Gary Oldman": "1958-03-21",
  "George Clooney": "1961-05-06",
  "Glenn Close": "1947-03-19",
  
  // H
  "Halle Berry": "1966-08-14",
  "Harrison Ford": "1942-07-13",
  "Heath Ledger": "1979-04-04",
  "Helena Bonham Carter": "1966-05-26",
  "Henry Cavill": "1983-05-05",
  "Hugh Jackman": "1968-10-12",
  
  // I
  "Ian McKellen": "1939-05-25",
  "Idris Elba": "1972-09-06",
  
  // J
  "Jack Nicholson": "1937-04-22",
  "Jake Gyllenhaal": "1980-12-19",
  "James McAvoy": "1979-04-21",
  "Jamie Foxx": "1967-12-13",
  "Javier Bardem": "1969-03-01",
  "Jeff Bridges": "1949-12-04",
  "Jennifer Aniston": "1969-02-11",
  "Jennifer Lawrence": "1990-08-15",
  "Jennifer Lopez": "1969-07-24",
  "Jessica Chastain": "1977-03-24",
  "Joaquin Phoenix": "1974-10-28",
  "John Travolta": "1954-02-18",
  "Johnny Depp": "1963-06-09",
  "Judi Dench": "1934-12-09",
  "Julia Roberts": "1967-10-28",
  
  // K
  "Kate Winslet": "1975-10-05",
  "Keanu Reeves": "1964-09-02",
  "Kevin Spacey": "1959-07-26",
  "Kristen Stewart": "1990-04-09",
  
  // L
  "Leonardo DiCaprio": "1974-11-11",
  "Liam Neeson": "1952-06-07",
  
  // M
  "Margot Robbie": "1990-07-02",
  "Mark Wahlberg": "1971-06-05",
  "Matt Damon": "1970-10-08",
  "Matthew McConaughey": "1969-11-04",
  "Mel Gibson": "1956-01-03",
  "Mila Kunis": "1983-08-14",
  "Morgan Freeman": "1937-06-01",
  "Meryl Streep": "1949-06-22",
  
  // N
  "Natalie Portman": "1981-06-09",
  "Nicole Kidman": "1967-06-20",
  
  // O
  "Orlando Bloom": "1977-01-13",
  "Owen Wilson": "1968-11-18",
  
  // P
  "Patrick Stewart": "1940-07-13",
  "Paul Newman": "1925-01-26",
  "Paul Rudd": "1969-04-06",
  "Penélope Cruz": "1974-04-28",
  
  // R
  "Rachel McAdams": "1978-11-17",
  "Ralph Fiennes": "1962-12-22",
  "Reese Witherspoon": "1976-03-22",
  "Robert De Niro": "1943-08-17",
  "Robert Downey Jr.": "1965-04-04",
  "Robin Williams": "1951-07-21",
  "Russell Crowe": "1964-04-07",
  "Ryan Gosling": "1980-11-12",
  "Ryan Reynolds": "1976-10-23",
  
  // S
  "Salma Hayek": "1966-09-02",
  "Samuel L. Jackson": "1948-12-21",
  "Sandra Bullock": "1964-07-26",
  "Scarlett Johansson": "1984-11-22",
  "Sean Connery": "1930-08-25",
  "Sigourney Weaver": "1949-10-08",
  "Sophie Turner": "1996-02-21",
  "Steve Carell": "1962-08-16",
  "Susan Sarandon": "1946-10-04",
  "Sylvester Stallone": "1946-07-06",
  
  // T
  "Tim Robbins": "1958-10-16",
  "Tom Cruise": "1962-07-03",
  "Tom Hanks": "1956-07-09",
  "Tom Hardy": "1977-09-15",
  "Tommy Lee Jones": "1946-09-15",
  
  // V
  "Viola Davis": "1965-08-11",
  "Vin Diesel": "1967-07-18",
  
  // W
  "Will Smith": "1968-09-25",
  
  // Z
  "Zoe Saldana": "1978-06-19"
};

// Function to normalize actor names for comparison
function normalizeActorName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove special characters
    .replace(/\s+/g, ' ')    // Replace multiple spaces with one
    .trim();
}

// Update actors with DOB information
async function populateActorDOBs() {
  try {
    console.log("Starting actor DOB population process...");
    
    // Get all actors without DOB
    const allActors = await db.select().from(actors);
    const actorsToUpdate = allActors.filter(actor => !actor.dateOfBirth);
    
    console.log(`Found ${actorsToUpdate.length} actors without DOB information.`);
    
    // Create a normalized map for easier matching
    const normalizedActorDOBs: Record<string, string> = {};
    for (const [name, dob] of Object.entries(actorDOBs)) {
      normalizedActorDOBs[normalizeActorName(name)] = dob;
    }
    
    let updatedCount = 0;
    let processedCount = 0;
    
    // Update actors in batches
    for (const actor of actorsToUpdate) {
      processedCount++;
      
      // Try direct match first
      let dob = actorDOBs[actor.name];
      
      // If no direct match, try normalized match
      if (!dob) {
        const normalizedName = normalizeActorName(actor.name);
        dob = normalizedActorDOBs[normalizedName];
      }
      
      if (dob) {
        await db.update(actors)
          .set({ dateOfBirth: dob })
          .where(eq(actors.id, actor.id));
        
        console.log(`✅ Updated DOB for ${actor.name}: ${dob}`);
        updatedCount++;
      } else {
        console.log(`❌ No DOB found for ${actor.name}`);
      }
      
      // Log progress every 50 actors
      if (processedCount % 50 === 0) {
        console.log(`Progress: ${processedCount}/${actorsToUpdate.length} (${Math.round(processedCount/actorsToUpdate.length*100)}%)`);
      }
    }
    
    console.log(`✨ DOB population completed. Updated ${updatedCount}/${actorsToUpdate.length} actors with DOB information.`);
  } catch (error) {
    console.error("Error populating actor DOBs:", error);
  }
}

// Run the population process
populateActorDOBs().catch(error => {
  console.error("Fatal error:", error);
  process.exit(1);
});