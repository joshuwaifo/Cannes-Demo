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
    extractCharactersWithGemini,
    ExtractedCharacter as BackendExtractedCharacter,
} from "./services/file-upload-service";
import {
    suggestActorsForCharacterViaGemini,
    ActorAISuggestion,
    suggestLocationsForScriptViaGemini,
    LocationAISuggestion,
} from "./services/ai-suggestion-service";
import { z } from "zod";
import {
    insertProductSchema,
    insertActorSchema,
    insertLocationSchema,
    scriptGenerationFormSchema,
    ProductCategory,
    Product as DbProduct,
    Scene as DbScene,
    Actor as DbActor,
    Location as DbLocation,
    ScriptGenerationFormData as DbScriptGenerationFormData,
    SceneVariation as DbSceneVariation,
    Product,
    Script,
} from "@shared/schema";
import { ZodError } from "zod";
import {
    ActorSuggestion as ClientActorSuggestion,
    ClientSuggestedLocation,
    ScriptCharacter,
} from "../../client/src/lib/types";
import { generateScriptWithGemini } from "./services/script-generation-service";
import { generateScriptPdf } from "./services/pdf-generation-service";
import { generateFinancialBreakdown } from "./services/financial-analysis-service";
import { analyzeAndStoreScriptVFX } from "./services/vfx-analysis-service";
// Character suggestion functionality moved to character-suggestion-optimizer


// ... (interfaces, utility functions, multer setup, _generateAndSaveSceneVariationsForRoute remain the same)
// --- Interfaces ---
interface SceneVariation extends DbSceneVariation {
    productName?: string;
    productCategory?: ProductCategory;
    productImageUrl?: string | null;
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
        const allowedTypes = [
            "application/pdf",
            "image/jpeg",
            "image/png",
            "image/jpg",
        ];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("Invalid file type. Only PDF, JPG, PNG allowed."));
        }
    },
});

async function _generateAndSaveSceneVariationsForRoute(
    sceneId: number,
): Promise<SceneVariation[]> {
    // ... (this function remains largely the same)
    const logPrefix = `[VarGen Route S:${sceneId}]`;
    try {
        let scene = await storage.getSceneById(sceneId);
        if (!scene) {
            console.error(`${logPrefix} Scene not found.`);
            return [];
        }
        if (
            !scene.isBrandable ||
            !scene.suggestedCategories ||
            scene.suggestedCategories.length === 0
        ) {
            try {
                const analysisResult = await identifyBrandableScenesWithGemini(
                    [scene],
                    1,
                );
                if (
                    analysisResult.brandableScenes.length > 0 &&
                    analysisResult.brandableScenes[0].sceneId === scene.id
                ) {
                    const brandableData = analysisResult.brandableScenes[0];
                    const updatedSceneInDb = await storage.updateScene(
                        scene.id,
                        {
                            isBrandable: true,
                            brandableReason: brandableData.reason,
                            suggestedCategories:
                                brandableData.suggestedProducts,
                        },
                    );
                    if (updatedSceneInDb) scene = updatedSceneInDb;
                } else {
                    if (!scene.isBrandable) {
                        const updatedSceneInDb = await storage.updateScene(
                            scene.id,
                            { isBrandable: true },
                        );
                        if (updatedSceneInDb) scene = updatedSceneInDb;
                    }
                }
            } catch (analysisError) {
                console.error(
                    `${logPrefix} Error during on-demand scene analysis:`,
                    analysisError,
                );
            }
        }
        const categories = scene.suggestedCategories || [];
        const selectedProducts = await storage.getTopMatchingProductsForScene(
            sceneId,
            categories,
            3,
        );
        if (selectedProducts.length === 0) return [];
        const variationPromises = selectedProducts.map(async (product, i) => {
            const variationNumber = i + 1;
            const varLogPrefixV = `${logPrefix} V${variationNumber} (P:${product.id})`;
            try {
                const creativePrompt = await generateCreativePlacementPrompt(
                    scene!,
                    product,
                );
                if (!creativePrompt || creativePrompt.includes("Error:")) {
                    throw new Error(`Gemini prompt error: ${creativePrompt}`);
                }
                const generationResult = await generateProductPlacement({
                    scene: scene!,
                    product,
                    variationNumber,
                    prompt: creativePrompt,
                });
                const cleanDescription = `Variation ${variationNumber}: ${product.name} in ${scene!.heading}. Prompt used: ${creativePrompt.substring(0, 50)}...`;
                const variationData = {
                    sceneId: scene!.id,
                    productId: product.id,
                    variationNumber,
                    description: sanitizeString(cleanDescription),
                    imageUrl: generationResult.imageUrl,
                    geminiPrompt: creativePrompt,
                    isSelected: false,
                };
                const newVariationDb =
                    await storage.createSceneVariation(variationData);
                return {
                    ...newVariationDb,
                    productName: product.name,
                    productCategory: product.category,
                    productImageUrl: product.imageUrl,
                } as SceneVariation;
            } catch (error) {
                console.error(
                    `${varLogPrefixV} Error in variation generation:`,
                    error,
                );
                return null;
            }
        });
        const results = await Promise.all(variationPromises);
        return results.filter((v): v is SceneVariation => v !== null);
    } catch (outerError) {
        console.error(
            `${logPrefix} CRITICAL ERROR in on-demand variation generation process:`,
            outerError,
        );
        return [];
    }
}


