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
//     SceneVariation as DbSceneVariation,
//     Product,
//     Script,
// } from "@shared/schema";
// import { ZodError } from "zod";

// // --- Interfaces ---
// interface SceneVariation extends DbSceneVariation { // Extended type
//     productName?: string;
//     productCategory?: ProductCategory;
//     productImageUrl?: string | null;
// }

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
//         selectedProduct: Product | null;
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
//     limits: { fileSize: 15 * 1024 * 1024 },
//     fileFilter: (req, file, cb) => {
//         const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
//         if (allowedTypes.includes(file.mimetype)) {
//             cb(null, true);
//         } else {
//             cb(new Error("Invalid file type. Only PDF, JPG, PNG allowed."));
//         }
//     },
// });

// // --- Helper: _generateAndSaveSceneVariationsForRoute ---
// async function _generateAndSaveSceneVariationsForRoute(
//     sceneId: number,
// ): Promise<SceneVariation[]> { // Return extended type
//     const logPrefix = `[VarGen Route S:${sceneId}]`;
//     console.log(`${logPrefix} Starting on-demand variation generation...`);
//     try {
//         let scene = await storage.getSceneById(sceneId);
//         if (!scene) {
//             console.error(`${logPrefix} Scene not found.`);
//             return [];
//         }
//         console.log(`${logPrefix} Found Scene ${scene.sceneNumber}: ${scene.heading}, Brandable: ${scene.isBrandable}`);

//         if (!scene.isBrandable || !scene.suggestedCategories || scene.suggestedCategories.length === 0) {
//             console.log(`${logPrefix} Analyzing/Re-analyzing with Gemini for scene ${scene.id}...`);
//             try {
//                 const analysisResult = await identifyBrandableScenesWithGemini([scene], 1);
//                 if (analysisResult.brandableScenes.length > 0 && analysisResult.brandableScenes[0].sceneId === scene.id) {
//                     const brandableData = analysisResult.brandableScenes[0];
//                     const updatedSceneInDb = await storage.updateScene(scene.id, {
//                         isBrandable: true,
//                         brandableReason: brandableData.reason,
//                         suggestedCategories: brandableData.suggestedProducts,
//                     });
//                     if (updatedSceneInDb) scene = updatedSceneInDb;
//                     console.log(`${logPrefix} Scene ${scene.id} updated. Brandable: true, Categories: ${scene.suggestedCategories?.join(", ")}`);
//                 } else {
//                     console.warn(`${logPrefix} Gemini analysis did not yield brandable info for scene ${scene.id}.`);
//                     if (!scene.isBrandable) {
//                          const updatedSceneInDb = await storage.updateScene(scene.id, { isBrandable: true });
//                          if (updatedSceneInDb) scene = updatedSceneInDb;
//                     }
//                 }
//             } catch (analysisError) { console.error(`${logPrefix} Error during scene analysis:`, analysisError); }
//         }

//         const categories = scene.suggestedCategories || [];
//         console.log(`${logPrefix} Fetching products for categories: ${categories.join(", ") || "None (generic)"}`);
//         const selectedProducts = await storage.getTopMatchingProductsForScene(sceneId, categories, 3);

//         if (selectedProducts.length === 0) {
//             console.warn(`${logPrefix} No suitable products found.`);
//             return [];
//         }
//         console.log(`${logPrefix} Selected products: ${selectedProducts.map((p) => p.name).join(", ")}`);

//         const variationPromises = selectedProducts.map(async (product, i) => {
//             const variationNumber = i + 1;
//             const varLogPrefix = `${logPrefix} V${variationNumber} (P:${product.id})`;
//             try {
//                 const creativePrompt = await generateCreativePlacementPrompt(scene!, product);
//                 if (!creativePrompt || creativePrompt.includes("Error:")) throw new Error(`Gemini prompt error: ${creativePrompt}`);

//                 const generationResult = await generateProductPlacement({ scene: scene!, product, variationNumber, prompt: creativePrompt });
//                 const cleanDescription = `Variation ${variationNumber}: ${product.name} - ${scene!.heading}. Prompt: ${creativePrompt.substring(0, 50)}...`;

//                 const variationData = {
//                     sceneId: scene!.id, productId: product.id, variationNumber,
//                     description: sanitizeString(cleanDescription), imageUrl: generationResult.imageUrl,
//                     geminiPrompt: creativePrompt, isSelected: false,
//                 };
//                 const newVariationDb = await storage.createSceneVariation(variationData); // This returns the DB type
//                 // Manually construct the extended type for the response
//                 return {
//                     ...newVariationDb,
//                     productName: product.name,
//                     productCategory: product.category,
//                     productImageUrl: product.imageUrl
//                 } as SceneVariation; // Cast to the extended interface
//             } catch (error) {
//                 console.error(`${varLogPrefix} Error in variation generation:`, error);
//                 return null;
//             }
//         });

