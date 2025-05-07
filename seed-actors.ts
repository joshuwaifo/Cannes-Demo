import { db } from "./db";
import { actors } from "./shared/schema";

async function seedActors() {
  try {
    console.log("Starting actor seeding...");
    
    // Sample actor data based on the actorDatabase.txt
    const actorsData = [
      {
        name: "Tom Hanks",
        gender: "Male",
        nationality: "American",
        notableRoles: ["Forrest Gump", "Saving Private Ryan", "Cast Away", "Philadelphia", "Toy Story (Woody - Voice)"],
        genres: ["Drama", "Comedy", "Historical", "War", "Animation (Voice)"],
        recentPopularity: "Very High / Iconic",
        typicalRoles: ["Everyman heroes", "historical figures", "conveying warmth/integrity"],
        estSalaryRange: "A-List Lead ($20M+)",
        socialMediaFollowing: "Moderate (Uses selectively)",
        availability: "Active",
        bestSuitedRolesStrategic: "Prestigious dramas, biopics, roles requiring audience trust/sympathy, voice work. High budget needed. Safe choice.",
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: "Meryl Streep",
        gender: "Female",
        nationality: "American",
        notableRoles: ["The Devil Wears Prada", "Sophie's Choice", "Kramer vs. Kramer", "Mamma Mia!"],
        genres: ["Drama", "Comedy", "Musical", "Biopic"],
        recentPopularity: "Very High / Iconic",
        typicalRoles: ["Versatile dramatic leads", "complex/powerful women", "matriarchs"],
        estSalaryRange: "A-List Lead ($10M+)",
        socialMediaFollowing: "Low / N/A",
        availability: "Active",
        bestSuitedRolesStrategic: "Virtually any demanding dramatic or comedic lead/supporting role, biopics, prestige TV. High budget/prestige projects.",
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: "Leonardo DiCaprio",
        gender: "Male",
        nationality: "American",
        notableRoles: ["Titanic", "Inception", "The Wolf of Wall Street", "The Revenant", "Killers of the Flower Moon"],
        genres: ["Drama", "Thriller", "Historical", "Biopic", "Crime"],
        recentPopularity: "Very High",
        typicalRoles: ["Intense, conflicted protagonists in major director-driven films"],
        estSalaryRange: "A-List Lead ($25M+)",
        socialMediaFollowing: "High (Activism focus)",
        availability: "Active",
        bestSuitedRolesStrategic: "Intense leading roles in large-scale dramas/thrillers, often period pieces, collaborating with top directors. Very high budget required.",
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: "Viola Davis",
        gender: "Female",
        nationality: "American",
        notableRoles: ["Fences", "The Help", "Ma Rainey's Black Bottom", "How to Get Away with Murder", "The Woman King", "Air"],
        genres: ["Drama", "Period Piece", "Legal Drama", "Action"],
        recentPopularity: "Very High",
        typicalRoles: ["Intense dramatic roles", "powerful/determined women"],
        estSalaryRange: "A-List Lead ($5M-$10M+)",
        socialMediaFollowing: "High",
        availability: "Active",
        bestSuitedRolesStrategic: "Leading roles demanding dramatic power, authority figures, biopics, action leads. High prestige, EGOT winner.",
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: "Denzel Washington",
        gender: "Male",
        nationality: "American",
        notableRoles: ["Training Day", "Malcolm X", "Glory", "The Equalizer series", "Fences"],
        genres: ["Drama", "Action", "Thriller", "Biopic"],
        recentPopularity: "Very High",
        typicalRoles: ["Charismatic leads", "authority figures", "mentors", "anti-heroes"],
        estSalaryRange: "A-List Lead ($20M+)",
        socialMediaFollowing: "Low / N/A",
        availability: "Active",
        bestSuitedRolesStrategic: "Leading roles in action-thrillers, prestige dramas, roles requiring gravitas/intensity. High budget. Bankable star.",
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: "Emma Stone",
        gender: "Female",
        nationality: "American",
        notableRoles: ["La La Land", "Poor Things", "The Favourite", "Easy A", "The Curse"],
        genres: ["Drama", "Comedy", "Musical", "Period Piece", "Dark Comedy"],
        recentPopularity: "Very High",
        typicalRoles: ["Charismatic, versatile, relatable/expressive performances"],
        estSalaryRange: "A-List Lead ($10M+)",
        socialMediaFollowing: "Moderate (Private/Limited use)",
        availability: "Active",
        bestSuitedRolesStrategic: "Leading roles in comedies, dramas, musicals, auteur projects. High demand, multiple Oscar winner.",
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: "Ryan Gosling",
        gender: "Male",
        nationality: "Canadian",
        notableRoles: ["La La Land", "Blade Runner 2049", "Drive", "The Notebook", "Barbie"],
        genres: ["Drama", "Romance", "Sci-Fi", "Action", "Comedy"],
        recentPopularity: "Very High",
        typicalRoles: ["Charismatic or brooding leads", "romantic interests", "action heroes"],
        estSalaryRange: "A-List Lead ($10M+)",
        socialMediaFollowing: "Moderate",
        availability: "Active",
        bestSuitedRolesStrategic: "Leading roles across genres - action, comedy, drama, romance. High demand after Barbie.",
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: "Cate Blanchett",
        gender: "Female",
        nationality: "Australian",
        notableRoles: ["Elizabeth", "Blue Jasmine", "Carol", "Tár", "Lord of the Rings"],
        genres: ["Drama", "Period Piece", "Fantasy", "Biopic", "Thriller"],
        recentPopularity: "Very High",
        typicalRoles: ["Elegant, intelligent, complex women, transformative roles"],
        estSalaryRange: "A-List Lead ($10M+)",
        socialMediaFollowing: "Low / N/A",
        availability: "Active",
        bestSuitedRolesStrategic: "Any demanding lead/supporting role, particularly complex women, auteurs' projects, prestige TV. High budget/prestige.",
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: "Morgan Freeman",
        gender: "Male",
        nationality: "American",
        notableRoles: ["The Shawshank Redemption", "Million Dollar Baby", "Invictus", "Seven", "numerous voiceovers"],
        genres: ["Drama", "Thriller", "Voiceover"],
        recentPopularity: "Very High / Iconic",
        typicalRoles: ["Wise figures", "authority", "narrators", "God"],
        estSalaryRange: "A-List Supporting/Voice ($5M+)",
        socialMediaFollowing: "Low / N/A",
        availability: "Active",
        bestSuitedRolesStrategic: "Narrator roles, wise mentors, authority figures. Highly sought for voiceovers. Adds prestige.",
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: "Joaquin Phoenix",
        gender: "Male",
        nationality: "American (Born Puerto Rico)",
        notableRoles: ["Joker", "Gladiator", "Walk the Line", "Her", "Beau Is Afraid", "Napoleon"],
        genres: ["Drama", "Thriller", "Biopic", "Dark Comedy", "Historical"],
        recentPopularity: "Very High",
        typicalRoles: ["Intense, unpredictable, immersive, complex/dark roles"],
        estSalaryRange: "A-List Lead ($10M-$20M+)",
        socialMediaFollowing: "Low / N/A",
        availability: "Active",
        bestSuitedRolesStrategic: "Complex, challenging lead roles, often anti-heroes or disturbed characters, auteur projects. Known for intensity.",
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
    
    // Insert actors
    await db.insert(actors).values(actorsData);
    
    console.log(`Successfully inserted ${actorsData.length} actors.`);
  } catch (error) {
    console.error("Error seeding actors:", error);
  }
}

seedActors().catch(error => {
  console.error("Fatal error:", error);
  process.exit(1);
});