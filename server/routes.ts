import type { Express } from "express";
import { createServer, type Server } from "http";
import * as storage from "./storage";
import multer from "multer";
import { extractScriptFromPdf } from "./services/pdf-service";
import { generateProductPlacement } from "./services/replicate-service";
import { z } from "zod";
import { insertProductSchema, insertActorSchema, insertLocationSchema, ProductCategory } from "@shared/schema";

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
  productCategory: string;
  productImageUrl?: string | null;
}

// Basic Product interface for typing within the helper
interface Product {
  id: number;
  name: string;
  category: string;
  imageUrl?: string | null;
}

// Utility function to sanitize strings for database storage
const sanitizeString = (str: string): string => {
  if (!str) return "";
  // Replace null bytes and other invalid UTF-8 characters
  return str.replace(/\u0000/g, "").replace(/[^\x20-\x7E\u0080-\uFFFF]/g, "");
};

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
});

// Simple analyzer function for brandable scenes
interface AIAnalysisResult {
  brandableScenes: {
    sceneId: number;
    reason: string;
    suggestedProducts: ProductCategory[];
  }[];
}

// Analyzes scenes for brandable opportunities - simplified implementation
function analyzeBrandableScenes(scenes: any[]): AIAnalysisResult {
  const result: AIAnalysisResult = {
    brandableScenes: [],
  };

  // For each scene, check if it contains certain keywords that indicate it might be brandable
  for (const scene of scenes) {
    const content = scene.content.toLowerCase();
    
    // Very simple keyword-based analysis 
    if (content.includes('restaurant') || 
        content.includes('cafe') || 
        content.includes('coffee') || 
        content.includes('drink')) {
      result.brandableScenes.push({
        sceneId: scene.id,
        reason: 'Scene contains food or beverage references',
        suggestedProducts: [ProductCategory.BEVERAGE, ProductCategory.FOOD],
      });
    } else if (content.includes('car') || 
               content.includes('drive') || 
               content.includes('vehicle')) {
      result.brandableScenes.push({
        sceneId: scene.id,
        reason: 'Scene contains automotive references',
        suggestedProducts: [ProductCategory.AUTOMOTIVE],
      });
    } else if (content.includes('phone') || 
               content.includes('computer') || 
               content.includes('laptop')) {
      result.brandableScenes.push({
        sceneId: scene.id,
        reason: 'Scene contains technology references',
        suggestedProducts: [ProductCategory.ELECTRONICS],
      });
    } else if (content.includes('clothes') || 
               content.includes('wear') || 
               content.includes('dress')) {
      result.brandableScenes.push({
        sceneId: scene.id,
        reason: 'Scene contains fashion references',
        suggestedProducts: [ProductCategory.FASHION],
      });
    }
  }

  return result;
}

// Helper function to generate and save scene variations
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

  const productsResult = await storageModule.getProducts();
  const allProducts: Product[] = productsResult.products;

  if (allProducts.length === 0) {
    console.log(
      `No products found in database for generating variations for scene ${sceneId}.`,
    );
    return [];
  }

  const eligibleProducts =
    scene.suggestedCategories && scene.suggestedCategories.length > 0
      ? allProducts.filter((p: Product) =>
          scene.suggestedCategories?.includes(p.category),
        )
      : allProducts;

  const selectedProducts = eligibleProducts.slice(0, 3);

  if (selectedProducts.length === 0) {
    console.log(
      `No suitable products found for scene ${scene.sceneNumber} (ID: ${sceneId}).`,
    );
    return [];
  }

  const generatedVariations: SceneVariationWithProductInfo[] = [];
  for (let i = 0; i < selectedProducts.length; i++) {
    const product = selectedProducts[i];
    const variationNumber = i + 1;

    try {
      console.log(
        `Generating variation ${variationNumber} for scene ${scene.sceneNumber} (ID: ${sceneId}) with product ${product.name}...`,
      );
      const generation = await generateProductPlacementFn({
        scene,
        product,
        variationNumber,
      });

      const variation = await storageModule.createSceneVariation({
        sceneId,
        productId: product.id,
        variationNumber,
        description: sanitizeString(generation.description),
        imageUrl: sanitizeString(generation.imageUrl),
        isSelected: false,
      });

      generatedVariations.push({
        ...(variation as BaseSceneVariation),
        productName: product.name,
        productCategory: product.category,
        productImageUrl: product.imageUrl,
      });
    } catch (error) {
      console.error(
        `Error generating variation ${variationNumber} for scene ${scene.sceneNumber} (ID: ${sceneId}):`,
        error,
      );
      // Continue with other variations
    }
  }
  return generatedVariations;
}

