// // server/routes.ts
// import type { Express } from "express";
// import { createServer, type Server } from "http";
// import * as storage from "./storage";
// import multer from "multer";
// import { extractScriptFromPdf } from "./services/pdf-service";
// import {
//     generateProductPlacement,
//     generateVideoFromVariation,
//     getPredictionStatus,
// } from "./services/replicate-service";
// import {
//     identifyBrandableScenesWithGemini,
//     generateCreativePlacementPrompt,
//     AIAnalysisResponseForRoutes,
//     extractTextFromImage,
//     extractTextFromPdf as extractPdfTextViaGemini,
// } from "./services/file-upload-service";
// import { z } from "zod";
// import {
//     insertProductSchema,
//     insertActorSchema,
//     insertLocationSchema,
//     ProductCategory,
//     Product as DbProduct,
//     Scene as DbScene,
//     Actor as DbActor,
//     Location as DbLocation,
//     SceneVariation,
//     Product,
//     Script,
// } from "@shared/schema";
// import { ZodError } from "zod";

// // --- Interfaces ---
// interface BaseSceneVariation {
//     id: number;
//     sceneId: number;
//     productId: number;
//     variationNumber: number;
//     description: string;
//     imageUrl: string;
//     geminiPrompt: string;
//     isSelected: boolean;
//     createdAt: Date;
//     updatedAt: Date;
// }

// interface SceneVariationWithProductInfo extends BaseSceneVariation {
//     productName: string;
//     productCategory: string;
//     productImageUrl?: string | null;
// }
// // Define ExportData interface if not already present
// interface ExportData {
//     script: {
//         id: number;
//         title: string;
//         createdAt: Date;
//         updatedAt: Date;
//     };
//     placements: {
//         sceneId: number;
//         sceneNumber: number;
//         sceneHeading: string;
//         selectedProduct: Product | null; // Assuming Product type from schema
//         selectedVariationImageUrl: string | null;
//     }[];
// }

// // --- Utility Functions ---
// const sanitizeString = (str: string | null | undefined): string => {
//     if (!str) return "";
//     return str.replace(/\u0000/g, "").replace(/[^\x20-\x7E\u00A0-\uFFFF]/g, "");
// };

// // --- Multer Setup ---
// const upload = multer({
//     storage: multer.memoryStorage(),
//     limits: {
//         fileSize: 15 * 1024 * 1024, // 15MB
//     },
//     fileFilter: (req, file, cb) => {
//         const allowedTypes = [
//             "application/pdf",
//             "image/jpeg",
//             "image/png",
//             "image/jpg",
//         ];
//         if (allowedTypes.includes(file.mimetype)) {
//             cb(null, true);
//         } else {
//             cb(new Error("Invalid file type. Only PDF, JPG, PNG allowed."));
//         }
//     },
// });

// // --- Helper: _generateAndSaveSceneVariationsForRoute (Refactored) ---
// async function _generateAndSaveSceneVariationsForRoute(
//     sceneId: number,
// ): Promise<SceneVariation[]> {
//     const logPrefix = `[VarGen Route S:${sceneId}]`;
//     console.log(`${logPrefix} Starting on-demand variation generation...`);
//     try {
//         const scene = await storage.getSceneById(sceneId);
//         if (!scene) {
//             console.error(`${logPrefix} Scene not found.`);
//             return [];
//         }
//         if (!scene.isBrandable) {
//             console.log(
//                 `${logPrefix} Scene is not marked as brandable. Skipping generation.`,
//             );
//             return [];
//         }
//         console.log(
//             `${logPrefix} Found Scene ${scene.sceneNumber}: ${scene.heading}`,
//         );

//         if (
//             !scene.suggestedCategories ||
//             scene.suggestedCategories.length === 0
//         ) {
//             console.log(
//                 `${logPrefix} No suggested categories found. Re-analyzing...`,
//             );
//             try {
//                 const analysisResult = await identifyBrandableScenesWithGemini(
//                     [scene],
//                     1,
//                 );
//                 if (analysisResult.brandableScenes.length > 0) {
//                     const brandable = analysisResult.brandableScenes[0];
//                     await storage.updateScene(scene.id, {
//                         isBrandable: true,
//                         brandableReason: brandable.reason,
//                         suggestedCategories: brandable.suggestedProducts,
//                     });
//                     const refreshedScene = await storage.getSceneById(sceneId);
//                     if (!refreshedScene)
//                         throw new Error("Scene disappeared after update.");
//                     scene.suggestedCategories =
//                         refreshedScene.suggestedCategories;
//                     scene.brandableReason = refreshedScene.brandableReason;
//                     console.log(
//                         `${logPrefix} Categories updated: ${scene.suggestedCategories?.join(", ")}`,
//                     );
//                 } else {
//                     console.warn(
//                         `${logPrefix} Re-analysis did not yield categories.`,
//                     );
//                 }
//             } catch (analysisError) {
//                 console.error(
//                     `${logPrefix} Error during scene re-analysis:`,
//                     analysisError,
//                 );
//             }
//         }

//         const categories = scene.suggestedCategories || [];
//         console.log(
//             `${logPrefix} Fetching top 3 products for categories: ${categories.join(", ")}`,
//         );
//         const selectedProducts = await storage.getTopMatchingProductsForScene(
//             sceneId,
//             categories,
//             3,
//         );

//         if (selectedProducts.length === 0) {
//             console.warn(
//                 `${logPrefix} No suitable products found. Cannot generate variations.`,
//             );
//             return [];
//         }
//         console.log(
//             `${logPrefix} Selected products: ${selectedProducts.map((p) => p.name).join(", ")}`,
//         );

//         const variationPromises = selectedProducts.map(async (product, i) => {
//             const variationNumber = i + 1;
//             const varLogPrefix = `${logPrefix} V${variationNumber} (P:${product.id})`;
//             try {
//                 console.log(
//                     `${varLogPrefix} Getting creative prompt from Gemini...`,
//                 );
//                 console.time(`${varLogPrefix}_GeminiPrompt`);
//                 const creativePrompt = await generateCreativePlacementPrompt(
//                     scene,
//                     product,
//                 );
//                 console.timeEnd(`${varLogPrefix}_GeminiPrompt`);
//                 if (!creativePrompt || creativePrompt.includes("Error:")) {
//                     throw new Error(
//                         `Gemini failed to generate a valid prompt: ${creativePrompt}`,
//                     );
//                 }

//                 console.log(
//                     `${varLogPrefix} Generating image with Replicate...`,
//                 );
//                 console.time(`${varLogPrefix}_ReplicateImage`);
//                 const generationResult = await generateProductPlacement({
//                     scene,
//                     product,
//                     variationNumber,
//                     prompt: creativePrompt,
//                 });
//                 console.timeEnd(`${varLogPrefix}_ReplicateImage`);

