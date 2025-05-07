import { db } from "./index";
import * as schema from "@shared/schema";
import { eq } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";

async function seed() {
  try {
    console.log("Starting database seeding...");

    // Check if products already exist
    const existingProducts = await db.select({ count: { value: schema.products.id } })
      .from(schema.products)
      .limit(1);
    
    if (existingProducts.length > 0 && existingProducts[0].count.value > 0) {
      console.log("Products already exist in the database, skipping seed.");
      return;
    }

    // Sample product data based on the design
    const productsData = [
      {
        companyName: "Starbucks",
        name: "Starbucks Coffee",
        category: "BEVERAGE",
        imageUrl: "https://images.unsplash.com/photo-1577590835286-1cdd24c08fd7?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=300&h=160",
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        companyName: "Apple",
        name: "Apple MacBook",
        category: "ELECTRONICS",
        imageUrl: "https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=300&h=160",
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        companyName: "Godiva",
        name: "Godiva Chocolate",
        category: "FOOD",
        imageUrl: "https://pixabay.com/get/g019557ea5a868fc7b6a061116435d92cb542c700e53c1c6d346ec4788cd236162754a6972e833c18688ad9d4cbe468383638fbbb8c2adee77141514db1c6a25a_1280.jpg",
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        companyName: "Tesla",
        name: "Tesla Model 3",
        category: "AUTOMOTIVE",
        imageUrl: "https://images.unsplash.com/photo-1617788138017-80ad40651399?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=300&h=160",
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        companyName: "Ray-Ban",
        name: "Ray-Ban Sunglasses",
        category: "FASHION",
        imageUrl: "https://images.unsplash.com/photo-1572635196237-14b3f281503f?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=300&h=160",
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        companyName: "The Coca-Cola Company",
        name: "Coca-Cola",
        category: "BEVERAGE",
        imageUrl: "https://images.unsplash.com/photo-1554866585-cd94860890b7?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=300&h=160",
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        companyName: "Samsung",
        name: "Samsung Galaxy S22",
        category: "ELECTRONICS",
        imageUrl: "https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=300&h=160",
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        companyName: "Mars Inc.",
        name: "Snickers",
        category: "FOOD",
        imageUrl: "https://images.unsplash.com/photo-1634913940786-58ce67cf72a7?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=300&h=160",
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        companyName: "BMW",
        name: "BMW i8",
        category: "AUTOMOTIVE",
        imageUrl: "https://images.unsplash.com/photo-1556800572-1b8aeef2c54f?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=300&h=160",
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        companyName: "Nike",
        name: "Nike Air Jordan",
        category: "FASHION",
        imageUrl: "https://images.unsplash.com/photo-1556906781-9a412961c28c?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=300&h=160",
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        companyName: "Monster Beverage",
        name: "Monster Energy",
        category: "BEVERAGE",
        imageUrl: "https://images.unsplash.com/photo-1622543925917-763c34d1a86e?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=300&h=160",
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        companyName: "Sony",
        name: "Sony PlayStation 5",
        category: "ELECTRONICS",
        imageUrl: "https://images.unsplash.com/photo-1607853202273-797f1c22a38e?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=300&h=160",
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    // Insert products
    await db.insert(schema.products).values(productsData);

    // Sample script data
    const scriptData = {
      title: "COFFEE SHOP ROMANCE",
      content: `INT. COFFEE SHOP - DAY

SARAH (28) sits by the window, typing on her laptop. The coffee shop is moderately busy with morning customers.

MICHAEL (30) enters, spots Sarah, and approaches her table.

MICHAEL
Hey, sorry I'm late. Traffic was a nightmare.

SARAH
(looking up)
No worries, I just got here.

Michael sits down and places his bag on the empty chair.

MICHAEL
Have you ordered yet?

SARAH
Just a coffee. I was waiting for you before getting breakfast.

A BARISTA approaches their table.

BARISTA
Can I get you anything?

MICHAEL
I'll have a large coffee, please.

SARAH
And I'll take a blueberry muffin.

The barista nods and walks away.

MICHAEL
So, about the project...

Sarah opens a document on her laptop and turns it towards Michael.`,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Only insert script if none exists
    const existingScripts = await db.select({ count: { value: schema.scripts.id } })
      .from(schema.scripts)
      .limit(1);
    
    if (existingScripts.length === 0 || existingScripts[0].count.value === 0) {
      const [script] = await db.insert(schema.scripts).values(scriptData).returning();
      
      // Create a sample scene
      const sceneData = {
        scriptId: script.id,
        sceneNumber: 1,
        heading: "INT. COFFEE SHOP - DAY",
        content: scriptData.content,
        isBrandable: true,
        brandableReason: "Coffee shop setting provides natural opportunities for beverage and food product placement",
        suggestedCategories: ["BEVERAGE", "FOOD", "ELECTRONICS"],
        createdAt: new Date()
      };
      
      await db.insert(schema.scenes).values(sceneData);
    }

    // Check if actors already exist
    const existingActors = await db.select({ count: { value: schema.actors.id } })
      .from(schema.actors)
      .limit(1);
    
    if (existingActors.length === 0 || existingActors[0].count.value === 0) {
      try {
        console.log("Seeding actors from actorDatabase.txt...");
        
        // Read the actor database file
        const actorFilePath = path.join(__dirname, '..', 'attached_assets', 'actorDatabase.txt');
        const actorFileContent = fs.readFileSync(actorFilePath, 'utf8');
        
        // Skip the header line and process each actor line
        const actorLines = actorFileContent.split('\n').filter(line => line.trim().length > 0);
        const header = actorLines[0]; // Skip header
        
        const actorsData = [];
        
        // Process each actor line starting from line 2 (index 1)
        for (let i = 1; i < actorLines.length; i++) {
          const line = actorLines[i];
          
          // Split by pipe character and trim spaces
          const parts = line.split('|').map(part => part.trim());
          
          if (parts.length >= 11) {
            const name = parts[0].replace(/\*\*/g, ''); // Remove ** from names
            const gender = parts[1];
            const nationality = parts[2];
            
            // Extract notable roles - remove * markers and split by comma
            const notableRolesText = parts[3].replace(/\*/g, '');
            const notableRoles = notableRolesText.split(',').map(role => role.trim());
            
            // Split genres by comma
            const genres = parts[4].split(',').map(genre => genre.trim());
            
            const recentPopularity = parts[5];
            
            // Split typical roles by comma
            const typicalRolesText = parts[6];
            const typicalRoles = typicalRolesText.split(',').map(role => role.trim());
            
            const estSalaryRange = parts[7];
            const socialMediaFollowing = parts[8];
            const availability = parts[9];
            const bestSuitedRolesStrategic = parts[10];
            
            actorsData.push({
              name,
              gender,
              nationality,
              notableRoles,
              genres,
              recentPopularity,
              typicalRoles,
              estSalaryRange,
              socialMediaFollowing,
              availability,
              bestSuitedRolesStrategic,
              createdAt: new Date(),
              updatedAt: new Date()
            });
          }
        }
        
        if (actorsData.length > 0) {
          // Insert actors in batches to avoid very large queries
          const batchSize = 10;
          for (let i = 0; i < actorsData.length; i += batchSize) {
            const batch = actorsData.slice(i, i + batchSize);
            await db.insert(schema.actors).values(batch);
          }
          
          console.log(`Successfully seeded ${actorsData.length} actors.`);
        } else {
          console.log("No actor data found to seed.");
        }
      } catch (error) {
        console.error("Error seeding actors:", error);
      }
    } else {
      console.log("Actors already exist in the database, skipping actor seed.");
    }

    console.log("Database seeding completed successfully.");
  } catch (error) {
    console.error("Error seeding database:", error);
    throw error;
  }
}

seed().catch(error => {
  console.error("Fatal error during seeding:", error);
  process.exit(1);
});