export async function registerRoutes(app: Express): Promise<Server> {
  const apiPrefix = "/api";
  
  // --- Actor Routes ---
  
  // Get actors (with pagination and filtering)
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

      res.json({
        actors: result.actors,
        totalPages: result.totalPages,
        currentPage: result.currentPage,
        totalCount: result.totalCount,
      });
    } catch (error) {
      console.error("Error fetching actors:", error);
      res.status(500).json({ message: "Failed to fetch actors" });
    }
  });

  // Get actor by ID
  app.get(`${apiPrefix}/actors/:id`, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid actor ID" });
      }

      const actor = await storage.getActorById(id);
      if (!actor) {
        return res.status(404).json({ message: "Actor not found" });
      }

      res.json(actor);
    } catch (error) {
      console.error("Error fetching actor:", error);
      res.status(500).json({ message: "Failed to fetch actor" });
    }
  });

  // Create actor
  app.post(`${apiPrefix}/actors`, async (req, res) => {
    try {
      console.log("Received actor data:", req.body);

      const validation = insertActorSchema.safeParse(req.body);

      if (!validation.success) {
        console.log("Validation failed:", validation.error.errors);
        return res.status(400).json({
          message: "Invalid actor data",
          errors: validation.error.errors,
        });
      }

      console.log("Validation passed, creating actor");
      const actor = await storage.createActor(req.body);
      console.log("Actor created:", actor);
      res.status(201).json(actor);
    } catch (error) {
      console.error("Error creating actor:", error);
      res.status(500).json({ message: "Failed to create actor" });
    }
  });

  // Update actor
  app.put(`${apiPrefix}/actors/:id`, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid actor ID" });
      }

      const actor = await storage.updateActor(id, req.body);
      if (!actor) {
        return res.status(404).json({ message: "Actor not found" });
      }

      res.json(actor);
    } catch (error) {
      console.error("Error updating actor:", error);
      res.status(500).json({ message: "Failed to update actor" });
    }
  });

  // Delete actor
  app.delete(`${apiPrefix}/actors/:id`, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid actor ID" });
      }

      const success = await storage.deleteActor(id);
      if (!success) {
        return res.status(404).json({ message: "Actor not found" });
      }

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting actor:", error);
      res.status(500).json({ message: "Failed to delete actor" });
    }
  });

  // --- Product Routes ---

  // Get products (with pagination and filtering)
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

      res.json({
        products: result.products,
        totalPages: result.totalPages,
        currentPage: result.currentPage,
        totalCount: result.totalCount,
      });
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  // Get product by ID
  app.get(`${apiPrefix}/products/:id`, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid product ID" });
      }

      const product = await storage.getProductById(id);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      res.json(product);
    } catch (error) {
      console.error("Error fetching product:", error);
      res.status(500).json({ message: "Failed to fetch product" });
    }
  });

  // Create product
  app.post(`${apiPrefix}/products`, async (req, res) => {
    try {
      console.log("Received product data:", req.body);

      const validation = insertProductSchema.safeParse(req.body);

      if (!validation.success) {
        console.log("Validation failed:", validation.error.errors);
        return res.status(400).json({
          message: "Invalid product data",
          errors: validation.error.errors,
        });
      }

      console.log("Validation passed, creating product");
      const product = await storage.createProduct(req.body);
      console.log("Product created:", product);
      res.status(201).json(product);
    } catch (error) {
      console.error("Error creating product:", error);
      res.status(500).json({ message: "Failed to create product" });
    }
  });

  // Update product
  app.put(`${apiPrefix}/products/:id`, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid product ID" });
      }

      const product = await storage.updateProduct(id, req.body);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      res.json(product);
    } catch (error) {
      console.error("Error updating product:", error);
      res.status(500).json({ message: "Failed to update product" });
    }
  });

  // Delete product
  app.delete(`${apiPrefix}/products/:id`, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid product ID" });
      }

      const success = await storage.deleteProduct(id);
      if (!success) {
        return res.status(404).json({ message: "Product not found" });
      }

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting product:", error);
      res.status(500).json({ message: "Failed to delete product" });
    }
  });

  // --- Script Routes ---

  // Get current script
  app.get(`${apiPrefix}/scripts/current`, async (req, res) => {
    try {
      const script = await storage.getCurrentScript();
      if (!script) {
        return res.status(404).json({ message: "No script found" });
      }

      res.json(script);
    } catch (error) {
      console.error("Error fetching script:", error);
      res.status(500).json({ message: "Failed to fetch script" });
    }
  });

  // Upload and process a script
  app.post(
    `${apiPrefix}/scripts/upload`,
    upload.single("script"),
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ message: "No file uploaded" });
        }

        console.log(
          `Processing uploaded file: ${req.file.originalname}, MIME type: ${req.file.mimetype}`,
        );

        // Validate file type - now supporting PDF and various image formats
        const supportedTypes = [
          "application/pdf",
          "image/jpeg",
          "image/jpg",
          "image/png",
        ];
        const fileType = req.file.mimetype;

        if (!supportedTypes.some((type) => fileType.includes(type))) {
          return res.status(400).json({
            message: "Uploaded file must be a PDF or an image (JPEG/PNG)",
          });
        }

        // Extract script content from the file - pass the mime type to handle differently
        const parsedScript = await extractScriptFromPdf(
          req.file.buffer,
          req.file.mimetype,
        );

        // Save script to database
        const script = await storage.createScript({
          title: parsedScript.title,
          content: parsedScript.content,
        });

        // Process and save scenes
        const scenesPromises = parsedScript.scenes.map((scene) =>
          storage.createScene({
            scriptId: script.id,
            sceneNumber: scene.sceneNumber,
            heading: scene.heading,
            content: scene.content,
            isBrandable: false,
            brandableReason: null,
            suggestedCategories: null,
          }),
        );

        const scenes = await Promise.all(scenesPromises);

        // Analyze scenes for brandable opportunities
        const brandableScenes = await analyzeBrandableScenes(scenes);

        // Update scenes with brandable information
        for (const brandable of brandableScenes.brandableScenes) {
          await storage.updateScene(brandable.sceneId, {
            isBrandable: true,
            brandableReason: brandable.reason,
            suggestedCategories: brandable.suggestedProducts,
          });
        }

        res.status(201).json({
          script,
          scenesCount: scenes.length,
          brandableScenesCount: brandableScenes.brandableScenes.length,
        });
      } catch (error) {
        console.error("Error processing script:", error);
        res.status(500).json({ message: "Failed to process script" });
      }
    },
  );

  // Get scenes for the current script
  app.get(`${apiPrefix}/scripts/scenes`, async (req, res) => {
    try {
      const script = await storage.getCurrentScript();
      if (!script) {
        return res.status(404).json({ message: "No script found" });
      }

      const scenes = await storage.getScenesByScriptId(script.id);
      res.json(scenes);
    } catch (error) {
      console.error("Error fetching scenes:", error);
      res.status(500).json({ message: "Failed to fetch scenes" });
    }
  });

  // Get brandable scenes for the current script
  app.get(`${apiPrefix}/scripts/brandable-scenes`, async (req, res) => {
    try {
      const script = await storage.getCurrentScript();
      if (!script) {
        return res.status(404).json({ message: "No script found" });
      }

      const brandableScenes = await storage.getBrandableScenes(script.id);
      res.json(brandableScenes);
    } catch (error) {
      console.error("Error fetching brandable scenes:", error);
      res.status(500).json({ message: "Failed to fetch brandable scenes" });
    }
  });

  // Save script changes
  app.put(`${apiPrefix}/scripts/save`, async (req, res) => {
    try {
      const { scriptId } = req.body;
      if (!scriptId) {
        return res.status(400).json({ message: "Script ID is required" });
      }

      // We don't need to pass updatedAt as it's added automatically in the storage function
      const script = await storage.updateScript(scriptId, {});

      if (!script) {
        return res.status(404).json({ message: "Script not found" });
      }

      res.json(script);
    } catch (error) {
      console.error("Error saving script:", error);
      res.status(500).json({ message: "Failed to save script" });
    }
  });

  // Re-analyze script for brandable scenes
  app.post(`${apiPrefix}/scripts/analyze`, async (req, res) => {
    try {
      const { scriptId } = req.body;
      if (!scriptId) {
        return res.status(400).json({ message: "Script ID is required" });
      }

      const script = await storage.getScriptById(scriptId);
      if (!script) {
        return res.status(404).json({ message: "Script not found" });
      }

      // Get all scenes
      const scenes = await storage.getScenesByScriptId(scriptId);

      // Reset brandable status
      for (const scene of scenes) {
        await storage.updateScene(scene.id, {
          isBrandable: false,
          brandableReason: null,
          suggestedCategories: null,
        });
      }

      // Re-analyze scenes
      const brandableScenes = await analyzeBrandableScenes(scenes);

      // Update scenes with new brandable information
      for (const brandable of brandableScenes.brandableScenes) {
        await storage.updateScene(brandable.sceneId, {
          isBrandable: true,
          brandableReason: brandable.reason,
          suggestedCategories: brandable.suggestedProducts,
        });
      }

      res.json({
        brandableScenesCount: brandableScenes.brandableScenes.length,
      });
    } catch (error) {
      console.error("Error analyzing script:", error);
      res.status(500).json({ message: "Failed to analyze script" });
    }
  });

  // Identify brandable scenes and generate product placements
  app.post(`${apiPrefix}/scripts/generate-placements`, async (req, res) => {
    try {
      // Step 1: Get the current script
      const script = await storage.getCurrentScript();
      if (!script) {
        return res.status(404).json({ message: "No script found" });
      }

      // Step 2: Get all scenes
      const scenes = await storage.getScenesByScriptId(script.id);

      // Step 3: Reset brandable status for all scenes
      for (const scene of scenes) {
        await storage.updateScene(scene.id, {
          isBrandable: false,
          brandableReason: null,
          suggestedCategories: null,
        });
      }

      // Step 4: Analyze scenes with Gemini to identify brandable opportunities
      console.log("Analyzing scenes with Gemini AI...");
      const brandableScenesAnalysis = await analyzeBrandableScenes(scenes);

      // Step 5: Update scenes with brandable information
      const brandableSceneIds = [];
      for (const brandable of brandableScenesAnalysis.brandableScenes) {
        await storage.updateScene(brandable.sceneId, {
          isBrandable: true,
          brandableReason: brandable.reason,
          suggestedCategories: brandable.suggestedProducts,
        });
        brandableSceneIds.push(brandable.sceneId);
      }

      console.log(`Identified ${brandableSceneIds.length} brandable scenes`);

      // Step 6: Get all products (this is done inside the helper now)
      // const products = await storage.getProducts();
      // if (products.products.length === 0) {
      //   return res.status(404).json({ message: 'No products found in database' });
      // }

      // Step 6.5: Clear existing variations for all brandable scenes to avoid accumulation
      console.log("Clearing existing scene variations...");
      for (const sceneId of brandableSceneIds) {
        const existingVariations = await storage.getSceneVariations(sceneId);
        for (const variation of existingVariations) {
          await storage.deleteSceneVariation(variation.id);
        }
        console.log(
          `Cleared ${existingVariations.length} existing variations for scene ${sceneId}`,
        );
      }

      const allGeneratedVariationsResponse = [];

      // Step 7: Generate up to 3 product placement variations for each brandable scene
      for (const sceneId of brandableSceneIds) {
        const sceneDetails = await storage.getSceneById(sceneId);
        if (!sceneDetails) {
          console.warn(
            `Scene details not found for sceneId: ${sceneId} while constructing response.`,
          );
          continue;
        }

        const singleSceneVariations =
          await _generateAndSaveSceneVariationsForRoute(
            sceneId,
            storage,
            generateProductPlacement,
          );

        allGeneratedVariationsResponse.push({
          sceneId,
          sceneNumber: sceneDetails.sceneNumber,
          heading: sceneDetails.heading,
          variations: singleSceneVariations,
        });
      }

      res.json({
        success: true,
        brandableScenesCount: brandableSceneIds.length,
        generatedVariations: allGeneratedVariationsResponse,
      });
    } catch (error) {
      console.error("Error generating placements:", error);
      res
        .status(500)
        .json({ message: "Failed to generate product placements" });
    }
  });

  // Get scene variations
  app.get(`${apiPrefix}/scripts/scene-variations`, async (req, res) => {
    try {
      const sceneId = req.query.sceneId
        ? parseInt(req.query.sceneId as string)
        : null;

      if (!sceneId) {
        return res.status(400).json({ message: "Scene ID is required" });
      }

      const variations = await storage.getSceneVariations(sceneId);

      // If no variations exist, generate them using the helper
      if (variations.length === 0) {
        console.log(
          `No pre-existing variations for scene ${sceneId}, generating them now.`,
        );
        const newVariations = await _generateAndSaveSceneVariationsForRoute(
          sceneId,
          storage,
          generateProductPlacement,
        );
        return res.json(newVariations);
      }

      res.json(variations);
    } catch (error) {
      console.error("Error fetching scene variations:", error);
      res.status(500).json({ message: "Failed to fetch scene variations" });
    }
  });

  // Select a variation
  app.put(`${apiPrefix}/scripts/variations/select`, async (req, res) => {
    try {
      const { variationId } = req.body;
      if (!variationId) {
        return res.status(400).json({ message: "Variation ID is required" });
      }

      const success = await storage.selectVariation(variationId);
      if (!success) {
        return res.status(404).json({ message: "Variation not found" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error selecting variation:", error);
      res.status(500).json({ message: "Failed to select variation" });
    }
  });

  // --- Location Routes ---
  
  // Get locations (with pagination and filtering)
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

      res.json({
        locations: result.locations,
        totalPages: result.totalPages,
        currentPage: result.currentPage,
        totalCount: result.totalCount,
      });
    } catch (error) {
      console.error("Error fetching locations:", error);
      res.status(500).json({ message: "Failed to fetch locations" });
    }
  });
  
  // Get unique countries for filtering
  app.get(`${apiPrefix}/locations/countries`, async (req, res) => {
    try {
      const allLocations = await storage.getLocations({ pageSize: 1000 });
      const uniqueCountries = Array.from(
        new Set(allLocations.locations.map((loc) => loc.country))
      ).sort();
      
      res.json(uniqueCountries);
    } catch (error) {
      console.error("Error fetching countries:", error);
      res.status(500).json({ message: "Failed to fetch countries" });
    }
  });

  // Get location by ID
  app.get(`${apiPrefix}/locations/:id`, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid location ID" });
      }

      const location = await storage.getLocationById(id);
      if (!location) {
        return res.status(404).json({ message: "Location not found" });
      }

      res.json(location);
    } catch (error) {
      console.error("Error fetching location:", error);
      res.status(500).json({ message: "Failed to fetch location" });
    }
  });

  // Create location
  app.post(`${apiPrefix}/locations`, async (req, res) => {
    try {
      console.log("Received location data:", req.body);

      const validation = insertLocationSchema.safeParse(req.body);

      if (!validation.success) {
        console.log("Validation failed:", validation.error.errors);
        return res.status(400).json({
          message: "Invalid location data",
          errors: validation.error.errors,
        });
      }

      console.log("Validation passed, creating location");
      const location = await storage.createLocation(req.body);
      console.log("Location created:", location);
      res.status(201).json(location);
    } catch (error) {
      console.error("Error creating location:", error);
      res.status(500).json({ message: "Failed to create location" });
    }
  });

  // Update location
  app.put(`${apiPrefix}/locations/:id`, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid location ID" });
      }

      const location = await storage.updateLocation(id, req.body);
      if (!location) {
        return res.status(404).json({ message: "Location not found" });
      }

      res.json(location);
    } catch (error) {
      console.error("Error updating location:", error);
      res.status(500).json({ message: "Failed to update location" });
    }
  });

  // Delete location
  app.delete(`${apiPrefix}/locations/:id`, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid location ID" });
      }

      const success = await storage.deleteLocation(id);
      if (!success) {
        return res.status(404).json({ message: "Location not found" });
      }

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting location:", error);
      res.status(500).json({ message: "Failed to delete location" });
    }
  });
  


  const httpServer = createServer(app);
  return httpServer;
}
