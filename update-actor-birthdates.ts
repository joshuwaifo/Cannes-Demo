import dotenv from 'dotenv';
import { db } from './db';
import { actors } from './shared/schema';
import { eq, or, isNull } from 'drizzle-orm';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

// Initialize Google Generative AI
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');
const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

// Configuration
const BATCH_SIZE = 2; // Process 2 actors at a time
const DELAY_BETWEEN_ACTORS = 10000; // 10 seconds between actor requests
const DELAY_BETWEEN_BATCHES = 60000; // 1 minute between batches
const MAX_RETRIES = 3;
const PROGRESS_FILE = './actor-update-progress.json';

interface ActorWithoutBirthdate {
  id: number;
  name: string;
}

interface ActorUpdateResult {
  actorId: number;
  name: string;
  birthdate: string | null;
  status: 'success' | 'failed';
}

// Load saved progress (if exists)
function loadProgress(): ActorUpdateResult[] {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      const data = fs.readFileSync(PROGRESS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading progress file:', error);
  }
  return [];
}

// Save progress
function saveProgress(results: ActorUpdateResult[]): void {
  try {
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(results, null, 2));
    console.log('Progress saved.');
  } catch (error) {
    console.error('Error saving progress:', error);
  }
}

async function getActorsWithoutBirthdate(): Promise<ActorWithoutBirthdate[]> {
  const result = await db.select({ id: actors.id, name: actors.name })
    .from(actors)
    .where(
      or(
        eq(actors.dateOfBirth, ''),
        isNull(actors.dateOfBirth)
      )
    );
  
  return result;
}

// Get actors that have already been processed
function getProcessedActorIds(progress: ActorUpdateResult[]): number[] {
  return progress.map(result => result.actorId);
}