//                 if (!generationResult.success) {
//                     console.warn(
//                         `${varLogPrefix} Image generation failed. Will use fallback URL.`,
//                     );
//                 }

//                 const cleanDescription = `Variation ${variationNumber}: ${product.name} - ${scene.heading}. Prompt: ${creativePrompt.substring(0, 50)}...`;

//                 const variationData = {
//                     sceneId: scene.id,
//                     productId: product.id,
//                     variationNumber,
//                     description: sanitizeString(cleanDescription),
//                     imageUrl: generationResult.imageUrl,
//                     geminiPrompt: creativePrompt,
//                     isSelected: false,
//                 };

//                 console.log(`${varLogPrefix} Saving variation to DB...`);
//                 console.time(`${varLogPrefix}_DBSave`);
//                 const newVariation =
//                     await storage.createSceneVariation(variationData);
//                 console.timeEnd(`${varLogPrefix}_DBSave`);
//                 console.log(
//                     `${varLogPrefix} Saved variation ID: ${newVariation.id}`,
//                 );

//                 return newVariation;
//             } catch (error) {
//                 console.error(
//                     `${varLogPrefix} Error during variation generation:`,
//                     error,
//                 );
//                 return null;
//             }
//         });

//         const results = await Promise.all(variationPromises);
//         const successfulVariations = results.filter(
//             (v): v is SceneVariation => v !== null,
//         );

//         console.log(
//             `${logPrefix} Generated ${successfulVariations.length}/${selectedProducts.length} variations successfully.`,
//         );
//         return successfulVariations;
//     } catch (outerError) {
//         console.error(`${logPrefix} CRITICAL ERROR during setup:`, outerError);
//         return [];
//     }
// }

// // --- Routes Registration ---
// export async function registerRoutes(app: Express): Promise<Server> {
//     const apiPrefix = "/api";

//     // --- Actor Routes ---
//     app.get(`${apiPrefix}/actors`, async (req, res, next) => {
//         try {
//             const page = parseInt((req.query.page as string) || "1");
//             const pageSize = parseInt((req.query.pageSize as string) || "10");
//             const search = (req.query.search as string) || "";
//             const gender = (req.query.gender as string) || "";
//             const nationality = (req.query.nationality as string) || "";

//             const result = await storage.getActors({
//                 search,
//                 gender,
//                 nationality,
//                 page,
//                 pageSize,
//             });
//             res.json(result);
//         } catch (error) {
//             next(error);
//         }
//     });
//     app.put(`${apiPrefix}/actors/:id`, async (req, res, next) => {
//         try {
//             const id = parseInt(req.params.id);
//             if (isNaN(id))
//                 return res.status(400).json({ message: "Invalid actor ID" });
//             const validatedData = insertActorSchema.partial().parse(req.body);
//             const updated = await storage.updateActor(id, validatedData);
//             if (!updated)
//                 return res.status(404).json({ message: "Actor not found" });
//             res.json(updated);
//         } catch (error) {
//             if (error instanceof ZodError) {
//                 return res
//                     .status(400)
//                     .json({
//                         message: "Validation failed",
//                         errors: error.errors,
//                     });
//             }
//             next(error);
//         }
//     });

//     // --- Product Routes ---
//     app.get(`${apiPrefix}/products`, async (req, res, next) => {
//         try {
//             const page = parseInt((req.query.page as string) || "1");
//             const pageSize = parseInt((req.query.pageSize as string) || "12");
//             const search = (req.query.search as string) || "";
//             const category = (req.query.category as string) || "ALL";

//             const result = await storage.getProducts({
//                 search,
//                 category,
//                 page,
//                 pageSize,
//             });
//             res.json(result);
//         } catch (error) {
//             next(error);
//         }
//     });
//     app.post(`${apiPrefix}/products`, async (req, res, next) => {
//         try {
//             const validatedData = insertProductSchema.parse(req.body);
//             const newProduct = await storage.createProduct(validatedData);
//             res.status(201).json(newProduct);
//         } catch (error) {
//             if (error instanceof ZodError) {
//                 return res
//                     .status(400)
//                     .json({
//                         message: "Validation failed",
//                         errors: error.errors,
//                     });
//             }
//             next(error);
//         }
//     });
//     app.put(`${apiPrefix}/products/:id`, async (req, res, next) => {
//         try {
//             const id = parseInt(req.params.id);
//             if (isNaN(id))
//                 return res.status(400).json({ message: "Invalid product ID" });
//             const partialSchema = insertProductSchema
//                 .partial()
//                 .omit({ id: true, createdAt: true, updatedAt: true });
//             const validatedData = partialSchema.parse(req.body);
//             const updated = await storage.updateProduct(id, validatedData);
//             if (!updated)
//                 return res.status(404).json({ message: "Product not found" });
//             res.json(updated);
//         } catch (error) {
//             if (error instanceof ZodError) {
//                 return res
//                     .status(400)
//                     .json({
//                         message: "Validation failed",
//                         errors: error.errors,
//                     });
//             }
//             next(error);
//         }
//     });
//     app.delete(`${apiPrefix}/products/:id`, async (req, res, next) => {
//         try {
//             const id = parseInt(req.params.id);
//             if (isNaN(id))
//                 return res.status(400).json({ message: "Invalid product ID" });
//             const deleted = await storage.deleteProduct(id);
//             if (!deleted)
//                 return res.status(404).json({ message: "Product not found" });
//             res.status(204).send();
//         } catch (error) {
//             next(error);
//         }
//     });

//     // --- Location Routes ---
//     app.post(`${apiPrefix}/locations`, async (req, res, next) => {
//         try {
//             const validatedData = insertLocationSchema.parse(req.body);
//             const newLocation = await storage.createLocation(validatedData);
//             res.status(201).json(newLocation);
//         } catch (error) {
//             if (error instanceof ZodError) {
//                 return res
//                     .status(400)
//                     .json({
//                         message: "Validation failed",
//                         errors: error.errors,
//                     });
//             }
//             next(error);
//         }
//     });
//     app.put(`${apiPrefix}/locations/:id`, async (req, res, next) => {
//         try {
//             const id = parseInt(req.params.id);
//             if (isNaN(id))
//                 return res.status(400).json({ message: "Invalid location ID" });
//             const partialSchema = insertLocationSchema
//                 .partial()
//                 .omit({ id: true, createdAt: true, updatedAt: true });
//             const validatedData = partialSchema.parse(req.body);
//             const updated = await storage.updateLocation(id, validatedData);
//             if (!updated)
//                 return res.status(404).json({ message: "Location not found" });
//             res.json(updated);
//         } catch (error) {
//             if (error instanceof ZodError) {
//                 return res
//                     .status(400)
//                     .json({
//                         message: "Validation failed",
//                         errors: error.errors,
//                     });
//             }
//             next(error);
//         }
//     });
//     app.delete(`${apiPrefix}/locations/:id`, async (req, res, next) => {
//         try {
//             const id = parseInt(req.params.id);
//             if (isNaN(id))
//                 return res.status(400).json({ message: "Invalid location ID" });
//             const deleted = await storage.deleteLocation(id);
//             if (!deleted)
//                 return res.status(404).json({ message: "Location not found" });
//             res.status(204).send();
//         } catch (error) {
//             next(error);
//         }
//     });