//         const results = await Promise.all(variationPromises);
//         const successfulVariations = results.filter((v): v is SceneVariation => v !== null);
//         console.log(`${logPrefix} Generated ${successfulVariations.length}/${selectedProducts.length} variations.`);
//         return successfulVariations;
//     } catch (outerError) {
//         console.error(`${logPrefix} CRITICAL ERROR in variation generation process:`, outerError);
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
//             const result = await storage.getActors({ search, gender, nationality, page, pageSize });
//             res.json(result);
//         } catch (error) { next(error); }
//     });
//     app.put(`${apiPrefix}/actors/:id`, async (req, res, next) => {
//         try {
//             const id = parseInt(req.params.id);
//             if (isNaN(id)) return res.status(400).json({ message: "Invalid actor ID" });
//             const validatedData = insertActorSchema.partial().parse(req.body);
//             const updated = await storage.updateActor(id, validatedData);
//             if (!updated) return res.status(404).json({ message: "Actor not found" });
//             res.json(updated);
//         } catch (error) {
//             if (error instanceof ZodError) return res.status(400).json({ message: "Validation failed", errors: error.errors });
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
//             const result = await storage.getProducts({ search, category, page, pageSize });
//             res.json(result);
//         } catch (error) { next(error); }
//     });
//     app.post(`${apiPrefix}/products`, async (req, res, next) => {
//         try {
//             const validatedData = insertProductSchema.parse(req.body);
//             const newProduct = await storage.createProduct(validatedData);
//             res.status(201).json(newProduct);
//         } catch (error) {
//             if (error instanceof ZodError) return res.status(400).json({ message: "Validation failed", errors: error.errors });
//             next(error);
//         }
//     });
//     app.put(`${apiPrefix}/products/:id`, async (req, res, next) => {
//         try {
//             const id = parseInt(req.params.id);
//             if (isNaN(id)) return res.status(400).json({ message: "Invalid product ID" });
//             const partialSchema = insertProductSchema.partial().omit({ id: true, createdAt: true, updatedAt: true });
//             const validatedData = partialSchema.parse(req.body);
//             const updated = await storage.updateProduct(id, validatedData);
//             if (!updated) return res.status(404).json({ message: "Product not found" });
//             res.json(updated);
//         } catch (error) {
//             if (error instanceof ZodError) return res.status(400).json({ message: "Validation failed", errors: error.errors });
//             next(error);
//         }
//     });
//     app.delete(`${apiPrefix}/products/:id`, async (req, res, next) => {
//         try {
//             const id = parseInt(req.params.id);
//             if (isNaN(id)) return res.status(400).json({ message: "Invalid product ID" });
//             const deleted = await storage.deleteProduct(id);
//             if (!deleted) return res.status(404).json({ message: "Product not found" });
//             res.status(204).send();
//         } catch (error) { next(error); }
//     });

//     // --- Location Routes ---
//     app.post(`${apiPrefix}/locations`, async (req, res, next) => {
//         try {
//             const validatedData = insertLocationSchema.parse(req.body);
//             const newLocation = await storage.createLocation(validatedData);
//             res.status(201).json(newLocation);
//         } catch (error) {
//             if (error instanceof ZodError) return res.status(400).json({ message: "Validation failed", errors: error.errors });
//             next(error);
//         }
//     });
//     app.put(`${apiPrefix}/locations/:id`, async (req, res, next) => {
//         try {
//             const id = parseInt(req.params.id);
//             if (isNaN(id)) return res.status(400).json({ message: "Invalid location ID" });
//             const partialSchema = insertLocationSchema.partial().omit({ id: true, createdAt: true, updatedAt: true });
//             const validatedData = partialSchema.parse(req.body);
//             const updated = await storage.updateLocation(id, validatedData);
//             if (!updated) return res.status(404).json({ message: "Location not found" });
//             res.json(updated);
//         } catch (error) {
//             if (error instanceof ZodError) return res.status(400).json({ message: "Validation failed", errors: error.errors });
//             next(error);
//         }
//     });
//     app.delete(`${apiPrefix}/locations/:id`, async (req, res, next) => {
//         try {
//             const id = parseInt(req.params.id);
//             if (isNaN(id)) return res.status(400).json({ message: "Invalid location ID" });
//             const deleted = await storage.deleteLocation(id);
//             if (!deleted) return res.status(404).json({ message: "Location not found" });
//             res.status(204).send();
//         } catch (error) { next(error); }
//     });

