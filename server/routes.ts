// server/routes.ts
import type { Express } from "express";
import { createServer, type Server } from "http";
import * as storage from "./storage";
import multer from "multer";
import { extractScriptFromPdf } from "./services/pdf-service";
import {
  generateProductPlacement,
  generateVideoFromVariation,
  getPredictionStatus,
} from "./services/replicate-service";
import {
  identifyBrandableScenesWithGemini,
  AIAnalysisResponseForRoutes,
} from "./services/file-upload-service";
import { z } from "zod";
import {
  insertProductSchema,
  insertActorSchema,
  insertLocationSchema,
  ProductCategory,
  Product as DbProduct,
  Scene as DbScene,
  Actor as DbActor,
  Location as DbLocation,
  SceneVariation,
  Product,
  Script, // Import Script type
} from "@shared/schema";

// --- Interfaces ---
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

interface ExportData {
  script: {
    id: number;
    title: string;
    createdAt: Date;
    updatedAt: Date;
  };
  placements: {
    sceneId: number;
    sceneNumber: number;
    sceneHeading: string;
    selectedProduct: {
      id: number;
      companyName: string;
      name: string;
      category: string;
      imageUrl: string;
    } | null;
    selectedVariationImageUrl: string | null;
  }[];
}

// --- Utility Functions ---
const sanitizeString = (str: string): string => {
  if (!str) return "";
  return str.replace(/\u0000/g, "").replace(/[^\x20-\x7E\u0080-\uFFFF]/g, "");
};

// --- Multer Setup ---
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024, // Increased limit slightly to 15MB just in case
  },
});

