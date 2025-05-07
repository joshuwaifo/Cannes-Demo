// server/routes.ts
import type { Express } from "express";
import { createServer, type Server } from "http";
import * as storage from "./storage";
import multer from "multer";
import { extractScriptFromPdf } from "./services/pdf-service";
import { generateProductPlacement } from "./services/replicate-service"; // Corrected import
import {
  identifyBrandableScenesWithGemini,
  AIAnalysisResponseForRoutes,
} from "./services/file-upload-service"; // Import new Gemini function
import { z } from "zod";
import {
  insertProductSchema,
  insertActorSchema,
  insertLocationSchema,
  ProductCategory,
  Product as DbProduct,
  Scene as DbScene,
  Actor as DbActor, // Import DbActor for consistency
  Location as DbLocation, // Import DbLocation for consistency
  // SceneVariation as DbSceneVariation // Not strictly needed here if SceneVariationWithProductInfo is used
} from "@shared/schema";

// Define a type for scene variations with product details
interface BaseSceneVariation {
  id: number;
  sceneId: number;
  productId: number;
  variationNumber: number;
  description: string;
  imageUrl: string;
  isSelected: boolean;
}

interface SceneVariationWithProductInfo extends BaseSceneVariation {
  productName: string;
  productCategory: string; // This should align with ProductCategory enum
  productImageUrl?: string | null;
}

// Local Product interface for temporary use if DbProduct from schema has issues or needs aliasing
interface ProductLocal {
  id: number;
  name: string;
  category: string; // Could be ProductCategory if data source is consistent
  imageUrl?: string | null;
}

// Utility function to sanitize strings for database storage
const sanitizeString = (str: string): string => {
  if (!str) return "";
  return str.replace(/\u0000/g, "").replace(/[^\x20-\x7E\u0080-\uFFFF]/g, "");
};

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
});

// Helper function to generate and save scene variations with optimizations
async function _generateAndSaveSceneVariationsForRoute(
  sceneId: number,
  storageModule: typeof storage,
  generateProductPlacementFn: typeof generateProductPlacement,
): Promise<SceneVariationWithProductInfo[]> {
  const scene = await storageModule.getSceneById(sceneId);
  if (!scene) {
    console.error(
      `Scene with ID ${sceneId} not found for variation generation.`,
    );
    return [];
  }

  // Get top matching products for this scene based on suggested categories
  // This uses our new optimized function that returns more relevant products
  let selectedProducts: DbProduct[] = [];
  
  if (scene.suggestedCategories && scene.suggestedCategories.length > 0) {
    try {
      console.log(`Finding best matching products for scene ${scene.sceneNumber} based on categories: ${scene.suggestedCategories.join(', ')}`);
      
      selectedProducts = await storageModule.getTopMatchingProductsForScene(
        sceneId,
        scene.suggestedCategories as ProductCategory[],
        3 // Generate 3 variations
      );
      
      console.log(`Selected ${selectedProducts.length} optimal products for scene ${scene.sceneNumber}`);
    } catch (error) {
      console.error(`Error finding matching products: ${error}`);
      // Fallback to traditional product selection if the optimized function fails
      const productsResult = await storageModule.getProducts({ pageSize: 100 });
      const allProducts: DbProduct[] = productsResult.products;
      
      if (allProducts.length > 0) {
        const eligibleProducts = allProducts.filter((p: DbProduct) =>
          (scene.suggestedCategories as ProductCategory[]).includes(p.category)
        );
        
        selectedProducts = eligibleProducts
          .sort(() => 0.5 - Math.random())
          .slice(0, 3);
      }
    }
  } else {
    // If no suggested categories, get some recent products
    const productsResult = await storageModule.getProducts({ 
      pageSize: 10,
    });
    selectedProducts = productsResult.products.slice(0, 3);
  }

  if (selectedProducts.length === 0) {
    console.log(
      `No suitable products found for scene ${scene.sceneNumber} (ID: ${sceneId}). This scene might not have suggested categories matching available products.`,
    );
    return [];
  }

  // Create scene base prompt and seed for consistent scene composition
  // These will be passed to all variations to ensure the scene layout remains consistent
  const basePrompt = `Scene ${scene.sceneNumber}: ${scene.heading}. ${scene.content?.substring(0, 200) || ""}`;
  const baseSeed = Math.floor(Math.random() * 1000000);
  
  console.log(`Using consistent scene composition for scene ${scene.sceneNumber} with seed ${baseSeed}`);

  // Process variations in parallel for speed
  const variationPromises = selectedProducts.map(async (product, i) => {
    const variationNumber = i + 1;
    try {
      console.log(
        `Generating variation ${variationNumber} for scene ${scene.sceneNumber} (ID: ${sceneId}) with product ${product.name}...`,
      );
      
      // Use the enhanced generateProductPlacement function with consistent scene parameters
      const generationResult = await generateProductPlacementFn({
        scene,
        product,
        variationNumber,
        sceneBasePrompt: basePrompt, // Pass the base prompt for scene consistency
        sceneBaseSeed: baseSeed,     // Pass the seed for scene consistency
      });

      if (!generationResult.success) {
        console.warn(
          `Image generation failed for S${scene.sceneNumber}V${variationNumber}, P:${product.name}. Using fallback.`,
        );
        // Fallback image URL is already handled inside generateProductPlacementFn
      }

      const variation = await storageModule.createSceneVariation({
        sceneId,
        productId: product.id,
        variationNumber,
        description: sanitizeString(generationResult.description),
        imageUrl: sanitizeString(generationResult.imageUrl),
        isSelected: false,
      });

      return {
        ...(variation as BaseSceneVariation),
        productName: product.name,
        productCategory: product.category,
        productImageUrl: product.imageUrl,
      };
    } catch (error) {
      console.error(
        `Error in variation generation for S${scene.sceneNumber}V${variationNumber} (Product: ${product.name}):`,
        error,
      );
      return null;
    }
  });

  // Wait for all variations to complete
  const results = await Promise.all(variationPromises);
  const generatedVariations = results.filter(
    Boolean,
  ) as SceneVariationWithProductInfo[];

  console.log(
    `Successfully generated ${generatedVariations.length} variations for scene ${scene.sceneNumber}.`,
  );
  return generatedVariations;
}

