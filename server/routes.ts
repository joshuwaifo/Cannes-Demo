// // server/routes.ts
// import type { Express } from "express";
// import { createServer, type Server } from "http";
// import * as storage from "./storage";
// import multer from "multer";
// import { extractScriptFromPdf } from "./services/pdf-service";
// import {
//   generateProductPlacement,
//   generateVideoFromVariation,
//   getPredictionStatus,
// } from "./services/replicate-service";
// import {
//   identifyBrandableScenesWithGemini,
//   AIAnalysisResponseForRoutes,
// } from "./services/file-upload-service";
// import { z } from "zod";
// import {
//   insertProductSchema,
//   insertActorSchema,
//   insertLocationSchema,
//   ProductCategory,
//   Product as DbProduct,
//   Scene as DbScene,
//   Actor as DbActor,
//   Location as DbLocation,
//   SceneVariation,
//   Product,
//   Script, // Import Script type
// } from "@shared/schema";

// // --- Interfaces ---
// interface BaseSceneVariation {
//   id: number;
//   sceneId: number;
//   productId: number;
//   variationNumber: number;
//   description: string;
//   imageUrl: string;
//   isSelected: boolean;
// }

// interface SceneVariationWithProductInfo extends BaseSceneVariation {
//   productName: string;
//   productCategory: string;
//   productImageUrl?: string | null;
// }

// interface ExportData {
//   script: {
//     id: number;
//     title: string;
//     createdAt: Date;
//     updatedAt: Date;
//   };
//   placements: {
//     sceneId: number;
//     sceneNumber: number;
//     sceneHeading: string;
//     selectedProduct: {
//       id: number;
//       companyName: string;
//       name: string;
//       category: string;
//       imageUrl: string;
//     } | null;
//     selectedVariationImageUrl: string | null;
//   }[];
// }

// // --- Utility Functions ---
// const sanitizeString = (str: string): string => {
//   if (!str) return "";
//   return str.replace(/\u0000/g, "").replace(/[^\x20-\x7E\u0080-\uFFFF]/g, "");
// };

// // --- Multer Setup ---
// const upload = multer({
//   storage: multer.memoryStorage(),
//   limits: {
//     fileSize: 15 * 1024 * 1024, // Increased limit slightly to 15MB just in case
//   },
// });

// // --- Helper: _generateAndSaveSceneVariationsForRoute ---
// async function _generateAndSaveSceneVariationsForRoute(
//   sceneId: number,
//   storageModule: typeof storage,
//   generateProductPlacementFn: typeof generateProductPlacement,
// ): Promise<SceneVariationWithProductInfo[]> {
//   console.log(
//     `[_generateAndSaveSceneVariationsForRoute] Starting generation for Scene ID: ${sceneId}`,
//   ); // LOG START
//   try {
//     // Find scene
//     console.log(
//       `[_generateAndSaveSceneVariationsForRoute] Fetching scene ${sceneId}`,
//     );
//     const scene = await storageModule.getSceneById(sceneId);
//     if (!scene) {
//       console.error(
//         `[_generateAndSaveSceneVariationsForRoute] Scene ${sceneId} not found.`,
//       );
//       return [];
//     }
//     console.log(
//       `[_generateAndSaveSceneVariationsForRoute] Found Scene ${scene.sceneNumber}: ${scene.heading}`,
//     );

//     // Find products
//     let selectedProducts: DbProduct[] = [];
//     const categories = scene.suggestedCategories as
//       | ProductCategory[]
//       | undefined;
//     console.log(
//       `[_generateAndSaveSceneVariationsForRoute] Suggested categories for Scene ${sceneId}:`,
//       categories,
//     );

//     if (categories && categories.length > 0) {
//       try {
//         console.log(
//           `[_generateAndSaveSceneVariationsForRoute] Fetching top products for Scene ${sceneId}`,
//         );
//         selectedProducts = await storageModule.getTopMatchingProductsForScene(
//           sceneId,
//           categories,
//           3,
//         );
//         console.log(
//           `[_generateAndSaveSceneVariationsForRoute] Selected ${selectedProducts.length} products for Scene ${scene.sceneNumber} based on categories.`,
//         );
//       } catch (e) {
//         console.error(
//           `[_generateAndSaveSceneVariationsForRoute] Error getting products for scene ${sceneId}:`,
//           e,
//         );
//         // Fallback: Get recent products if category search fails
//         console.log(
//           `[_generateAndSaveSceneVariationsForRoute] Falling back to recent products for Scene ${sceneId}`,
//         );
//         const recentProducts = await storageModule.getProducts({ pageSize: 3 });
//         selectedProducts = recentProducts.products;
//       }
//     } else {
//       // Fallback: Get recent products if no categories
//       console.log(
//         `[_generateAndSaveSceneVariationsForRoute] No categories for scene ${sceneId}, selecting recent products.`,
//       );
//       const recentProducts = await storageModule.getProducts({ pageSize: 3 });
//       selectedProducts = recentProducts.products;
//     }
//     console.log(
//       `[_generateAndSaveSceneVariationsForRoute] Products selected for Scene ${sceneId}:`,
//       selectedProducts.map((p) => p.name),
//     );

//     if (selectedProducts.length === 0) {
//       console.log(
//         `[_generateAndSaveSceneVariationsForRoute] No products found for scene ${scene.sceneNumber} (ID: ${sceneId}). Skipping variation generation.`,
//       );
//       return [];
//     }