//     // --- Script Routes ---
//     app.get(`${apiPrefix}/scripts/current`, async (_req, res, next) => {
//         try {
//             const script = await storage.getCurrentScript();
//             if (!script) return res.status(404).json({ message: "No current script found" });
//             res.json({ id: script.id, title: script.title, createdAt: script.createdAt, updatedAt: script.updatedAt });
//         } catch (error) { next(error); }
//     });
//     app.post(`${apiPrefix}/scripts/upload`, upload.single("script"), async (req, res, next) => {
//         let script: Script | null = null;
//             try {
//                 if (!req.file) { return res.status(400).json({ message: "No file uploaded" }); }
//                 console.log(`[Upload] Processing: ${req.file.originalname}, Type: ${req.file.mimetype}`);
//                 console.time("[Upload] scriptExtraction");
//                 const parsedScript = await extractScriptFromPdf(req.file.buffer, req.file.mimetype);
//                 console.timeEnd("[Upload] scriptExtraction");
//                 if (parsedScript.content.startsWith("Error:")) {
//                     console.error(`[Upload] Script extraction failed: ${parsedScript.content}`);
//                     return res.status(400).json({ message: `Script extraction failed: ${parsedScript.title}` });
//                 }
//                 console.log(`[Upload] Extracted Title: ${parsedScript.title}, Content Sample: ${parsedScript.content.substring(0, 50)}...`);
//                 console.time("[Upload] createScriptRecord");
//                 script = await storage.createScript({ title: sanitizeString(parsedScript.title), content: parsedScript.content });
//                 console.timeEnd("[Upload] createScriptRecord");
//                 console.time("[Upload] createSceneRecords");
//                 const createdScenes: DbScene[] = [];
//                 for (const sceneData of parsedScript.scenes) {
//                     const newScene = await storage.createScene({ scriptId: script.id, sceneNumber: sceneData.sceneNumber, heading: sanitizeString(sceneData.heading), content: sceneData.content });
//                     createdScenes.push(newScene);
//                 }
//                 console.timeEnd("[Upload] createSceneRecords");
//                 console.log(`[Upload] Created ${createdScenes.length} scenes.`);
//                 console.time("[Upload] geminiAnalysis");
//                 let analysisResult: AIAnalysisResponseForRoutes = { brandableScenes: [] };
//                 if (createdScenes.length > 0) {
//                     analysisResult = await identifyBrandableScenesWithGemini(createdScenes, 5);
//                     console.log(`[Upload] Gemini identified ${analysisResult.brandableScenes.length} potential brandable scenes.`);
//                     console.time("[Upload] updateBrandableScenes");
//                     const updatePromises = analysisResult.brandableScenes.map(
//                         (brandable) => storage.updateScene(brandable.sceneId, { isBrandable: true, brandableReason: sanitizeString(brandable.reason), suggestedCategories: brandable.suggestedProducts })
//                                             .catch((e) => console.error(`Failed updating scene ${brandable.sceneId}:`,e)),
//                     );
//                     await Promise.all(updatePromises);
//                     console.timeEnd("[Upload] updateBrandableScenes");
//                 } else {
//                     console.log("[Upload] No scenes extracted, skipping brandability analysis.");
//                 }
//                 console.timeEnd("[Upload] geminiAnalysis");
//                 console.log("[Upload] Processed successfully.");
//                 res.status(201).json({ script: { id: script.id, title: script.title }, scenesCount: createdScenes.length, brandableScenesCount: analysisResult.brandableScenes.length });
//             } catch (error) { console.error("[Upload] Error processing upload:", error); next(error); }
//     });
//     app.get(`${apiPrefix}/scripts/scenes`, async (_req, res, next) => {
//         try {
//             const script = await storage.getCurrentScript();
//             if (!script) return res.status(404).json({ message: "No current script found" });
//             const scenes = await storage.getScenesByScriptId(script.id);
//             res.json(scenes);
//         } catch (error) { next(error); }
//     });
//     app.get(`${apiPrefix}/scripts/brandable-scenes`, async (_req, res, next) => {
//         try {
//             const script = await storage.getCurrentScript();
//             if (!script) return res.status(404).json({ message: "No current script found" });
//             const brandableScenes = await storage.getBrandableScenes(script.id);
//             res.json(brandableScenes);
//         } catch (error) { next(error); }
//     });
//     app.get(`${apiPrefix}/scripts/scene-variations`, async (req, res, next) => {
//         const sceneIdParam = req.query.sceneId as string;
//         const logPrefix = `[GET /scene-variations S:${sceneIdParam}]`;
//         try {
//             const sceneId = parseInt(sceneIdParam);
//             if (isNaN(sceneId)) return res.status(400).json({ message: "Valid Scene ID is required" });

