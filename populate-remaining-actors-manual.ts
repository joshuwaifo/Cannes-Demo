// populate-remaining-actors-manual.ts
import { db } from "./db";
import { actors } from "./shared/schema";
import { eq } from "drizzle-orm";

// Additional manually collected actors with DOB
// This is a dataset that can be expanded over time
const additionalActorDOBs: Record<string, string> = {
  // A
  "Alexander Skarsgård": "1976-08-25",
  "Amanda Seyfried": "1985-12-03",
  "Antonio Banderas": "1960-08-10",
  "Aubrey Plaza": "1984-06-26",
  
  // B
  "Bette Davis": "1908-04-05",
  "Bill Murray": "1950-09-21",
  "Bill Nighy": "1949-12-12",
  "Bill Skarsgård": "1990-08-09",
  "Billy Crystal": "1948-03-14",
  "Billy Dee Williams": "1937-04-06",
  "Brendan Gleeson": "1955-03-29",
  "Brian Cox": "1946-06-01",
  
  // C
  "Carice van Houten": "1976-09-05",
  "Cary Grant": "1904-01-18",
  "Cate Blanchett": "1969-05-14",
  "Catherine O'Hara": "1954-03-04",
  "Charlie Chaplin": "1889-04-16",
  "Chow Yun-fat": "1955-05-18",
  "Clarke Peters": "1952-04-07",
  "Colin Farrell": "1976-05-31",
  "Colin Firth": "1960-09-10",
  
  // D
  "Daniel Brühl": "1978-06-16",
  "Daniel Radcliffe": "1989-07-23",
  "David Harbour": "1975-04-10",
  "Deborah Kerr": "1921-09-30",
  "Diane Kruger": "1976-07-15",
  "Diego Luna": "1979-12-29",
  "Domhnall Gleeson": "1983-05-12",
  "Donald Sutherland": "1935-07-17",
  
  // E
  "Eddie Redmayne": "1982-01-06",
  "Emily Blunt": "1983-02-23",
  "Emma Thompson": "1959-04-15",
  "Ethan Hawke": "1970-11-06",
  "Eva Green": "1980-07-06",
  "Evangeline Lilly": "1979-08-03",
  
  // F
  "Famke Janssen": "1964-11-05",
  "Florence Pugh": "1996-01-03",
  "Franka Potente": "1974-07-22",
  "Fred Astaire": "1899-05-10",
  
  // G
  "Gal Gadot": "1985-04-30",
  "Gary Oldman": "1958-03-21",
  "Gemma Arterton": "1986-02-02",
  "Gene Kelly": "1912-08-23",
  "George Sanders": "1906-07-03",
  "Ginger Rogers": "1911-07-16",
  "Glenn Close": "1947-03-19",
  "Gong Li": "1965-12-31",
  "Gustaf Skarsgård": "1980-11-12",
  
  // H
  "Hamish Linklater": "1976-07-07",
  "Helen Mirren": "1945-07-26",
  "Humphrey Bogart": "1899-12-25",
  
  // I
  "Ian Holm": "1931-09-12",
  "Imelda Staunton": "1956-01-09",
  "Ingrid Bergman": "1915-08-29",
  
  // J
  "James Earl Jones": "1931-01-17",
  "James Stewart": "1908-05-20",
  "Jared Harris": "1961-08-24",
  "Jason Isaacs": "1963-06-06",
  "Jean Arthur": "1900-10-17",
  "Jean Dujardin": "1972-06-19",
  "John Cho": "1972-06-16",
  "John Malkovich": "1953-12-09",
  "Judy Garland": "1922-06-10",
  
  // K
  "Kate Siegel": "1982-08-09",
  "Kate Winslet": "1975-10-05",
  "Katharine Hepburn": "1907-05-12",
  "Kirk Douglas": "1916-12-09",
  "Kristen Stewart": "1990-04-09",
  "Kristin Scott Thomas": "1960-05-24",
  "Kurt Russell": "1951-03-17",
  
  // L
  "Laurence Fishburne": "1961-07-30",
  "Léa Seydoux": "1985-07-01",
  "Leonardo DiCaprio": "1974-11-11",
  "Liam Cunningham": "1961-06-02",
  "Liv Tyler": "1977-07-01",
  "Lupita Nyong'o": "1983-03-01",
  
  // M
  "Mads Mikkelsen": "1965-11-22",
  "Maggie Smith": "1934-12-28",
  "Marlon Brando": "1924-04-03",
  "Martin Freeman": "1971-09-08",
  "Max von Sydow": "1929-04-10",
  "Mia Farrow": "1945-02-09",
  "Michael Fassbender": "1977-04-02",
  "Michelle Pfeiffer": "1958-04-29",
  "Miles Teller": "1987-02-20",
  "Myrna Loy": "1905-08-02",
  
  // N
  "Naomi Watts": "1968-09-28",
  "Natalie Wood": "1938-07-20",
  "Nicholas Hoult": "1989-12-07",
  
  // O
  "Olivia Coleman": "1974-01-30",
  "Olivia de Havilland": "1916-07-01",
  "Omar Sharif": "1932-04-10",
  "Orson Welles": "1915-05-06",
  
  // P
  "Patrick Wilson": "1973-07-03",
  "Paul Dano": "1984-06-19",
  "Pedro Pascal": "1975-04-02",
  "Peter Dinklage": "1969-06-11",
  "Peter Lorre": "1904-06-26",
  "Peter O'Toole": "1932-08-02",
  "Pierce Brosnan": "1953-05-16",
  
  // R
  "Rachel Weisz": "1970-03-07",
  "Rebecca Hall": "1982-05-03",
  "Ricardo Darín": "1957-01-16",
  "Richard Burton": "1925-11-10",
  "Rita Hayworth": "1918-10-17",
  "Robert Redford": "1936-08-18",
  "Ruth Gordon": "1896-10-30",
  
  // S
  "Saoirse Ronan": "1994-04-12",
  "Sean Bean": "1959-04-17",
  "Simone Signoret": "1921-03-25",
  "Sophia Loren": "1934-09-20",
  "Spencer Tracy": "1900-04-05",
  "Stanley Tucci": "1960-11-11",
  "Stellan Skarsgård": "1951-06-13",
  
  // T
  "Tessa Thompson": "1983-10-03",
  "Tilda Swinton": "1960-11-05",
  "Timothée Chalamet": "1995-12-27",
  "Tom Courtenay": "1937-02-25",
  "Tom Hardy": "1977-09-15",
  "Tommy Lee Jones": "1946-09-15",
  "Tony Curtis": "1925-06-03",
  
  // V
  "Vanessa Redgrave": "1937-01-30",
  "Viggo Mortensen": "1958-10-20",
  "Vincent Cassel": "1966-11-23",
  "Vincent Price": "1911-05-27",
  "Vivien Leigh": "1913-11-05",
  
  // W
  "Wendy Hiller": "1912-08-15",
  "William Holden": "1918-04-17",
  
  // Z
  "Zachary Quinto": "1977-06-02",
  "Zendaya": "1996-09-01"
};