//     // Generate variations in parallel
//     console.log(
//       `[_generateAndSaveSceneVariationsForRoute] Starting parallel generation for ${selectedProducts.length} variations for Scene ${sceneId}`,
//     );
//     const variationPromises = selectedProducts.map(async (product, i) => {
//       const variationNumber = i + 1;
//       const logPrefix = `[_generateAndSaveSceneVariationsForRoute] S${scene.sceneNumber}V${variationNumber} (P:${product.name}, ID:${product.id}) -`;
//       try {
//         console.log(`${logPrefix} Starting image generation...`);
//         console.time(`${logPrefix} Replicate Call`); // Time Replicate call
//         const generationResult = await generateProductPlacementFn({
//           scene,
//           product,
//           variationNumber,
//         });
//         console.timeEnd(`${logPrefix} Replicate Call`); // End timer

//         if (!generationResult.success) {
//           console.warn(
//             `${logPrefix} Image generation failed. Using fallback: ${generationResult.imageUrl}`,
//           );
//         } else {
//           console.log(
//             `${logPrefix} Image generation succeeded. URL: ${generationResult.imageUrl.substring(0, 50)}...`,
//           );
//         }

//         // Sanitize data before inserting
//         const cleanDescription = sanitizeString(generationResult.description);
//         const cleanImageUrl = sanitizeString(generationResult.imageUrl);

//         const variationData = {
//           sceneId,
//           productId: product.id,
//           variationNumber,
//           description: cleanDescription,
//           imageUrl: cleanImageUrl,
//           isSelected: false, // Default to false
//         };

//         console.log(`${logPrefix} Creating variation record in DB...`);
//         console.time(`${logPrefix} DB Insert`);
//         const newVariation =
//           await storageModule.createSceneVariation(variationData);
//         console.timeEnd(`${logPrefix} DB Insert`);
//         console.log(
//           `${logPrefix} Variation record created (ID: ${newVariation.id}).`,
//         );

//         // Return full info
//         return {
//           ...(newVariation as BaseSceneVariation),
//           productName: product.name,
//           productCategory: product.category,
//           productImageUrl: product.imageUrl,
//         };
//       } catch (error) {
//         console.error(
//           `${logPrefix} Error during variation generation or saving:`,
//           error,
//         );
//         return null; // Indicate failure for this variation
//       }
//     });

//     console.log(
//       `[_generateAndSaveSceneVariationsForRoute] Waiting for all variation promises for Scene ${sceneId} to resolve...`,
//     );
//     const results = await Promise.all(variationPromises);
//     console.log(
//       `[_generateAndSaveSceneVariationsForRoute] All variation promises resolved for Scene ${sceneId}.`,
//     );

//     const successfulVariations = results.filter(
//       (v): v is SceneVariationWithProductInfo => v !== null,
//     ); // Filter out nulls

//     console.log(
//       `[_generateAndSaveSceneVariationsForRoute] Generated ${successfulVariations.length} variations successfully for scene ${scene.sceneNumber}.`,
//     );
//     return successfulVariations;
//   } catch (outerError) {
//     // Catch errors happening before the Promise.all (e.g., fetching scene, fetching products)
//     console.error(
//       `[_generateAndSaveSceneVariationsForRoute] CRITICAL ERROR during setup for Scene ID ${sceneId}:`,
//       outerError,
//     );
//     return []; // Return empty array on major error
//   }
// }

// // --- Routes Registration ---
// export async function registerRoutes(app: Express): Promise<Server> {
//   const apiPrefix = "/api";

//   // --- Actor Routes ---
//   app.get(`${apiPrefix}/actors`, async (req, res) => {
//     /* ... */
//   });
//   app.get(`${apiPrefix}/actors/distinct-nationalities`, async (_req, res) => {
//     /* ... */
//   });
//   app.get(`${apiPrefix}/actors/:id`, async (req, res) => {
//     /* ... */
//   });
//   app.post(`${apiPrefix}/actors`, async (req, res) => {
//     /* ... */
//   });
//   app.put(`${apiPrefix}/actors/:id`, async (req, res) => {
//     /* ... */
//   });
//   app.delete(`${apiPrefix}/actors/:id`, async (req, res) => {
//     /* ... */
//   });

//   // --- Product Routes ---
//   app.get(`${apiPrefix}/products`, async (req, res) => {
//     /* ... */
//   });
//   app.get(`${apiPrefix}/products/:id`, async (req, res) => {
//     /* ... */
//   });
//   app.post(`${apiPrefix}/products`, async (req, res) => {
//     /* ... */
//   });
//   app.put(`${apiPrefix}/products/:id`, async (req, res) => {
//     /* ... */
//   });
//   app.delete(`${apiPrefix}/products/:id`, async (req, res) => {
//     /* ... */
//   });

//   // --- Location Routes ---
//   app.get(`${apiPrefix}/locations`, async (req, res) => {
//     /* ... */
//   });
//   app.get(`${apiPrefix}/locations/countries`, async (_req, res) => {
//     /* ... */
//   });
//   app.get(`${apiPrefix}/locations/:id`, async (req, res) => {
//     /* ... */
//   });
//   app.post(`${apiPrefix}/locations`, async (req, res) => {
//     /* ... */
//   });
//   app.put(`${apiPrefix}/locations/:id`, async (req, res) => {
//     /* ... */
//   });
//   app.delete(`${apiPrefix}/locations/:id`, async (req, res) => {
//     /* ... */
//   });

//   // --- Script Routes ---
//   app.get(`${apiPrefix}/scripts/current`, async (_req, res) => {
//     try {
//       const script = await storage.getCurrentScript();
//       if (script) {
//         res.json({
//           id: script.id,
//           title: script.title,
//           createdAt: script.createdAt,
//           updatedAt: script.updatedAt,
//         });
//       } else {
//         res.status(404).json({ message: "No current script found" });
//       }
//     } catch (error) {
//       console.error("Error fetching current script:", error);
//       res.status(500).json({ message: "Failed to fetch current script" });
//     }
//   });