// --- Helper: _generateAndSaveSceneVariationsForRoute ---
async function _generateAndSaveSceneVariationsForRoute(
  sceneId: number,
  storageModule: typeof storage,
  generateProductPlacementFn: typeof generateProductPlacement,
): Promise<SceneVariationWithProductInfo[]> {
  console.log(
    `[_generateAndSaveSceneVariationsForRoute] Starting generation for Scene ID: ${sceneId}`,
  ); // LOG START
  try {
    // Find scene
    console.log(
      `[_generateAndSaveSceneVariationsForRoute] Fetching scene ${sceneId}`,
    );
    const scene = await storageModule.getSceneById(sceneId);
    if (!scene) {
      console.error(
        `[_generateAndSaveSceneVariationsForRoute] Scene ${sceneId} not found.`,
      );
      return [];
    }
    console.log(
      `[_generateAndSaveSceneVariationsForRoute] Found Scene ${scene.sceneNumber}: ${scene.heading}`,
    );

    // Find products
    let selectedProducts: DbProduct[] = [];
    const categories = scene.suggestedCategories as
      | ProductCategory[]
      | undefined;
    console.log(
      `[_generateAndSaveSceneVariationsForRoute] Suggested categories for Scene ${sceneId}:`,
      categories,
    );

    if (categories && categories.length > 0) {
      try {
        console.log(
          `[_generateAndSaveSceneVariationsForRoute] Fetching top products for Scene ${sceneId}`,
        );
        selectedProducts = await storageModule.getTopMatchingProductsForScene(
          sceneId,
          categories,
          3,
        );
        console.log(
          `[_generateAndSaveSceneVariationsForRoute] Selected ${selectedProducts.length} products for Scene ${scene.sceneNumber} based on categories.`,
        );
      } catch (e) {
        console.error(
          `[_generateAndSaveSceneVariationsForRoute] Error getting products for scene ${sceneId}:`,
          e,
        );
        // Fallback: Get recent products if category search fails
        console.log(
          `[_generateAndSaveSceneVariationsForRoute] Falling back to recent products for Scene ${sceneId}`,
        );
        const recentProducts = await storageModule.getProducts({ pageSize: 3 });
        selectedProducts = recentProducts.products;
      }
    } else {
      // Fallback: Get recent products if no categories
      console.log(
        `[_generateAndSaveSceneVariationsForRoute] No categories for scene ${sceneId}, selecting recent products.`,
      );
      const recentProducts = await storageModule.getProducts({ pageSize: 3 });
      selectedProducts = recentProducts.products;
    }
    console.log(
      `[_generateAndSaveSceneVariationsForRoute] Products selected for Scene ${sceneId}:`,
      selectedProducts.map((p) => p.name),
    );

    if (selectedProducts.length === 0) {
      console.log(
        `[_generateAndSaveSceneVariationsForRoute] No products found for scene ${scene.sceneNumber} (ID: ${sceneId}). Skipping variation generation.`,
      );
      return [];
    }

    // Generate variations in parallel
    console.log(
      `[_generateAndSaveSceneVariationsForRoute] Starting parallel generation for ${selectedProducts.length} variations for Scene ${sceneId}`,
    );
    const variationPromises = selectedProducts.map(async (product, i) => {
      const variationNumber = i + 1;
      const logPrefix = `[_generateAndSaveSceneVariationsForRoute] S${scene.sceneNumber}V${variationNumber} (P:${product.name}, ID:${product.id}) -`;
      try {
        console.log(`${logPrefix} Starting image generation...`);
        console.time(`${logPrefix} Replicate Call`); // Time Replicate call
        const generationResult = await generateProductPlacementFn({
          scene,
          product,
          variationNumber,
        });
        console.timeEnd(`${logPrefix} Replicate Call`); // End timer

        if (!generationResult.success) {
          console.warn(
            `${logPrefix} Image generation failed. Using fallback: ${generationResult.imageUrl}`,
          );
        } else {
          console.log(
            `${logPrefix} Image generation succeeded. URL: ${generationResult.imageUrl.substring(0, 50)}...`,
          );
        }

        // Sanitize data before inserting
        const cleanDescription = sanitizeString(generationResult.description);
        const cleanImageUrl = sanitizeString(generationResult.imageUrl);

        const variationData = {
          sceneId,
          productId: product.id,
          variationNumber,
          description: cleanDescription,
          imageUrl: cleanImageUrl,
          isSelected: false, // Default to false
        };

        console.log(`${logPrefix} Creating variation record in DB...`);
        console.time(`${logPrefix} DB Insert`);
        const newVariation =
          await storageModule.createSceneVariation(variationData);
        console.timeEnd(`${logPrefix} DB Insert`);
        console.log(
          `${logPrefix} Variation record created (ID: ${newVariation.id}).`,
        );

        // Return full info
        return {
          ...(newVariation as BaseSceneVariation),
          productName: product.name,
          productCategory: product.category,
          productImageUrl: product.imageUrl,
        };
      } catch (error) {
        console.error(
          `${logPrefix} Error during variation generation or saving:`,
          error,
        );
        return null; // Indicate failure for this variation
      }
    });

    console.log(
      `[_generateAndSaveSceneVariationsForRoute] Waiting for all variation promises for Scene ${sceneId} to resolve...`,
    );
    const results = await Promise.all(variationPromises);
    console.log(
      `[_generateAndSaveSceneVariationsForRoute] All variation promises resolved for Scene ${sceneId}.`,
    );

    const successfulVariations = results.filter(
      (v): v is SceneVariationWithProductInfo => v !== null,
    ); // Filter out nulls

    console.log(
      `[_generateAndSaveSceneVariationsForRoute] Generated ${successfulVariations.length} variations successfully for scene ${scene.sceneNumber}.`,
    );
    return successfulVariations;
  } catch (outerError) {
    // Catch errors happening before the Promise.all (e.g., fetching scene, fetching products)
    console.error(
      `[_generateAndSaveSceneVariationsForRoute] CRITICAL ERROR during setup for Scene ID ${sceneId}:`,
      outerError,
    );
    return []; // Return empty array on major error
  }
}

