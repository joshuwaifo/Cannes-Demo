import type { Express } from "express";
import { createServer, type Server } from "http";
import * as storage from "./storage";
import multer from "multer";
import { extractScriptFromPdf } from "./services/pdf-service";
import { analyzeBrandableScenes } from "./services/gemini-service";
import { generateProductPlacement } from "./services/replicate-service";
import { z } from "zod";
import { insertProductSchema } from "@shared/schema";

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  const apiPrefix = "/api";
  
  // --- Product Routes ---
  
  // Get products (with pagination and filtering)
  app.get(`${apiPrefix}/products`, async (req, res) => {
    try {
      const search = req.query.search as string | undefined;
      const category = req.query.category as string | undefined;
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string) : 12;
      
      const result = await storage.getProducts({ 
        search, 
        category,
        page,
        pageSize
      });
      
      res.json({
        products: result.products,
        totalPages: result.totalPages,
        currentPage: result.currentPage,
        totalCount: result.totalCount
      });
    } catch (error) {
      console.error('Error fetching products:', error);
      res.status(500).json({ message: 'Failed to fetch products' });
    }
  });
  
  // Get product by ID
  app.get(`${apiPrefix}/products/:id`, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid product ID' });
      }
      
      const product = await storage.getProductById(id);
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }
      
      res.json(product);
    } catch (error) {
      console.error('Error fetching product:', error);
      res.status(500).json({ message: 'Failed to fetch product' });
    }
  });
  
  // Create product
  app.post(`${apiPrefix}/products`, async (req, res) => {
    try {
      console.log('Received product data:', req.body);
      
      const validation = insertProductSchema.safeParse(req.body);
      
      if (!validation.success) {
        console.log('Validation failed:', validation.error.errors);
        return res.status(400).json({ 
          message: 'Invalid product data', 
          errors: validation.error.errors 
        });
      }
      
      console.log('Validation passed, creating product');
      const product = await storage.createProduct(req.body);
      console.log('Product created:', product);
      res.status(201).json(product);
    } catch (error) {
      console.error('Error creating product:', error);
      res.status(500).json({ message: 'Failed to create product' });
    }
  });
  
  // Update product
  app.put(`${apiPrefix}/products/:id`, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid product ID' });
      }
      
      const product = await storage.updateProduct(id, req.body);
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }
      
      res.json(product);
    } catch (error) {
      console.error('Error updating product:', error);
      res.status(500).json({ message: 'Failed to update product' });
    }
  });
  
  // Delete product
  app.delete(`${apiPrefix}/products/:id`, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid product ID' });
      }
      
      const success = await storage.deleteProduct(id);
      if (!success) {
        return res.status(404).json({ message: 'Product not found' });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting product:', error);
      res.status(500).json({ message: 'Failed to delete product' });
    }
  });
  
  // --- Script Routes ---
  
  // Get current script
  app.get(`${apiPrefix}/scripts/current`, async (req, res) => {
    try {
      const script = await storage.getCurrentScript();
      if (!script) {
        return res.status(404).json({ message: 'No script found' });
      }
      
      res.json(script);
    } catch (error) {
      console.error('Error fetching script:', error);
      res.status(500).json({ message: 'Failed to fetch script' });
    }
  });
  
  // Upload and process a script
  app.post(`${apiPrefix}/scripts/upload`, upload.single('script'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }
      
      console.log(`Processing uploaded file: ${req.file.originalname}, MIME type: ${req.file.mimetype}`);
      
      // Validate file type - now supporting PDF and various image formats
      const supportedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
      const fileType = req.file.mimetype;
      
      if (!supportedTypes.some(type => fileType.includes(type))) {
        return res.status(400).json({ 
          message: 'Uploaded file must be a PDF or an image (JPEG/PNG)' 
        });
      }
      
      // Extract script content from the file - pass the mime type to handle differently
      const parsedScript = await extractScriptFromPdf(req.file.buffer, req.file.mimetype);
      
      // Save script to database
      const script = await storage.createScript({
        title: parsedScript.title,
        content: parsedScript.content
      });
      
      // Process and save scenes
      const scenesPromises = parsedScript.scenes.map(scene => 
        storage.createScene({
          scriptId: script.id,
          sceneNumber: scene.sceneNumber,
          heading: scene.heading,
          content: scene.content,
          isBrandable: false,
          brandableReason: null,
          suggestedCategories: null
        })
      );
      
      const scenes = await Promise.all(scenesPromises);
      
      // Analyze scenes for brandable opportunities
      const brandableScenes = await analyzeBrandableScenes(scenes);
      
      // Update scenes with brandable information
      for (const brandable of brandableScenes.brandableScenes) {
        await storage.updateScene(brandable.sceneId, {
          isBrandable: true,
          brandableReason: brandable.reason,
          suggestedCategories: brandable.suggestedProducts
        });
      }
      
      res.status(201).json({
        script,
        scenesCount: scenes.length,
        brandableScenesCount: brandableScenes.brandableScenes.length
      });
    } catch (error) {
      console.error('Error processing script:', error);
      res.status(500).json({ message: 'Failed to process script' });
    }
  });
  
  // Get scenes for the current script
  app.get(`${apiPrefix}/scripts/scenes`, async (req, res) => {
    try {
      const script = await storage.getCurrentScript();
      if (!script) {
        return res.status(404).json({ message: 'No script found' });
      }
      
      const scenes = await storage.getScenesByScriptId(script.id);
      res.json(scenes);
    } catch (error) {
      console.error('Error fetching scenes:', error);
      res.status(500).json({ message: 'Failed to fetch scenes' });
    }
  });
  
  // Get brandable scenes for the current script
  app.get(`${apiPrefix}/scripts/brandable-scenes`, async (req, res) => {
    try {
      const script = await storage.getCurrentScript();
      if (!script) {
        return res.status(404).json({ message: 'No script found' });
      }
      
      const brandableScenes = await storage.getBrandableScenes(script.id);
      res.json(brandableScenes);
    } catch (error) {
      console.error('Error fetching brandable scenes:', error);
      res.status(500).json({ message: 'Failed to fetch brandable scenes' });
    }
  });
  
  // Save script changes
  app.put(`${apiPrefix}/scripts/save`, async (req, res) => {
    try {
      const { scriptId } = req.body;
      if (!scriptId) {
        return res.status(400).json({ message: 'Script ID is required' });
      }
      
      // We don't need to pass updatedAt as it's added automatically in the storage function
      const script = await storage.updateScript(scriptId, {});
      
      if (!script) {
        return res.status(404).json({ message: 'Script not found' });
      }
      
      res.json(script);
    } catch (error) {
      console.error('Error saving script:', error);
      res.status(500).json({ message: 'Failed to save script' });
    }
  });
  
  // Re-analyze script for brandable scenes
  app.post(`${apiPrefix}/scripts/analyze`, async (req, res) => {
    try {
      const { scriptId } = req.body;
      if (!scriptId) {
        return res.status(400).json({ message: 'Script ID is required' });
      }
      
      const script = await storage.getScriptById(scriptId);
      if (!script) {
        return res.status(404).json({ message: 'Script not found' });
      }
      
      // Get all scenes
      const scenes = await storage.getScenesByScriptId(scriptId);
      
      // Reset brandable status
      for (const scene of scenes) {
        await storage.updateScene(scene.id, {
          isBrandable: false,
          brandableReason: null,
          suggestedCategories: null
        });
      }
      
      // Re-analyze scenes
      const brandableScenes = await analyzeBrandableScenes(scenes);
      
      // Update scenes with new brandable information
      for (const brandable of brandableScenes.brandableScenes) {
        await storage.updateScene(brandable.sceneId, {
          isBrandable: true,
          brandableReason: brandable.reason,
          suggestedCategories: brandable.suggestedProducts
        });
      }
      
      res.json({
        brandableScenesCount: brandableScenes.brandableScenes.length
      });
    } catch (error) {
      console.error('Error analyzing script:', error);
      res.status(500).json({ message: 'Failed to analyze script' });
    }
  });
  
  // Identify brandable scenes and generate product placements
  app.post(`${apiPrefix}/scripts/generate-placements`, async (req, res) => {
    try {
      // Step 1: Get the current script
      const script = await storage.getCurrentScript();
      if (!script) {
        return res.status(404).json({ message: 'No script found' });
      }
      
      // Step 2: Get all scenes
      const scenes = await storage.getScenesByScriptId(script.id);
      
      // Step 3: Reset brandable status for all scenes
      for (const scene of scenes) {
        await storage.updateScene(scene.id, {
          isBrandable: false,
          brandableReason: null,
          suggestedCategories: null
        });
      }
      
      // Step 4: Analyze scenes with Gemini to identify brandable opportunities
      console.log('Analyzing scenes with Gemini AI...');
      const brandableScenes = await analyzeBrandableScenes(scenes);
      
      // Step 5: Update scenes with brandable information
      const brandableSceneIds = [];
      for (const brandable of brandableScenes.brandableScenes) {
        await storage.updateScene(brandable.sceneId, {
          isBrandable: true,
          brandableReason: brandable.reason,
          suggestedCategories: brandable.suggestedProducts
        });
        brandableSceneIds.push(brandable.sceneId);
      }
      
      console.log(`Identified ${brandableSceneIds.length} brandable scenes`);
      
      // Step 6: Get all products
      const products = await storage.getProducts();
      if (products.products.length === 0) {
        return res.status(404).json({ message: 'No products found in database' });
      }
      
      const generatedVariations = [];
      
      // Step 7: Generate up to 3 product placement variations for each brandable scene
      for (const sceneId of brandableSceneIds) {
        const scene = await storage.getSceneById(sceneId);
        if (!scene) continue;
        
        // Filter products by suggested categories
        const eligibleProducts = scene.suggestedCategories && scene.suggestedCategories.length > 0
          ? products.products.filter(p => scene.suggestedCategories?.includes(p.category))
          : products.products;
        
        // Select up to 3 products for variations
        const selectedProducts = eligibleProducts.slice(0, 3);
        
        if (selectedProducts.length === 0) {
          console.log(`No suitable products found for scene ${scene.sceneNumber}`);
          continue;
        }
        
        const sceneVariations = [];
        
        // Generate variations for each product
        for (let i = 0; i < selectedProducts.length; i++) {
          const product = selectedProducts[i];
          const variationNumber = i + 1;
          
          try {
            console.log(`Generating variation ${variationNumber} for scene ${scene.sceneNumber} with product ${product.name}...`);
            
            // Generate image and description using Replicate
            const generation = await generateProductPlacement({
              scene,
              product,
              variationNumber
            });
            
            // Save variation to database
            const variation = await storage.createSceneVariation({
              sceneId,
              productId: product.id,
              variationNumber,
              description: generation.description,
              imageUrl: generation.imageUrl,
              isSelected: false
            });
            
            // Add product information to variation
            sceneVariations.push({
              ...variation,
              productName: product.name,
              productCategory: product.category,
              productImageUrl: product.imageUrl
            });
          } catch (error) {
            console.error(`Error generating variation ${variationNumber} for scene ${scene.sceneNumber}:`, error);
            // Continue with other variations
          }
        }
        
        generatedVariations.push({
          sceneId,
          sceneNumber: scene.sceneNumber,
          heading: scene.heading,
          variations: sceneVariations
        });
      }
      
      res.json({
        success: true,
        brandableScenesCount: brandableSceneIds.length,
        generatedVariations
      });
    } catch (error) {
      console.error('Error generating placements:', error);
      res.status(500).json({ message: 'Failed to generate product placements' });
    }
  });
  
  // Get scene variations
  app.get(`${apiPrefix}/scripts/scene-variations`, async (req, res) => {
    try {
      const sceneId = req.query.sceneId ? parseInt(req.query.sceneId as string) : null;
      
      if (!sceneId) {
        return res.status(400).json({ message: 'Scene ID is required' });
      }
      
      const variations = await storage.getSceneVariations(sceneId);
      
      // If no variations exist, generate them
      if (variations.length === 0) {
        // Get scene details
        const scene = await storage.getSceneById(sceneId);
        if (!scene) {
          return res.status(404).json({ message: 'Scene not found' });
        }
        
        // Get products for suggested categories
        const products = await storage.getProducts();
        
        // Filter products by suggested categories (or use any if none specified)
        const eligibleProducts = scene.suggestedCategories && scene.suggestedCategories.length > 0
          ? products.products.filter(p => scene.suggestedCategories?.includes(p.category))
          : products.products;
        
        // Select up to 3 products for variations
        const selectedProducts = eligibleProducts.slice(0, 3);
        
        if (selectedProducts.length === 0) {
          return res.status(404).json({ message: 'No suitable products found for this scene' });
        }
        
        // Generate variations for each product
        const newVariations = [];
        
        for (let i = 0; i < selectedProducts.length; i++) {
          const product = selectedProducts[i];
          const variationNumber = i + 1;
          
          try {
            // Generate image and description
            const generation = await generateProductPlacement({
              scene,
              product,
              variationNumber
            });
            
            // Save variation to database
            const variation = await storage.createSceneVariation({
              sceneId,
              productId: product.id,
              variationNumber,
              description: generation.description,
              imageUrl: generation.imageUrl,
              isSelected: false
            });
            
            // Add product information to variation
            newVariations.push({
              ...variation,
              productName: product.name,
              productCategory: product.category,
              productImageUrl: product.imageUrl
            });
          } catch (error) {
            console.error(`Error generating variation ${variationNumber}:`, error);
            // Continue with other variations
          }
        }
        
        return res.json(newVariations);
      }
      
      res.json(variations);
    } catch (error) {
      console.error('Error fetching scene variations:', error);
      res.status(500).json({ message: 'Failed to fetch scene variations' });
    }
  });
  
  // Select a variation
  app.put(`${apiPrefix}/scripts/variations/select`, async (req, res) => {
    try {
      const { variationId } = req.body;
      if (!variationId) {
        return res.status(400).json({ message: 'Variation ID is required' });
      }
      
      const success = await storage.selectVariation(variationId);
      if (!success) {
        return res.status(404).json({ message: 'Variation not found' });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error selecting variation:', error);
      res.status(500).json({ message: 'Failed to select variation' });
    }
  });
  
  const httpServer = createServer(app);
  return httpServer;
}