//             let variations = await storage.getSceneVariations(sceneId); // This now returns the extended SceneVariation type
//             if (variations.length === 0) {
//                 console.log(`${logPrefix} No variations exist, attempting on-demand generation...`);
//                 variations = await _generateAndSaveSceneVariationsForRoute(sceneId); // This helper also returns the extended type
//             }
//             res.json(variations);
//         } catch (error: any) { next(error); }
//     });
//     app.put(`${apiPrefix}/scripts/variations/select`, async (req, res, next) => {
//         const variationIdParam = req.body.variationId as string;
//         try {
//             const variationId = parseInt(variationIdParam);
//             if (isNaN(variationId)) return res.status(400).json({ message: "Valid Variation ID is required" });
//             const updatedVariation = await storage.selectVariation(variationId);
//             if (!updatedVariation) return res.status(404).json({ message: `Variation with ID ${variationId} not found.`});
//             res.json(updatedVariation);
//         } catch (error) { next(error); }
//     });
//     app.put(`${apiPrefix}/variations/:variationId/update-prompt-and-image`, async (req, res, next) => {
//         const variationIdParam = req.params.variationId;
//         const { newPrompt } = req.body;
//         try {
//             const variationId = parseInt(variationIdParam);
//             if (isNaN(variationId)) return res.status(400).json({ message: "Valid Variation ID is required" });
//             if (!newPrompt || typeof newPrompt !== "string" || newPrompt.trim().length < 10) {
//                 return res.status(400).json({ message: "A valid new prompt is required (min 10 chars)." });
//             }
//             const variation = await storage.getSceneVariationById(variationId);
//             if (!variation) return res.status(404).json({ message: `Variation with ID ${variationId} not found.` });
//             const scene = await storage.getSceneById(variation.sceneId);
//             if (!scene) return res.status(404).json({ message: `Scene with ID ${variation.sceneId} not found.` });
//             const product = await storage.getProductById(variation.productId);
//             if (!product) return res.status(404).json({ message: `Product with ID ${variation.productId} not found.` });
//             const generationResult = await generateProductPlacement({ scene, product, variationNumber: variation.variationNumber, prompt: newPrompt });
//             if (!generationResult.success) return res.status(500).json({ message: "Failed to regenerate image.", details: generationResult.description });
//             const updatedVariation = await storage.updateSceneVariation(variationId, { geminiPrompt: newPrompt, imageUrl: generationResult.imageUrl, description: `Variation ${variation.variationNumber}: ${product.name} - ${scene.heading}. User Prompt: ${newPrompt.substring(0, 40)}...` });
//             if (!updatedVariation) return res.status(500).json({ message: "Failed to update variation after image regeneration." });
//             res.json(updatedVariation);
//         } catch (error) { next(error); }
//     });
//     app.put(`${apiPrefix}/variations/:variationId/change-product`, async (req, res, next) => {
//             const variationIdParam = req.params.variationId;
//             const { newProductId } = req.body;
//             try {
//                 const variationId = parseInt(variationIdParam);
//                 const parsedNewProductId = parseInt(newProductId as string);
//                 if (isNaN(variationId) || isNaN(parsedNewProductId)) return res.status(400).json({ message: "Valid Variation ID and New Product ID are required." });
//                 const originalVariation = await storage.getSceneVariationById(variationId);
//                 if (!originalVariation) return res.status(404).json({ message: `Variation with ID ${variationId} not found.` });
//                 const scene = await storage.getSceneById(originalVariation.sceneId);
//                 if (!scene) return res.status(404).json({ message: `Scene with ID ${originalVariation.sceneId} not found.` });
//                 const newProduct = await storage.getProductById(parsedNewProductId);
//                 if (!newProduct) return res.status(404).json({ message: `New product with ID ${parsedNewProductId} not found.` });
//                 const newCreativePrompt = await generateCreativePlacementPrompt(scene, newProduct);
//                 if (!newCreativePrompt || newCreativePrompt.includes("Error:")) throw new Error(`Gemini failed to generate prompt: ${newCreativePrompt}`);
//                 const generationResult = await generateProductPlacement({ scene, product: newProduct, variationNumber: originalVariation.variationNumber, prompt: newCreativePrompt });
//                 if (!generationResult.success) return res.status(500).json({ message: "Failed to regen image for new product.", details: generationResult.description });
//                 const updatedVariation = await storage.updateSceneVariation(variationId, { productId: newProduct.id, geminiPrompt: newCreativePrompt, imageUrl: generationResult.imageUrl, description: `Var ${originalVariation.variationNumber}: ${newProduct.name} - ${scene.heading}. Prompt: ${newCreativePrompt.substring(0, 50)}...`, isSelected: false });
//                 if (!updatedVariation) return res.status(500).json({ message: "Failed to update variation after product change." });
//                 res.json(updatedVariation);
//             } catch (error) { next(error); }
//         },
//     );
//     app.post(`${apiPrefix}/variations/:variationId/generate-video`, async (req, res, next) => {
//         const variationIdParam = req.params.variationId;
//         try {
//             const variationId = parseInt(variationIdParam);
//             if (isNaN(variationId)) return res.status(400).json({ message: "Valid Variation ID is required" });
//             const result = await generateVideoFromVariation(variationId);
//             if (result.error) return res.status(500).json({ message: result.error, predictionId: result.predictionId });
//             res.status(202).json({ message: "Video generation started.", predictionId: result.predictionId, status: result.status });
//         } catch (error) { next(error); }
//     });
//     app.get(`${apiPrefix}/replicate/predictions/:predictionId`, async (req, res, next) => {
//         const predictionId = req.params.predictionId;
//         try {
//             if (!predictionId || typeof predictionId !== "string") return res.status(400).json({ message: "Valid Prediction ID is required" });
//             const result = await getPredictionStatus(predictionId);
//             res.json(result);
//         } catch (error) { next(error); }
//     });
//     app.get(`${apiPrefix}/scripts/export`, async (_req, res, next) => { /* ... export logic ... */ });


//     // --- NEW: Location Suggestion Endpoint STUB ---
//     app.get(`${apiPrefix}/scenes/:sceneId/suggest-locations`, async (req, res, next) => {
//         const sceneIdParam = req.params.sceneId;
//         const budgetParam = req.query.budget as string;
//         try {
//             const sceneId = parseInt(sceneIdParam);
//             const projectBudget = budgetParam ? parseInt(budgetParam) : 0;
//             if (isNaN(sceneId)) return res.status(400).json({ message: "Valid Scene ID is required" });

//             const scene = await storage.getSceneById(sceneId);
//             if (!scene) return res.status(404).json({ message: "Scene not found" });

//             // STUB: Replace with actual AI logic and DB querying for location matching & incentive calculation
//             const allLocations = (await storage.getLocations({ pageSize: 50 })).locations; // Get some locations
//             const suggested = allLocations
//                 .slice(0, 3 + Math.floor(Math.random() * 3)) // Suggest 3-5 random ones
//                 .map(loc => ({
//                     ...loc,
//                     estimatedIncentiveValue: projectBudget > 0 
//                         ? `$${(projectBudget * (0.15 + Math.random() * 0.15)).toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})} (${(15 + Math.random() * 15).toFixed(0)}% of spend)` 
//                         : "N/A (budget needed)",
//                     matchReason: `Based on scene type: "${scene.heading.split(' ')[1]}" and general incentive availability.`
//                 }));
//             res.json(suggested);
//         } catch (error) { next(error); }
//     });