//     // --- Script Routes ---
//     app.get(`${apiPrefix}/scripts/current`, async (_req, res, next) => {
//         try {
//             const script = await storage.getCurrentScript();
//             if (!script)
//                 return res
//                     .status(404)
//                     .json({ message: "No current script found" });
//             res.json({
//                 id: script.id,
//                 title: script.title,
//                 createdAt: script.createdAt,
//                 updatedAt: script.updatedAt,
//             });
//         } catch (error) {
//             next(error);
//         }
//     });

//     app.post(
//         `${apiPrefix}/scripts/upload`,
//         upload.single("script"),
//         async (req, res, next) => {
//             let script: Script | null = null;
//             try {
//                 if (!req.file) {
//                     return res
//                         .status(400)
//                         .json({ message: "No file uploaded" });
//                 }
//                 console.log(
//                     `[Upload] Processing: ${req.file.originalname}, Type: ${req.file.mimetype}`,
//                 );

//                 console.time("[Upload] scriptExtraction");
//                 const parsedScript = await extractScriptFromPdf(
//                     req.file.buffer,
//                     req.file.mimetype,
//                 );
//                 console.timeEnd("[Upload] scriptExtraction");

//                 if (parsedScript.content.startsWith("Error:")) {
//                     console.error(
//                         `[Upload] Script extraction failed: ${parsedScript.content}`,
//                     );
//                     return res
//                         .status(400)
//                         .json({
//                             message: `Script extraction failed: ${parsedScript.title}`,
//                         });
//                 }

//                 console.log(
//                     `[Upload] Extracted Title: ${parsedScript.title}, Content Sample: ${parsedScript.content.substring(0, 50)}...`,
//                 );

//                 console.time("[Upload] createScriptRecord");
//                 script = await storage.createScript({
//                     title: sanitizeString(parsedScript.title),
//                     content: parsedScript.content,
//                 });
//                 console.timeEnd("[Upload] createScriptRecord");

//                 console.time("[Upload] createSceneRecords");
//                 const createdScenes: DbScene[] = [];
//                 for (const sceneData of parsedScript.scenes) {
//                     const newScene = await storage.createScene({
//                         scriptId: script.id,
//                         sceneNumber: sceneData.sceneNumber,
//                         heading: sanitizeString(sceneData.heading),
//                         content: sceneData.content,
//                     });
//                     createdScenes.push(newScene);
//                 }
//                 console.timeEnd("[Upload] createSceneRecords");
//                 console.log(`[Upload] Created ${createdScenes.length} scenes.`);

//                 console.time("[Upload] geminiAnalysis");
//                 let analysisResult: AIAnalysisResponseForRoutes = {
//                     brandableScenes: [],
//                 };
//                 if (createdScenes.length > 0) {
//                     analysisResult = await identifyBrandableScenesWithGemini(
//                         createdScenes,
//                         5,
//                     );
//                     console.log(
//                         `[Upload] Gemini identified ${analysisResult.brandableScenes.length} potential brandable scenes.`,
//                     );

//                     console.time("[Upload] updateBrandableScenes");
//                     const updatePromises = analysisResult.brandableScenes.map(
//                         (brandable) =>
//                             storage
//                                 .updateScene(brandable.sceneId, {
//                                     isBrandable: true,
//                                     brandableReason: sanitizeString(
//                                         brandable.reason,
//                                     ),
//                                     suggestedCategories:
//                                         brandable.suggestedProducts,
//                                 })
//                                 .catch((e) =>
//                                     console.error(
//                                         `Failed updating scene ${brandable.sceneId}:`,
//                                         e,
//                                     ),
//                                 ),
//                     );
//                     await Promise.all(updatePromises);
//                     console.timeEnd("[Upload] updateBrandableScenes");
//                 } else {
//                     console.log(
//                         "[Upload] No scenes extracted, skipping brandability analysis.",
//                     );
//                 }
//                 console.timeEnd("[Upload] geminiAnalysis");

//                 console.log("[Upload] Processed successfully.");
//                 res.status(201).json({
//                     script: { id: script.id, title: script.title },
//                     scenesCount: createdScenes.length,
//                     brandableScenesCount: analysisResult.brandableScenes.length,
//                 });
//             } catch (error) {
//                 console.error("[Upload] Error processing upload:", error);
//                 next(error);
//             }
//         },
//     );

//     app.get(`${apiPrefix}/scripts/scenes`, async (_req, res, next) => {
//         try {
//             const script = await storage.getCurrentScript();
//             if (!script)
//                 return res
//                     .status(404)
//                     .json({ message: "No current script found" });
//             const scenes = await storage.getScenesByScriptId(script.id);
//             res.json(scenes);
//         } catch (error) {
//             next(error);
//         }
//     });

//     app.get(
//         `${apiPrefix}/scripts/brandable-scenes`,
//         async (_req, res, next) => {
//             try {
//                 const script = await storage.getCurrentScript();
//                 if (!script)
//                     return res
//                         .status(404)
//                         .json({ message: "No current script found" });
//                 const brandableScenes = await storage.getBrandableScenes(
//                     script.id,
//                 );
//                 res.json(brandableScenes);
//             } catch (error) {
//                 next(error);
//             }
//         },
//     );

//     app.get(`${apiPrefix}/scripts/scene-variations`, async (req, res, next) => {
//         const sceneIdParam = req.query.sceneId as string;
//         const logPrefix = `[GET /scene-variations S:${sceneIdParam}]`;
//         console.log(`${logPrefix} Request received.`);

//         try {
//             const sceneId = parseInt(sceneIdParam);
//             if (isNaN(sceneId)) {
//                 console.warn(`${logPrefix} Invalid Scene ID.`);
//                 return res
//                     .status(400)
//                     .json({ message: "Valid Scene ID is required" });
//             }

//             console.log(`${logPrefix} Fetching existing variations...`);
//             let variations = await storage.getSceneVariations(sceneId);
//             console.log(
//                 `${logPrefix} Found ${variations.length} existing variations.`,
//             );

//             if (variations.length === 0) {
//                 console.log(
//                     `${logPrefix} No variations exist, attempting on-demand generation...`,
//                 );
//                 console.time(`${logPrefix}_OnDemandGen`);
//                 variations =
//                     await _generateAndSaveSceneVariationsForRoute(sceneId);
//                 console.timeEnd(`${logPrefix}_OnDemandGen`);
//                 console.log(
//                     `${logPrefix} On-demand generation finished. Generated ${variations.length} variations.`,
//                 );
//             } else {
//                 console.log(`${logPrefix} Returning existing variations.`);
//             }
//             res.json(variations);
//         } catch (error: any) {
//             console.error(
//                 `${logPrefix} Error fetching/generating variations:`,
//                 error,
//             );
//             next(error);
//         }
//     });