// Update actors with DOB information
async function populateRemainingActorDOBsManual() {
  try {
    console.log("Starting actor DOB manual population process...");
    
    // Get all actors without DOB
    const allActors = await db.select().from(actors);
    const actorsToUpdate = allActors.filter(actor => !actor.dateOfBirth);
    
    console.log(`Found ${actorsToUpdate.length} actors without DOB information.`);
    
    // Function to normalize actor names for comparison
    function normalizeActorName(name: string): string {
      return name
        .toLowerCase()
        .replace(/[^\w\s]/g, '') // Remove special characters
        .replace(/\s+/g, ' ')    // Replace multiple spaces with one
        .trim();
    }
    
    // Create a normalized map for easier matching
    const normalizedActorDOBs: Record<string, string> = {};
    for (const [name, dob] of Object.entries(additionalActorDOBs)) {
      normalizedActorDOBs[normalizeActorName(name)] = dob;
    }
    
    let updatedCount = 0;
    
    // Update actors with DOB information
    for (const actor of actorsToUpdate) {
      // Try direct match first
      let dob = additionalActorDOBs[actor.name];
      
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
        // Skip verbose logs for actors not found
        // console.log(`❌ No DOB found for ${actor.name}`);
      }
    }
    
    console.log(`✨ DOB update process completed. Updated ${updatedCount}/${actorsToUpdate.length} actors with DOB information.`);
    
    if (updatedCount < actorsToUpdate.length) {
      console.log(`⚠️ Note: ${actorsToUpdate.length - updatedCount} actors still need DOB information.`);
      console.log("To add more actors, expand the additionalActorDOBs object in this script.");
    }
  } catch (error) {
    console.error("Error updating actor DOBs:", error);
  }
}

// Run the update process
populateRemainingActorDOBsManual().catch(error => {
  console.error("Fatal error:", error);
  process.exit(1);
});