//     // --- NEW: Get Characters from Script Endpoint STUB ---
//     app.get(`${apiPrefix}/scripts/:scriptId/characters`, async (req, res, next) => {
//         const scriptIdParam = req.params.scriptId;
//         try {
//             const scriptId = parseInt(scriptIdParam);
//             if (isNaN(scriptId)) return res.status(400).json({ message: "Valid Script ID is required" });
//             const script = await storage.getScriptById(scriptId);
//             if (!script || !script.content) return res.status(404).json({ message: "Script not found" });

//             // Basic character extraction - THIS NEEDS SIGNIFICANT IMPROVEMENT for accuracy
//             const characterRegex = /^[A-Z][A-Z0-9\s\(\)\-\']{1,28}[A-Z0-9]$/gm;
//             const dialogueIndicatorRegex = /\(.*\)|[a-z]/;
//             const sceneHeadingRegex = /^(INT\.?\/EXT\.?|INT\.?|EXT\.?|I\/E\.?)/i;
//             const actionLineKeywords = ["HE", "SHE", "THEY", "IT", "WE"];

//             const lines = script.content.split('\n');
//             const potentialCharacters = new Set<string>();

//             for (let i = 0; i < lines.length; i++) {
//                 const trimmedLine = lines[i].trim();
//                 if (
//                     trimmedLine.length > 1 && trimmedLine.length < 30 &&
//                     trimmedLine.toUpperCase() === trimmedLine &&
//                     !sceneHeadingRegex.test(trimmedLine) &&
//                     !dialogueIndicatorRegex.test(trimmedLine) && // Less likely to be char name if it has lowercase/parens
//                     !actionLineKeywords.some(keyword => trimmedLine.startsWith(keyword + " ")) && // Avoid action lines
//                     trimmedLine.split(" ").length <= 4 && // Character names are usually short
//                     (lines[i+1] && lines[i+1].trim() !== "" && !lines[i+1].trim().match(/^[A-Z\s\(\)\-\']+$/)) // Next line is likely dialogue (not all caps)
//                 ) {
//                     const charName = trimmedLine.replace(/\s*\(.*\)\s*$/, "").trim();
//                     if (charName.length > 1 && !/^\d+$/.test(charName) && charName !== "CONT'D" && charName !== "CONTINUED" && charName !== "V.O." && charName !== "O.S.") {
//                         potentialCharacters.add(charName);
//                     }
//                 }
//             }
//             const characters = Array.from(potentialCharacters).sort().map(name => ({ name }));
//             res.json(characters);
//         } catch (error) { next(error); }
//     });

//     // --- NEW: Suggest Actors for Character Endpoint STUB ---
//     app.get(`${apiPrefix}/characters/:characterName/suggest-actors`, async (req, res, next) => {
//         const characterName = req.params.characterName;
//         const { genre, roleType, budgetTier } = req.query; // as string | undefined
//         try {
//             if (!characterName) return res.status(400).json({ message: "Character name required" });

//             // STUB: Replace with AI + DB query for actors
//             console.log(`Suggesting actors for ${characterName}, Genre: ${genre}, Role: ${roleType}, Budget: ${budgetTier}`);
//             const allActors = (await storage.getActors({ pageSize: 20 })).actors;
//             const suggested = allActors
//                 .sort(() => 0.5 - Math.random()) // Randomize
//                 .slice(0, 3 + Math.floor(Math.random() * 3)) // Suggest 3-5 random
//                 .map((actor, i) => ({
//                     ...actor,
//                     matchReason: `Good potential for a ${genre || 'general'} ${roleType || 'role'} in a ${budgetTier || 'medium'} budget film.`,
//                     controversyFlag: Math.random() < 0.15, // ~15% chance of controversy flag
//                 }));
//             res.json(suggested);
//         } catch (error) { next(error); }
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
    // extractTextFromPdf as extractPdfTextViaGemini, // Not used directly here, pdf-service handles it
    extractCharactersWithGemini, // <= IMPORTED THE NEW FUNCTION
} from "./services/file-upload-service";
import { z } from "zod";
import {
    insertProductSchema,
    insertActorSchema,
    insertLocationSchema,
    ProductCategory,
    Product as DbProduct, // Alias to avoid naming conflict if Product type is used differently
    Scene as DbScene,     // Alias
    Actor as DbActor,     // Alias
    Location as DbLocation, // Alias
    SceneVariation as DbSceneVariation, // Alias
    Product, // Keep for direct use
    Script,  // Keep for direct use
} from "@shared/schema";
import { ZodError } from "zod";