//     app.put(
//         `${apiPrefix}/scripts/variations/select`,
//         async (req, res, next) => {
//             const variationIdParam = req.body.variationId as string;
//             const logPrefix = `[PUT /select-variation V:${variationIdParam}]`;
//             try {
//                 const variationId = parseInt(variationIdParam);
//                 if (isNaN(variationId)) {
//                     console.warn(`${logPrefix} Invalid Variation ID.`);
//                     return res
//                         .status(400)
//                         .json({ message: "Valid Variation ID is required" });
//                 }
//                 const updatedVariation =
//                     await storage.selectVariation(variationId);
//                 if (!updatedVariation) {
//                     console.warn(
//                         `${logPrefix} Variation not found or selection failed.`,
//                     );
//                     return res
//                         .status(404)
//                         .json({
//                             message: `Variation with ID ${variationId} not found.`,
//                         });
//                 }
//                 console.log(`${logPrefix} Variation successfully selected.`);
//                 res.json(updatedVariation);
//             } catch (error) {
//                 console.error(`${logPrefix} Error selecting variation:`, error);
//                 next(error);
//             }
//         },
//     );

//     app.put(
//         `${apiPrefix}/variations/:variationId/update-prompt-and-image`,
//         async (req, res, next) => {
//             const variationIdParam = req.params.variationId;
//             const { newPrompt } = req.body;
//             const logPrefix = `[PUT /update-prompt-and-image V:${variationIdParam}]`;

//             try {
//                 const variationId = parseInt(variationIdParam);
//                 if (isNaN(variationId)) {
//                     console.warn(`${logPrefix} Invalid Variation ID.`);
//                     return res
//                         .status(400)
//                         .json({ message: "Valid Variation ID is required" });
//                 }
//                 if (
//                     !newPrompt ||
//                     typeof newPrompt !== "string" ||
//                     newPrompt.trim().length < 10
//                 ) {
//                     console.warn(`${logPrefix} Invalid new prompt provided.`);
//                     return res
//                         .status(400)
//                         .json({
//                             message:
//                                 "A valid new prompt is required (min 10 chars).",
//                         });
//                 }

//                 console.log(
//                     `${logPrefix} Request received. New prompt: ${newPrompt.substring(0, 50)}...`,
//                 );

//                 const variation =
//                     await storage.getSceneVariationById(variationId);
//                 if (!variation) {
//                     return res
//                         .status(404)
//                         .json({
//                             message: `Variation with ID ${variationId} not found.`,
//                         });
//                 }

//                 const scene = await storage.getSceneById(variation.sceneId);
//                 if (!scene) {
//                     return res
//                         .status(404)
//                         .json({
//                             message: `Scene with ID ${variation.sceneId} not found.`,
//                         });
//                 }

//                 const product = await storage.getProductById(
//                     variation.productId,
//                 );
//                 if (!product) {
//                     return res
//                         .status(404)
//                         .json({
//                             message: `Product with ID ${variation.productId} not found.`,
//                         });
//                 }

//                 const generationResult = await generateProductPlacement({
//                     scene,
//                     product,
//                     variationNumber: variation.variationNumber,
//                     prompt: newPrompt,
//                 });

//                 if (!generationResult.success) {
//                     return res
//                         .status(500)
//                         .json({
//                             message: "Failed to regenerate image.",
//                             details: generationResult.description,
//                         });
//                 }

//                 const updatedVariation = await storage.updateSceneVariation(
//                     variationId,
//                     {
//                         geminiPrompt: newPrompt,
//                         imageUrl: generationResult.imageUrl,
//                         description: `Variation ${variation.variationNumber}: ${product.name} - ${scene.heading}. User Prompt: ${newPrompt.substring(0, 40)}...`,
//                     },
//                 );

//                 if (!updatedVariation) {
//                     return res
//                         .status(500)
//                         .json({
//                             message:
//                                 "Failed to update variation after image regeneration.",
//                         });
//                 }

//                 console.log(
//                     `${logPrefix} Variation updated successfully. New Image URL: ${updatedVariation.imageUrl.substring(0, 60)}...`,
//                 );
//                 res.json(updatedVariation);
//             } catch (error) {
//                 console.error(
//                     `${logPrefix} Error updating prompt and image:`,
//                     error,
//                 );
//                 next(error);
//             }
//         },
//     );

//     // --- NEW: Route to change product for a variation and regenerate ---
//     app.put(
//         `${apiPrefix}/variations/:variationId/change-product`,
//         async (req, res, next) => {
//             const variationIdParam = req.params.variationId;
//             const { newProductId } = req.body;
//             const logPrefix = `[PUT /change-product V:${variationIdParam} NewP:${newProductId}]`;

//             try {
//                 const variationId = parseInt(variationIdParam);
//                 const parsedNewProductId = parseInt(newProductId as string);

//                 if (isNaN(variationId) || isNaN(parsedNewProductId)) {
//                     return res
//                         .status(400)
//                         .json({
//                             message:
//                                 "Valid Variation ID and New Product ID are required.",
//                         });
//                 }

//                 console.log(`${logPrefix} Request received.`);

//                 // 1. Fetch existing variation to get sceneId and variationNumber
//                 const originalVariation =
//                     await storage.getSceneVariationById(variationId);
//                 if (!originalVariation) {
//                     return res
//                         .status(404)
//                         .json({
//                             message: `Variation with ID ${variationId} not found.`,
//                         });
//                 }

//                 // 2. Fetch the Scene
//                 const scene = await storage.getSceneById(
//                     originalVariation.sceneId,
//                 );
//                 if (!scene) {
//                     return res
//                         .status(404)
//                         .json({
//                             message: `Scene with ID ${originalVariation.sceneId} not found.`,
//                         });
//                 }

//                 // 3. Fetch the New Product
//                 const newProduct =
//                     await storage.getProductById(parsedNewProductId);
//                 if (!newProduct) {
//                     return res
//                         .status(404)
//                         .json({
//                             message: `New product with ID ${parsedNewProductId} not found.`,
//                         });
//                 }

//                 console.log(
//                     `${logPrefix} Swapping to Product: ${newProduct.name} for Scene: ${scene.heading}`,
//                 );

//                 // 4. Generate new creative prompt for the new product in the scene
//                 console.time(`${logPrefix}_NewGeminiPrompt`);
//                 const newCreativePrompt = await generateCreativePlacementPrompt(
//                     scene,
//                     newProduct,
//                 );
//                 console.timeEnd(`${logPrefix}_NewGeminiPrompt`);
//                 if (
//                     !newCreativePrompt ||
//                     newCreativePrompt.includes("Error:")
//                 ) {
//                     throw new Error(
//                         `Gemini failed to generate a valid prompt for the new product: ${newCreativePrompt}`,
//                     );
//                 }
//                 console.log(
//                     `${logPrefix} New Gemini Prompt: ${newCreativePrompt.substring(0, 70)}...`,
//                 );