//   app.post(
//     `${apiPrefix}/scripts/upload`,
//     upload.single("script"),
//     async (req, res) => {
//       let script: Script | null = null; // Keep track of the created script
//       try {
//         if (!req.file) {
//           return res.status(400).json({ message: "No file uploaded" });
//         }
//         console.log(
//           `Processing uploaded file: ${req.file.originalname}, MIME: ${req.file.mimetype}, Size: ${req.file.size}`,
//         );

//         // Step 1: Extract Content
//         console.time("scriptExtraction");
//         const parsedScript = await extractScriptFromPdf(
//           req.file.buffer,
//           req.file.mimetype,
//         );
//         console.timeEnd("scriptExtraction");
//         console.log(
//           "Sample text extracted from PDF:",
//           parsedScript.content.substring(0, 100) + "...",
//         );

//         // Step 2: Create Script Record
//         console.time("createScriptRecord");
//         script = await storage.createScript({
//           title: parsedScript.title,
//           content: parsedScript.content, // Store full content
//         });
//         console.timeEnd("createScriptRecord");

//         // Step 3: Create Scene Records
//         console.time("createSceneRecords");
//         const createdScenes: DbScene[] = [];
//         for (const sceneData of parsedScript.scenes) {
//           const newScene = await storage.createScene({
//             scriptId: script.id,
//             sceneNumber: sceneData.sceneNumber,
//             heading: sceneData.heading,
//             content: sceneData.content, // Store scene content
//           });
//           createdScenes.push(newScene);
//         }
//         console.timeEnd("createSceneRecords");
//         console.log(`Created ${createdScenes.length} scenes.`);

//         // Step 4: Analyze for Brandability
//         console.time("geminiAnalysis");
//         let analysisResult: AIAnalysisResponseForRoutes = {
//           brandableScenes: [],
//         };
//         if (createdScenes.length > 0) {
//           analysisResult = await identifyBrandableScenesWithGemini(
//             createdScenes,
//             5,
//           );
//           console.log(`Gemini analysis result:`, analysisResult); // Log full Gemini result

//           // Step 5: Update Brandable Scenes in DB
//           console.time("updateBrandableScenes");
//           if (
//             analysisResult.brandableScenes &&
//             analysisResult.brandableScenes.length > 0
//           ) {
//             const updatePromises = analysisResult.brandableScenes.map(
//               (brandable) =>
//                 storage
//                   .updateScene(brandable.sceneId, {
//                     isBrandable: true,
//                     brandableReason: brandable.reason,
//                     suggestedCategories: brandable.suggestedProducts,
//                   })
//                   .catch((updateError) => {
//                     console.error(
//                       `Failed to update scene ${brandable.sceneId} as brandable:`,
//                       updateError,
//                     );
//                   }),
//             );
//             await Promise.all(updatePromises);
//             console.log(
//               `Updated ${analysisResult.brandableScenes.length} scenes as brandable.`,
//             );
//           } else {
//             console.log(
//               "Gemini did not identify any brandable scenes or returned an unexpected format.",
//             );
//           }
//           console.timeEnd("updateBrandableScenes");
//         } else {
//           console.log("No scenes extracted, skipping brandability analysis.");
//         }

//         // Step 6: Send Simplified Success Response
//         console.log("Script upload processed successfully.");
//         res.status(201).json({
//           script: {
//             id: script.id,
//             title: script.title,
//             createdAt: script.createdAt,
//             updatedAt: script.updatedAt,
//           },
//           scenesCount: createdScenes.length,
//           brandableScenesCount: analysisResult.brandableScenes.length,
//         });
//       } catch (error: any) {
//         const scriptIdInfo = script ? ` (Script ID: ${script.id})` : "";
//         console.error(`Error processing script upload${scriptIdInfo}:`, error);
//         console.error("Stack Trace:", error.stack);

//         if (!res.headersSent) {
//           res.status(500).json({
//             message: `Failed to process script: ${error.message || "Unknown error"}`,
//             errorDetails: error.toString(),
//           });
//         } else {
//           console.error("Headers already sent, cannot send error response.");
//           res.end();
//         }
//       }
//     },
//   );

//   app.get(`${apiPrefix}/scripts/scenes`, async (_req, res) => {
//     try {
//       const script = await storage.getCurrentScript();
//       if (!script)
//         return res.status(404).json({ message: "No current script found" });
//       const scenes = await storage.getScenesByScriptId(script.id);
//       res.json(scenes);
//     } catch (error) {
//       console.error("Error fetching scenes:", error);
//       res.status(500).json({ message: "Failed to fetch scenes" });
//     }
//   });

//   app.get(`${apiPrefix}/scripts/brandable-scenes`, async (_req, res) => {
//     try {
//       const script = await storage.getCurrentScript();
//       if (!script)
//         return res.status(404).json({ message: "No current script found" });
//       const brandableScenes = await storage.getBrandableScenes(script.id);
//       res.json(brandableScenes);
//     } catch (error) {
//       console.error("Error fetching brandable scenes:", error);
//       res.status(500).json({ message: "Failed to fetch brandable scenes" });
//     }
//   });

//   app.put(`${apiPrefix}/scripts/save`, async (req, res) => {
//     /* ... */
//   });
//   app.post(`${apiPrefix}/scripts/analyze`, async (req, res) => {
//     /* ... */
//   });
//   app.post(`${apiPrefix}/scripts/generate-placements`, async (_req, res) => {
//     /* ... */
//   });

//   // --- GET Scene Variations (with On-Demand Generation Logic) ---
//   app.get(`${apiPrefix}/scripts/scene-variations`, async (req, res) => {
//     console.log(
//       `[GET /scene-variations] Request received for sceneId: ${req.query.sceneId}`,
//     );
//     try {
//       const sceneId = req.query.sceneId
//         ? parseInt(req.query.sceneId as string)
//         : null;
//       if (!sceneId) {
//         console.warn("[GET /scene-variations] Scene ID is required");
//         return res.status(400).json({ message: "Scene ID is required" });
//       }

