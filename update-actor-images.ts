import { db } from "./db";
import { actors } from "./shared/schema";
import { eq } from "drizzle-orm";

// Map of actor images from reliable sources
// These are public images of well-known actors
const actorImageMap: Record<string, string> = {
  // Male actors
  "Tom Hanks": "https://upload.wikimedia.org/wikipedia/commons/a/a9/Tom_Hanks_TIFF_2019.jpg",
  "Leonardo DiCaprio": "https://upload.wikimedia.org/wikipedia/commons/4/46/Leonardo_Dicaprio_Cannes_2019.jpg",
  "Denzel Washington": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/Denzel_Washington_2018.jpg/800px-Denzel_Washington_2018.jpg",
  "Robert Downey Jr.": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/94/Robert_Downey_Jr_2014_Comic_Con_%28cropped%29.jpg/800px-Robert_Downey_Jr_2014_Comic_Con_%28cropped%29.jpg",
  "Brad Pitt": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Brad_Pitt_2019_by_Glenn_Francis.jpg/800px-Brad_Pitt_2019_by_Glenn_Francis.jpg",
  "Morgan Freeman": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Morgan_Freeman_Deauville_2018.jpg/800px-Morgan_Freeman_Deauville_2018.jpg",
  "Al Pacino": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/Al_Pacino.jpg/800px-Al_Pacino.jpg",
  "Johnny Depp": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3b/Johnny_Depp-2757_%28cropped%29.jpg/800px-Johnny_Depp-2757_%28cropped%29.jpg",
  "Tom Cruise": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/33/Tom_Cruise_by_Gage_Skidmore_2.jpg/800px-Tom_Cruise_by_Gage_Skidmore_2.jpg",
  "Will Smith": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/TechCrunch_Disrupt_2019_%2848834434641%29_%28cropped%29.jpg/800px-TechCrunch_Disrupt_2019_%2848834434641%29_%28cropped%29.jpg",
  "Aamir Khan": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/Aamir_Khan_at_Dangal_song_launch_%2835%29.jpg/800px-Aamir_Khan_at_Dangal_song_launch_%2835%29.jpg",
  "Daniel Craig": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Daniel_Craig_in_2021.jpg/800px-Daniel_Craig_in_2021.jpg",
  "Arnold Schwarzenegger": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/af/Arnold_Schwarzenegger_by_Gage_Skidmore_4.jpg/800px-Arnold_Schwarzenegger_by_Gage_Skidmore_4.jpg",
  "Ryan Gosling": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Ryan_Gosling_in_2018.jpg/800px-Ryan_Gosling_in_2018.jpg",
  "Dwayne Johnson": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f1/Dwayne_Johnson_2%2C_2013.jpg/800px-Dwayne_Johnson_2%2C_2013.jpg",
  
  // Female actors
  "Meryl Streep": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/Meryl_Streep_December_2018.jpg/800px-Meryl_Streep_December_2018.jpg",
  "Jennifer Lawrence": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/Jennifer_Lawrence_SDCC_2015_X-Men.jpg/800px-Jennifer_Lawrence_SDCC_2015_X-Men.jpg",
  "Scarlett Johansson": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Scarlett_Johansson_by_Gage_Skidmore_2_%28cropped%29.jpg/800px-Scarlett_Johansson_by_Gage_Skidmore_2_%28cropped%29.jpg",
  "Emma Stone": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/Emma_Stone_at_the_39th_Mill_Valley_Film_Festival_%28cropped%29.jpg/800px-Emma_Stone_at_the_39th_Mill_Valley_Film_Festival_%28cropped%29.jpg",
  "Viola Davis": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/Viola_Davis_by_Gage_Skidmore.jpg/800px-Viola_Davis_by_Gage_Skidmore.jpg",
  "Cate Blanchett": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/31/Cate_Blanchett_Berlinale_2023_%28cropped%29.jpg/800px-Cate_Blanchett_Berlinale_2023_%28cropped%29.jpg",
  "Natalie Portman": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Natalie_Portman_Cannes_2023.jpg/800px-Natalie_Portman_Cannes_2023.jpg",
  "Nicole Kidman": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/Nicole_Kidman_Cannes_2017_5.jpg/800px-Nicole_Kidman_Cannes_2017_5.jpg",
  "Charlize Theron": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5d/Charlize-theron-IMG_6045.jpg/800px-Charlize-theron-IMG_6045.jpg",
  "Zendaya": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/Zendaya_-_2019_by_Glenn_Francis.jpg/800px-Zendaya_-_2019_by_Glenn_Francis.jpg",
  "Maggie Smith": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Maggie_Smith_2007.jpg/800px-Maggie_Smith_2007.jpg",
  "Jessica Lange": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/33/Jessica_Lange_Cannes.jpg/800px-Jessica_Lange_Cannes.jpg",
  "Claire Danes": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/56/Claire_Danes_2012.jpg/800px-Claire_Danes_2012.jpg",
  "Margot Robbie": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fe/Margot_Robbie_%2848511822397%29_%28cropped%29.jpg/800px-Margot_Robbie_%2848511822397%29_%28cropped%29.jpg",
  "Abbie Cornish": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/dc/Abbie_Cornish_2014.jpg/800px-Abbie_Cornish_2014.jpg"
};

// For any actor name not in our map, use a default image from a placeholder service
const getActorImage = (name: string): string => {
  return actorImageMap[name] || 
    `https://placehold.co/400x600/gray/white?text=${encodeURIComponent(name)}`;
};

async function updateActorImages() {
  try {
    // Get all actors
    const allActors = await db.select().from(actors);
    
    console.log(`Found ${allActors.length} actors to update with images`);
    
    // Update each actor with an image URL
    for (const actor of allActors) {
      const imageUrl = getActorImage(actor.name);
      
      console.log(`Updating ${actor.name} with image: ${imageUrl}`);
      
      await db.update(actors)
        .set({ imageUrl })
        .where(eq(actors.id, actor.id));
    }
    
    console.log("Actor images updated successfully");
  } catch (error) {
    console.error("Error updating actor images:", error);
  }
}

// Run the update function
updateActorImages()
  .then(() => {
    console.log("Update completed");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Update failed:", err);
    process.exit(1);
  });