//                 // 5. Generate new image using the new product and new prompt
//                 console.time(`${logPrefix}_NewReplicateImage`);
//                 const generationResult = await generateProductPlacement({
//                     scene,
//                     product: newProduct,
//                     variationNumber: originalVariation.variationNumber, // Keep original variation number
//                     prompt: newCreativePrompt,
//                 });
//                 console.timeEnd(`${logPrefix}_NewReplicateImage`);

//                 if (!generationResult.success) {
//                     return res
//                         .status(500)
//                         .json({
//                             message:
//                                 "Failed to regenerate image for the new product.",
//                             details: generationResult.description,
//                         });
//                 }

//                 // 6. Update the variation in the database
//                 const updatedVariation = await storage.updateSceneVariation(
//                     variationId,
//                     {
//                         productId: newProduct.id,
//                         geminiPrompt: newCreativePrompt,
//                         imageUrl: generationResult.imageUrl,
//                         description: `Variation ${originalVariation.variationNumber}: ${newProduct.name} - ${scene.heading}. Prompt: ${newCreativePrompt.substring(0, 50)}...`,
//                         isSelected: false, // Optionally reset selection status
//                         // Any video-related fields should also be reset here if they exist on the variation
//                     },
//                 );

//                 if (!updatedVariation) {
//                     return res
//                         .status(500)
//                         .json({
//                             message:
//                                 "Failed to update variation after changing product and regenerating image.",
//                         });
//                 }

//                 console.log(
//                     `${logPrefix} Variation product changed and image regenerated successfully.`,
//                 );
//                 res.json(updatedVariation);
//             } catch (error) {
//                 console.error(
//                     `${logPrefix} Error changing product for variation:`,
//                     error,
//                 );
//                 next(error);
//             }
//         },
//     );

//     // --- Video Generation Routes ---
//     app.post(
//         `${apiPrefix}/variations/:variationId/generate-video`,
//         async (req, res, next) => {
//             const variationIdParam = req.params.variationId;
//             const logPrefix = `[POST /generate-video V:${variationIdParam}]`;
//             try {
//                 const variationId = parseInt(variationIdParam);
//                 if (isNaN(variationId)) {
//                     console.warn(`${logPrefix} Invalid Variation ID.`);
//                     return res
//                         .status(400)
//                         .json({ message: "Valid Variation ID is required" });
//                 }
//                 console.log(`${logPrefix} Request received.`);

//                 const result = await generateVideoFromVariation(variationId);

//                 if (result.error) {
//                     console.error(
//                         `${logPrefix} Failed to start video generation: ${result.error}`,
//                     );
//                     return res
//                         .status(500)
//                         .json({
//                             message: result.error,
//                             predictionId: result.predictionId,
//                         });
//                 }

//                 console.log(
//                     `${logPrefix} Video generation started. Prediction ID: ${result.predictionId}, Status: ${result.status}`,
//                 );
//                 res.status(202).json({
//                     message: "Video generation started.",
//                     predictionId: result.predictionId,
//                     status: result.status,
//                 });
//             } catch (error) {
//                 console.error(`${logPrefix} Unexpected error:`, error);
//                 next(error);
//             }
//         },
//     );

//     app.get(
//         `${apiPrefix}/replicate/predictions/:predictionId`,
//         async (req, res, next) => {
//             const predictionId = req.params.predictionId;
//             const logPrefix = `[GET /prediction-status P:${predictionId}]`;
//             try {
//                 if (!predictionId || typeof predictionId !== "string") {
//                     return res
//                         .status(400)
//                         .json({ message: "Valid Prediction ID is required" });
//                 }
//                 const result = await getPredictionStatus(predictionId);
//                 res.json(result);
//             } catch (error) {
//                 console.error(`${logPrefix} Unexpected error:`, error);
//                 next(error);
//             }
//         },
//     );

//     app.get(`${apiPrefix}/scripts/export`, async (_req, res, next) => {
//         const logPrefix = `[GET /export]`;
//         try {
//             console.log(`${logPrefix} Request received.`);
//             const script = await storage.getCurrentScript();
//             if (!script)
//                 return res
//                     .status(404)
//                     .json({ message: "No current script found" });

//             const scenes = await storage.getScenesByScriptId(script.id);
//             const exportData: ExportData = {
//                 script: {
//                     id: script.id,
//                     title: script.title,
//                     createdAt: script.createdAt,
//                     updatedAt: script.updatedAt,
//                 },
//                 placements: [],
//             };

//             for (const scene of scenes) {
//                 if (scene.isBrandable) {
//                     const variations = await storage.getSceneVariations(
//                         scene.id,
//                     );
//                     const selectedVariation = variations.find(
//                         (v) => v.isSelected,
//                     );

//                     let selectedProductData: ExportData["placements"][0]["selectedProduct"] =
//                         null;
//                     let selectedVariationImageUrl: string | null = null;

//                     if (selectedVariation) {
//                         selectedVariationImageUrl = selectedVariation.imageUrl;
//                         if (selectedVariation.productId) {
//                             selectedProductData = {
//                                 id: selectedVariation.productId,
//                                 companyName:
//                                     selectedVariation.productName || "N/A",
//                                 name: selectedVariation.productName || "N/A",
//                                 category:
//                                     selectedVariation.productCategory ||
//                                     "OTHER",
//                                 imageUrl:
//                                     selectedVariation.productImageUrl || "",
//                             };
//                         }
//                     }

//                     exportData.placements.push({
//                         sceneId: scene.id,
//                         sceneNumber: scene.sceneNumber,
//                         sceneHeading: scene.heading,
//                         selectedProduct: selectedProductData,
//                         selectedVariationImageUrl: selectedVariationImageUrl,
//                     });
//                 }
//             }
//             console.log(
//                 `${logPrefix} Export data prepared for Script ID: ${script.id}.`,
//             );
//             res.json(exportData);
//         } catch (error) {
//             console.error(`${logPrefix} Error generating export data:`, error);
//             next(error);
//         }
//     });

//     const httpServer = createServer(app);
//     return httpServer;
// }


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
    generateCreativePlacementPrompt,
    AIAnalysisResponseForRoutes,
    extractTextFromImage,
    extractTextFromPdf as extractPdfTextViaGemini,
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
    SceneVariation as DbSceneVariation, // Renamed to avoid conflict with extended type
    Product,
    Script,
} from "@shared/schema";
import { ZodError } from "zod";