//       // Fetch the scene details first to check if it's brandable
//       let scene = await storage.getSceneById(sceneId);
//       if (!scene) {
//         console.warn(
//           `[GET /scene-variations] Scene not found for ID: ${sceneId}`,
//         );
//         return res.status(404).json({ message: "Scene not found" });
//       }
//       console.log(
//         `[GET /scene-variations] Found scene ${scene.sceneNumber}, isBrandable: ${scene.isBrandable}`,
//       );

//       // Fetch existing variations
//       console.log(
//         `[GET /scene-variations] Fetching existing variations for scene ${sceneId}`,
//       );
//       let variations = await storage.getSceneVariations(sceneId);
//       console.log(
//         `[GET /scene-variations] Found ${variations.length} existing variations.`,
//       );

//       // Generate variations on demand ONLY if none exist AND the scene is brandable
//       if (variations.length === 0 && scene.isBrandable) {
//         console.log(
//           `[GET /scene-variations] No variations for brandable scene ${sceneId}, generating on-demand...`,
//         );
//         console.time(`on-demand-variation-generation-scene-${sceneId}`);

//         // Check for suggested categories, try to analyze if missing
//         if (
//           !scene.suggestedCategories ||
//           scene.suggestedCategories.length === 0
//         ) {
//           console.log(
//             `[GET /scene-variations] Scene ${sceneId} has no suggested categories. Analyzing...`,
//           );
//           try {
//             const analysisResult = await identifyBrandableScenesWithGemini(
//               [scene],
//               1,
//             ); // Analyze just this scene
//             if (analysisResult.brandableScenes.length > 0) {
//               const brandable = analysisResult.brandableScenes[0];
//               console.log(
//                 `[GET /scene-variations] Re-analyzed scene ${sceneId}. New Categories:`,
//                 brandable.suggestedProducts,
//               );
//               await storage.updateScene(scene.id, {
//                 brandableReason: brandable.reason,
//                 suggestedCategories: brandable.suggestedProducts,
//               });
//               scene = await storage.getSceneById(sceneId); // Refresh scene data
//               if (!scene)
//                 throw new Error(
//                   "Scene disappeared after update during on-demand generation.",
//                 );
//             } else {
//               console.log(
//                 `[GET /scene-variations] Re-analysis did not yield categories for scene ${sceneId}.`,
//               );
//             }
//           } catch (analysisError) {
//             console.error(
//               `[GET /scene-variations] Error analyzing scene ${sceneId} for categories:`,
//               analysisError,
//             );
//             // Proceed without categories if analysis fails
//           }
//         }

//         // Generate using the helper function (includes detailed logging)
//         variations = await _generateAndSaveSceneVariationsForRoute(
//           sceneId,
//           storage,
//           generateProductPlacement,
//         );

//         console.timeEnd(`on-demand-variation-generation-scene-${sceneId}`);
//         console.log(
//           `[GET /scene-variations] Generated ${variations.length} variations on-demand for scene ${scene.sceneNumber}.`,
//         );
//       }

//       console.log(
//         `[GET /scene-variations] Returning ${variations.length} variations for scene ${sceneId}.`,
//       );
//       res.json(variations);
//     } catch (error: any) {
//       console.error(
//         "[GET /scene-variations] Error fetching/generating scene variations:",
//         error,
//       );
//       res.status(500).json({
//         message: `Failed to fetch/generate scene variations: ${error.message}`,
//       });
//     }
//   });

//   app.put(`${apiPrefix}/scripts/variations/select`, async (req, res) => {
//     /* ... */
//   });
//   app.get(`${apiPrefix}/scripts/export`, async (req, res) => {
//     /* ... */
//   });

//   // --- Video Generation Routes ---
//   app.post(
//     `${apiPrefix}/variations/:variationId/generate-video`,
//     async (req, res) => {
//       /* ... */
//     },
//   );
//   app.get(
//     `${apiPrefix}/replicate/predictions/:predictionId`,
//     async (req, res) => {
//       /* ... */
//     },
//   );

//   const httpServer = createServer(app);
//   return httpServer;
// }


// server/routes.ts
import type { Express } from "express";
import { createServer, type Server } from "http";
import * as storage from "./storage";
import multer from "multer";
import { extractScriptFromPdf } from "./services/pdf-service";
import {
  generateProductPlacement, // Stays for image generation
  generateVideoFromVariation,
  getPredictionStatus,
} from "./services/replicate-service";
import {
  identifyBrandableScenesWithGemini,
  generateCreativePlacementPrompt, // <--- Import new Gemini prompt function
  AIAnalysisResponseForRoutes, // Keep if used elsewhere
  extractTextFromImage, // Ensure this is imported if used directly here
  extractTextFromPdf as extractPdfTextViaGemini // Rename to avoid confusion if pdf-service calls it too
} from "./services/file-upload-service"; // Adjust path if you moved the function
import { z } from "zod";
import {
  insertProductSchema,
  insertActorSchema,
  insertLocationSchema,
  ProductCategory,
  Product as DbProduct, // Use DbProduct alias
  Scene as DbScene, // Use DbScene alias
  Actor as DbActor,
  Location as DbLocation,
  SceneVariation, // This is the extended type from schema.ts
  Product,
  Script,
} from "@shared/schema";
import { ZodError } from "zod"; // Import ZodError