// --- Interfaces ---
interface SceneVariation extends DbSceneVariation { // Extended type
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
): Promise<SceneVariation[]> { // Return extended type
    const logPrefix = `[VarGen Route S:${sceneId}]`;
    console.log(`${logPrefix} Starting on-demand variation generation...`);
    try {
        let scene = await storage.getSceneById(sceneId);
        if (!scene) {
            console.error(`${logPrefix} Scene not found.`);
            return [];
        }
        console.log(`${logPrefix} Found Scene ${scene.sceneNumber}: ${scene.heading}, Brandable: ${scene.isBrandable}`);

        if (!scene.isBrandable || !scene.suggestedCategories || scene.suggestedCategories.length === 0) {
            console.log(`${logPrefix} Analyzing/Re-analyzing with Gemini for scene ${scene.id}...`);
            try {
                const analysisResult = await identifyBrandableScenesWithGemini([scene], 1); // Analyze only this scene
                if (analysisResult.brandableScenes.length > 0 && analysisResult.brandableScenes[0].sceneId === scene.id) {
                    const brandableData = analysisResult.brandableScenes[0];
                    const updatedSceneInDb = await storage.updateScene(scene.id, {
                        isBrandable: true,
                        brandableReason: brandableData.reason,
                        suggestedCategories: brandableData.suggestedProducts,
                    });
                    if (updatedSceneInDb) scene = updatedSceneInDb; // Use the updated scene data
                    console.log(`${logPrefix} Scene ${scene.id} updated. Brandable: true, Categories: ${scene.suggestedCategories?.join(", ")}`);
                } else {
                    console.warn(`${logPrefix} Gemini analysis did not yield brandable info for scene ${scene.id}. Ensuring it's marked as brandable for on-demand flow.`);
                     // If Gemini doesn't find it specifically brandable, but we are here, it means user selected it.
                     // Mark it as brandable (or ensure it is) so product matching can proceed.
                    if (!scene.isBrandable) {
                         const updatedSceneInDb = await storage.updateScene(scene.id, { isBrandable: true });
                         if (updatedSceneInDb) scene = updatedSceneInDb;
                    }
                }
            } catch (analysisError) {
                console.error(`${logPrefix} Error during on-demand scene analysis:`, analysisError);
                // Proceed if scene exists, even if analysis failed, it might have old categories or default to generic
            }
        }

        const categories = scene.suggestedCategories || []; // Use existing or empty if none
        console.log(`${logPrefix} Fetching products for categories: ${categories.join(", ") || "None (generic matching)"}`);
        const selectedProducts = await storage.getTopMatchingProductsForScene(sceneId, categories, 3);

        if (selectedProducts.length === 0) {
            console.warn(`${logPrefix} No suitable products found for scene ${sceneId} with categories: ${categories.join(", ")}.`);
            return [];
        }
        console.log(`${logPrefix} Selected products: ${selectedProducts.map((p) => p.name).join(", ")}`);

        const variationPromises = selectedProducts.map(async (product, i) => {
            const variationNumber = i + 1;
            const varLogPrefix = `${logPrefix} V${variationNumber} (P:${product.id})`;
            try {
                const creativePrompt = await generateCreativePlacementPrompt(scene!, product);
                if (!creativePrompt || creativePrompt.includes("Error:")) {
                    console.error(`${varLogPrefix} Gemini prompt generation failed or returned error: ${creativePrompt}`);
                    throw new Error(`Gemini prompt error: ${creativePrompt}`);
                }

                const generationResult = await generateProductPlacement({ scene: scene!, product, variationNumber, prompt: creativePrompt });
                const cleanDescription = `Variation ${variationNumber}: ${product.name} in ${scene!.heading}. Prompt used: ${creativePrompt.substring(0, 50)}...`;

                const variationData = {
                    sceneId: scene!.id, productId: product.id, variationNumber,
                    description: sanitizeString(cleanDescription), imageUrl: generationResult.imageUrl,
                    geminiPrompt: creativePrompt, isSelected: false,
                };
                const newVariationDb = await storage.createSceneVariation(variationData);
                return {
                    ...newVariationDb,
                    productName: product.name,
                    productCategory: product.category,
                    productImageUrl: product.imageUrl
                } as SceneVariation;
            } catch (error) {
                console.error(`${varLogPrefix} Error in variation generation:`, error);
                return null; // Allow other variations to proceed
            }
        });

        const results = await Promise.all(variationPromises);
        const successfulVariations = results.filter((v): v is SceneVariation => v !== null);
        console.log(`${logPrefix} Successfully generated ${successfulVariations.length}/${selectedProducts.length} variations.`);
        return successfulVariations;
    } catch (outerError) {
        console.error(`${logPrefix} CRITICAL ERROR in on-demand variation generation process:`, outerError);
        return []; // Return empty on critical failure
    }
}