// --- Interfaces ---
// This interface is used for data returned to the frontend, including joined product details
interface SceneVariation extends DbSceneVariation {
    productName?: string;
    productCategory?: ProductCategory;
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
        selectedProduct: Product | null;
        selectedVariationImageUrl: string | null;
    }[];
}

// --- Utility Functions ---
const sanitizeString = (str: string | null | undefined): string => {
    if (!str) return "";
    return str.replace(/\u0000/g, "").replace(/[^\x20-\x7E\u00A0-\uFFFF]/g, "");
};

// --- Multer Setup ---
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("Invalid file type. Only PDF, JPG, PNG allowed."));
        }
    },
});

// --- Helper: _generateAndSaveSceneVariationsForRoute ---
async function _generateAndSaveSceneVariationsForRoute(
    sceneId: number,
): Promise<SceneVariation[]> {
    const logPrefix = `[VarGen Route S:${sceneId}]`;
    console.log(`${logPrefix} Starting on-demand variation generation...`);
    try {
        let scene = await storage.getSceneById(sceneId);
        if (!scene) {
            console.error(`${logPrefix} Scene not found.`);
            return [];
        }
        console.log(
            `${logPrefix} Found Scene ${scene.sceneNumber}: ${scene.heading}, Current Brandable: ${scene.isBrandable}`,
        );

        // If categories are missing OR if it wasn't brandable (implying categories might be missing or outdated)
        // try to get/update categories.
        if (!scene.isBrandable || !scene.suggestedCategories || scene.suggestedCategories.length === 0) {
            console.log(
                `${logPrefix} Categories missing or scene not marked brandable. Analyzing/Re-analyzing with Gemini for scene ${scene.id}...`,
            );
            try {
                const analysisResult = await identifyBrandableScenesWithGemini([scene], 1);
                if (analysisResult.brandableScenes.length > 0 && analysisResult.brandableScenes[0].sceneId === scene.id) {
                    const brandableData = analysisResult.brandableScenes[0];
                    const updatedSceneInDb = await storage.updateScene(scene.id, {
                        isBrandable: true,
                        brandableReason: brandableData.reason,
                        suggestedCategories: brandableData.suggestedProducts,
                    });
                    if (updatedSceneInDb) {
                        scene = updatedSceneInDb; // Update local 'scene' variable
                        console.log(
                            `${logPrefix} Scene ${scene.id} updated. Brandable: true, Categories: ${scene.suggestedCategories?.join(", ")}`,
                        );
                    } else {
                         console.warn(`${logPrefix} Failed to update scene ${scene.id} in DB after Gemini analysis.`);
                    }
                } else {
                    console.warn(
                        `${logPrefix} Gemini analysis did not yield brandable info for scene ${scene.id}. Will proceed without specific categories.`,
                    );
                    // If no categories, getTopMatchingProductsForScene will fetch generic products.
                    // Ensure scene.isBrandable is at least marked true if we proceed with generation,
                    // or decide if generation should be blocked if no categories can be found.
                    // For now, let's mark it as brandable if we attempt generation.
                    if (!scene.isBrandable) {
                        const updatedSceneInDb = await storage.updateScene(scene.id, { isBrandable: true });
                        if (updatedSceneInDb) scene = updatedSceneInDb;
                    }
                }
            } catch (analysisError) {
                console.error(
                    `${logPrefix} Error during scene analysis for categories:`,
                    analysisError,
                );
            }
        }

        const categories = scene.suggestedCategories || []; // Use potentially updated categories
        console.log(
            `${logPrefix} Fetching top 3 products for categories: ${categories.join(", ") || "None (will use generic)"}`,
        );
        const selectedProducts = await storage.getTopMatchingProductsForScene(sceneId, categories, 3);

        if (selectedProducts.length === 0) {
            console.warn(`${logPrefix} No suitable products found. Cannot generate variations.`);
            return [];
        }
        console.log(`${logPrefix} Selected products: ${selectedProducts.map((p) => p.name).join(", ")}`);

        const variationPromises = selectedProducts.map(async (product, i) => {
            const variationNumber = i + 1;
            const varLogPrefix = `${logPrefix} V${variationNumber} (P:${product.id})`;
            try {
                const creativePrompt = await generateCreativePlacementPrompt(scene!, product);
                if (!creativePrompt || creativePrompt.includes("Error:")) {
                    throw new Error(`Gemini failed to generate a valid prompt: ${creativePrompt}`);
                }
                const generationResult = await generateProductPlacement({ scene: scene!, product, variationNumber, prompt: creativePrompt });
                const cleanDescription = `Variation ${variationNumber}: ${product.name} - ${scene!.heading}. Prompt: ${creativePrompt.substring(0, 50)}...`;
                const variationData = {
                    sceneId: scene!.id,
                    productId: product.id,
                    variationNumber,
                    description: sanitizeString(cleanDescription),
                    imageUrl: generationResult.imageUrl, // This might be a fallback URL
                    geminiPrompt: creativePrompt,
                    isSelected: false,
                };
                const newVariationDb = await storage.createSceneVariation(variationData);
                return {
                    ...newVariationDb,
                    productName: product.name,
                    productCategory: product.category,
                    productImageUrl: product.imageUrl
                } as SceneVariation;
            } catch (error) {
                console.error(`${varLogPrefix} Error during variation generation:`, error);
                return null;
            }
        });

        const results = await Promise.all(variationPromises);
        const successfulVariations = results.filter((v): v is SceneVariation => v !== null);
        console.log(`${logPrefix} Generated ${successfulVariations.length}/${selectedProducts.length} variations.`);
        return successfulVariations;
    } catch (outerError) {
        console.error(`${logPrefix} CRITICAL ERROR during variation generation process:`, outerError);
        return [];
    }
}