// --- Routes Registration ---
export async function registerRoutes(app: Express): Promise<Server> {
  const apiPrefix = "/api";

  // --- Actor Routes ---
  app.get(`${apiPrefix}/actors`, async (req, res) => {
    /* ... */
  });
  app.get(`${apiPrefix}/actors/distinct-nationalities`, async (_req, res) => {
    /* ... */
  });
  app.get(`${apiPrefix}/actors/:id`, async (req, res) => {
    /* ... */
  });
  app.post(`${apiPrefix}/actors`, async (req, res) => {
    /* ... */
  });
  app.put(`${apiPrefix}/actors/:id`, async (req, res) => {
    /* ... */
  });
  app.delete(`${apiPrefix}/actors/:id`, async (req, res) => {
    /* ... */
  });

  // --- Product Routes ---
  app.get(`${apiPrefix}/products`, async (req, res) => {
    /* ... */
  });
  app.get(`${apiPrefix}/products/:id`, async (req, res) => {
    /* ... */
  });
  app.post(`${apiPrefix}/products`, async (req, res) => {
    /* ... */
  });
  app.put(`${apiPrefix}/products/:id`, async (req, res) => {
    /* ... */
  });
  app.delete(`${apiPrefix}/products/:id`, async (req, res) => {
    /* ... */
  });

  // --- Location Routes ---
  app.get(`${apiPrefix}/locations`, async (req, res) => {
    /* ... */
  });
  app.get(`${apiPrefix}/locations/countries`, async (_req, res) => {
    /* ... */
  });
  app.get(`${apiPrefix}/locations/:id`, async (req, res) => {
    /* ... */
  });
  app.post(`${apiPrefix}/locations`, async (req, res) => {
    /* ... */
  });
  app.put(`${apiPrefix}/locations/:id`, async (req, res) => {
    /* ... */
  });
  app.delete(`${apiPrefix}/locations/:id`, async (req, res) => {
    /* ... */
  });

  // --- Script Routes ---
  app.get(`${apiPrefix}/scripts/current`, async (_req, res) => {
    try {
      const script = await storage.getCurrentScript();
      if (script) {
        res.json({
          id: script.id,
          title: script.title,
          createdAt: script.createdAt,
          updatedAt: script.updatedAt,
        });
      } else {
        res.status(404).json({ message: "No current script found" });
      }
    } catch (error) {
      console.error("Error fetching current script:", error);
      res.status(500).json({ message: "Failed to fetch current script" });
    }
  });

  app.post(
    `${apiPrefix}/scripts/upload`,
    upload.single("script"),
    async (req, res) => {
      let script: Script | null = null; // Keep track of the created script
      try {
        if (!req.file) {
          return res.status(400).json({ message: "No file uploaded" });
        }
        console.log(
          `Processing uploaded file: ${req.file.originalname}, MIME: ${req.file.mimetype}, Size: ${req.file.size}`,
        );

        // Step 1: Extract Content
        console.time("scriptExtraction");
        const parsedScript = await extractScriptFromPdf(
          req.file.buffer,
          req.file.mimetype,
        );
        console.timeEnd("scriptExtraction");
        console.log(
          "Sample text extracted from PDF:",
          parsedScript.content.substring(0, 100) + "...",
        );

        // Step 2: Create Script Record
        console.time("createScriptRecord");
        script = await storage.createScript({
          title: parsedScript.title,
          content: parsedScript.content, // Store full content
        });
        console.timeEnd("createScriptRecord");

        // Step 3: Create Scene Records
        console.time("createSceneRecords");
        const createdScenes: DbScene[] = [];
        for (const sceneData of parsedScript.scenes) {
          const newScene = await storage.createScene({
            scriptId: script.id,
            sceneNumber: sceneData.sceneNumber,
            heading: sceneData.heading,
            content: sceneData.content, // Store scene content
          });
          createdScenes.push(newScene);
        }
        console.timeEnd("createSceneRecords");
        console.log(`Created ${createdScenes.length} scenes.`);

        // Step 4: Analyze for Brandability
        console.time("geminiAnalysis");
        let analysisResult: AIAnalysisResponseForRoutes = {
          brandableScenes: [],
        };
        if (createdScenes.length > 0) {
          analysisResult = await identifyBrandableScenesWithGemini(
            createdScenes,
            5,
          );
          console.log(`Gemini analysis result:`, analysisResult); // Log full Gemini result

          // Step 5: Update Brandable Scenes in DB
          console.time("updateBrandableScenes");
          if (
            analysisResult.brandableScenes &&
            analysisResult.brandableScenes.length > 0
          ) {
            const updatePromises = analysisResult.brandableScenes.map(
              (brandable) =>
                storage
                  .updateScene(brandable.sceneId, {
                    isBrandable: true,
                    brandableReason: brandable.reason,
                    suggestedCategories: brandable.suggestedProducts,
                  })
                  .catch((updateError) => {
                    console.error(
                      `Failed to update scene ${brandable.sceneId} as brandable:`,
                      updateError,
                    );
                  }),
            );
            await Promise.all(updatePromises);
            console.log(
              `Updated ${analysisResult.brandableScenes.length} scenes as brandable.`,
            );
          } else {
            console.log(
              "Gemini did not identify any brandable scenes or returned an unexpected format.",
            );
          }
          console.timeEnd("updateBrandableScenes");
        } else {
          console.log("No scenes extracted, skipping brandability analysis.");
        }

        // Step 6: Send Simplified Success Response
        console.log("Script upload processed successfully.");
        res.status(201).json({
          script: {
            id: script.id,
            title: script.title,
            createdAt: script.createdAt,
            updatedAt: script.updatedAt,
          },
          scenesCount: createdScenes.length,
          brandableScenesCount: analysisResult.brandableScenes.length,
        });
      } catch (error: any) {
        const scriptIdInfo = script ? ` (Script ID: ${script.id})` : "";
        console.error(`Error processing script upload${scriptIdInfo}:`, error);
        console.error("Stack Trace:", error.stack);

        if (!res.headersSent) {
          res.status(500).json({
            message: `Failed to process script: ${error.message || "Unknown error"}`,
            errorDetails: error.toString(),
          });
        } else {
          console.error("Headers already sent, cannot send error response.");
          res.end();
        }
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
    /* ... */
  });
  app.post(`${apiPrefix}/scripts/analyze`, async (req, res) => {
    /* ... */
  });
  app.post(`${apiPrefix}/scripts/generate-placements`, async (_req, res) => {
    /* ... */
  });

  // --- GET Scene Variations (with On-Demand Generation Logic) ---
  app.get(`${apiPrefix}/scripts/scene-variations`, async (req, res) => {
    console.log(
      `[GET /scene-variations] Request received for sceneId: ${req.query.sceneId}`,
    );
    try {
      const sceneId = req.query.sceneId
        ? parseInt(req.query.sceneId as string)
        : null;
      if (!sceneId) {
        console.warn("[GET /scene-variations] Scene ID is required");
        return res.status(400).json({ message: "Scene ID is required" });
      }

      // Fetch the scene details first to check if it's brandable
      let scene = await storage.getSceneById(sceneId);
      if (!scene) {
        console.warn(
          `[GET /scene-variations] Scene not found for ID: ${sceneId}`,
        );
        return res.status(404).json({ message: "Scene not found" });
      }
      console.log(
        `[GET /scene-variations] Found scene ${scene.sceneNumber}, isBrandable: ${scene.isBrandable}`,
      );

      // Fetch existing variations
      console.log(
        `[GET /scene-variations] Fetching existing variations for scene ${sceneId}`,
      );
      let variations = await storage.getSceneVariations(sceneId);
      console.log(
        `[GET /scene-variations] Found ${variations.length} existing variations.`,
      );

      // Generate variations on demand ONLY if none exist AND the scene is brandable
      if (variations.length === 0 && scene.isBrandable) {
        console.log(
          `[GET /scene-variations] No variations for brandable scene ${sceneId}, generating on-demand...`,
        );
        console.time(`on-demand-variation-generation-scene-${sceneId}`);

        // Check for suggested categories, try to analyze if missing
        if (
          !scene.suggestedCategories ||
          scene.suggestedCategories.length === 0
        ) {
          console.log(
            `[GET /scene-variations] Scene ${sceneId} has no suggested categories. Analyzing...`,
          );
          try {
            const analysisResult = await identifyBrandableScenesWithGemini(
              [scene],
              1,
            ); // Analyze just this scene
            if (analysisResult.brandableScenes.length > 0) {
              const brandable = analysisResult.brandableScenes[0];
              console.log(
                `[GET /scene-variations] Re-analyzed scene ${sceneId}. New Categories:`,
                brandable.suggestedProducts,
              );
              await storage.updateScene(scene.id, {
                brandableReason: brandable.reason,
                suggestedCategories: brandable.suggestedProducts,
              });
              scene = await storage.getSceneById(sceneId); // Refresh scene data
              if (!scene)
                throw new Error(
                  "Scene disappeared after update during on-demand generation.",
                );
            } else {
              console.log(
                `[GET /scene-variations] Re-analysis did not yield categories for scene ${sceneId}.`,
              );
            }
          } catch (analysisError) {
            console.error(
              `[GET /scene-variations] Error analyzing scene ${sceneId} for categories:`,
              analysisError,
            );
            // Proceed without categories if analysis fails
          }
        }

        // Generate using the helper function (includes detailed logging)
        variations = await _generateAndSaveSceneVariationsForRoute(
          sceneId,
          storage,
          generateProductPlacement,
        );

        console.timeEnd(`on-demand-variation-generation-scene-${sceneId}`);
        console.log(
          `[GET /scene-variations] Generated ${variations.length} variations on-demand for scene ${scene.sceneNumber}.`,
        );
      }

      console.log(
        `[GET /scene-variations] Returning ${variations.length} variations for scene ${sceneId}.`,
      );
      res.json(variations);
    } catch (error: any) {
      console.error(
        "[GET /scene-variations] Error fetching/generating scene variations:",
        error,
      );
      res.status(500).json({
        message: `Failed to fetch/generate scene variations: ${error.message}`,
      });
    }
  });

  app.put(`${apiPrefix}/scripts/variations/select`, async (req, res) => {
    /* ... */
  });
  app.get(`${apiPrefix}/scripts/export`, async (req, res) => {
    /* ... */
  });

  // --- Video Generation Routes ---
  app.post(
    `${apiPrefix}/variations/:variationId/generate-video`,
    async (req, res) => {
      /* ... */
    },
  );
  app.get(
    `${apiPrefix}/replicate/predictions/:predictionId`,
    async (req, res) => {
      /* ... */
    },
  );

  const httpServer = createServer(app);
  return httpServer;
}