// --- Routes Registration ---
export async function registerRoutes(app: Express): Promise<Server> {
    const apiPrefix = "/api";

    // --- Actor Routes ---
    app.get(`${apiPrefix}/actors`, async (req, res, next) => {
        try {
            const page = parseInt((req.query.page as string) || "1");
            const pageSize = parseInt((req.query.pageSize as string) || "10");
            const search = (req.query.search as string) || "";
            const gender = (req.query.gender as string) || ""; // Defaults to empty, handled in storage
            const nationality = (req.query.nationality as string) || ""; // Defaults to empty
            const result = await storage.getActors({ search, gender, nationality, page, pageSize });
            res.json(result);
        } catch (error) { next(error); }
    });
    app.put(`${apiPrefix}/actors/:id`, async (req, res, next) => {
        try {
            const id = parseInt(req.params.id);
            if (isNaN(id)) return res.status(400).json({ message: "Invalid actor ID" });
            const validatedData = insertActorSchema.partial().parse(req.body); // Use partial for updates
            const updated = await storage.updateActor(id, validatedData);
            if (!updated) return res.status(404).json({ message: "Actor not found" });
            res.json(updated);
        } catch (error) {
            if (error instanceof ZodError) return res.status(400).json({ message: "Validation failed", errors: error.errors });
            next(error);
        }
    });

    // --- Product Routes ---
    app.get(`${apiPrefix}/products`, async (req, res, next) => {
        try {
            const page = parseInt((req.query.page as string) || "1");
            const pageSize = parseInt((req.query.pageSize as string) || "12");
            const search = (req.query.search as string) || "";
            const category = (req.query.category as string) || "ALL"; // Default to "ALL"
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

    // --- Location Routes ---
     app.get(`${apiPrefix}/locations`, async (req, res, next) => {
        try {
            const page = parseInt((req.query.page as string) || "1");
            const pageSize = parseInt((req.query.pageSize as string) || "10");
            const search = (req.query.search as string) || "";
            const country = (req.query.country as string) || "ALL";
            const result = await storage.getLocations({ search, country, page, pageSize });
            res.json(result);
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

    // --- Script Routes ---
    app.get(`${apiPrefix}/scripts/current`, async (_req, res, next) => {
        try {
            const script = await storage.getCurrentScript();
            if (!script) return res.status(404).json({ message: "No current script found" });
            res.json({ id: script.id, title: script.title, createdAt: script.createdAt, updatedAt: script.updatedAt });
        } catch (error) { next(error); }
    });

    app.post(`${apiPrefix}/scripts/upload`, upload.single("script"), async (req, res, next) => {
        let script: Script | null = null; // Initialize to null
            try {
                if (!req.file) { return res.status(400).json({ message: "No file uploaded" }); }
                console.log(`[Upload] Processing: ${req.file.originalname}, Type: ${req.file.mimetype}, Size: ${req.file.size} bytes`);
                console.time("[Upload] scriptExtractionAndCreation");

                const parsedScript = await extractScriptFromPdf(req.file.buffer, req.file.mimetype);

                if (parsedScript.content.startsWith("Error:")) { // Check if extraction itself failed
                    console.error(`[Upload] Script extraction failed: ${parsedScript.title}`); // Title might contain error message
                    return res.status(400).json({ message: `Script extraction failed: ${parsedScript.title}` });
                }
                console.log(`[Upload] Extracted Title: ${parsedScript.title}, Content Sample: ${parsedScript.content.substring(0, 50)}...`);

                // Create script record first
                script = await storage.createScript({ title: sanitizeString(parsedScript.title), content: parsedScript.content });
                console.log(`[Upload] Created Script ID: ${script.id}`);

                // Create scene records
                const createdScenes: DbScene[] = []; // Use aliased type for DB objects
                for (const sceneData of parsedScript.scenes) {
                    const newScene = await storage.createScene({ 
                        scriptId: script.id, 
                        sceneNumber: sceneData.sceneNumber, 
                        heading: sanitizeString(sceneData.heading), 
                        content: sceneData.content 
                    });
                    createdScenes.push(newScene);
                }
                console.log(`[Upload] Created ${createdScenes.length} scenes.`);
                console.timeEnd("[Upload] scriptExtractionAndCreation");

                console.time("[Upload] geminiAnalysisAndUpdates");
                let analysisResult: AIAnalysisResponseForRoutes = { brandableScenes: [] };
                if (createdScenes.length > 0) {
                    analysisResult = await identifyBrandableScenesWithGemini(createdScenes, 5); // Request 5 brandable scenes
                    console.log(`[Upload] Gemini identified ${analysisResult.brandableScenes.length} potential brandable scenes.`);

                    const updatePromises = analysisResult.brandableScenes.map(
                        (brandable) => storage.updateScene(brandable.sceneId, { 
                                            isBrandable: true, 
                                            brandableReason: sanitizeString(brandable.reason), 
                                            suggestedCategories: brandable.suggestedProducts 
                                        })
                                        .catch((e) => console.error(`[Upload] Failed updating scene ${brandable.sceneId} with brandable info:`,e)), // Catch individual update errors
                    );
                    await Promise.all(updatePromises);
                } else {
                    console.log("[Upload] No scenes extracted, skipping brandability analysis.");
                }
                console.timeEnd("[Upload] geminiAnalysisAndUpdates");

                console.log("[Upload] Processed successfully.");
                res.status(201).json({ 
                    script: { id: script.id, title: script.title }, 
                    scenesCount: createdScenes.length, 
                    brandableScenesCount: analysisResult.brandableScenes.length 
                });
            } catch (error) {
                console.error("[Upload] Error processing upload:", error);
                next(error); // Pass to global error handler
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

    app.get(`${apiPrefix}/scripts/scene-variations`, async (req, res, next) => {
        const sceneIdParam = req.query.sceneId as string;
        const logPrefix = `[GET /scene-variations S:${sceneIdParam}]`;
        try {
            const sceneId = parseInt(sceneIdParam);
            if (isNaN(sceneId)) return res.status(400).json({ message: "Valid Scene ID is required" });

            let variations = await storage.getSceneVariations(sceneId);
            if (variations.length === 0) {
                console.log(`${logPrefix} No variations exist, attempting on-demand generation...`);
                variations = await _generateAndSaveSceneVariationsForRoute(sceneId);
            }
            res.json(variations);
        } catch (error: any) {
            console.error(`${logPrefix} Error fetching scene variations:`, error.message || error);
            next(error);
        }
    });

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

            const updatedVariation = await storage.updateSceneVariation(variationId, { 
                geminiPrompt: newPrompt, 
                imageUrl: generationResult.imageUrl, 
                description: `Variation ${variation.variationNumber}: ${product.name} - ${scene.heading}. User Prompt: ${newPrompt.substring(0, 40)}...` 
            });
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
                if (!newCreativePrompt || newCreativePrompt.includes("Error:")) throw new Error(`Gemini failed to generate prompt: ${newCreativePrompt}`);

                const generationResult = await generateProductPlacement({ scene, product: newProduct, variationNumber: originalVariation.variationNumber, prompt: newCreativePrompt });
                if (!generationResult.success) return res.status(500).json({ message: "Failed to regen image for new product.", details: generationResult.description });

                const updatedVariation = await storage.updateSceneVariation(variationId, { 
                    productId: newProduct.id, 
                    geminiPrompt: newCreativePrompt, 
                    imageUrl: generationResult.imageUrl, 
                    description: `Var ${originalVariation.variationNumber}: ${newProduct.name} - ${scene.heading}. Prompt: ${newCreativePrompt.substring(0, 50)}...`, 
                    isSelected: false // Deselect when product changes
                });
                if (!updatedVariation) return res.status(500).json({ message: "Failed to update variation after product change." });
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
            if (result.error) return res.status(500).json({ message: result.error, predictionId: result.predictionId }); // Use 500 for server-side generation errors
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
        /* ... export logic ... */ 
        res.status(501).json({message: "Export not implemented yet"});
    });

    app.get(`${apiPrefix}/scenes/:sceneId/suggest-locations`, async (req, res, next) => {
        const sceneIdParam = req.params.sceneId;
        const budgetParam = req.query.budget as string;
        try {
            const sceneId = parseInt(sceneIdParam);
            const projectBudget = budgetParam ? parseInt(budgetParam) : 0;
            if (isNaN(sceneId)) return res.status(400).json({ message: "Valid Scene ID is required" });

            const scene = await storage.getSceneById(sceneId);
            if (!scene) return res.status(404).json({ message: "Scene not found" });

            // STUB: Replace with actual AI logic and DB querying for location matching & incentive calculation
            const allLocations = (await storage.getLocations({ pageSize: 50 })).locations; // Get some locations
            const suggested = allLocations
                .slice(0, 3 + Math.floor(Math.random() * 3)) // Suggest 3-5 random ones
                .map(loc => ({
                    ...loc,
                    estimatedIncentiveValue: projectBudget > 0 
                        ? `$${(projectBudget * (0.15 + Math.random() * 0.15)).toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})} (${(15 + Math.random() * 15).toFixed(0)}% of spend)` 
                        : "N/A (budget needed)",
                    matchReason: `Based on scene type: "${scene.heading.split(' ')[1]}" and general incentive availability.`
                }));
            res.json(suggested);
        } catch (error) { next(error); }
    });

    // --- MODIFIED: Get Characters from Script Endpoint ---
    app.get(`${apiPrefix}/scripts/:scriptId/characters`, async (req, res, next) => {
        const scriptIdParam = req.params.scriptId;
        try {
            const scriptId = parseInt(scriptIdParam);
            if (isNaN(scriptId)) {
                return res.status(400).json({ message: "Valid Script ID is required" });
            }

            const script = await storage.getScriptById(scriptId);
            if (!script || !script.content) {
                console.log(`[Characters Route] Script not found or no content for ID: ${scriptId}`);
                return res.status(404).json({ message: "Script not found or has no content" });
            }

            console.log(`[Characters Route] Script ${scriptId} found. Content length: ${script.content.length}. Requesting Gemini character extraction.`);

            // Call the new Gemini-powered character extraction function
            const characters = await extractCharactersWithGemini(script.content);

            if (characters.length === 0) {
                console.log(`[Characters Route] Gemini extracted 0 characters for script ${scriptId}.`);
            } else {
                console.log(`[Characters Route] Gemini extracted ${characters.length} characters for script ${scriptId}.`);
            }

            res.json(characters); // The service function returns the expected format { name: string }[]
        } catch (error) { 
            console.error(`[Characters Route] Error processing character extraction for script ID ${scriptIdParam}:`, error);
            next(error); 
        }
    });

    app.get(`${apiPrefix}/characters/:characterName/suggest-actors`, async (req, res, next) => {
        const characterName = req.params.characterName;
        const { genre, roleType, budgetTier } = req.query;
        try {
            if (!characterName) return res.status(400).json({ message: "Character name required" });

            console.log(`[Actor Suggestion] For: ${characterName}, Genre: ${genre}, Role: ${roleType}, Budget: ${budgetTier}`);
            const allActors = (await storage.getActors({ pageSize: 20 })).actors; // Get more actors to choose from
            const suggested = allActors
                .sort(() => 0.5 - Math.random()) 
                .slice(0, 3 + Math.floor(Math.random() * 3)) 
                .map((actor, i) => ({
                    ...actor,
                    matchReason: `Good potential for a ${genre || 'general'} ${roleType || 'role'} in a ${budgetTier || 'medium'} budget film.`,
                    controversyFlag: Math.random() < 0.15, 
                }));
            res.json(suggested);
        } catch (error) { next(error); }
    });

    const httpServer = createServer(app);
    return httpServer;
}