// --- Routes Registration ---
export async function registerRoutes(app: Express): Promise<Server> {
    const apiPrefix = "/api";

    // ... (Actor, Product, Location, other Script routes remain unchanged) ...
    app.get(`${apiPrefix}/actors`, async (req, res, next) => {
        try {
            const page = parseInt((req.query.page as string) || "1");
            const pageSize = parseInt((req.query.pageSize as string) || "10");
            const search = (req.query.search as string) || "";
            const gender = (req.query.gender as string) || "";
            const nationality = (req.query.nationality as string) || "";

            const result = await storage.getActors({ search, gender, nationality, page, pageSize });
            res.json(result);
        } catch (error) { next(error); }
    });
    app.put(`${apiPrefix}/actors/:id`, async (req, res, next) => {
        try {
            const id = parseInt(req.params.id);
            if (isNaN(id)) return res.status(400).json({ message: "Invalid actor ID" });
            const validatedData = insertActorSchema.partial().parse(req.body);
            const updated = await storage.updateActor(id, validatedData);
            if (!updated) return res.status(404).json({ message: "Actor not found" });
            res.json(updated);
        } catch (error) {
            if (error instanceof ZodError) return res.status(400).json({ message: "Validation failed", errors: error.errors });
            next(error);
        }
    });

    app.get(`${apiPrefix}/products`, async (req, res, next) => {
        try {
            const page = parseInt((req.query.page as string) || "1");
            const pageSize = parseInt((req.query.pageSize as string) || "12");
            const search = (req.query.search as string) || "";
            const category = (req.query.category as string) || "ALL";
            const result = await storage.getProducts({ search, category, page, pageSize });
            res.json(result);
        } catch (error) { next(error); }
    });
    app.post(`${apiPrefix}/products`, async (req, res, next) => {
        try {
            const validatedData = insertProductSchema.parse(req.body);
            const newProduct = await storage.createProduct(validatedData);
            res.status(201).json(newProduct);
        } catch (error) {
            if (error instanceof ZodError) return res.status(400).json({ message: "Validation failed", errors: error.errors });
            next(error);
        }
    });
    app.put(`${apiPrefix}/products/:id`, async (req, res, next) => {
        try {
            const id = parseInt(req.params.id);
            if (isNaN(id)) return res.status(400).json({ message: "Invalid product ID" });
            const partialSchema = insertProductSchema.partial().omit({ id: true, createdAt: true, updatedAt: true });
            const validatedData = partialSchema.parse(req.body);
            const updated = await storage.updateProduct(id, validatedData);
            if (!updated) return res.status(404).json({ message: "Product not found" });
            res.json(updated);
        } catch (error) {
            if (error instanceof ZodError) return res.status(400).json({ message: "Validation failed", errors: error.errors });
            next(error);
        }
    });
    app.delete(`${apiPrefix}/products/:id`, async (req, res, next) => {
        try {
            const id = parseInt(req.params.id);
            if (isNaN(id)) return res.status(400).json({ message: "Invalid product ID" });
            const deleted = await storage.deleteProduct(id);
            if (!deleted) return res.status(404).json({ message: "Product not found" });
            res.status(204).send();
        } catch (error) { next(error); }
    });

    app.post(`${apiPrefix}/locations`, async (req, res, next) => {
        try {
            const validatedData = insertLocationSchema.parse(req.body);
            const newLocation = await storage.createLocation(validatedData);
            res.status(201).json(newLocation);
        } catch (error) {
            if (error instanceof ZodError) return res.status(400).json({ message: "Validation failed", errors: error.errors });
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
            if (error instanceof ZodError) return res.status(400).json({ message: "Validation failed", errors: error.errors });
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
        } catch (error) { next(error); }
    });
     app.get(`${apiPrefix}/scripts/current`, async (_req, res, next) => {
        try {
            const script = await storage.getCurrentScript();
            if (!script) return res.status(404).json({ message: "No current script found" });
            res.json({ id: script.id, title: script.title, createdAt: script.createdAt, updatedAt: script.updatedAt });
        } catch (error) { next(error); }
    });
    app.post(`${apiPrefix}/scripts/upload`, upload.single("script"), async (req, res, next) => {
        // ... (upload logic remains the same as it already creates scenes and runs initial Gemini analysis) ...
        let script: Script | null = null;
            try {
                if (!req.file) { return res.status(400).json({ message: "No file uploaded" }); }
                console.log(`[Upload] Processing: ${req.file.originalname}, Type: ${req.file.mimetype}`);
                console.time("[Upload] scriptExtraction");
                const parsedScript = await extractScriptFromPdf(req.file.buffer, req.file.mimetype);
                console.timeEnd("[Upload] scriptExtraction");
                if (parsedScript.content.startsWith("Error:")) {
                    console.error(`[Upload] Script extraction failed: ${parsedScript.content}`);
                    return res.status(400).json({ message: `Script extraction failed: ${parsedScript.title}` });
                }
                console.log(`[Upload] Extracted Title: ${parsedScript.title}, Content Sample: ${parsedScript.content.substring(0, 50)}...`);
                console.time("[Upload] createScriptRecord");
                script = await storage.createScript({ title: sanitizeString(parsedScript.title), content: parsedScript.content });
                console.timeEnd("[Upload] createScriptRecord");
                console.time("[Upload] createSceneRecords");
                const createdScenes: DbScene[] = [];
                for (const sceneData of parsedScript.scenes) {
                    const newScene = await storage.createScene({ scriptId: script.id, sceneNumber: sceneData.sceneNumber, heading: sanitizeString(sceneData.heading), content: sceneData.content });
                    createdScenes.push(newScene);
                }
                console.timeEnd("[Upload] createSceneRecords");
                console.log(`[Upload] Created ${createdScenes.length} scenes.`);
                console.time("[Upload] geminiAnalysis");
                let analysisResult: AIAnalysisResponseForRoutes = { brandableScenes: [] };
                if (createdScenes.length > 0) {
                    analysisResult = await identifyBrandableScenesWithGemini(createdScenes, 5);
                    console.log(`[Upload] Gemini identified ${analysisResult.brandableScenes.length} potential brandable scenes.`);
                    console.time("[Upload] updateBrandableScenes");
                    const updatePromises = analysisResult.brandableScenes.map(
                        (brandable) => storage.updateScene(brandable.sceneId, { isBrandable: true, brandableReason: sanitizeString(brandable.reason), suggestedCategories: brandable.suggestedProducts })
                                            .catch((e) => console.error(`Failed updating scene ${brandable.sceneId}:`,e)),
                    );
                    await Promise.all(updatePromises);
                    console.timeEnd("[Upload] updateBrandableScenes");
                } else {
                    console.log("[Upload] No scenes extracted, skipping brandability analysis.");
                }
                console.timeEnd("[Upload] geminiAnalysis");
                console.log("[Upload] Processed successfully.");
                res.status(201).json({ script: { id: script.id, title: script.title }, scenesCount: createdScenes.length, brandableScenesCount: analysisResult.brandableScenes.length });
            } catch (error) { console.error("[Upload] Error processing upload:", error); next(error); }
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
            let variations = await storage.getSceneVariations(sceneId); // This now returns the extended SceneVariation type
            console.log(`${logPrefix} Found ${variations.length} existing variations.`);
            if (variations.length === 0) {
                console.log(`${logPrefix} No variations exist, attempting on-demand generation...`);
                console.time(`${logPrefix}_OnDemandGen`);
                variations = await _generateAndSaveSceneVariationsForRoute(sceneId); // This helper now also returns the extended type
                console.timeEnd(`${logPrefix}_OnDemandGen`);
                console.log(`${logPrefix} On-demand generation finished. Generated ${variations.length} variations.`);
            } else {
                console.log(`${logPrefix} Returning existing variations.`);
            }
            res.json(variations);
        } catch (error: any) {
            console.error(`${logPrefix} Error fetching/generating variations:`, error);
            next(error);
        }
    });

    // ... (PUT /select-variation, PUT /update-prompt-and-image, PUT /change-product, POST /generate-video, GET /prediction-status, GET /export remain unchanged)
    app.put(`${apiPrefix}/scripts/variations/select`, async (req, res, next) => {
        const variationIdParam = req.body.variationId as string;
        try {
            const variationId = parseInt(variationIdParam);
            if (isNaN(variationId)) return res.status(400).json({ message: "Valid Variation ID is required" });
            const updatedVariation = await storage.selectVariation(variationId);
            if (!updatedVariation) return res.status(404).json({ message: `Variation with ID ${variationId} not found.`});
            res.json(updatedVariation);
        } catch (error) { next(error); }
    });
    app.put(`${apiPrefix}/variations/:variationId/update-prompt-and-image`, async (req, res, next) => {
        const variationIdParam = req.params.variationId;
        const { newPrompt } = req.body;
        try {
            const variationId = parseInt(variationIdParam);
            if (isNaN(variationId)) return res.status(400).json({ message: "Valid Variation ID is required" });
            if (!newPrompt || typeof newPrompt !== "string" || newPrompt.trim().length < 10) {
                return res.status(400).json({ message: "A valid new prompt is required (min 10 chars)." });
            }
            const variation = await storage.getSceneVariationById(variationId);
            if (!variation) return res.status(404).json({ message: `Variation with ID ${variationId} not found.` });
            const scene = await storage.getSceneById(variation.sceneId);
            if (!scene) return res.status(404).json({ message: `Scene with ID ${variation.sceneId} not found.` });
            const product = await storage.getProductById(variation.productId);
            if (!product) return res.status(404).json({ message: `Product with ID ${variation.productId} not found.` });
            const generationResult = await generateProductPlacement({ scene, product, variationNumber: variation.variationNumber, prompt: newPrompt });
            if (!generationResult.success) return res.status(500).json({ message: "Failed to regenerate image.", details: generationResult.description });
            const updatedVariation = await storage.updateSceneVariation(variationId, { geminiPrompt: newPrompt, imageUrl: generationResult.imageUrl, description: `Variation ${variation.variationNumber}: ${product.name} - ${scene.heading}. User Prompt: ${newPrompt.substring(0, 40)}...` });
            if (!updatedVariation) return res.status(500).json({ message: "Failed to update variation after image regeneration." });
            res.json(updatedVariation);
        } catch (error) { next(error); }
    });
     app.put(`${apiPrefix}/variations/:variationId/change-product`, async (req, res, next) => {
            const variationIdParam = req.params.variationId;
            const { newProductId } = req.body;
            try {
                const variationId = parseInt(variationIdParam);
                const parsedNewProductId = parseInt(newProductId as string);
                if (isNaN(variationId) || isNaN(parsedNewProductId)) return res.status(400).json({ message: "Valid Variation ID and New Product ID are required." });
                const originalVariation = await storage.getSceneVariationById(variationId);
                if (!originalVariation) return res.status(404).json({ message: `Variation with ID ${variationId} not found.` });
                const scene = await storage.getSceneById(originalVariation.sceneId);
                if (!scene) return res.status(404).json({ message: `Scene with ID ${originalVariation.sceneId} not found.` });
                const newProduct = await storage.getProductById(parsedNewProductId);
                if (!newProduct) return res.status(404).json({ message: `New product with ID ${parsedNewProductId} not found.` });
                const newCreativePrompt = await generateCreativePlacementPrompt(scene, newProduct);
                if (!newCreativePrompt || newCreativePrompt.includes("Error:")) throw new Error(`Gemini failed to generate a valid prompt for the new product: ${newCreativePrompt}`);
                const generationResult = await generateProductPlacement({ scene, product: newProduct, variationNumber: originalVariation.variationNumber, prompt: newCreativePrompt });
                if (!generationResult.success) return res.status(500).json({ message: "Failed to regenerate image for the new product.", details: generationResult.description });
                const updatedVariation = await storage.updateSceneVariation(variationId, { productId: newProduct.id, geminiPrompt: newCreativePrompt, imageUrl: generationResult.imageUrl, description: `Variation ${originalVariation.variationNumber}: ${newProduct.name} - ${scene.heading}. Prompt: ${newCreativePrompt.substring(0, 50)}...`, isSelected: false });
                if (!updatedVariation) return res.status(500).json({ message: "Failed to update variation after changing product and regenerating image." });
                res.json(updatedVariation);
            } catch (error) { next(error); }
        },
    );
    app.post(`${apiPrefix}/variations/:variationId/generate-video`, async (req, res, next) => {
        const variationIdParam = req.params.variationId;
        try {
            const variationId = parseInt(variationIdParam);
            if (isNaN(variationId)) return res.status(400).json({ message: "Valid Variation ID is required" });
            const result = await generateVideoFromVariation(variationId);
            if (result.error) return res.status(500).json({ message: result.error, predictionId: result.predictionId });
            res.status(202).json({ message: "Video generation started.", predictionId: result.predictionId, status: result.status });
        } catch (error) { next(error); }
    });
    app.get(`${apiPrefix}/replicate/predictions/:predictionId`, async (req, res, next) => {
        const predictionId = req.params.predictionId;
        try {
            if (!predictionId || typeof predictionId !== "string") return res.status(400).json({ message: "Valid Prediction ID is required" });
            const result = await getPredictionStatus(predictionId);
            res.json(result);
        } catch (error) { next(error); }
    });
    app.get(`${apiPrefix}/scripts/export`, async (_req, res, next) => {
        try {
            const script = await storage.getCurrentScript();
            if (!script) return res.status(404).json({ message: "No current script found" });
            const scenes = await storage.getScenesByScriptId(script.id);
            const exportData: ExportData = { script: { id: script.id, title: script.title, createdAt: script.createdAt, updatedAt: script.updatedAt }, placements: [] };
            for (const scene of scenes) {
                if (scene.isBrandable) {
                    const variations = await storage.getSceneVariations(scene.id);
                    const selectedVariation = variations.find((v) => v.isSelected);
                    let selectedProductData: ExportData["placements"][0]["selectedProduct"] = null;
                    let selectedVariationImageUrl: string | null = null;
                    if (selectedVariation) {
                        selectedVariationImageUrl = selectedVariation.imageUrl;
                        if (selectedVariation.productId) {
                            selectedProductData = { id: selectedVariation.productId, companyName: selectedVariation.productName || "N/A", name: selectedVariation.productName || "N/A", category: selectedVariation.productCategory || "OTHER", imageUrl: selectedVariation.productImageUrl || "" };
                        }
                    }
                    exportData.placements.push({ sceneId: scene.id, sceneNumber: scene.sceneNumber, sceneHeading: scene.heading, selectedProduct: selectedProductData, selectedVariationImageUrl: selectedVariationImageUrl });
                }
            }
            res.json(exportData);
        } catch (error) { next(error); }
    });


    const httpServer = createServer(app);
    return httpServer;
}