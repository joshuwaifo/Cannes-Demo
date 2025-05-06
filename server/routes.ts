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
      const validation = insertProductSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ 
          message: 'Invalid product data', 
          errors: validation.error.errors 
        });
      }
      
      const product = await storage.createProduct(req.body);
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
      
      // Validate file type
      if (!req.file.mimetype.includes('pdf')) {
        return res.status(400).json({ message: 'Uploaded file must be a PDF' });
      }
      
      // Extract script content from PDF
      const parsedScript = await extractScriptFromPdf(req.file.buffer);
      
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
          isBrandable: false
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
      
      const script = await storage.updateScript(scriptId, {
        updatedAt: new Date()
      });
      
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
