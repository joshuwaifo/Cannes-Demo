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
  "Adrien Brody": "1973-04-14",
  "Aishwarya Rai Bachchan": "1973-11-01",
  "Al Pacino": "1940-04-25",
  "Alan Rickman": "1946-02-21",
  "Amitabh Bachchan": "1942-10-11",
  "Amy Adams": "1974-08-20",
  "Andrew Garfield": "1983-08-20",
  "Andy Garcia": "1956-04-12",
  "Angela Bassett": "1958-08-16",
  "Angelina Jolie": "1975-06-04",
  "Ann-Margret": "1941-04-28",
  "Anne Hathaway": "1982-11-12",
  "Annette Bening": "1958-05-29",
  "Anthony Hopkins": "1937-12-31",
  "Audrey Hepburn": "1929-05-04",
  "Awkwafina": "1988-06-02",
  
  // B
  "Barbra Streisand": "1942-04-24",
  "Ben Affleck": "1972-08-15",
  "Ben Mendelsohn": "1969-04-03",
  "Ben Stiller": "1965-11-30",
  "Benedict Cumberbatch": "1976-07-19",
  "Benicio Del Toro": "1967-02-19",
  "Bill Murray": "1950-09-21",
  "Brad Pitt": "1963-12-18",
  "Brie Larson": "1989-10-01",
  "Bruce Willis": "1955-03-19",
  
  // C
  "Cameron Diaz": "1972-08-30",
  "Carey Mulligan": "1985-05-28",
  "Cary-Hiroyuki Tagawa": "1950-09-27",
  "Cate Blanchett": "1969-05-14",
  "Catherine Deneuve": "1943-10-22",
  "Chadwick Boseman": "1976-11-29",
  "Charlize Theron": "1975-08-07",
  "Chevy Chase": "1943-10-08",
  "Chiwetel Ejiofor": "1977-07-10",
  "Choi Min-sik": "1962-04-30",
  "Chow Yun-fat": "1955-05-18",
  "Christina Hendricks": "1975-05-03",
  "Christoph Waltz": "1956-10-04",
  "Christopher Walken": "1943-03-31",
  "Claire Danes": "1979-04-12",
  "Claudia Cardinale": "1938-04-15",
  "Clint Eastwood": "1930-05-31",
  "Colin Farrell": "1976-05-31",
  "Colin Firth": "1960-09-10",
  "Chris Evans": "1981-06-13",
  "Chris Hemsworth": "1983-08-11",
  "Chris Pratt": "1979-06-21",
  "Christian Bale": "1974-01-30",
  
  // D
  "Dakota Johnson": "1989-10-04",
  "Daniel Craig": "1968-03-02",
  "Daniel Dae Kim": "1968-08-04",
  "Daniel Day-Lewis": "1957-04-29",
  "Daniel Radcliffe": "1989-07-23",
  "Denzel Washington": "1954-12-28",
  "Dennis Quaid": "1954-04-09",
  "Diane Keaton": "1946-01-05",
  "Dwayne Johnson": "1972-05-02",
  
  // E
  "Eddie Murphy": "1961-04-03",
  "Edie Falco": "1963-07-05",
  "Edward Norton": "1969-08-18",
  "Elizabeth Taylor": "1932-02-27",
  "Emma Stone": "1988-11-06",
  "Emma Watson": "1990-04-15",
  "Eric Bana": "1968-08-09",
  "Ethan Hawke": "1970-11-06",
  
  // F
  "Forest Whitaker": "1961-07-15",
  "Frances McDormand": "1957-06-23",
  
  // G
  "Gabriel Byrne": "1950-05-12",
  "Gary Oldman": "1958-03-21",
  "Geoffrey Rush": "1951-07-06",
  "George Clooney": "1961-05-06",
  "Giancarlo Giannini": "1942-08-01",
  "Gillian Jacobs": "1982-10-19",
  "Glenn Close": "1947-03-19",
  "Gong Li": "1965-12-31",
  "Guy Pearce": "1967-10-05",
  
  // H
  "Halle Berry": "1966-08-14",
  "Harrison Ford": "1942-07-13",
  "Heath Ledger": "1979-04-04",
  "Helen Mirren": "1945-07-26",
  "Helena Bonham Carter": "1966-05-26",
  "Henry Cavill": "1983-05-05",
  "Hugh Grant": "1960-09-09",
  "Hugh Jackman": "1968-10-12",
  
  // I
  "Ian McKellen": "1939-05-25",
  "Idina Menzel": "1971-05-30",
  "Idris Elba": "1972-09-06",
  "Isabelle Huppert": "1953-03-16",
  
  // J
  "Jack Black": "1969-08-28",
  "Jack Nicholson": "1937-04-22",
  "Jacqueline Bisset": "1944-09-13",
  "Jake Gyllenhaal": "1980-12-19",
  "James Hong": "1929-02-22",
  "James McAvoy": "1979-04-21",
  "Jamie Foxx": "1967-12-13",
  "Jason Bateman": "1969-01-14",
  "Javier Bardem": "1969-03-01",
  "Jean Reno": "1948-07-30",
  "Jeff Bridges": "1949-12-04",
  "Jennifer Aniston": "1969-02-11",
  "Jennifer Lawrence": "1990-08-15",
  "Jennifer Lopez": "1969-07-24",
  "Jessica Chastain": "1977-03-24",
  "Jessica Lange": "1949-04-20",
  "Joaquin Phoenix": "1974-10-28",
  "Jodie Foster": "1962-11-19",
  "John C. Reilly": "1965-05-24",
  "John Goodman": "1952-06-20",
  "John Travolta": "1954-02-18",
  "Jon Hamm": "1971-03-10",
  "Jonah Hill": "1983-12-20",
  "Johnny Depp": "1963-06-09",
  "Judi Dench": "1934-12-09",
  "Judy Davis": "1955-04-23",
  "Julia Roberts": "1967-10-28",
  "Julie Andrews": "1935-10-01",
  "Juliette Binoche": "1964-03-09",
  "Juliette Lewis": "1973-06-21",
  
  // K
  "Kate Winslet": "1975-10-05",
  "Keanu Reeves": "1964-09-02",
  "Keisha Castle-Hughes": "1990-03-24",
  "Ken Watanabe": "1959-10-21",
  "Kevin Spacey": "1959-07-26",
  "Kiefer Sutherland": "1966-12-21",
  "Kristen Bell": "1980-07-18",
  "Kristen Scott Thomas": "1960-05-24",
  "Kristen Stewart": "1990-04-09",
  
  // L
  "Leonardo DiCaprio": "1974-11-11",
  "Liam Neeson": "1952-06-07",
  "Lucy Liu": "1968-12-02",
  
  // M
  "Mahershala Ali": "1974-02-16",
  "Mandy Patinkin": "1952-11-30",
  "Margot Robbie": "1990-07-02",
  "Mark Wahlberg": "1971-06-05",
  "Matt Damon": "1970-10-08",
  "Matthew McConaughey": "1969-11-04",
  "Mel Gibson": "1956-01-03",
  "Michael B. Jordan": "1987-02-09",
  "Michael Cera": "1988-06-07",
  "Michael Imperioli": "1966-03-26",
  "Michael Madsen": "1957-09-25",
  "Michelle Rodriguez": "1978-07-12",
  "Mila Kunis": "1983-08-14",
  "Monica Bellucci": "1964-09-30",
  "Morgan Freeman": "1937-06-01",
  "Moritz Bleibtreu": "1971-08-13",
  "Meryl Streep": "1949-06-22",
  
  // N
  "Naomi Watts": "1968-09-28",
  "Naseeruddin Shah": "1950-07-20",
  "Natalie Portman": "1981-06-09",
  "Nicole Kidman": "1967-06-20",
  
  // O
  "Octavia Spencer": "1972-05-25",
  "Oprah Winfrey": "1954-01-29",
  "Orlando Bloom": "1977-01-13",
  "Owen Wilson": "1968-11-18",
  
  // P
  "Patrick Stewart": "1940-07-13",
  "Paul Bettany": "1971-05-27",
  "Paul Newman": "1925-01-26",
  "Paul Rudd": "1969-04-06",
  "Pedro Pascal": "1975-04-02",
  "Penélope Cruz": "1974-04-28",
  
  // R
  "Rachel McAdams": "1978-11-17",
  "Rachel Weisz": "1970-03-07",
  "Ralph Fiennes": "1962-12-22",
  "Rashida Jones": "1976-02-25",
  "Reese Witherspoon": "1976-03-22",
  "Robert De Niro": "1943-08-17",
  "Robert Downey Jr.": "1965-04-04",
  "Robert Patrick": "1958-11-05",
  "Robin Williams": "1951-07-21",
  "Rosamund Pike": "1979-01-27",
  "Rupert Grint": "1988-08-24",
  "Russell Crowe": "1964-04-07",
  "Ryan Gosling": "1980-11-12",
  "Ryan Reynolds": "1976-10-23",
  
  // S
  "Salma Hayek": "1966-09-02",
  "Sam Neill": "1947-09-14",
  "Samuel L. Jackson": "1948-12-21",
  "Samuel West": "1966-06-19",
  "Sandra Bullock": "1964-07-26",
  "Scarlett Johansson": "1984-11-22",
  "Sean Connery": "1930-08-25",
  "Sebastian Koch": "1962-05-31",
  "Seth Rogen": "1982-04-15",
  "Shabana Azmi": "1950-09-18",
  "Shah Rukh Khan": "1965-11-02",
  "Sigourney Weaver": "1949-10-08",
  "Song Kang-ho": "1967-01-17",
  "Sophie Turner": "1996-02-21",
  "Sophia Loren": "1934-09-20",
  "Stephen Rea": "1946-10-31",
  "Sterling K. Brown": "1976-04-05",
  "Steve Buscemi": "1957-12-13",
  "Steve Carell": "1962-08-16",
  "Steve Martin": "1945-08-14",
  "Susan Sarandon": "1946-10-04",
  "Sylvester Stallone": "1946-07-06",
  
  // T
  "Takeshi Kitano": "1947-01-18",
  "Tiffany Haddish": "1979-12-03",
  "Til Schweiger": "1963-12-19",
  "Tilda Swinton": "1960-11-05",
  "Tim Robbins": "1958-10-16",
  "Tim Roth": "1961-05-14",
  "Tina Fey": "1970-05-18",
  "Tom Cruise": "1962-07-03",
  "Tom Hanks": "1956-07-09",
  "Tom Hardy": "1977-09-15",
  "Tom Hiddleston": "1981-02-09",
  "Tommy Lee Jones": "1946-09-15",
  "Toni Collette": "1972-11-01",
  "Toni Servillo": "1959-01-25",
  "Tony Leung Chiu-wai": "1962-06-27",
  
  // V
  "Viola Davis": "1965-08-11",
  "Vin Diesel": "1967-07-18",
  
  // W
  "Whoopi Goldberg": "1955-11-13",
  "Will Ferrell": "1967-07-16",
  "Will Smith": "1968-09-25",
  "William H. Macy": "1950-03-13",
  
  // Y
  "Youn Yuh-jung": "1947-06-19",
  
  // Z
  "Zhang Ziyi": "1979-02-09",
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