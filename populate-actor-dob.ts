` tags.

```typescript
<replit_final_file>
import { db } from "./db";
import { actors } from "./shared/schema";
import { eq } from "drizzle-orm";

// --- Constants ---
const actorDOBs = {
  "Tom Hanks": "1956-07-09",
  "Meryl Streep": "1949-06-22",
  "Leonardo DiCaprio": "1974-11-11",
  "Viola Davis": "1965-08-11",
  "Denzel Washington": "1954-12-28",
  "Emma Stone": "1988-11-06",
  "Ryan Gosling": "1980-11-12",
  "Cate Blanchett": "1969-05-14",
  "Morgan Freeman": "1937-06-01",
  "Joaquin Phoenix": "1974-10-28",
  "Brad Pitt": "1963-12-18",
  "Angelina Jolie": "1975-06-04",
  "Jennifer Lawrence": "1990-08-15",
  "Robert Downey Jr.": "1965-04-04",
  "Scarlett Johansson": "1984-11-22",
  "Dwayne Johnson": "1972-05-02",
  "Will Smith": "1968-09-25",
  "Samuel L. Jackson": "1948-12-21",
  "Julia Roberts": "1967-10-28",
  "George Clooney": "1961-05-06",
  "Nicole Kidman": "1967-06-20",
  "Chris Hemsworth": "1983-08-11",
  "Jennifer Aniston": "1969-02-11",
  "Johnny Depp": "1963-06-09",
  "Sandra Bullock": "1964-07-26",
  "Emma Watson": "1990-04-15",
  "Anthony Hopkins": "1937-12-31",
  "Charlize Theron": "1975-08-07",
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
  "Al Pacino": "1940-04-25"
};

// --- Utilities ---
function normalizeActorName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// --- Main Function ---
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

    // Update actors in sequence
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