export async function registerRoutes(app: Express): Promise<Server> {
  const apiPrefix = "/api";

  // --- Actor Routes ---
  app.get(`${apiPrefix}/actors`, async (req, res) => {
    try {
      const search = req.query.search as string | undefined;
      const gender = req.query.gender as string | undefined;
      const nationality = req.query.nationality as string | undefined;
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const pageSize = req.query.pageSize
        ? parseInt(req.query.pageSize as string)
        : 10;

      const result = await storage.getActors({
        search,
        gender,
        nationality,
        page,
        pageSize,
      });
      res.json(result);
    } catch (error) {
      console.error("Error fetching actors:", error);
      res.status(500).json({ message: "Failed to fetch actors" });
    }
  });

  app.get(`${apiPrefix}/actors/distinct-nationalities`, async (_req, res) => {
    try {
      const nationalities = await storage.getDistinctActorNationalities();
      res.json(nationalities);
    } catch (error) {
      console.error("Error fetching distinct actor nationalities:", error);
      res
        .status(500)
        .json({ message: "Failed to fetch distinct actor nationalities" });
    }
  });

  app.get(`${apiPrefix}/actors/:id`, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id))
        return res.status(400).json({ message: "Invalid actor ID" });
      const actor = await storage.getActorById(id);
      if (!actor) return res.status(404).json({ message: "Actor not found" });
      res.json(actor);
    } catch (error) {
      console.error("Error fetching actor:", error);
      res.status(500).json({ message: "Failed to fetch actor" });
    }
  });

  app.post(`${apiPrefix}/actors`, async (req, res) => {
    try {
      const validation = insertActorSchema.safeParse(req.body);
      if (!validation.success) {
        return res
          .status(400)
          .json({
            message: "Invalid actor data",
            errors: validation.error.errors,
          });
      }
      const actor = await storage.createActor(validation.data);
      res.status(201).json(actor);
    } catch (error) {
      console.error("Error creating actor:", error);
      res.status(500).json({ message: "Failed to create actor" });
    }
  });

  app.put(`${apiPrefix}/actors/:id`, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id))
        return res.status(400).json({ message: "Invalid actor ID" });
      // Add validation for update if necessary, e.g., using a partial schema
      const actor = await storage.updateActor(id, req.body);
      if (!actor) return res.status(404).json({ message: "Actor not found" });
      res.json(actor);
    } catch (error) {
      console.error("Error updating actor:", error);
      res.status(500).json({ message: "Failed to update actor" });
    }
  });

  app.delete(`${apiPrefix}/actors/:id`, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id))
        return res.status(400).json({ message: "Invalid actor ID" });
      const success = await storage.deleteActor(id);
      if (!success) return res.status(404).json({ message: "Actor not found" });
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting actor:", error);
      res.status(500).json({ message: "Failed to delete actor" });
    }
  });

  // --- Product Routes ---
  app.get(`${apiPrefix}/products`, async (req, res) => {
    try {
      const search = req.query.search as string | undefined;
      const category = req.query.category as string | undefined;
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const pageSize = req.query.pageSize
        ? parseInt(req.query.pageSize as string)
        : 12;

      const result = await storage.getProducts({
        search,
        category,
        page,
        pageSize,
      });
      res.json(result);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  app.get(`${apiPrefix}/products/:id`, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id))
        return res.status(400).json({ message: "Invalid product ID" });
      const product = await storage.getProductById(id);
      if (!product)
        return res.status(404).json({ message: "Product not found" });
      res.json(product);
    } catch (error) {
      console.error("Error fetching product:", error);
      res.status(500).json({ message: "Failed to fetch product" });
    }
  });

  app.post(`${apiPrefix}/products`, async (req, res) => {
    try {
      const validation = insertProductSchema.safeParse(req.body);
      if (!validation.success) {
        return res
          .status(400)
          .json({
            message: "Invalid product data",
            errors: validation.error.errors,
          });
      }
      const product = await storage.createProduct(validation.data);
      res.status(201).json(product);
    } catch (error) {
      console.error("Error creating product:", error);
      res.status(500).json({ message: "Failed to create product" });
    }
  });

  app.put(`${apiPrefix}/products/:id`, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id))
        return res.status(400).json({ message: "Invalid product ID" });
      const product = await storage.updateProduct(id, req.body);
      if (!product)
        return res.status(404).json({ message: "Product not found" });
      res.json(product);
    } catch (error) {
      console.error("Error updating product:", error);
      res.status(500).json({ message: "Failed to update product" });
    }
  });

  app.delete(`${apiPrefix}/products/:id`, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id))
        return res.status(400).json({ message: "Invalid product ID" });
      const success = await storage.deleteProduct(id);
      if (!success)
        return res.status(404).json({ message: "Product not found" });
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting product:", error);
      res.status(500).json({ message: "Failed to delete product" });
    }
  });

  // --- Script Routes ---
  app.get(`${apiPrefix}/scripts/current`, async (_req, res) => {
    try {
      const script = await storage.getCurrentScript();
      if (!script)
        return res.status(404).json({ message: "No current script found" });
      res.json(script);
    } catch (error) {
      console.error("Error fetching current script:", error);
      res.status(500).json({ message: "Failed to fetch current script" });
    }
  });

  app.post(
    `${apiPrefix}/scripts/upload`,
    upload.single("script"),
    async (req, res) => {
      try {
        if (!req.file)
          return res.status(400).json({ message: "No file uploaded" });
        console.log(
          `Processing uploaded file: ${req.file.originalname}, MIME: ${req.file.mimetype}`,
        );

        const parsedScript = await extractScriptFromPdf(
          req.file.buffer,
          req.file.mimetype,
        );
        const script = await storage.createScript({
          title: parsedScript.title,
          content: parsedScript.content,
        });

        const createdScenes: DbScene[] = [];
        for (const sceneData of parsedScript.scenes) {
          const newScene = await storage.createScene({
            scriptId: script.id,
            sceneNumber: sceneData.sceneNumber,
            heading: sceneData.heading,
            content: sceneData.content,
          });
          createdScenes.push(newScene);
        }
        console.log(
          `Created ${createdScenes.length} scenes. Analyzing for brandability...`,
        );

        const analysisResult = await identifyBrandableScenesWithGemini(
          createdScenes,
          5,
        );
        for (const brandable of analysisResult.brandableScenes) {
          await storage.updateScene(brandable.sceneId, {
            isBrandable: true,
            brandableReason: brandable.reason,
            suggestedCategories: brandable.suggestedProducts,
          });
        }
        console.log(
          `Analysis complete. ${analysisResult.brandableScenes.length} scenes marked as brandable.`,
        );
        res
          .status(201)
          .json({
            script,
            scenesCount: createdScenes.length,
            brandableScenesCount: analysisResult.brandableScenes.length,
          });
      } catch (error: any) {
        console.error(
          "Error processing script upload:",
          error.message || error,
        );
        res
          .status(500)
          .json({ message: `Failed to process script: ${error.message}` });
      }
    },
  );

  app.get(`${apiPrefix}/scripts/scenes`, async (_req, res) => {
    try {
      const script = await storage.getCurrentScript();
      if (!script)
        return res.status(404).json({ message: "No current script found" });
      const scenes = await storage.getScenesByScriptId(script.id);
      res.json(scenes);
    } catch (error) {
      console.error("Error fetching scenes:", error);
      res.status(500).json({ message: "Failed to fetch scenes" });
    }
  });

  app.get(`${apiPrefix}/scripts/brandable-scenes`, async (_req, res) => {
    try {
      const script = await storage.getCurrentScript();
      if (!script)
        return res.status(404).json({ message: "No current script found" });
      const brandableScenes = await storage.getBrandableScenes(script.id);
      res.json(brandableScenes);
    } catch (error) {
      console.error("Error fetching brandable scenes:", error);
      res.status(500).json({ message: "Failed to fetch brandable scenes" });
    }
  });

  app.put(`${apiPrefix}/scripts/save`, async (req, res) => {
    try {
      const { scriptId } = req.body;
      if (!scriptId)
        return res.status(400).json({ message: "Script ID is required" });
      const script = await storage.updateScript(scriptId, {
        updatedAt: new Date(),
      }); // Only update timestamp
      if (!script) return res.status(404).json({ message: "Script not found" });
      res.json(script);
    } catch (error) {
      console.error("Error saving script (updating timestamp):", error);
      res.status(500).json({ message: "Failed to save script" });
    }
  });

  app.post(`${apiPrefix}/scripts/analyze`, async (req, res) => {
    try {
      const { scriptId } = req.body;
      if (!scriptId)
        return res.status(400).json({ message: "Script ID is required" });
      const script = await storage.getScriptById(scriptId);
      if (!script) return res.status(404).json({ message: "Script not found" });

      const scenes = await storage.getScenesByScriptId(scriptId);
      if (scenes.length === 0)
        return res.json({
          brandableScenesCount: 0,
          message: "No scenes to analyze.",
        });

      for (const scene of scenes) {
        await storage.updateScene(scene.id, {
          isBrandable: false,
          brandableReason: null,
          suggestedCategories: null,
        });
      }

      const analysisResult = await identifyBrandableScenesWithGemini(scenes, 5);
      for (const brandable of analysisResult.brandableScenes) {
        await storage.updateScene(brandable.sceneId, {
          isBrandable: true,
          brandableReason: brandable.reason,
          suggestedCategories: brandable.suggestedProducts,
        });
      }
      res.json({ brandableScenesCount: analysisResult.brandableScenes.length });
    } catch (error: any) {
      console.error("Error re-analyzing script:", error.message || error);
      res
        .status(500)
        .json({ message: `Failed to re-analyze script: ${error.message}` });
    }
  });

  app.post(`${apiPrefix}/scripts/generate-placements`, async (_req, res) => {
    try {
      console.time('generate-placements-total'); // Performance tracking
      const script = await storage.getCurrentScript();
      if (!script)
        return res.status(404).json({ message: "No current script found" });

      // Step 1: Ensure we have brandable scenes, or identify them if needed
      console.log("Step 1: Identifying brandable scenes...");
      console.time('identify-brandable-scenes');
      let brandableDbScenes = await storage.getBrandableScenes(script.id);
      
      if (brandableDbScenes.length === 0) {
        console.log("No brandable scenes marked. Running AI analysis to identify them.");
        const allScenes = await storage.getScenesByScriptId(script.id);
        
        // Use our optimized Gemini function for faster, more accurate analysis
        const analysisResult = await identifyBrandableScenesWithGemini(
          allScenes,
          5, // Target 5 best scenes for product placement
        );
        
        console.log(`AI identified ${analysisResult.brandableScenes.length} brandable scenes`);
        
        // Update scenes with brandable flags and categories
        const updatePromises = analysisResult.brandableScenes.map(brandable => 
          storage.updateScene(brandable.sceneId, {
            isBrandable: true,
            brandableReason: brandable.reason,
            suggestedCategories: brandable.suggestedProducts,
          })
        );
        
        await Promise.all(updatePromises);
        brandableDbScenes = await storage.getBrandableScenes(script.id);
      }
      console.timeEnd('identify-brandable-scenes');

      // Select top scenes to process (limit to 5 for reasonable processing time)
      const scenesToProcess = brandableDbScenes.slice(0, 5);
      if (scenesToProcess.length === 0) {
        return res.json({
          success: true,
          brandableScenesCount: 0,
          generatedVariations: [],
          message: "No brandable scenes were identified for product placement.",
        });
      }
      
      // Step 2: Clean up any existing variations for these scenes
      console.log("Step 2: Cleaning up existing variations...");
      console.time('cleanup-existing-variations');
      
      const cleanupPromises = scenesToProcess.map(async (scene) => {
        const existingVariations = await storage.getSceneVariations(scene.id);
        const deletePromises = existingVariations.map(variation => 
          storage.deleteSceneVariation(variation.id)
        );
        await Promise.all(deletePromises);
      });
      
      await Promise.all(cleanupPromises);
      console.timeEnd('cleanup-existing-variations');
      
      // Step 3: Generate and save new variations with optimized pipeline
      console.log(`Step 3: Generating optimized product placements for ${scenesToProcess.length} scenes...`);
      console.time('generate-all-variations');
      
      // Process scenes in parallel for better performance
      const generationPromises = scenesToProcess.map(async (scene) => {
        console.time(`generate-scene-${scene.id}`);
        const singleSceneVariations = await _generateAndSaveSceneVariationsForRoute(
          scene.id,
          storage,
          generateProductPlacement,
        );
        console.timeEnd(`generate-scene-${scene.id}`);
        
        return {
          sceneId: scene.id,
          sceneNumber: scene.sceneNumber,
          heading: scene.heading,
          variations: singleSceneVariations,
        };
      });
      
      const allGeneratedVariationsResponse = await Promise.all(generationPromises);
      console.timeEnd('generate-all-variations');
      
      // Step 4: Return the results
      console.timeEnd('generate-placements-total');
      
      // Count total successful variations
      const totalVariations = allGeneratedVariationsResponse.reduce(
        (sum, sceneData) => sum + sceneData.variations.length, 0
      );
      
      console.log(`Successfully generated ${totalVariations} variations across ${scenesToProcess.length} scenes`);
      
      res.json({
        success: true,
        brandableScenesCount: scenesToProcess.length,
        totalVariations: totalVariations,
        generatedVariations: allGeneratedVariationsResponse,
        message: `Successfully generated ${totalVariations} placement options for ${scenesToProcess.length} scenes.`
      });
    } catch (error: any) {
      console.error(
        "Error in /generate-placements endpoint:",
        error.message || error,
      );
      res.status(500).json({
        message: `Failed to generate product placements: ${error.message}`,
      });
    }
  });

  app.get(`${apiPrefix}/scripts/scene-variations`, async (req, res) => {
    try {
      const sceneId = req.query.sceneId
        ? parseInt(req.query.sceneId as string)
        : null;
      if (!sceneId)
        return res.status(400).json({ message: "Scene ID is required" });

      const scene = await storage.getSceneById(sceneId);
      if (!scene) return res.status(404).json({ message: "Scene not found" });

      let variations = await storage.getSceneVariations(sceneId);
      
      // Generate variations on demand if none exist and the scene is brandable
      if (variations.length === 0 && scene.isBrandable) {
        console.log(
          `No variations for brandable scene ${sceneId}, generating on-demand with optimized pipeline.`,
        );
        console.time('on-demand-variation-generation');
        
        // Ensure we have suggested product categories
        if (!scene.suggestedCategories || !scene.suggestedCategories.length) {
          console.log("Scene has no suggested categories. Updating scene analysis first.");
          // Get just this one scene's analysis to avoid reanalyzing all scenes
          const scenesWithThisOne = [scene];
          
          try {
            const analysisResult = await identifyBrandableScenesWithGemini(
              scenesWithThisOne,
              1
            );
            
            if (analysisResult.brandableScenes.length > 0) {
              const brandable = analysisResult.brandableScenes[0];
              await storage.updateScene(scene.id, {
                brandableReason: brandable.reason,
                suggestedCategories: brandable.suggestedProducts,
              });
              
              // Refresh scene with updated categories
              const updatedScene = await storage.getSceneById(sceneId);
              if (updatedScene) scene = updatedScene;
            }
          } catch (analysisError) {
            console.error("Error analyzing scene for suggested categories:", analysisError);
            // Continue - we'll use general product selection if categories couldn't be determined
          }
        }
        
        // Use the optimized variation generation
        variations = await _generateAndSaveSceneVariationsForRoute(
          sceneId,
          storage,
          generateProductPlacement
        );
        
        console.timeEnd('on-demand-variation-generation');
        console.log(`Generated ${variations.length} variations on-demand for scene ${scene.sceneNumber}`);
      }
      
      res.json(variations);
    } catch (error: any) {
      console.error(
        "Error fetching/generating scene variations:",
        error.message || error,
      );
      res.status(500).json({
        message: `Failed to fetch/generate scene variations: ${error.message}`,
      });
    }
  });

  app.put(`${apiPrefix}/scripts/variations/select`, async (req, res) => {
    try {
      const { variationId } = req.body;
      if (!variationId)
        return res.status(400).json({ message: "Variation ID is required" });
      const selectedVariation = await storage.selectVariation(variationId);
      if (!selectedVariation)
        return res
          .status(404)
          .json({ message: "Variation not found or failed to select" });
      res.json({ success: true, selectedVariation });
    } catch (error) {
      console.error("Error selecting variation:", error);
      res.status(500).json({ message: "Failed to select variation" });
    }
  });

  // --- Location Routes ---
  app.get(`${apiPrefix}/locations`, async (req, res) => {
    try {
      const search = req.query.search as string | undefined;
      const country = req.query.country as string | undefined;
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const pageSize = req.query.pageSize
        ? parseInt(req.query.pageSize as string)
        : 10;

      const result = await storage.getLocations({
        search,
        country,
        page,
        pageSize,
      });
      res.json(result);
    } catch (error) {
      console.error("Error fetching locations:", error);
      res.status(500).json({ message: "Failed to fetch locations" });
    }
  });

  app.get(`${apiPrefix}/locations/countries`, async (_req, res) => {
    try {
      const countries = await storage.getDistinctLocationCountries();
      res.json(countries);
    } catch (error) {
      console.error("Error fetching distinct location countries:", error);
      res
        .status(500)
        .json({ message: "Failed to fetch distinct location countries" });
    }
  });

  app.get(`${apiPrefix}/locations/:id`, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id))
        return res.status(400).json({ message: "Invalid location ID" });
      const location = await storage.getLocationById(id);
      if (!location)
        return res.status(404).json({ message: "Location not found" });
      res.json(location);
    } catch (error) {
      console.error("Error fetching location:", error);
      res.status(500).json({ message: "Failed to fetch location" });
    }
  });

  app.post(`${apiPrefix}/locations`, async (req, res) => {
    try {
      const validation = insertLocationSchema.safeParse(req.body);
      if (!validation.success) {
        return res
          .status(400)
          .json({
            message: "Invalid location data",
            errors: validation.error.errors,
          });
      }
      const location = await storage.createLocation(validation.data);
      res.status(201).json(location);
    } catch (error) {
      console.error("Error creating location:", error);
      res.status(500).json({ message: "Failed to create location" });
    }
  });

  app.put(`${apiPrefix}/locations/:id`, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id))
        return res.status(400).json({ message: "Invalid location ID" });
      const location = await storage.updateLocation(id, req.body);
      if (!location)
        return res.status(404).json({ message: "Location not found" });
      res.json(location);
    } catch (error) {
      console.error("Error updating location:", error);
      res.status(500).json({ message: "Failed to update location" });
    }
  });

  app.delete(`${apiPrefix}/locations/:id`, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id))
        return res.status(400).json({ message: "Invalid location ID" });
      const success = await storage.deleteLocation(id);
      if (!success)
        return res.status(404).json({ message: "Location not found" });
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting location:", error);
      res.status(500).json({ message: "Failed to delete location" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
