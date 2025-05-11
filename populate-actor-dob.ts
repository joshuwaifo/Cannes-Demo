import { db } from "./db";
import { actors } from "./shared/schema";
import { eq } from "drizzle-orm";

// Known actor birth dates
const actorDOBs: Record<string, string> = {
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
  "Aamir Khan": "1965-03-14",
  "Will Smith": "1968-09-25",
  "Brad Pitt": "1963-12-18",
  "Jennifer Lawrence": "1990-08-15",
  "Robert Downey Jr.": "1965-04-04",
  "Scarlett Johansson": "1984-11-22",
  "Christian Bale": "1974-01-30",
  "Nicole Kidman": "1967-06-20",
  "Johnny Depp": "1963-06-09",
  "Angelina Jolie": "1975-06-04"
};

async function populateActorDOB() {
  try {
    console.log("Starting to populate actor DOB...");

    // Get all actors
    const allActors = await db.select().from(actors);

    for (const actor of allActors) {
      if (!actor.dateOfBirth && actorDOBs[actor.name]) {
        console.log(`Setting DOB for ${actor.name} to ${actorDOBs[actor.name]}`);

        await db.update(actors)
          .set({ 
            dateOfBirth: actorDOBs[actor.name],
            updatedAt: new Date()
          })
          .where(eq(actors.id, actor.id));
      }
    }

    console.log("Finished populating actor DOB");
  } catch (error) {
    console.error("Error in populateActorDOB:", error);
  }
}

// Run the population
populateActorDOB().then(() => {
  console.log("Script completed");
  process.exit(0);
}).catch(error => {
  console.error("Script failed:", error);
  process.exit(1);
});