// --- Interfaces ---
// Keep existing interfaces if they are still relevant
interface BaseSceneVariation { // This might be less needed if SceneVariation from schema is sufficient
  id: number;
  sceneId: number;
  productId: number;
  variationNumber: number;
  description: string;
  imageUrl: string;
  geminiPrompt: string; // Add prompt here too
  isSelected: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface SceneVariationWithProductInfo extends BaseSceneVariation { // Keep or adapt based on SceneVariation type
  productName: string;
  productCategory: string;
  productImageUrl?: string | null;
}
// ... (other interfaces like ExportData remain the same) ...

// --- Utility Functions ---
// Keep sanitizeString if used
const sanitizeString = (str: string | null | undefined): string => {
  if (!str) return "";
  // Remove null characters and non-printable ASCII/extended ASCII, allowing common Unicode like accents, CJK etc.
  return str.replace(/\u0000/g, "").replace(/[^\x20-\x7E\u00A0-\uFFFF]/g, "");
};

// --- Multer Setup ---
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB
  },
  fileFilter: (req, file, cb) => { // Add basic file filter
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, JPG, PNG allowed.'));
    }
  }
});

// --- Helper: _generateAndSaveSceneVariationsForRoute (Refactored) ---
async function _generateAndSaveSceneVariationsForRoute(
  sceneId: number,
): Promise<SceneVariation[]> { // Return type updated to match storage layer
  const logPrefix = `[VarGen Route S:${sceneId}]`;
  console.log(`${logPrefix} Starting on-demand variation generation...`);
  try {
    const scene = await storage.getSceneById(sceneId);
    if (!scene) {
      console.error(`${logPrefix} Scene not found.`);
      return [];
    }
    if (!scene.isBrandable) {
        console.log(`${logPrefix} Scene is not marked as brandable. Skipping generation.`);
        return [];
    }
    console.log(`${logPrefix} Found Scene ${scene.sceneNumber}: ${scene.heading}`);

    // Ensure categories are present, re-analyze if needed (keep this logic)
     if (!scene.suggestedCategories || scene.suggestedCategories.length === 0) {
         console.log(`${logPrefix} No suggested categories found. Re-analyzing...`);
         try {
             const analysisResult = await identifyBrandableScenesWithGemini([scene], 1);
             if (analysisResult.brandableScenes.length > 0) {
                 const brandable = analysisResult.brandableScenes[0];
                 await storage.updateScene(scene.id, {
                     isBrandable: true, // Ensure it's true
                     brandableReason: brandable.reason,
                     suggestedCategories: brandable.suggestedProducts,
                 });
                 // Refresh scene data
                 const refreshedScene = await storage.getSceneById(sceneId);
                 if (!refreshedScene) throw new Error("Scene disappeared after update.");
                 scene.suggestedCategories = refreshedScene.suggestedCategories;
                 scene.brandableReason = refreshedScene.brandableReason;
                 console.log(`${logPrefix} Categories updated: ${scene.suggestedCategories?.join(', ')}`);
             } else {
                 console.warn(`${logPrefix} Re-analysis did not yield categories.`);
             }
         } catch (analysisError) {
             console.error(`${logPrefix} Error during scene re-analysis:`, analysisError);
         }
     }

    // Fetch products based on (potentially updated) categories
    const categories = scene.suggestedCategories || [];
    console.log(`${logPrefix} Fetching top 3 products for categories: ${categories.join(', ')}`);
    const selectedProducts = await storage.getTopMatchingProductsForScene(sceneId, categories, 3);

    if (selectedProducts.length === 0) {
      console.warn(`${logPrefix} No suitable products found. Cannot generate variations.`);
      return [];
    }
    console.log(`${logPrefix} Selected products: ${selectedProducts.map(p => p.name).join(', ')}`);

    // Generate variations in parallel
    const variationPromises = selectedProducts.map(async (product, i) => {
      const variationNumber = i + 1;
      const varLogPrefix = `${logPrefix} V${variationNumber} (P:${product.id})`;
      try {
        // *** 1. Get creative prompt from Gemini ***
        console.log(`${varLogPrefix} Getting creative prompt from Gemini...`);
        console.time(`${varLogPrefix}_GeminiPrompt`);
        const creativePrompt = await generateCreativePlacementPrompt(scene, product);
        console.timeEnd(`${varLogPrefix}_GeminiPrompt`);
        if (!creativePrompt || creativePrompt.includes("Error:")) { // Check for fallback/error
            throw new Error(`Gemini failed to generate a valid prompt: ${creativePrompt}`);
        }

        // *** 2. Generate image using the Gemini prompt ***
        console.log(`${varLogPrefix} Generating image with Replicate...`);
        console.time(`${varLogPrefix}_ReplicateImage`);
        const generationResult = await generateProductPlacement({ // Pass object
             scene,
             product,
             variationNumber,
             prompt: creativePrompt
         });
        console.timeEnd(`${varLogPrefix}_ReplicateImage`);

        if (!generationResult.success) {
          console.warn(`${varLogPrefix} Image generation failed. Will use fallback URL.`);
          // Decide if you want to save a variation record even if image gen fails
          // For now, we'll still save it with the fallback URL and the prompt used.
        }

        // *** 3. Create and save the variation record ***
        const cleanDescription = `Variation ${variationNumber}: ${product.name} - ${scene.heading}. Prompt: ${creativePrompt.substring(0, 50)}...`;

        const variationData = {
          sceneId: scene.id,
          productId: product.id,
          variationNumber,
          description: sanitizeString(cleanDescription), // Sanitize potentially complex prompt snippet
          imageUrl: generationResult.imageUrl, // Use result (could be fallback)
          geminiPrompt: creativePrompt, // Save the used prompt
          isSelected: false,
        };

        console.log(`${varLogPrefix} Saving variation to DB...`);
        console.time(`${varLogPrefix}_DBSave`);
        const newVariation = await storage.createSceneVariation(variationData);
        console.timeEnd(`${varLogPrefix}_DBSave`);
        console.log(`${varLogPrefix} Saved variation ID: ${newVariation.id}`);

        return newVariation; // Return the full variation object from storage
      } catch (error) {
        console.error(`${varLogPrefix} Error during variation generation:`, error);
        return null; // Indicate failure for this variation
      }
    });

    const results = await Promise.all(variationPromises);
    const successfulVariations = results.filter((v): v is SceneVariation => v !== null);

    console.log(`${logPrefix} Generated ${successfulVariations.length}/${selectedProducts.length} variations successfully.`);
    return successfulVariations; // Return the extended SceneVariation type

  } catch (outerError) {
    console.error(`${logPrefix} CRITICAL ERROR during setup:`, outerError);
    return [];
  }
}