async function getBirthdateFromAI(actorName: string, retryCount = 0): Promise<string | null> {
  try {
    const prompt = `I need to know the accurate date of birth for actor/actress ${actorName}. 
Please provide it in YYYY-MM-DD format. Return only the date in that exact format.
If you're not absolutely certain, indicate that with a comment after the date.`;
    
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
  } catch (error: any) {
    console.error(`Error getting birthdate for ${actorName}:`, error.message || error);
    
    // Check if it's a rate limit error (429)
    if (error.status === 429 && retryCount < MAX_RETRIES) {
      // Extract retry delay from error if available, or use exponential backoff
      let retryDelay = 60000 * (retryCount + 1); // 1 minute, 2 minutes, 3 minutes...
      
      if (error.errorDetails && 
          error.errorDetails[2] && 
          error.errorDetails[2]['@type'] === 'type.googleapis.com/google.rpc.RetryInfo' &&
          error.errorDetails[2].retryDelay) {
        // Extract seconds from the delay format (e.g. "52s")
        const retryDelayStr = error.errorDetails[2].retryDelay;
        const secondsMatch = retryDelayStr.match(/(\d+)s/);
        if (secondsMatch && secondsMatch[1]) {
          retryDelay = parseInt(secondsMatch[1], 10) * 1000;
        }
      }
      
      console.log(`Rate limited. Retrying after ${retryDelay / 1000} seconds... (Attempt ${retryCount + 1}/${MAX_RETRIES})`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      return getBirthdateFromAI(actorName, retryCount + 1);
    }
    
    return null;
  }
}

async function updateActorBirthdate(id: number, dateOfBirth: string): Promise<boolean> {
  try {
    await db.update(actors)
      .set({ dateOfBirth: dateOfBirth, updatedAt: new Date() })
      .where(eq(actors.id, id));
    
    console.log(`Updated birthdate for actor ID ${id} to ${dateOfBirth}`);
    return true;
  } catch (error) {
    console.error(`Error updating birthdate for actor ID ${id}:`, error);
    return false;
  }
}

// Process actors one by one to avoid rate limiting
async function processActorsSequentially(
  actors: ActorWithoutBirthdate[],
  existingProgress: ActorUpdateResult[],
  startIndex = 0
): Promise<ActorUpdateResult[]> {
  const results = [...existingProgress]; // Start with existing progress
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  
  for (let i = startIndex; i < actors.length; i++) {
    const actor = actors[i];
    console.log(`Processing actor ${i + 1}/${actors.length}: ${actor.name}`);
    
    // Check if we've already processed this actor
    if (results.some(r => r.actorId === actor.id)) {
      console.log(`Skipping ${actor.name} (already processed)`);
      continue;
    }
    
    console.log(`Getting birthdate for ${actor.name}...`);
    const birthdate = await getBirthdateFromAI(actor.name);
    
    let result: ActorUpdateResult;
    
    if (birthdate) {
      const updateSuccess = await updateActorBirthdate(actor.id, birthdate);
      result = {
        actorId: actor.id,
        name: actor.name,
        birthdate,
        status: updateSuccess ? 'success' : 'failed'
      };
    } else {
      result = {
        actorId: actor.id,
        name: actor.name,
        birthdate: null,
        status: 'failed'
      };
    }
    
    results.push(result);
    
    // Save progress after each actor
    saveProgress(results);
    
    // Introduce delay between actor requests to avoid rate limiting
    if (i < actors.length - 1) {
      console.log(`Waiting ${DELAY_BETWEEN_ACTORS / 1000} seconds before next actor...`);
      await delay(DELAY_BETWEEN_ACTORS);
      
      // Add a longer delay after every batch
      if ((i + 1) % BATCH_SIZE === 0) {
        console.log(`Completed batch ${Math.floor((i + 1) / BATCH_SIZE)}. Taking a longer break (${DELAY_BETWEEN_BATCHES / 1000} seconds)...`);
        await delay(DELAY_BETWEEN_BATCHES);
      }
    }
  }
  
  return results;
}

// Manual birthdate data for common actors
// This helps us avoid API calls for well-known actors
const knownActorBirthdates: Record<string, string> = {
  "Abbie Cornish": "1982-08-07",
  "Adam Scott": "1973-04-03",
  "Adrian Edmondson": "1957-01-24",
  "Adèle Exarchopoulos": "1993-11-22",
  "Alfred Molina": "1953-05-24",
  "Alicia Vikander": "1988-10-03",
  "Alison Brie": "1982-12-29",
  "Allison Janney": "1959-11-19",
  "Amy Poehler": "1971-09-16",
  "Andy Serkis": "1964-04-20",
  "Anil Kapoor": "1956-12-24",
  "Anna Paquin": "1982-07-24",
  "Ansel Elgort": "1994-03-14",
  "Anthony Mackie": "1978-09-23",
  "Anthony Ramos": "1991-11-01",
  "Anya Taylor-Joy": "1996-04-16",
  "Armin Mueller-Stahl": "1930-12-17",
  "Arnold Schwarzenegger": "1947-07-30",
  "Audrey Tautou": "1976-08-09",
  "Auliʻi Cravalho": "2000-11-22",
  "Aziz Ansari": "1983-02-23",
  "BD Wong": "1960-10-24",
  "Ben Kingsley": "1943-12-31",
  "Billy Boyd": "1968-08-28",
  "Bob Odenkirk": "1962-10-22",
  "Bryan Cranston": "1956-03-07",
  "Bryce Dallas Howard": "1981-03-02",
  "Bérénice Bejo": "1976-07-07",
  "Callan Mulvey": "1975-02-23",
  "Candice Bergen": "1946-05-09",
  "Charles Dance": "1946-10-10",
  "Charlie Sheen": "1965-09-03",
  "Charlotte Rampling": "1946-02-05",
  "Chloë Grace Moretz": "1997-02-10",
  "Chris Pine": "1980-08-26",
  "Christopher Guest": "1948-02-05",
  "Ciarán Hinds": "1953-02-09",
  "Cillian Murphy": "1976-05-25",
  "Cliff Curtis": "1968-07-27",
  "Clifton Collins Jr.": "1970-06-16",
  "Constance Wu": "1982-03-22",
  "Daisy Ridley": "1992-04-10",
  "Dakota Fanning": "1994-02-23",
  "Dan Aykroyd": "1952-07-01",
  "Daniel Auteuil": "1950-01-24",
  "Daniel Kaluuya": "1989-02-24",
  "Danny Glover": "1946-07-22",
  "Danny Pudi": "1979-03-10",
  "Daveed Diggs": "1982-01-24",
  "David Bradley": "1942-04-17",
  "David Thewlis": "1963-03-20",
  "David Wenham": "1965-09-21",
  "Dawn French": "1957-10-11",
  "Deepika Padukone": "1986-01-05", 
  "Demián Bichir": "1963-08-01",
  "Dev Patel": "1990-04-23",
  "Dick Van Dyke": "1925-12-13",
  "Dominic Monaghan": "1976-12-08",
  "Don Cheadle": "1964-11-29",
  "Donald Glover": "1983-09-25",
  "Dustin Hoffman": "1937-08-08",
  "Ed Harris": "1950-11-28",
  "Edward Furlong": "1977-08-02",
  "Edward James Olmos": "1947-02-24",
  "Elijah Wood": "1981-01-28",
  "Elisabeth Moss": "1982-07-24",
  "Elizabeth Olsen": "1989-02-16",
  "Elle Fanning": "1998-04-09",
  "Elliott Gould": "1938-08-29",
  "Emilia Clarke": "1986-10-23",
  "Emilio Estevez": "1962-05-12",
  "Emily Watson": "1967-01-14",
  "Emmanuelle Béart": "1963-08-14",
  "Eric Idle": "1943-03-29",
  "Esai Morales": "1962-10-01",
  "Eugene Levy": "1946-12-17",
  "Eva Marie Saint": "1924-07-04",
  "Evanna Lynch": "1991-08-16",
  "Ewan McGregor": "1971-03-31",
  "Fanny Ardant": "1949-03-22",
  "Faye Dunaway": "1941-01-14",
  "Felicity Jones": "1983-10-17",
  "Fiona Shaw": "1958-07-10",
  "Freida Pinto": "1984-10-18",
  "Gabrielle Union": "1972-10-29",
  "Gael García Bernal": "1978-11-30",
  "Gary Sinise": "1955-03-17",
  "George Takei": "1937-04-20",
  "Goldie Hawn": "1945-11-21",
  "Gwendoline Christie": "1978-10-28",
  "Gérard Depardieu": "1948-12-27",
  "Hailee Steinfeld": "1996-12-11",
  "Harry Shearer": "1943-12-23",
  "Harvey Keitel": "1939-05-13",
  "Henry Golding": "1987-02-05",
  "Hiroyuki Sanada": "1960-10-12",
  "Holly Hunter": "1958-03-20",
  "Hope Davis": "1964-03-23",
  "Hugh Laurie": "1959-06-11",
  "Hugo Weaving": "1960-04-04",
  "Héctor Elizondo": "1936-12-22",
  "Ian McShane": "1942-09-29",
  "Isabella Rossellini": "1952-06-18",
  "Isabelle Adjani": "1955-06-27",
  "Isla Fisher": "1976-02-03",
  "Jacki Weaver": "1947-05-25",
  "Jackie Chan": "1954-04-07",
  "Jada Pinkett Smith": "1971-09-18",
  "Jai Courtney": "1986-03-15",
  "James Woods": "1947-04-18",
  "Jane Fonda": "1937-12-21",
  "Jane Lynch": "1960-07-14",
  "Jason Clarke": "1969-07-17",
  "Jason Statham": "1967-07-26",
  "Jean-Claude Van Damme": "1960-10-18",
  "Jeff Goldblum": "1952-10-22",
  "Jenette Goldstein": "1960-02-04",
  "Jennifer Coolidge": "1961-08-28",
  "Jennifer Saunders": "1958-07-06",
  "Jeremy Renner": "1971-01-07",
  "Jesse Eisenberg": "1983-10-05",
  "Jim Broadbent": "1949-05-24",
  "Jim Rash": "1971-07-15",
  "Jimmy Smits": "1955-07-09",
  "Joe Morton": "1947-10-18",
  "Joe Pesci": "1943-02-09",
  "Joel Edgerton": "1974-06-23",
  "Joel McHale": "1971-11-20",
  "Joely Richardson": "1965-01-09",
  "John Boyega": "1992-03-17",
  "John Cleese": "1939-10-27",
  "John Leguizamo": "1964-07-22",
  "John Rhys-Davies": "1944-05-05",
  "John Savage": "1949-08-25",
  "Jonathan Groff": "1985-03-26",
  "Josh Brolin": "1968-02-12",
  "Josh Gad": "1981-02-23",
  "Julianne Moore": "1960-12-03",
  "Julie Walters": "1950-02-22",
  "Jürgen Prochnow": "1941-06-10",
  "Karl Urban": "1972-06-07",
  "Kathryn Hahn": "1973-07-23",
  "Keira Knightley": "1985-03-26",
  "Kelly Macdonald": "1976-02-23",
  "Ken Jeong": "1969-07-13",
  "Kevin Bacon": "1958-07-08",
  "Kevin Dillon": "1965-08-19",
  "Kevin Hart": "1979-07-06",
  "Kit Harington": "1986-12-26",
  "Kristen Wiig": "1973-08-22",
  "Kumail Nanjiani": "1978-02-21",
  "Kyle MacLachlan": "1959-02-22",
  "Lance Henriksen": "1940-05-05",
  "Laura Dern": "1967-02-10",
  "Lee Byung-hun": "1970-07-12",
  "Lena Headey": "1973-10-03",
  "Lenny Henry": "1958-08-29",
  "Lesley Manville": "1956-03-12",
  "Leslie Odom Jr.": "1981-08-06",
  "Lin-Manuel Miranda": "1980-01-16",
  "Linda Hamilton": "1956-09-26",
  "Luis Guzmán": "1956-08-28",
  "Maggie Gyllenhaal": "1977-11-16",
  "Maisie Williams": "1997-04-15",
  "Malcolm McDowell": "1943-06-13",
  "Mandy Moore": "1984-04-10",
  "Manu Bennett": "1969-10-10",
  "Marion Cotillard": "1975-09-30",
  "Mark Ruffalo": "1967-11-22",
  "Mark Strong": "1963-08-05",
  "Mark Williams": "1959-08-22",
  "Martin Sheen": "1940-08-03",
  "Martin Short": "1950-03-26",
  "Martina Gedeck": "1961-09-14",
  "Masi Oka": "1974-12-27",
  "Mathieu Kassovitz": "1967-08-03",
  "Matt Dillon": "1964-02-18",
  "Matthew Lewis": "1989-06-27",
  "Matthias Schweighöfer": "1981-03-11",
  "Meg Ryan": "1961-11-19",
  "Melissa McCarthy": "1970-08-26",
  "Michael Biehn": "1956-07-31",
  "Michael Douglas": "1944-09-25",
  "Michael McKean": "1947-10-17",
  "Michael Palin": "1943-05-05",
  "Michael Peña": "1976-01-13",
  "Michael Shannon": "1974-08-07",
  "Michelle Yeoh": "1962-08-06",
  "Miranda Otto": "1967-12-16",
  "Miranda Richardson": "1958-03-03",
  "Naomie Harris": "1976-09-06",
  "Nick Frost": "1972-03-28",
  "Nick Nolte": "1941-02-08",
  "Nick Offerman": "1970-06-26",
  "Nicolas Cage": "1964-01-07",
  "Nikolaj Coster-Waldau": "1970-07-27",
  "Nina Hoss": "1975-07-07",
  "Noah Taylor": "1969-09-04",
  "Oliver Platt": "1960-01-12",
  "Olivia Colman": "1974-01-30",
  "Oscar Isaac": "1979-03-09",
  "Parker Posey": "1968-11-08",
  "Patricia Clarkson": "1959-12-29",
  "Peter Mullan": "1959-11-02",
  "Phillipa Soo": "1990-05-31",
  "Phoebe Waller-Bridge": "1985-07-14",
  "Priyanka Chopra Jonas": "1982-07-18",
  "Queen Latifah": "1970-03-18",
  "Radha Mitchell": "1973-11-12",
  "Rashida Jones": "1976-02-25",
  "Rebecca Hall": "1982-05-03",
  "Rebel Wilson": "1980-03-02",
  "Regina Hall": "1970-12-12",
  "Renée Elise Goldsberry": "1971-01-02",
  "Retta": "1970-04-12",
  "Rhys Ifans": "1967-07-22",
  "Richard Dreyfuss": "1947-10-29",
  "Richard Roxburgh": "1962-01-23",
  "Rinko Kikuchi": "1981-01-06",
  "Rita Moreno": "1931-12-11",
  "Riz Ahmed": "1982-12-01",
  "Rob Lowe": "1964-03-17",
  "Robert Carlyle": "1961-04-14",
  "Robert Duvall": "1931-01-05",
  "Roberto Benigni": "1952-10-27",
  "Rodrigo Santoro": "1975-08-22",
  "Romain Duris": "1974-05-28",
  "Rose Byrne": "1979-07-24",
  "Rosie Perez": "1964-09-06",
  "Rowan Atkinson": "1955-01-06",
  "Russ Tamblyn": "1934-12-30",
  "Ryan Kwanten": "1976-11-28",
  "Salman Khan": "1965-12-27",
  "Sam Rockwell": "1968-11-05",
  "Samantha Morton": "1977-05-13",
  "Sandra Hüller": "1978-04-30",
  "Sandra Oh": "1971-07-20",
  "Sean Astin": "1971-02-25",
  "Sean Penn": "1960-08-17",
  "Sebastian Stan": "1982-08-13",
  "Shailene Woodley": "1991-11-15",
  "Shirley MacLaine": "1934-04-24",
  "Simon Baker": "1969-07-30",
  "Simon Pegg": "1970-02-14",
  "Sissy Spacek": "1949-12-25",
  "Stanley Tucci": "1960-11-11",
  "Stephen Fry": "1957-08-24",
  "Stephen Rea": "1946-10-31",
  "Steven Yeun": "1983-12-21",
  "Sullivan Stapleton": "1977-06-14",
  "Sônia Braga": "1950-06-08",
  "Tahar Rahim": "1981-07-04",
  "Takeshi Kitano": "1947-01-18",
  "Talia Shire": "1946-04-25",
  "Taraji P. Henson": "1970-09-11",
  "Temuera Morrison": "1960-12-26",
  "Terence Stamp": "1938-07-22",
  "Terrence Howard": "1969-03-11",
  "Thandiwe Newton": "1972-11-06",
  "Tiffany Haddish": "1979-12-03",
  "Til Schweiger": "1963-12-19",
  "Timothy Olyphant": "1968-05-20",
  "Timothy Spall": "1957-02-27",
  "Tom Felton": "1987-09-22",
  "Tom Skerritt": "1933-08-25",
  "Udo Kier": "1944-10-14",
  "Vince Vaughn": "1970-03-28",
  "Wagner Moura": "1976-06-27",
  "Walton Goggins": "1971-11-10",
  "Warwick Davis": "1970-02-03",
  "Wesley Snipes": "1962-07-31",
  "Willem Dafoe": "1955-07-22",
  "Woody Harrelson": "1961-07-23",
  "Yvette Nicole Brown": "1971-08-12",
  "Zachary Levi": "1980-09-29"
};

async function run() {
  try {
    console.log("Starting update of actor birthdates...");
    
    // Load existing progress
    const existingProgress = loadProgress();
    console.log(`Loaded ${existingProgress.length} entries from progress file.`);
    
    // Get actors without birthdates
    const actorsWithoutBirthdate = await getActorsWithoutBirthdate();
    console.log(`Found ${actorsWithoutBirthdate.length} actors without birthdates.`);
    
    // Get processed actor IDs
    const processedIds = getProcessedActorIds(existingProgress);
    console.log(`Already processed ${processedIds.length} actors.`);
    
    // First, update actors with known birthdates
    let updatedFromKnownData = 0;
    for (const actor of actorsWithoutBirthdate) {
      if (knownActorBirthdates[actor.name]) {
        // Skip if already in progress file
        if (processedIds.includes(actor.id)) continue;
        
        console.log(`Updating ${actor.name} with known birthdate: ${knownActorBirthdates[actor.name]}`);
        const success = await updateActorBirthdate(actor.id, knownActorBirthdates[actor.name]);
        
        existingProgress.push({
          actorId: actor.id,
          name: actor.name,
          birthdate: knownActorBirthdates[actor.name],
          status: success ? 'success' : 'failed'
        });
        
        updatedFromKnownData++;
      }
    }
    
    console.log(`Updated ${updatedFromKnownData} actors from known data.`);
    saveProgress(existingProgress);
    
    // Filter out actors that already have birthdates or are in our known data
    const actorsToProcess = actorsWithoutBirthdate.filter(actor => 
      !processedIds.includes(actor.id) && !knownActorBirthdates[actor.name]
    );
    
    console.log(`Remaining actors to process: ${actorsToProcess.length}`);
    
    if (actorsToProcess.length > 0) {
      // Process actors sequentially
      await processActorsSequentially(actorsToProcess, existingProgress);
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