export async function registerRoutes(app: Express): Promise<Server> {
    const apiPrefix = "/api";

    // --- Actor Routes ---
    // ...

    // --- Product Routes ---
    // ...

    // --- Location Routes ---
    // ...

    // --- Script Routes ---
    // ... (existing script routes up to /api/scripts/export)
    app.get(`${apiPrefix}/actors`, async (req, res, next) => {
        try {
            const page = parseInt((req.query.page as string) || "1");
            const pageSize = parseInt((req.query.pageSize as string) || "10");
            const search = (req.query.search as string) || "";
            const gender = (req.query.gender as string) || "";
            const nationality = (req.query.nationality as string) || "";
            const result = await storage.getActors({
                search,
                gender,
                nationality,
                page,
                pageSize,
            });
            res.json(result);
        } catch (e) {
            next(e);
        }
    });
    app.put(`${apiPrefix}/actors/:id`, async (req, res, next) => {
        try {
            const id = parseInt(req.params.id);
            if (isNaN(id))
                return res.status(400).json({ message: "Invalid ID" });
            const data = insertActorSchema.partial().parse(req.body);
            const updated = await storage.updateActor(id, data);
            if (!updated) return res.status(404).json({ message: "Not found" });
            res.json(updated);
        } catch (e) {
            if (e instanceof ZodError)
                return res
                    .status(400)
                    .json({ message: "Validation failed", errors: e.errors });
            next(e);
        }
    });


    // --- Product Routes ---
    app.get(`${apiPrefix}/products`, async (req, res, next) => {
        try {
            const page = parseInt((req.query.page as string) || "1");
            const pageSize = parseInt((req.query.pageSize as string) || "12");
            const search = (req.query.search as string) || "";
            const category = (req.query.category as string) || "ALL";
            const result = await storage.getProducts({
                search,
                category,
                page,
                pageSize,
            });
            res.json(result);
        } catch (e) {
            next(e);
        }
    });
    app.post(`${apiPrefix}/products`, async (req, res, next) => {
        try {
            const data = insertProductSchema.parse(req.body);
            const newProd = await storage.createProduct(data);
            res.status(201).json(newProd);
        } catch (e) {
            if (e instanceof ZodError)
                return res
                    .status(400)
                    .json({ message: "Validation failed", errors: e.errors });
            next(e);
        }
    });
    app.put(`${apiPrefix}/products/:id`, async (req, res, next) => {
        try {
            const id = parseInt(req.params.id);
            if (isNaN(id))
                return res.status(400).json({ message: "Invalid ID" });
            const data = insertProductSchema
                .partial()
                .omit({ id: true, createdAt: true, updatedAt: true })
                .parse(req.body);
            const updated = await storage.updateProduct(id, data);
            if (!updated) return res.status(404).json({ message: "Not found" });
            res.json(updated);
        } catch (e) {
            if (e instanceof ZodError)
                return res
                    .status(400)
                    .json({ message: "Validation failed", errors: e.errors });
            next(e);
        }
    });
    app.delete(`${apiPrefix}/products/:id`, async (req, res, next) => {
        try {
            const id = parseInt(req.params.id);
            if (isNaN(id))
                return res.status(400).json({ message: "Invalid ID" });
            const deleted = await storage.deleteProduct(id);
            if (!deleted) return res.status(404).json({ message: "Not found" });
            res.status(204).send();
        } catch (e) {
            next(e);
        }
    });


    // --- Location Routes ---
    app.get(`${apiPrefix}/locations`, async (req, res, next) => {
        try {
            const page = parseInt((req.query.page as string) || "1");
            const pageSize = parseInt((req.query.pageSize as string) || "10");
            const search = (req.query.search as string) || "";
            const country = (req.query.country as string) || "ALL";
            const result = await storage.getLocations({
                search,
                country,
                page,
                pageSize,
            });
            res.json(result);
        } catch (e) {
            next(e);
        }
    });
    app.post(`${apiPrefix}/locations`, async (req, res, next) => {
        try {
            const data = insertLocationSchema.parse(req.body);
            const newLoc = await storage.createLocation(data);
            res.status(201).json(newLoc);
        } catch (e) {
            if (e instanceof ZodError)
                return res
                    .status(400)
                    .json({ message: "Validation failed", errors: e.errors });
            next(e);
        }
    });
    app.put(`${apiPrefix}/locations/:id`, async (req, res, next) => {
        try {
            const id = parseInt(req.params.id);
            if (isNaN(id))
                return res.status(400).json({ message: "Invalid ID" });
            const data = insertLocationSchema
                .partial()
                .omit({ id: true, createdAt: true, updatedAt: true })
                .parse(req.body);
            const updated = await storage.updateLocation(id, data);
            if (!updated) return res.status(404).json({ message: "Not found" });
            res.json(updated);
        } catch (e) {
            if (e instanceof ZodError)
                return res
                    .status(400)
                    .json({ message: "Validation failed", errors: e.errors });
            next(e);
        }
    });
    app.delete(`${apiPrefix}/locations/:id`, async (req, res, next) => {
        try {
            const id = parseInt(req.params.id);
            if (isNaN(id))
                return res.status(400).json({ message: "Invalid ID" });
            const deleted = await storage.deleteLocation(id);
            if (!deleted) return res.status(404).json({ message: "Not found" });
            res.status(204).send();
        } catch (e) {
            next(e);
        }
    });

    // --- Script Routes ---
    app.get(`${apiPrefix}/scripts/current`, async (_req, res, next) => {
        try {
            const script = await storage.getCurrentScript();
            if (!script)
                return res
                    .status(404)
                    .json({ message: "No current script found" });
            res.json({
                id: script.id,
                title: script.title,
                expectedReleaseDate: script.expectedReleaseDate,
                totalBudget: script.totalBudget,
                createdAt: script.createdAt,
                updatedAt: script.updatedAt,
            });
        } catch (e) {
            next(e);
        }
    });

    app.post(
        `${apiPrefix}/scripts/upload`,
        upload.single("script"),
        async (req, res, next) => {
            let script: Script | null = null;
            try {
                if (!req.file) {
                    return res
                        .status(400)
                        .json({ message: "No file uploaded" });
                }

                const parsedScript = await extractScriptFromPdf(
                    req.file.buffer,
                    req.file.mimetype,
                );

                if (parsedScript.content.startsWith("Error:")) {
                    return res.status(400).json({
                        message: `Script extraction failed: ${parsedScript.title}`,
                    });
                }

                const userProvidedProjectName = req.body.projectName as string | undefined;
                const expectedReleaseDate = req.body.expectedReleaseDate as string | undefined;
                const totalBudgetStr = req.body.totalBudget as string | undefined;

                let totalBudget: number | null = null;
                if (totalBudgetStr) {
                    const parsedBudget = parseFloat(totalBudgetStr);
                    if (!isNaN(parsedBudget)) {
                        totalBudget = Math.round(parsedBudget); 
                    } else {
                        console.warn(`[Upload] Invalid totalBudget string received: "${totalBudgetStr}". Storing as null.`);
                    }
                }

                let finalScriptTitle = sanitizeString(parsedScript.title);
                if (userProvidedProjectName && userProvidedProjectName.trim() !== "") {
                    finalScriptTitle = sanitizeString(userProvidedProjectName.trim());
                }

                script = await storage.createScript({
                    title: finalScriptTitle,
                    content: parsedScript.content,
                    expectedReleaseDate: expectedReleaseDate || null,
                    totalBudget: totalBudget,
                });

                const createdScenes: DbScene[] = [];
                for (const sceneData of parsedScript.scenes) {
                    const newScene = await storage.createScene({
                        scriptId: script.id,
                        sceneNumber: sceneData.sceneNumber,
                        heading: sanitizeString(sceneData.heading),
                        content: sceneData.content,
                    });
                    createdScenes.push(newScene);
                }

                let analysisResult: AIAnalysisResponseForRoutes = { brandableScenes: [] };
                if (createdScenes.length > 0) {
                    // Analyze brandable scenes
                    analysisResult = await identifyBrandableScenesWithGemini(createdScenes, 5);
                    const updatePromises = analysisResult.brandableScenes.map(
                        (brandable) =>
                            storage.updateScene(brandable.sceneId, {
                                isBrandable: true,
                                brandableReason: sanitizeString(brandable.reason),
                                suggestedCategories: brandable.suggestedProducts,
                            }).catch((e) =>
                                console.error(`[Upload] Failed updating scene ${brandable.sceneId} with brandable info:`, e)
                            ),
                    );
                    await Promise.all(updatePromises);

                    // Analyze VFX scenes
                    try {
                        await analyzeAndStoreScriptVFX(script.id, parsedScript.content, createdScenes);
                        console.log(`[Upload] VFX analysis completed for script ${script.id}`);
                    } catch (vfxError) {
                        console.error(`[Upload] VFX analysis failed for script ${script.id}:`, vfxError);
                        // Don't fail the upload if VFX analysis fails
                    }
                }

                res.status(201).json({
                    script: { 
                        id: script.id, 
                        title: script.title,
                        expectedReleaseDate: script.expectedReleaseDate,
                        totalBudget: script.totalBudget,
                    },
                    scenesCount: createdScenes.length,
                    brandableScenesCount: analysisResult.brandableScenes.length,
                });
            } catch (e) {
                console.error("[Upload Route Error]", e);
                next(e);
            }
        },
    );

    app.get(`${apiPrefix}/scripts/scenes`, async (_req, res, next) => {
        try {
            const script = await storage.getCurrentScript();
            if (!script)
                return res
                    .status(404)
                    .json({ message: "No current script found" });
            const scenes = await storage.getScenesByScriptId(script.id);
            res.json(scenes);
        } catch (e) {
            next(e);
        }
    });
    app.get(
        `${apiPrefix}/scripts/brandable-scenes`,
        async (_req, res, next) => {
            try {
                const script = await storage.getCurrentScript();
                if (!script)
                    return res
                        .status(404)
                        .json({ message: "No current script found" });
                const scenes = await storage.getBrandableScenes(script.id);
                res.json(scenes);
            } catch (e) {
                next(e);
            }
        },
    );
    app.get(`${apiPrefix}/scripts/scene-variations`, async (req, res, next) => {
        const sceneIdParam = req.query.sceneId as string;
        try {
            const sceneId = parseInt(sceneIdParam);
            if (isNaN(sceneId))
                return res
                    .status(400)
                    .json({ message: "Valid Scene ID is required" });
            let variations = await storage.getSceneVariations(sceneId);
            if (variations.length === 0 && sceneId > 0) {
                variations =
                    await _generateAndSaveSceneVariationsForRoute(sceneId);
            }
            res.json(variations);
        } catch (e: any) {
            next(e);
        }
    });
    app.put(
        `${apiPrefix}/scripts/variations/select`,
        async (req, res, next) => {
            try {
                const id = parseInt(req.body.variationId as string);
                if (isNaN(id))
                    return res
                        .status(400)
                        .json({ message: "Invalid Variation ID" });
                const updated = await storage.selectVariation(id);
                if (!updated)
                    return res
                        .status(404)
                        .json({ message: "Variation not found." });
                res.json(updated);
            } catch (e) {
                next(e);
            }
        },
    );
    app.put(
        `${apiPrefix}/variations/:variationId/update-prompt-and-image`,
        async (req, res, next) => {
            try {
                const id = parseInt(req.params.variationId);
                const { newPrompt } = req.body;
                if (isNaN(id))
                    return res
                        .status(400)
                        .json({ message: "Invalid Variation ID" });
                if (
                    !newPrompt ||
                    typeof newPrompt !== "string" ||
                    newPrompt.trim().length < 10
                )
                    return res.status(400).json({
                        message: "Valid new prompt is required (min 10 chars).",
                    });
                const variation = await storage.getSceneVariationById(id);
                if (!variation)
                    return res.status(404).json({
                        message: `Variation with ID ${id} not found.`,
                    });
                const scene = await storage.getSceneById(variation.sceneId);
                if (!scene)
                    return res.status(404).json({
                        message: `Scene with ID ${variation.sceneId} not found.`,
                    });
                const product = await storage.getProductById(
                    variation.productId,
                );
                if (!product)
                    return res.status(404).json({
                        message: `Product with ID ${variation.productId} not found.`,
                    });
                const genResult = await generateProductPlacement({
                    scene,
                    product,
                    variationNumber: variation.variationNumber,
                    prompt: newPrompt,
                });
                if (!genResult.success)
                    return res.status(500).json({
                        message: "Failed to regenerate image.",
                        details: genResult.description,
                    });
                const updated = await storage.updateSceneVariation(id, {
                    geminiPrompt: newPrompt,
                    imageUrl: genResult.imageUrl,
                    description: `Variation ${variation.variationNumber}: ${product.name} - ${scene.heading}. User Prompt: ${newPrompt.substring(0, 40)}...`,
                });
                if (!updated)
                    return res.status(500).json({
                        message:
                            "Failed to update variation after image regeneration.",
                    });
                res.json(updated);
            } catch (e) {
                next(e);
            }
        },
    );
    app.put(
        `${apiPrefix}/variations/:variationId/change-product`,
        async (req, res, next) => {
            try {
                const id = parseInt(req.params.variationId);
                const { newProductId } = req.body;
                const pNewProdId = parseInt(newProductId as string);
                if (isNaN(id) || isNaN(pNewProdId))
                    return res.status(400).json({
                        message:
                            "Valid Variation ID and New Product ID are required.",
                    });
                const origVar = await storage.getSceneVariationById(id);
                if (!origVar)
                    return res.status(404).json({
                        message: `Variation with ID ${id} not found.`,
                    });
                const scene = await storage.getSceneById(origVar.sceneId);
                if (!scene)
                    return res.status(404).json({
                        message: `Scene with ID ${origVar.sceneId} not found.`,
                    });
                const newProd = await storage.getProductById(pNewProdId);
                if (!newProd)
                    return res.status(404).json({
                        message: `New product with ID ${pNewProdId} not found.`,
                    });
                const newCreativePrompt = await generateCreativePlacementPrompt(
                    scene,
                    newProd,
                );
                if (!newCreativePrompt || newCreativePrompt.includes("Error:"))
                    throw new Error(
                        `Gemini failed to generate prompt: ${newCreativePrompt}`,
                    );
                const genResult = await generateProductPlacement({
                    scene,
                    product: newProd,
                    variationNumber: origVar.variationNumber,
                    prompt: newCreativePrompt,
                });
                if (!genResult.success)
                    return res.status(500).json({
                        message: "Failed to regen image for new product.",
                        details: genResult.description,
                    });
                const updated = await storage.updateSceneVariation(id, {
                    productId: newProd.id,
                    geminiPrompt: newCreativePrompt,
                    imageUrl: genResult.imageUrl,
                    description: `Var ${origVar.variationNumber}: ${newProd.name} - ${scene.heading}. Prompt: ${newCreativePrompt.substring(0, 50)}...`,
                    isSelected: false,
                });
                if (!updated)
                    return res.status(500).json({
                        message:
                            "Failed to update variation after product change.",
                    });
                res.json(updated);
            } catch (e) {
                next(e);
            }
        },
    );
    app.post(
        `${apiPrefix}/variations/:variationId/generate-video`,
        async (req, res, next) => {
            try {
                const id = parseInt(req.params.variationId);
                if (isNaN(id))
                    return res
                        .status(400)
                        .json({ message: "Valid Variation ID is required" });
                const result = await generateVideoFromVariation(id);
                if (result.error)
                    return res.status(500).json({
                        message: result.error,
                        predictionId: result.predictionId,
                    });
                res.status(202).json({
                    message: "Video generation started.",
                    predictionId: result.predictionId,
                    status: result.status,
                });
            } catch (e) {
                next(e);
            }
        },
    );
    app.get(
        `${apiPrefix}/replicate/predictions/:predictionId`,
        async (req, res, next) => {
            try {
                const id = req.params.predictionId;
                if (!id || typeof id !== "string")
                    return res
                        .status(400)
                        .json({ message: "Valid Prediction ID is required" });
                const result = await getPredictionStatus(id);
                res.json(result);
            } catch (e) {
                next(e);
            }
        },
    );
    app.get(`${apiPrefix}/scripts/export`, async (_req, res, next) => {
        res.status(501).json({ message: "Export not implemented yet" });
    });


    // --- BEGIN MODIFICATION (Task 1.3) ---
    app.get(`${apiPrefix}/scripts/:scriptId/financial-analysis`, async (req, res, next) => {
        try {
            const scriptIdParam = req.params.scriptId;
            const scriptId = parseInt(scriptIdParam);

            if (isNaN(scriptId)) {
                return res.status(400).json({ message: "Valid Script ID is required." });
            }

            const financialData = await generateFinancialBreakdown(scriptId);

            if (!financialData) {
                return res.status(404).json({ message: `Script with ID ${scriptId} not found or financial data could not be generated.` });
            }

            res.json(financialData);
        } catch (e) {
            console.error(`[Financial Analysis Endpoint Error for Script ID ${req.params.scriptId}]:`, e);
            next(e); // Pass to global error handler
        }
    });
    // --- END MODIFICATION (Task 1.3) ---

    // --- Script Generation Route ---
    // ...
    app.post(
        `${apiPrefix}/scripts/generate-from-prompt`,
        async (req, res, next) => {
            try {
                const formData = scriptGenerationFormSchema.parse(req.body);
                const generatedScript =
                    await generateScriptWithGemini(formData);
                res.json({ script: generatedScript });
            } catch (error) {
                if (error instanceof ZodError) {
                    return res
                        .status(400)
                        .json({
                            message: "Validation failed",
                            errors: error.errors,
                        });
                }
                console.error("[API /generate-from-prompt] Error:", error);
                next(error);
            }
        },
    );

    // --- PDF Export Route ---
    // ...
    app.post(`${apiPrefix}/scripts/export-pdf`, async (req, res, next) => {
        try {
            const { scriptContent, title } = req.body;
            if (!scriptContent || typeof scriptContent !== "string") {
                return res
                    .status(400)
                    .json({ message: "Script content is required." });
            }
            if (!title || typeof title !== "string" || title.trim() === "") {
                return res
                    .status(400)
                    .json({ message: "Valid script title is required." });
            }

            const pdfBuffer = await generateScriptPdf(scriptContent, title);
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader(
                "Content-Disposition",
                `attachment; filename="${title.replace(/[^a-z0-9]/gi, "_")}.pdf"`,
            );
            res.send(pdfBuffer);
        } catch (error) {
            console.error("[API /export-pdf] Error:", error);
            next(error);
        }
    });

    // --- AI Suggestion Routes ---
    // ... (these routes remain the same)
    app.get(
        `${apiPrefix}/scripts/:scriptId/suggest-locations`,
        async (req, res, next) => {
            const scriptIdParam = req.params.scriptId;
            const budgetParam = req.query.budget as string;
            const countParam = req.query.count as string;
            const logPrefix = `[Route Script Location Suggestion for Script ID:${scriptIdParam}]`;
            try {
                const scriptId = parseInt(scriptIdParam);
                if (isNaN(scriptId))
                    return res
                        .status(400)
                        .json({ message: "Valid Script ID is required" });

                const script = await storage.getScriptById(scriptId);
                if (!script || !script.content) {
                    return res.status(404).json({
                        message: "Script not found or has no content",
                    });
                }

                const projectBudget = budgetParam
                    ? parseInt(budgetParam)
                    : undefined;
                const numberOfSuggestions = countParam
                    ? parseInt(countParam)
                    : 5;

                const allDbLocations =
                    await storage.getAllLocationsForAISuggestion();
                if (allDbLocations.length === 0) {
                    console.log(
                        `${logPrefix} No locations in DB to suggest from.`,
                    );
                    return res.json([]);
                }

                const aiLocationSuggestions: LocationAISuggestion[] =
                    await suggestLocationsForScriptViaGemini(
                        script.content,
                        script.id,
                        allDbLocations,
                        projectBudget,
                        numberOfSuggestions,
                    );

                if (aiLocationSuggestions.length === 0) return res.json([]);

                const finalSuggestedLocations: ClientSuggestedLocation[] = [];
                for (const aiSugg of aiLocationSuggestions) {
                    const locationDetails = await storage.getLocationById(
                        aiSugg.locationId,
                    );
                    if (locationDetails) {
                        finalSuggestedLocations.push({
                            ...locationDetails,
                            matchReason: aiSugg.matchReason,
                            estimatedIncentiveValue:
                                aiSugg.estimatedIncentiveNotes,
                            confidenceScore: aiSugg.confidenceScore,
                        });
                    } else {
                        console.warn(
                            `${logPrefix} Location ID "${aiSugg.locationId}" suggested by AI not found in DB.`,
                        );
                    }
                }
                res.json(finalSuggestedLocations);
            } catch (error) {
                console.error(`${logPrefix} Error:`, error);
                next(error);
            }
        },
    );

    app.get(
        `${apiPrefix}/scripts/:scriptId/characters`,
        async (req, res, next) => {
            const scriptIdParam = req.params.scriptId;
            const logPrefix = `[Characters Route for Script ID:${scriptIdParam}]`;
            try {
                const scriptId = parseInt(scriptIdParam);
                if (isNaN(scriptId))
                    return res
                        .status(400)
                        .json({ message: "Valid Script ID is required" });

                const script = await storage.getScriptById(scriptId);
                if (!script || !script.content)
                    return res.status(404).json({
                        message: "Script not found or has no content",
                    });

                console.log(`${logPrefix} Extracting characters from script content`);
                const characters: ScriptCharacter[] = await extractCharactersWithGemini(script.content);

                try {
                    if (characters.length > 0) {
                        console.log(`${logPrefix} Starting background prefetch for ${Math.min(5, characters.length)} main characters`);
                        // Background prefetching removed during cleanup
                        console.log(`${logPrefix} Character prefetching disabled`);;
                    }
                } catch (prefetchError: any) {
                    console.error(`${logPrefix} Prefetch setup error: ${prefetchError.message}`);
                }

                return res.json(characters);
            } catch (error) {
                console.error(`${logPrefix} Error extracting characters:`, error);
                next(error);
            }
        },
    );

    app.get(
        `${apiPrefix}/characters/:characterName/suggest-actors`,
        async (req, res, next) => {
            const characterName = req.params.characterName;
            const {
                scriptId: queryScriptId,
                filmGenre: filmGenreFromUI,
                roleType: roleTypeFromUI,
                budgetTier: budgetTierFromUI,
                gender: genderFilterFromUI,
            } = req.query as {
                scriptId?: string;
                filmGenre?: string;
                roleType?: string;
                budgetTier?: string;
                gender?: string;
            };
            const logPrefix = `[Route Actor Suggestion for "${characterName}" in Script ${queryScriptId}]`;

            try {
                if (!characterName) {
                    return res.status(400).json({ message: "Character name required" });
                }

                if (!queryScriptId) {
                    return res.status(400).json({ message: "Script ID query parameter is required" });
                }

                const scriptId = parseInt(queryScriptId);
                if (isNaN(scriptId)) {
                    return res.status(400).json({ message: "Valid Script ID is required" });
                }

                const { getActorSuggestionsWithCaching } = await import('./services/character-suggestion-optimizer');
                console.log(`${logPrefix} Using optimized character suggestion service with caching`);

                const aiSuggestions = await getActorSuggestionsWithCaching(
                    scriptId,
                    characterName,
                    filmGenreFromUI,
                    roleTypeFromUI,
                    budgetTierFromUI,
                    genderFilterFromUI
                );

                if (aiSuggestions.length === 0) {
                    console.log(`${logPrefix} No suggestions found for character`);
                    return res.json([]);
                }

                const finalSuggestions: ClientActorSuggestion[] = [];
                for (const aiSugg of aiSuggestions) {
                    const directDbActor = await storage.getActorByName(aiSugg.actorName);
                    if (directDbActor) {
                        finalSuggestions.push({
                            ...directDbActor,
                            matchReason: aiSugg.matchReason,
                            controversyLevel: aiSugg.controversyLevel,
                        });
                    } else {
                        console.warn(`${logPrefix} Actor "${aiSugg.actorName}" not found in DB.`);
                    }
                }
                console.log(`${logPrefix} Returning ${finalSuggestions.length} suggestions`);
                return res.json(finalSuggestions);
            } catch (error) {
                console.error(`${logPrefix} Error processing request:`, error);
                next(error);
            }
        },
    );

    app.post(
        `${apiPrefix}/characters/batch-suggest-actors`,
        async (req, res, next) => {
            try {
                const { scriptId, characters } = req.body as {
                    scriptId: number,
                    characters: {
                        name: string,
                        criteria: {
                            filmGenre?: string;
                            roleType?: string;
                            budgetTier?: string;
                            gender?: string;
                        }
                    }[]
                };

                if (!scriptId) return res.status(400).json({ message: "Script ID is required" });
                if (!characters || !Array.isArray(characters) || characters.length === 0) {
                    return res.status(400).json({ message: "At least one character is required" });
                }

                const response: Record<string, ClientActorSuggestion[]> = {};

                for (const character of characters) {
                    // Use the character-suggestion-optimizer service instead
                    const { getActorSuggestionsWithCaching } = await import('./services/character-suggestion-optimizer');
                    const aiSuggestions = await getActorSuggestionsWithCaching(
                        character,
                        {}
                    );

                    const characterClientSuggestions: ClientActorSuggestion[] = [];
                    if (aiSuggestions.length > 0) {
                        for (const aiSugg of aiSuggestions) {
                            const actorDetails = await storage.getActorByName(aiSugg.actorName);
                            if (actorDetails) {
                                characterClientSuggestions.push({
                                    ...actorDetails,
                                    matchReason: aiSugg.matchReason,
                                    controversyLevel: aiSugg.controversyLevel,
                                });
                            }
                        }
                    }
                    response[character.name] = characterClientSuggestions;
                }

                res.json(response);
            } catch (error) {
                console.error('[Batch Character Suggest] Error:', error);
                next(error);
            }
        }
    );

    app.post(
        `${apiPrefix}/scripts/:scriptId/prefetch-character-suggestions`,
        async (req, res, next) => {
            const scriptIdParam = req.params.scriptId;
            try {
                const scriptId = parseInt(scriptIdParam);
                if (isNaN(scriptId)) return res.status(400).json({ message: "Valid Script ID is required" });

                // Prefetch functionality disabled during cleanup
                console.log(`[Prefetch Route] Prefetch disabled for script ${scriptId}`);

                res.status(202).json({ message: "Character suggestions prefetch started", scriptId });
            } catch (error) {
                next(error);
            }
        }
    );

    // VFX Analysis endpoint - analyze existing script for VFX scenes
    app.post(`${apiPrefix}/scripts/:scriptId/analyze-vfx`, async (req, res, next) => {
        try {
            const scriptId = parseInt(req.params.scriptId);
            if (isNaN(scriptId)) {
                return res.status(400).json({ message: "Valid Script ID is required" });
            }

            const logPrefix = `[VFX Analysis Route for Script ${scriptId}]`;
            console.log(`${logPrefix} Starting VFX analysis`);

            // Get the script
            const script = await storage.getScriptById(scriptId);
            if (!script) {
                return res.status(404).json({ message: "Script not found" });
            }

            // Get all scenes for this script
            const scenes = await storage.getScenesByScriptId(scriptId);
            if (scenes.length === 0) {
                return res.status(400).json({ message: "No scenes found for this script" });
            }

            console.log(`${logPrefix} Found ${scenes.length} scenes to analyze`);

            // Run VFX analysis
            await analyzeAndStoreScriptVFX(scriptId, script.content, scenes);

            // Count VFX scenes after analysis
            const updatedScenes = await storage.getScenesByScriptId(scriptId);
            const vfxScenesCount = updatedScenes.filter(scene => scene.isVfxScene).length;

            console.log(`${logPrefix} VFX analysis completed. ${vfxScenesCount} VFX scenes identified`);

            res.status(200).json({
                message: "VFX analysis completed successfully",
                scriptId,
                totalScenes: scenes.length,
                vfxScenesCount,
            });

        } catch (error) {
            console.error(`[VFX Analysis Route] Error:`, error);
            next(error);
        }
    });

    // Initiate full VFX analysis for script (alternative endpoint)
    app.post(`${apiPrefix}/scripts/:scriptId/initiate-vfx-analysis`, async (req, res, next) => {
        try {
            const scriptId = parseInt(req.params.scriptId);
            if (isNaN(scriptId)) {
                return res.status(400).json({ message: "Valid Script ID is required" });
            }

            const logPrefix = `[VFX Initiate Route for Script ${scriptId}]`;
            console.log(`${logPrefix} Starting full VFX re-analysis`);

            // Get the script
            const script = await storage.getScriptById(scriptId);
            if (!script) {
                return res.status(404).json({ message: "Script not found" });
            }

            // Get all scenes for this script
            const scenes = await storage.getScenesByScriptId(scriptId);
            if (scenes.length === 0) {
                return res.status(400).json({ message: "No scenes found for this script" });
            }

            console.log(`${logPrefix} Found ${scenes.length} scenes to re-analyze`);

            // Run VFX analysis
            await analyzeAndStoreScriptVFX(scriptId, script.content, scenes);

            // Count VFX scenes after analysis
            const updatedScenes = await storage.getScenesByScriptId(scriptId);
            const vfxScenesCount = updatedScenes.filter(scene => scene.isVfxScene).length;

            console.log(`${logPrefix} Full VFX re-analysis completed. ${vfxScenesCount} VFX scenes identified`);

            res.status(200).json({
                message: "Full VFX analysis initiated and completed successfully",
                scriptId,
                totalScenes: scenes.length,
                vfxScenesCount,
            });

        } catch (error) {
            console.error(`[VFX Initiate Route] Error:`, error);
            next(error);
        }
    });

    // Get VFX scenes with tier details (on-demand generation)
    app.get(`${apiPrefix}/scripts/:scriptId/vfx-scenes`, async (req, res, next) => {
        try {
            const scriptId = parseInt(req.params.scriptId);
            if (isNaN(scriptId)) {
                return res.status(400).json({ message: "Valid Script ID is required" });
            }

            const logPrefix = `[VFX Scenes Route for Script ${scriptId}]`;
            console.log(`${logPrefix} Fetching VFX scenes with tier details`);

            // Get all scenes for this script
            const allScenes = await storage.getScenesByScriptId(scriptId);
            if (allScenes.length === 0) {
                return res.status(404).json({ message: "No scenes found for this script" });
            }

            // Filter VFX scenes
            const vfxScenes = allScenes.filter(scene => scene.isVfxScene);
            console.log(`${logPrefix} Found ${vfxScenes.length} VFX scenes out of ${allScenes.length} total scenes`);

            const vfxScenesWithDetails = [];

            for (const scene of vfxScenes) {
                try {
                    // Get existing VFX tier details
                    let vfxDetails = await storage.getVfxSceneDetailsBySceneId(scene.id);

                    // If no tier details exist, generate them on-demand
                    if (vfxDetails.length === 0) {
                        console.log(`${logPrefix} No tier details found for scene ${scene.id}, generating on-demand`);
                        
                        const { generateAndStoreVFXTierDetailsForScene } = await import("./services/vfx-analysis-service");
                        await generateAndStoreVFXTierDetailsForScene(scene);
                        
                        // Re-fetch the newly generated details
                        vfxDetails = await storage.getVfxSceneDetailsBySceneId(scene.id);
                        console.log(`${logPrefix} Generated ${vfxDetails.length} tier details for scene ${scene.id}`);
                    }

                    // Add the scene with its VFX details
                    vfxScenesWithDetails.push({
                        ...scene,
                        vfxDetails: vfxDetails
                    });

                } catch (sceneError) {
                    console.error(`${logPrefix} Error processing scene ${scene.id}:`, sceneError);
                    // Include scene without details if generation fails
                    vfxScenesWithDetails.push({
                        ...scene,
                        vfxDetails: []
                    });
                }
            }

            console.log(`${logPrefix} Returning ${vfxScenesWithDetails.length} VFX scenes with tier details`);

            res.status(200).json(vfxScenesWithDetails);

        } catch (error) {
            console.error(`[VFX Scenes Route] Error:`, error);
            next(error);
        }
    });

    // Select VFX tier for a scene
    app.put(`${apiPrefix}/scenes/:sceneId/select-vfx-tier`, async (req, res, next) => {
        try {
            const sceneId = parseInt(req.params.sceneId);
            if (isNaN(sceneId)) {
                return res.status(400).json({ message: "Valid Scene ID is required" });
            }

            const { qualityTier } = req.body;
            if (!qualityTier || !['LOW', 'MEDIUM', 'HIGH'].includes(qualityTier)) {
                return res.status(400).json({ message: "Valid qualityTier (LOW, MEDIUM, HIGH) is required" });
            }

            const logPrefix = `[VFX Tier Select Scene ${sceneId}]`;
            console.log(`${logPrefix} Selecting ${qualityTier} tier`);

            // Get the scene
            const scene = await storage.getSceneById(sceneId);
            if (!scene) {
                return res.status(404).json({ message: "Scene not found" });
            }

            if (!scene.isVfxScene) {
                return res.status(400).json({ message: "Scene is not marked as a VFX scene" });
            }

            // Get VFX tier details for the selected tier
            const vfxDetails = await storage.getVfxSceneDetailsBySceneId(sceneId);
            const selectedTierDetail = vfxDetails.find(detail => detail.qualityTier === qualityTier);

            if (!selectedTierDetail) {
                return res.status(404).json({ 
                    message: `VFX tier details for ${qualityTier} not found. Please generate tier details first.` 
                });
            }

            // Update scene with selected tier and cost
            const updatedScene = await storage.updateScene(sceneId, {
                selectedVfxTier: qualityTier,
                selectedVfxCost: selectedTierDetail.estimatedVfxCost || 0
            });

            console.log(`${logPrefix} Selected ${qualityTier} tier with cost $${selectedTierDetail.estimatedVfxCost}`);

            res.status(200).json({
                message: "VFX tier selected successfully",
                sceneId,
                selectedTier: qualityTier,
                selectedCost: selectedTierDetail.estimatedVfxCost,
                scene: updatedScene
            });

        } catch (error) {
            console.error(`[VFX Tier Select Route] Error:`, error);
            next(error);
        }
    });

    const httpServer = createServer(app);
    return httpServer;
}