// --- Routes Registration ---
export async function registerRoutes(app: Express): Promise<Server> {
  const apiPrefix = "/api";

  // --- Actor Routes ---
  app.get(`${apiPrefix}/actors`, async (req, res, next) => {
    try {
        const page = parseInt(req.query.page as string || '1');
        const pageSize = parseInt(req.query.pageSize as string || '10');
        const search = req.query.search as string || '';
        const gender = req.query.gender as string || '';
        const nationality = req.query.nationality as string || '';

        const result = await storage.getActors({ search, gender, nationality, page, pageSize });
        res.json(result);
    } catch (error) {
        next(error); // Pass error to central handler
    }
  });
  // ... (other actor routes remain similar, ensure try/catch/next) ...
  app.put(`${apiPrefix}/actors/:id`, async (req, res, next) => {
      try {
          const id = parseInt(req.params.id);
          if (isNaN(id)) return res.status(400).json({ message: "Invalid actor ID" });
          // Assuming body is validated ActorFormData from client/lib/types
          const validatedData = insertActorSchema.partial().parse(req.body); // Use partial schema for updates
          const updated = await storage.updateActor(id, validatedData);
          if (!updated) return res.status(404).json({ message: "Actor not found" });
          res.json(updated);
      } catch (error) {
           if (error instanceof ZodError) {
              return res.status(400).json({ message: "Validation failed", errors: error.errors });
          }
          next(error);
      }
  });


  // --- Product Routes ---
  // ... (GET /products, GET /products/:id remain similar, ensure try/catch/next) ...
   app.get(`${apiPrefix}/products`, async (req, res, next) => {
      try {
        const page = parseInt(req.query.page as string || '1');
        const pageSize = parseInt(req.query.pageSize as string || '12'); // Default from ProductDatabase page
        const search = req.query.search as string || '';
        const category = req.query.category as string || 'ALL';

        const result = await storage.getProducts({ search, category, page, pageSize });
        res.json(result);
    } catch (error) {
        next(error);
    }
   });
   app.post(`${apiPrefix}/products`, async (req, res, next) => {
      try {
          const validatedData = insertProductSchema.parse(req.body);
          const newProduct = await storage.createProduct(validatedData);
          res.status(201).json(newProduct);
      } catch (error) {
           if (error instanceof ZodError) {
              return res.status(400).json({ message: "Validation failed", errors: error.errors });
          }
          next(error);
      }
  });
   app.put(`${apiPrefix}/products/:id`, async (req, res, next) => {
      try {
          const id = parseInt(req.params.id);
           if (isNaN(id)) return res.status(400).json({ message: "Invalid product ID" });
           // Use partial schema for updates
          const partialSchema = insertProductSchema.partial().omit({ id: true, createdAt: true, updatedAt: true });
          const validatedData = partialSchema.parse(req.body);
          const updated = await storage.updateProduct(id, validatedData);
          if (!updated) return res.status(404).json({ message: "Product not found" });
          res.json(updated);
      } catch (error) {
           if (error instanceof ZodError) {
              return res.status(400).json({ message: "Validation failed", errors: error.errors });
          }
          next(error);
      }
  });
   app.delete(`${apiPrefix}/products/:id`, async (req, res, next) => {
      try {
           const id = parseInt(req.params.id);
           if (isNaN(id)) return res.status(400).json({ message: "Invalid product ID" });
          const deleted = await storage.deleteProduct(id);
          if (!deleted) return res.status(404).json({ message: "Product not found" });
          res.status(204).send(); // No content on successful delete
      } catch (error) {
          next(error);
      }
  });


  // --- Location Routes ---
  // ... (GET /locations, GET /locations/:id, etc. remain similar, ensure try/catch/next) ...
   app.post(`${apiPrefix}/locations`, async (req, res, next) => {
      try {
          const validatedData = insertLocationSchema.parse(req.body);
          const newLocation = await storage.createLocation(validatedData);
          res.status(201).json(newLocation);
      } catch (error) {
          if (error instanceof ZodError) {
              return res.status(400).json({ message: "Validation failed", errors: error.errors });
          }
          next(error);
      }
   });
    app.put(`${apiPrefix}/locations/:id`, async (req, res, next) => {
        try {
            const id = parseInt(req.params.id);
            if (isNaN(id)) return res.status(400).json({ message: "Invalid location ID" });
             const partialSchema = insertLocationSchema.partial().omit({ id: true, createdAt: true, updatedAt: true });
            const validatedData = partialSchema.parse(req.body);
            const updated = await storage.updateLocation(id, validatedData);
            if (!updated) return res.status(404).json({ message: "Location not found" });
            res.json(updated);
        } catch (error) {
            if (error instanceof ZodError) {
                return res.status(400).json({ message: "Validation failed", errors: error.errors });
            }
            next(error);
        }
    });
    app.delete(`${apiPrefix}/locations/:id`, async (req, res, next) => {
        try {
            const id = parseInt(req.params.id);
            if (isNaN(id)) return res.status(400).json({ message: "Invalid location ID" });
            const deleted = await storage.deleteLocation(id);
            if (!deleted) return res.status(404).json({ message: "Location not found" });
            res.status(204).send();
        } catch (error) {
            next(error);
        }
    });


  // --- Script Routes ---
  app.get(`${apiPrefix}/scripts/current`, async (_req, res, next) => {
    try {
      const script = await storage.getCurrentScript();
      if (!script) return res.status(404).json({ message: "No current script found" });
      // Only return essential info, not full content
      res.json({
          id: script.id,
          title: script.title,
          createdAt: script.createdAt,
          updatedAt: script.updatedAt,
      });
    } catch (error) { next(error); }
  });

  app.post(`${apiPrefix}/scripts/upload`, upload.single("script"), async (req, res, next) => {
      let script: Script | null = null;
      try {
          if (!req.file) {
              return res.status(400).json({ message: "No file uploaded" });
          }
          console.log(`[Upload] Processing: ${req.file.originalname}, Type: ${req.file.mimetype}`);

          // Use pdf-service which handles both PDF and Image via file-upload-service
          console.time("[Upload] scriptExtraction");
          const parsedScript = await extractScriptFromPdf(req.file.buffer, req.file.mimetype);
          console.timeEnd("[Upload] scriptExtraction");

           // Handle potential extraction errors indicated by the service
           if (parsedScript.content.startsWith("Error:")) {
               console.error(`[Upload] Script extraction failed: ${parsedScript.content}`);
               return res.status(400).json({ message: `Script extraction failed: ${parsedScript.title}` }); // Use title field for error msg
           }

          console.log(`[Upload] Extracted Title: ${parsedScript.title}, Content Sample: ${parsedScript.content.substring(0,50)}...`);

          console.time("[Upload] createScriptRecord");
          script = await storage.createScript({
              title: sanitizeString(parsedScript.title), // Sanitize title
              content: parsedScript.content, // Content assumed cleaned by extraction service
          });
          console.timeEnd("[Upload] createScriptRecord");

          console.time("[Upload] createSceneRecords");
          const createdScenes: DbScene[] = [];
          for (const sceneData of parsedScript.scenes) {
              const newScene = await storage.createScene({
                  scriptId: script.id,
                  sceneNumber: sceneData.sceneNumber,
                  heading: sanitizeString(sceneData.heading), // Sanitize
                  content: sceneData.content, // Assumed clean
              });
              createdScenes.push(newScene);
          }
          console.timeEnd("[Upload] createSceneRecords");
          console.log(`[Upload] Created ${createdScenes.length} scenes.`);

          console.time("[Upload] geminiAnalysis");
          let analysisResult: AIAnalysisResponseForRoutes = { brandableScenes: [] }; // Use specific type
          if (createdScenes.length > 0) {
              analysisResult = await identifyBrandableScenesWithGemini(createdScenes, 5); // Target 5
              console.log(`[Upload] Gemini identified ${analysisResult.brandableScenes.length} potential brandable scenes.`);

              console.time("[Upload] updateBrandableScenes");
              const updatePromises = analysisResult.brandableScenes.map(brandable =>
                  storage.updateScene(brandable.sceneId, {
                      isBrandable: true,
                      brandableReason: sanitizeString(brandable.reason), // Sanitize
                      suggestedCategories: brandable.suggestedProducts,
                  }).catch(e => console.error(`Failed updating scene ${brandable.sceneId}:`, e)) // Log errors but don't fail upload
              );
              await Promise.all(updatePromises);
              console.timeEnd("[Upload] updateBrandableScenes");

          } else {
              console.log("[Upload] No scenes extracted, skipping brandability analysis.");
          }
          console.timeEnd("[Upload] geminiAnalysis");

          console.log("[Upload] Processed successfully.");
          res.status(201).json({ // Send back less data
              script: { id: script.id, title: script.title },
              scenesCount: createdScenes.length,
              brandableScenesCount: analysisResult.brandableScenes.length,
          });

      } catch (error) {
          console.error("[Upload] Error processing upload:", error);
          next(error); // Pass to central error handler
      }
  });


  app.get(`${apiPrefix}/scripts/scenes`, async (_req, res, next) => {
    try {
      const script = await storage.getCurrentScript();
      if (!script) return res.status(404).json({ message: "No current script found" });
      const scenes = await storage.getScenesByScriptId(script.id);
      res.json(scenes);
    } catch (error) { next(error); }
  });

  app.get(`${apiPrefix}/scripts/brandable-scenes`, async (_req, res, next) => {
    try {
      const script = await storage.getCurrentScript();
      if (!script) return res.status(404).json({ message: "No current script found" });
      const brandableScenes = await storage.getBrandableScenes(script.id);
      res.json(brandableScenes);
    } catch (error) { next(error); }
  });

  // GET Scene Variations (Refactored for On-Demand with new workflow)
  app.get(`${apiPrefix}/scripts/scene-variations`, async (req, res, next) => {
    const sceneIdParam = req.query.sceneId as string;
    const logPrefix = `[GET /scene-variations S:${sceneIdParam}]`;
    console.log(`${logPrefix} Request received.`);

    try {
      const sceneId = parseInt(sceneIdParam);
      if (isNaN(sceneId)) {
        console.warn(`${logPrefix} Invalid Scene ID.`);
        return res.status(400).json({ message: "Valid Scene ID is required" });
      }

      // Fetch existing variations first
      console.log(`${logPrefix} Fetching existing variations...`);
      let variations = await storage.getSceneVariations(sceneId);
      console.log(`${logPrefix} Found ${variations.length} existing variations.`);

      // Generate on demand ONLY if none exist
      if (variations.length === 0) {
        console.log(`${logPrefix} No variations exist, attempting on-demand generation...`);
        console.time(`${logPrefix}_OnDemandGen`);

        // Call the refactored helper which now includes Gemini prompt generation
        variations = await _generateAndSaveSceneVariationsForRoute(sceneId);

        console.timeEnd(`${logPrefix}_OnDemandGen`);
        console.log(`${logPrefix} On-demand generation finished. Generated ${variations.length} variations.`);
      } else {
          console.log(`${logPrefix} Returning existing variations.`);
      }

      res.json(variations); // Return SceneVariation[] type directly

    } catch (error: any) {
      console.error(`${logPrefix} Error fetching/generating variations:`, error);
      next(error); // Pass to error handler
    }
  });

   app.put(`${apiPrefix}/scripts/variations/select`, async (req, res, next) => {
        const variationIdParam = req.body.variationId as string; // Assuming ID comes in body
        const logPrefix = `[PUT /select-variation V:${variationIdParam}]`;
        try {
            const variationId = parseInt(variationIdParam);
             if (isNaN(variationId)) {
                console.warn(`${logPrefix} Invalid Variation ID.`);
                return res.status(400).json({ message: "Valid Variation ID is required" });
            }

            const updatedVariation = await storage.selectVariation(variationId);

            if (!updatedVariation) {
                console.warn(`${logPrefix} Variation not found or selection failed.`);
                 // selectVariation might return null if the ID doesn't exist
                return res.status(404).json({ message: `Variation with ID ${variationId} not found.` });
            }

            console.log(`${logPrefix} Variation successfully selected.`);
            res.json(updatedVariation); // Return the selected variation info

        } catch (error) {
            console.error(`${logPrefix} Error selecting variation:`, error);
            next(error);
        }
    });


  // --- Video Generation Routes ---
  app.post(`${apiPrefix}/variations/:variationId/generate-video`, async (req, res, next) => {
      const variationIdParam = req.params.variationId;
      const logPrefix = `[POST /generate-video V:${variationIdParam}]`;
      try {
           const variationId = parseInt(variationIdParam);
           if (isNaN(variationId)) {
               console.warn(`${logPrefix} Invalid Variation ID.`);
               return res.status(400).json({ message: "Valid Variation ID is required" });
           }
           console.log(`${logPrefix} Request received.`);

           const result = await generateVideoFromVariation(variationId);

           if (result.error) {
               console.error(`${logPrefix} Failed to start video generation: ${result.error}`);
               // Send a more specific error code if possible, e.g., 404 if variation not found
               return res.status(500).json({ message: result.error, predictionId: result.predictionId });
           }

           console.log(`${logPrefix} Video generation started. Prediction ID: ${result.predictionId}, Status: ${result.status}`);
           res.status(202).json({ // 202 Accepted: request accepted, processing started
                message: "Video generation started.",
                predictionId: result.predictionId,
                status: result.status
           });

      } catch(error) {
           console.error(`${logPrefix} Unexpected error:`, error);
           next(error);
      }
  });

  app.get(`${apiPrefix}/replicate/predictions/:predictionId`, async (req, res, next) => {
      const predictionId = req.params.predictionId;
      const logPrefix = `[GET /prediction-status P:${predictionId}]`;
       // console.log(`${logPrefix} Request received.`); // Keep polling logs minimal

      try {
          if (!predictionId || typeof predictionId !== 'string') {
              return res.status(400).json({ message: "Valid Prediction ID is required" });
          }

          const result = await getPredictionStatus(predictionId);

           // console.log(`${logPrefix} Status: ${result.status}`); // Minimal logging

          res.json(result); // Send status, url, error, logs back to client

      } catch(error) {
           console.error(`${logPrefix} Unexpected error:`, error);
           next(error);
      }
  });

  // --- Script Export Route (Example - adjust as needed) ---
  app.get(`${apiPrefix}/scripts/export`, async (_req, res, next) => {
     const logPrefix = `[GET /export]`;
      try {
          console.log(`${logPrefix} Request received.`);
          const script = await storage.getCurrentScript();
          if (!script) return res.status(404).json({ message: "No current script found" });

          const scenes = await storage.getScenesByScriptId(script.id);
          const exportData: ExportData = {
              script: { // Only include necessary script fields
                  id: script.id,
                  title: script.title,
                  createdAt: script.createdAt,
                  updatedAt: script.updatedAt,
              },
              placements: []
          };

          for (const scene of scenes) {
              if (scene.isBrandable) {
                   // Find the selected variation for this scene
                  const variations = await storage.getSceneVariations(scene.id);
                  const selectedVariation = variations.find(v => v.isSelected);

                  let selectedProductData: ExportData['placements'][0]['selectedProduct'] = null;
                  let selectedVariationImageUrl: string | null = null;

                  if (selectedVariation) {
                       selectedVariationImageUrl = selectedVariation.imageUrl;
                      // Fetch product details if needed (should be joined in getSceneVariations)
                       if (selectedVariation.productId) {
                           selectedProductData = {
                               id: selectedVariation.productId,
                               companyName: selectedVariation.productName || 'N/A',
                               name: selectedVariation.productName || 'N/A', // Use joined name
                               category: selectedVariation.productCategory || 'OTHER',
                               imageUrl: selectedVariation.productImageUrl || ''
                           };
                       }
                  }

                  exportData.placements.push({
                      sceneId: scene.id,
                      sceneNumber: scene.sceneNumber,
                      sceneHeading: scene.heading,
                      selectedProduct: selectedProductData,
                      selectedVariationImageUrl: selectedVariationImageUrl,
                  });
              }
          }
           console.log(`${logPrefix} Export data prepared for Script ID: ${script.id}.`);

          res.json(exportData);

      } catch (error) {
           console.error(`${logPrefix} Error generating export data:`, error);
           next(error);
      }
  });


  const httpServer = createServer(app);
  return httpServer;
}