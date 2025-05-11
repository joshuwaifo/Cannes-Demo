import { db } from './db';
import { actors } from './shared/schema';
import { eq } from 'drizzle-orm';

// Second batch of actor birth dates to add
const remainingActorBirthdates: Record<string, string> = {
  "Alicia Vikander": "1988-10-03",
  "Amy Poehler": "1971-09-16",
  "Anil Kapoor": "1956-12-24",
  "Arnold Schwarzenegger": "1947-07-30",
  "Auliʻi Cravalho": "2000-11-22",
  "Bob Odenkirk": "1962-10-22",
  "Bryan Cranston": "1956-03-07",
  "Bryce Dallas Howard": "1981-03-02",
  "Candice Bergen": "1946-05-09", 
  "Charlotte Rampling": "1946-02-05",
  "Cillian Murphy": "1976-05-25",
  "Daisy Ridley": "1992-04-10",
  "Dan Aykroyd": "1952-07-01",
  "Daniel Kaluuya": "1989-02-24",
  "Danny Glover": "1946-07-22",
  "Daveed Diggs": "1982-01-24",
  "Dawn French": "1957-10-11",
  "Deepika Padukone": "1986-01-05",
  "Demián Bichir": "1963-08-01",
  "Dick Van Dyke": "1925-12-13",
  "Donald Glover": "1983-09-25",
  "Dustin Hoffman": "1937-08-08",
  "Edward Furlong": "1977-08-02",
  "Elisabeth Moss": "1982-07-24",
  "Emilio Estevez": "1962-05-12",
  "Esai Morales": "1962-10-01",
  "Ewan McGregor": "1971-03-31",
  "Felicity Jones": "1983-10-17",
  "Fiona Shaw": "1958-07-10",
  "Gabrielle Union": "1972-10-29",
  "Gael García Bernal": "1978-11-30",
  "George Takei": "1937-04-20",
  "Gérard Depardieu": "1948-12-27",
  "Harvey Keitel": "1939-05-13",
  "Hiroyuki Sanada": "1960-10-12",
  "Holly Hunter": "1958-03-20",
  "Hope Davis": "1964-03-23",
  "Hugo Weaving": "1960-04-04",
  "Héctor Elizondo": "1936-12-22",
  "Jackie Chan": "1954-04-07",
  "Jada Pinkett Smith": "1971-09-18",
  "Jane Lynch": "1960-07-14",
  "Jason Statham": "1967-07-26",
  "Jean-Claude Van Damme": "1960-10-18",
  "Jeff Goldblum": "1952-10-22",
  "Jenette Goldstein": "1960-02-04",
  "Jennifer Saunders": "1958-07-06",
  "Jeremy Renner": "1971-01-07",
  "Jim Broadbent": "1949-05-24",
  "Jimmy Smits": "1955-07-09",
  "Joel Edgerton": "1974-06-23",
  "Joely Richardson": "1965-01-09",
  "John Savage": "1949-08-25",
  "Jonathan Groff": "1985-03-26",
  "Josh Gad": "1981-02-23",
  "Judy Greer": "1975-06-20",
  "Julianne Moore": "1960-12-03",
  "Kevin Bacon": "1958-07-08",
  "Kevin Hart": "1979-07-06",
  "Kristen Wiig": "1973-08-22",
  "Lance Henriksen": "1940-05-05",
  "Lee Byung-hun": "1970-07-12",
  "Lesley Manville": "1956-03-12",
  "Leslie Odom Jr.": "1981-08-06",
  "Lin-Manuel Miranda": "1980-01-16",
  "Linda Hamilton": "1956-09-26",
  "Luis Guzmán": "1956-08-28",
  "Mandy Moore": "1984-04-10",
  "Marion Cotillard": "1975-09-30",
  "Mark Ruffalo": "1967-11-22",
  "Masi Oka": "1974-12-27",
  "Melissa McCarthy": "1970-08-26",
  "Michael Biehn": "1956-07-31",
  "Michelle Yeoh": "1962-08-06",
  "Miranda Richardson": "1958-03-03",
  "Naomie Harris": "1976-09-06",
  "Nick Nolte": "1941-02-08",
  "Nick Offerman": "1970-06-26",
  "Nicolas Cage": "1964-01-07",
  "Nikolaj Coster-Waldau": "1970-07-27",
  "Noah Taylor": "1969-09-04",
  "Phillipa Soo": "1990-05-31",
  "Priyanka Chopra Jonas": "1982-07-18",
  "Queen Latifah": "1970-03-18",
  "Radha Mitchell": "1973-11-12",
  "Rebel Wilson": "1980-03-02",
  "Regina Hall": "1970-12-12",
  "Renée Elise Goldsberry": "1971-01-02",
  "Rinko Kikuchi": "1981-01-06",
  "Rita Moreno": "1931-12-11",
  "Roberto Benigni": "1952-10-27",
  "Rodrigo Santoro": "1975-08-22",
  "Russ Tamblyn": "1934-12-30",
  "Salman Khan": "1965-12-27",
  "Sandra Oh": "1971-07-20",
  "Sean Penn": "1960-08-17",
  "Sônia Braga": "1950-06-08",
  "Taraji P. Henson": "1970-09-11",
  "Terrence Howard": "1969-03-11",
  "Thandiwe Newton": "1972-11-06",
  "Timothy Spall": "1957-02-27",
  "Vince Vaughn": "1970-03-28",
  "Wagner Moura": "1976-06-27",
  "Wesley Snipes": "1962-07-31",
  "Zachary Levi": "1980-09-29"
};

async function updateActorBirthdate(actorName: string, dateOfBirth: string): Promise<boolean> {
  try {
    const result = await db.update(actors)
      .set({ dateOfBirth, updatedAt: new Date() })
      .where(eq(actors.name, actorName));
    
    console.log(`Updated birthdate for ${actorName} to ${dateOfBirth}`);
    return true;
  } catch (error) {
    console.error(`Error updating birthdate for ${actorName}:`, error);
    return false;
  }
}

async function run() {
  try {
    console.log("Starting update of remaining actor birthdates...");
    
    let successCount = 0;
    let failureCount = 0;
    
    // Process actors
    for (const [actorName, birthdate] of Object.entries(remainingActorBirthdates)) {
      const success = await updateActorBirthdate(actorName, birthdate);
      
      if (success) {
        successCount++;
      } else {
        failureCount++;
      }
    }
    
    console.log(`Update completed. Successful: ${successCount}, Failed: ${failureCount}`);
  } catch (error) {
    console.error("An error occurred:", error);
  } finally {
    process.exit(0);
  }
}

// Execute the script
run();