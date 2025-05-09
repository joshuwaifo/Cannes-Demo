// // server/storage.ts
// import { db } from "@db";
// import {
//   products,
//   scripts,
//   scenes,
//   sceneVariations,
//   actors,
//   locations,
//   insertProductSchema,
//   insertScriptSchema,
//   insertSceneSchema,
//   insertSceneVariationSchema,
//   insertActorSchema,
//   insertLocationSchema,
//   Product,
//   ProductCategory,
//   Script,
//   Scene,
//   SceneVariation, // Base type from schema
//   Actor,
//   Location,
// } from "@shared/schema";
// import { eq, and, like, desc, sql, count, asc, not } from "drizzle-orm";
// import { ZodError } from "zod";

// // --- Utility: Get Product for Scene Variation ---
// // Helper to avoid repeating the join logic if needed elsewhere
// async function getProductForVariation(productId: number): Promise<Product | null> {
//     const result = await db.select().from(products).where(eq(products.id, productId)).limit(1);
//     return result.length > 0 ? result[0] : null;
// }

// // --- Products ---
// // (No changes needed for product functions: getProducts, getProductById, createProduct, updateProduct, deleteProduct)
// export async function getProducts(
//   options: {
//     search?: string;
//     category?: string;
//     page?: number;
//     pageSize?: number;
//   } = {},
// ) {
//   const { search = "", category = "ALL", page = 1, pageSize = 12 } = options;
//   const offset = (page - 1) * pageSize;

//   let query = db.select().from(products).$dynamic(); // Make query dynamic

//   // Apply search filter - case insensitive
//   if (search) {
//     query = query.where(
//       sql`(${products.name} ILIKE ${'%' + search + '%'} OR ${products.companyName} ILIKE ${'%' + search + '%'})`
//     );
//   }

//   // Apply category filter
//   if (category && category !== "ALL") {
//     query = query.where(eq(products.category, category as ProductCategory));
//   }

//   // Get total count for pagination - APPLY FILTERS TO COUNT QUERY
//   let countQuery = db.select({ count: sql<number>`count(*)` }).from(products).$dynamic(); // Make query dynamic
//   if (search) {
//      countQuery = countQuery.where(
//        sql`(${products.name} ILIKE ${'%' + search + '%'} OR ${products.companyName} ILIKE ${'%' + search + '%'})`
//      );
//   }
//   if (category && category !== "ALL") {
//     countQuery = countQuery.where(
//       eq(products.category, category as ProductCategory),
//     );
//   }

//   const countResult = await countQuery;
//   const total = Number(countResult[0]?.count || 0);

//   // Get paginated products
//   const result = await query
//     .orderBy(desc(products.createdAt))
//     .limit(pageSize)
//     .offset(offset);

//   return {
//     products: result,
//     totalCount: total,
//     currentPage: page,
//     totalPages: Math.ceil(total / pageSize),
//     pageSize,
//   };
// }

// export async function getProductById(id: number): Promise<Product | null> {
//   const result = await db
//     .select()
//     .from(products)
//     .where(eq(products.id, id))
//     .limit(1);
//   return result.length > 0 ? result[0] : null;
// }

// export async function createProduct(
//   data: Omit<Product, "id" | "createdAt" | "updatedAt">,
// ): Promise<Product> {
//   try {
//     const validatedData = insertProductSchema.parse({
//       ...data,
//       // createdAt and updatedAt are handled by defaultNow()
//     });

//     const result = await db.insert(products).values(validatedData).returning();
//     return result[0];
//   } catch (error: unknown) {
//     if (error instanceof ZodError) {
//       throw new Error(
//         `Validation error: ${error.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(", ")}`,
//       );
//     }
//     console.error("Error in createProduct:", error);
//     throw error;
//   }
// }

// export async function updateProduct(
//   id: number,
//   data: Partial<Omit<Product, "id" | "createdAt">>, // Allow updating updatedAt implicitly
// ): Promise<Product | null> {
//   try {
//     // Validate only the fields provided
//      const partialSchema = insertProductSchema.partial().omit({ id: true, createdAt: true, updatedAt: true });
//      const validatedUpdateData = partialSchema.parse(data);


//     const result = await db
//       .update(products)
//       .set({ ...validatedUpdateData, updatedAt: new Date() }) // Ensure updatedAt is always set
//       .where(eq(products.id, id))
//       .returning();

//     return result.length > 0 ? result[0] : null;
//   } catch (error: unknown) {
//     if (error instanceof ZodError) {
//         console.error("Zod Validation Error in updateProduct:", error.errors);
//       throw new Error(
//         `Validation error: ${error.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(", ")}`,
//       );
//     }
//     console.error(`Error in updateProduct for ID ${id}:`, error);
//     throw error;
//   }
// }

// export async function deleteProduct(id: number): Promise<boolean> {
//     // Consider cascading deletes or handling related variations if necessary
//     console.warn(`Deleting product ${id}. Related scene variations might be affected if cascade is not set.`);
//   const result = await db
//     .delete(products)
//     .where(eq(products.id, id))
//     .returning();
//   return result.length > 0;
// }


// // --- Scripts ---
// // (No changes needed for script functions: getCurrentScript, getScriptById, createScript, updateScript, deleteScript)
// export async function getCurrentScript(): Promise<Script | null> {
//   const result = await db
//     .select()
//     .from(scripts)
//     .orderBy(desc(scripts.createdAt))
//     .limit(1);
//   return result.length > 0 ? result[0] : null;
// }

// export async function getScriptById(id: number): Promise<Script | null> {
//   const result = await db
//     .select()
//     .from(scripts)
//     .where(eq(scripts.id, id))
//     .limit(1);
//   return result.length > 0 ? result[0] : null;
// }

// export async function createScript(
//   data: Omit<Script, "id" | "createdAt" | "updatedAt">,
// ): Promise<Script> {
//   try {
//     const validatedData = insertScriptSchema.parse({
//       ...data,
//       // Timestamps handled by defaultNow()
//     });

//     const result = await db.insert(scripts).values(validatedData).returning();
//     return result[0];
//   } catch (error: unknown) {
//     if (error instanceof ZodError) {
//         console.error("Zod Validation Error in createScript:", error.errors);
//       throw new Error(
//         `Validation error: ${error.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(", ")}`,
//       );
//     }
//     console.error("Error in createScript:", error);
//     throw error;
//   }
// }

// export async function updateScript(
//   id: number,
//   data: Partial<Omit<Script, "id" | "createdAt">>, // Allow updating updatedAt implicitly
// ): Promise<Script | null> {
//   try {
//     const partialSchema = insertScriptSchema.partial().omit({ id: true, createdAt: true, updatedAt: true });
//     const validatedUpdateData = partialSchema.parse(data);

//     const result = await db
//       .update(scripts)
//       .set({ ...validatedUpdateData, updatedAt: new Date() })
//       .where(eq(scripts.id, id))
//       .returning();

//     return result.length > 0 ? result[0] : null;
//   } catch (error: unknown) {
//     if (error instanceof ZodError) {
//        console.error("Zod Validation Error in updateScript:", error.errors);
//       throw new Error(
//         `Validation error: ${error.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(", ")}`,
//       );
//     }
//     console.error(`Error in updateScript for ID ${id}:`, error);
//     throw error;
//   }
// }

// export async function deleteScript(id: number): Promise<boolean> {
//      // Cascading delete should handle scenes and variations if schema is set correctly
//      console.warn(`Deleting script ${id}. Related scenes and variations will also be deleted due to cascade.`);
//   const result = await db.delete(scripts).where(eq(scripts.id, id)).returning();
//   return result.length > 0;
// }


// // --- Scenes ---
// // (No changes needed for scene functions: getScenesByScriptId, getBrandableScenes, getSceneById, createScene, updateScene, deleteScene)
// export async function getScenesByScriptId(scriptId: number): Promise<Scene[]> {
//   return await db
//     .select()
//     .from(scenes)
//     .where(eq(scenes.scriptId, scriptId))
//     .orderBy(asc(scenes.sceneNumber));
// }

// export async function getBrandableScenes(scriptId: number): Promise<Scene[]> {
//   return await db
//     .select()
//     .from(scenes)
//     .where(and(eq(scenes.scriptId, scriptId), eq(scenes.isBrandable, true)))
//     .orderBy(asc(scenes.sceneNumber));
// }

// export async function getSceneById(id: number): Promise<Scene | null> {
//   const result = await db
//     .select()
//     .from(scenes)
//     .where(eq(scenes.id, id))
//     .limit(1);
//   return result.length > 0 ? result[0] : null;
// }

// export async function createScene(
//   data: Omit<Scene, "id" | "createdAt" | "updatedAt">,
// ): Promise<Scene> {
//   try {
//     const validatedData = insertSceneSchema.parse({
//       ...data,
//       // Timestamps handled by defaultNow()
//     });

//     const result = await db.insert(scenes).values(validatedData).returning();
//     return result[0];
//   } catch (error: unknown) {
//     if (error instanceof ZodError) {
//         console.error("Zod Validation Error in createScene:", error.errors);
//       throw new Error(
//         `Validation error: ${error.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(", ")}`,
//       );
//     }
//     console.error("Error in createScene:", error);
//     throw error;
//   }
// }

// export async function updateScene(
//   id: number,
//   data: Partial<Omit<Scene, "id" | "createdAt">>, // Allow updating updatedAt implicitly
// ): Promise<Scene | null> {
//   try {
//     const partialSchema = insertSceneSchema.partial().omit({ id: true, createdAt: true, updatedAt: true });
//     const validatedUpdateData = partialSchema.parse(data);

//     const result = await db
//       .update(scenes)
//       .set({ ...validatedUpdateData, updatedAt: new Date() })
//       .where(eq(scenes.id, id))
//       .returning();

//     return result.length > 0 ? result[0] : null;
//   } catch (error: unknown) {
//     if (error instanceof ZodError) {
//         console.error("Zod Validation Error in updateScene:", error.errors);
//       throw new Error(
//         `Validation error: ${error.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(", ")}`,
//       );
//     }
//     console.error(`Error in updateScene for ID ${id}:`, error);
//     throw error;
//   }
// }

// export async function deleteScene(id: number): Promise<boolean> {
//     // Cascading delete should handle variations if schema is set correctly
//      console.warn(`Deleting scene ${id}. Related scene variations will also be deleted due to cascade.`);
//   const result = await db.delete(scenes).where(eq(scenes.id, id)).returning();
//   return result.length > 0;
// }


// // --- Scene Variations ---
// // MODIFIED: getSceneVariations - Selects geminiPrompt
// export async function getSceneVariations(sceneId: number): Promise<SceneVariation[]> {
//   const result = await db
//     .select({
//       // Explicitly list fields from sceneVariations
//       id: sceneVariations.id,
//       sceneId: sceneVariations.sceneId,
//       productId: sceneVariations.productId,
//       variationNumber: sceneVariations.variationNumber,
//       description: sceneVariations.description,
//       imageUrl: sceneVariations.imageUrl,
//       geminiPrompt: sceneVariations.geminiPrompt, // <-- Select the prompt
//       isSelected: sceneVariations.isSelected,
//       createdAt: sceneVariations.createdAt,
//       updatedAt: sceneVariations.updatedAt,
//       // Fields from joined products table
//       productName: products.name,
//       productCategory: products.category,
//       productImageUrl: products.imageUrl,
//     })
//     .from(sceneVariations)
//     .leftJoin(products, eq(sceneVariations.productId, products.id))
//     .where(eq(sceneVariations.sceneId, sceneId))
//     .orderBy(asc(sceneVariations.variationNumber));

//   // Cast the category to ProductCategory type explicitly if needed, Drizzle might infer correctly though
//    return result.map(v => ({ ...v, productCategory: v.productCategory as ProductCategory | undefined }));
// }

// // MODIFIED: getSceneVariationById - Selects geminiPrompt
// export async function getSceneVariationById(id: number): Promise<SceneVariation | null> {
//   const result = await db
//     .select({
//       // Explicitly list fields from sceneVariations
//       id: sceneVariations.id,
//       sceneId: sceneVariations.sceneId,
//       productId: sceneVariations.productId,
//       variationNumber: sceneVariations.variationNumber,
//       description: sceneVariations.description,
//       imageUrl: sceneVariations.imageUrl,
//       geminiPrompt: sceneVariations.geminiPrompt, // <-- Select the prompt
//       isSelected: sceneVariations.isSelected,
//       createdAt: sceneVariations.createdAt,
//       updatedAt: sceneVariations.updatedAt,
//       // Fields from joined products table
//       productName: products.name,
//       productCategory: products.category,
//       productImageUrl: products.imageUrl,
//     })
//     .from(sceneVariations)
//     .leftJoin(products, eq(sceneVariations.productId, products.id))
//     .where(eq(sceneVariations.id, id))
//     .limit(1);

//     if (result.length === 0) {
//         return null;
//     }
//     const variation = result[0];
//     // Cast category
//     return { ...variation, productCategory: variation.productCategory as ProductCategory | undefined };
// }

// // MODIFIED: createSceneVariation - Validates and uses geminiPrompt
// export async function createSceneVariation(
//   data: Omit<SceneVariation, "id" | "createdAt" | "updatedAt">,
// ): Promise<SceneVariation> { // Return type is still SceneVariation from schema
//   try {
//     const validatedData = insertSceneVariationSchema.parse({
//       ...data,
//       // createdAt/updatedAt handled by defaultNow()
//     });

//     // Explicit check for prompt although schema enforces notNull
//     if (!validatedData.geminiPrompt) {
//         throw new Error("Programming error: Gemini prompt is missing in data passed to createSceneVariation.");
//     }

//     const result = await db
//       .insert(sceneVariations)
//       .values(validatedData)
//       .returning();

//     // Fetch the product details to return the extended type immediately
//     const productDetails = await getProductForVariation(result[0].productId);

//     return {
//         ...result[0],
//         productName: productDetails?.name,
//         productCategory: productDetails?.category as ProductCategory | undefined,
//         productImageUrl: productDetails?.imageUrl,
//     };
//   } catch (error: unknown) {
//     if (error instanceof ZodError) {
//         console.error("Zod Validation Error in createSceneVariation:", error.errors);
//       throw new Error(
//         `Validation error: ${error.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(", ")}`,
//       );
//     }
//     console.error("Error in createSceneVariation:", error);
//     throw error;
//   }
// }

// // MODIFIED: updateSceneVariation - Handles potential geminiPrompt update
// export async function updateSceneVariation(
//   id: number,
//   data: Partial<Omit<SceneVariation, "id" | "createdAt">>, // Allow updating updatedAt implicitly
// ): Promise<SceneVariation | null> {
//   try {
//     // Validate only provided fields, including optional geminiPrompt
//     const partialSchema = insertSceneVariationSchema.partial().omit({ id: true, createdAt: true, updatedAt: true});
//     const validatedUpdateData = partialSchema.parse(data);

//     const result = await db
//       .update(sceneVariations)
//       .set({ ...validatedUpdateData, updatedAt: new Date() })
//       .where(eq(sceneVariations.id, id))
//       .returning();

//     if (result.length === 0) {
//         return null;
//     }

//      // Fetch the product details to return the extended type
//      const productDetails = await getProductForVariation(result[0].productId);

//      return {
//          ...result[0],
//          productName: productDetails?.name,
//          productCategory: productDetails?.category as ProductCategory | undefined,
//          productImageUrl: productDetails?.imageUrl,
//      };
//   } catch (error: unknown) {
//     if (error instanceof ZodError) {
//         console.error("Zod Validation Error in updateSceneVariation:", error.errors);
//       throw new Error(
//         `Validation error: ${error.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(", ")}`,
//       );
//     }
//     console.error(`Error in updateSceneVariation for ID ${id}:`, error);
//     throw error;
//   }
// }

// export async function deleteSceneVariation(id: number): Promise<boolean> {
//   const result = await db
//     .delete(sceneVariations)
//     .where(eq(sceneVariations.id, id))
//     .returning();
//   return result.length > 0;
// }

// // MODIFIED: selectVariation - No changes needed functionally, but added logging
// export async function selectVariation(
//   id: number,
// ): Promise<SceneVariation | null> {
//   try {
//     console.log(`[selectVariation] Attempting to select variation ID: ${id}`);
//     return await db.transaction(async (tx) => { // Removed explicit type for tx, drizzle infers it
//       // 1. Get the scene ID of the variation being selected
//       const variationToSelect = await tx
//         .select({ sceneId: sceneVariations.sceneId })
//         .from(sceneVariations)
//         .where(eq(sceneVariations.id, id))
//         .limit(1);

//       if (!variationToSelect || variationToSelect.length === 0) {
//         console.error(`[selectVariation] Variation with ID ${id} not found.`);
//         return null;
//       }
//       const { sceneId } = variationToSelect[0];
//        console.log(`[selectVariation] Variation ${id} belongs to Scene ${sceneId}. Deselecting others...`);


//       // 2. Set isSelected = false for all other variations in the same scene
//       const updateResult = await tx
//         .update(sceneVariations)
//         .set({ isSelected: false, updatedAt: new Date() })
//         .where(
//           and(
//             eq(sceneVariations.sceneId, sceneId),
//             not(eq(sceneVariations.id, id)),
//           ),
//         );
//         console.log(`[selectVariation] Deselected ${updateResult.rowCount} other variations in Scene ${sceneId}.`);


//       // 3. Set isSelected = true for the target variation
//       const result = await tx
//         .update(sceneVariations)
//         .set({ isSelected: true, updatedAt: new Date() })
//         .where(eq(sceneVariations.id, id))
//         .returning();

//         if (result.length > 0) {
//             console.log(`[selectVariation] Successfully selected variation ID: ${id}`);
//              // Fetch product details to return the extended type
//             const productDetails = await getProductForVariation(result[0].productId);
//             return {
//                 ...result[0],
//                 productName: productDetails?.name,
//                 productCategory: productDetails?.category as ProductCategory | undefined,
//                 productImageUrl: productDetails?.imageUrl,
//             };
//         } else {
//              console.error(`[selectVariation] Failed to update variation ID: ${id} after deselecting others.`);
//              return null; // Should not happen if variation was found initially
//         }
//     });
//   } catch (error: unknown) {
//     console.error(`[selectVariation] Error selecting variation ID ${id}:`, error);
//     throw error; // Rethrow the error after logging
//   }
// }

// // --- Product Matching ---
// // (No changes needed for getTopMatchingProductsForScene)
// export async function getTopMatchingProductsForScene(
//   sceneId: number, // sceneId might not be strictly necessary anymore if logic depends only on categories
//   suggestedCategories: ProductCategory[],
//   limit: number = 3
// ): Promise<Product[]> {
//     console.log(`[getTopMatchingProducts] Finding products for Scene ${sceneId}, Categories: ${suggestedCategories.join(', ')}, Limit: ${limit}`);
//   try {
//     if (!suggestedCategories || suggestedCategories.length === 0) {
//       console.log(`[getTopMatchingProducts] No categories suggested for scene ${sceneId}. Fetching ${limit} most recent products.`);
//       return await db
//         .select()
//         .from(products)
//         .orderBy(desc(products.createdAt))
//         .limit(limit);
//     }

//     // Ensure categories are valid enum values before using in SQL IN clause
//      const validCategories = suggestedCategories.filter(cat => Object.values(ProductCategory).includes(cat));
//      if (validCategories.length === 0) {
//          console.warn(`[getTopMatchingProducts] Provided categories for scene ${sceneId} were invalid. Fetching recent products.`);
//           return await db
//             .select()
//             .from(products)
//             .orderBy(desc(products.createdAt))
//             .limit(limit);
//      }


//     // Filter products by the suggested categories
//     const matchingProducts = await db
//       .select()
//       .from(products)
//       .where(sql`${products.category} IN ${validCategories}`) // Use sql helper for IN clause
//       .orderBy(desc(products.createdAt)) // Order by newest first
//       .limit(limit);

//     console.log(`[getTopMatchingProducts] Found ${matchingProducts.length} products matching categories.`);


//     // If we don't have enough matching products, add more non-matching ones to reach the limit
//     if (matchingProducts.length < limit) {
//         const needed = limit - matchingProducts.length;
//         console.log(`[getTopMatchingProducts] Not enough matches. Fetching ${needed} additional recent products.`);
//         const existingIds = matchingProducts.map(p => p.id); // Get IDs of products already selected

//         const additionalProductsQuery = db
//             .select()
//             .from(products)
//             .orderBy(desc(products.createdAt))
//             .limit(needed);

//         // Exclude products already selected if any matches were found
//         if (existingIds.length > 0) {
//              additionalProductsQuery.where(sql`${products.id} NOT IN ${existingIds}`);
//         }

//       const additionalProducts = await additionalProductsQuery;


//       console.log(`[getTopMatchingProducts] Found ${additionalProducts.length} additional products.`);


//       return [...matchingProducts, ...additionalProducts];
//     }

//     return matchingProducts;
//   } catch (error) {
//     console.error(`[getTopMatchingProducts] Error getting products for scene ${sceneId}:`, error);
//     // Fallback to recent products on error
//     return await db.select().from(products).orderBy(desc(products.createdAt)).limit(limit);
//   }
// }


// // --- Actors ---
// // (No changes needed for actor functions: getActors, getActorById, createActor, updateActor, deleteActor)
// export async function getActors(
//   options: {
//     search?: string;
//     gender?: string;
//     nationality?: string;
//     page?: number;
//     pageSize?: number;
//   } = {},
// ): Promise<{
//   actors: Actor[];
//   totalCount: number;
//   currentPage: number;
//   totalPages: number;
//   pageSize: number;
// }> {
//   const { search = "", gender = "", nationality = "", page = 1, pageSize = 10 } = options;
//   const offset = (page - 1) * pageSize;

//   let query = db.select().from(actors).$dynamic();

//   // Apply search filter - case insensitive for name
//   if (search) {
//     query = query.where(sql`${actors.name} ILIKE ${'%' + search + '%'}`);
//   }

//   // Apply gender filter
//   if (gender && gender.toLowerCase() !== 'all') {
//     query = query.where(sql`lower(${actors.gender}) = lower(${gender})`);
//   }

//   // Apply nationality filter
//   if (nationality && nationality.toLowerCase() !== 'all') {
//     // Use ILIKE for partial matching if desired, or = for exact match
//     query = query.where(sql`${actors.nationality} ILIKE ${nationality}`); // Assuming exact match intended from UI
//   }

//   // Get total count for pagination - Apply the same filters to count query
//   let countQuery = db.select({ count: sql<number>`count(*)` }).from(actors).$dynamic();
//   if (search) {
//     countQuery = countQuery.where(sql`${actors.name} ILIKE ${'%' + search + '%'}`);
//   }
//   if (gender && gender.toLowerCase() !== 'all') {
//     countQuery = countQuery.where(sql`lower(${actors.gender}) = lower(${gender})`);
//   }
//   if (nationality && nationality.toLowerCase() !== 'all') {
//     countQuery = countQuery.where(sql`${actors.nationality} ILIKE ${nationality}`);
//   }

//   const countResult = await countQuery;
//   const total = Number(countResult[0]?.count || 0);

//   // Get paginated actors
//   const result = await query
//     .orderBy(asc(actors.name))
//     .limit(pageSize)
//     .offset(offset);

//   return {
//     actors: result,
//     totalCount: total,
//     currentPage: page,
//     totalPages: Math.ceil(total / pageSize),
//     pageSize,
//   };
// }


// export async function getActorById(id: number): Promise<Actor | null> {
//   const result = await db
//     .select()
//     .from(actors)
//     .where(eq(actors.id, id))
//     .limit(1);
//   return result.length > 0 ? result[0] : null;
// }

// export async function createActor(
//   data: Omit<Actor, "id" | "createdAt" | "updatedAt">,
// ): Promise<Actor> {
//   try {
//     const validatedData = insertActorSchema.parse({
//       ...data,
//       // Timestamps handled by defaultNow()
//     });

//     const result = await db.insert(actors).values(validatedData).returning();
//     return result[0];
//   } catch (error: unknown) {
//     if (error instanceof ZodError) {
//         console.error("Zod Validation Error in createActor:", error.errors);
//       throw new Error(
//         `Validation error: ${error.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(", ")}`,
//       );
//     }
//     console.error("Error in createActor:", error);
//     throw error;
//   }
// }

// export async function updateActor(
//   id: number,
//   data: Partial<Omit<Actor, "id" | "createdAt">>, // Allow updating updatedAt implicitly
// ): Promise<Actor | null> {
//   try {
//      const partialSchema = insertActorSchema.partial().omit({ id: true, createdAt: true, updatedAt: true });
//      const validatedUpdateData = partialSchema.parse(data);

//     const result = await db
//       .update(actors)
//       .set({ ...validatedUpdateData, updatedAt: new Date() })
//       .where(eq(actors.id, id))
//       .returning();

//     return result.length > 0 ? result[0] : null;
//   } catch (error: unknown) {
//     if (error instanceof ZodError) {
//         console.error("Zod Validation Error in updateActor:", error.errors);
//       throw new Error(
//         `Validation error: ${error.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(", ")}`,
//       );
//     }
//     console.error(`Error in updateActor for ID ${id}:`, error);
//     throw error;
//   }
// }

// export async function deleteActor(id: number): Promise<boolean> {
//   const result = await db
//     .delete(actors)
//     .where(eq(actors.id, id))
//     .returning();
//   return result.length > 0;
// }


// // --- Locations ---
// // (No changes needed for location functions: getLocations, getLocationById, createLocation, updateLocation, deleteLocation)
// export async function getLocations(
//   options: {
//     search?: string;
//     country?: string;
//     page?: number;
//     pageSize?: number;
//   } = {},
// ): Promise<{
//   locations: Location[];
//   totalCount: number;
//   currentPage: number;
//   totalPages: number;
//   pageSize: number;
// }> {
//   const { search = "", country = "", page = 1, pageSize = 10 } = options;
//   const offset = (page - 1) * pageSize;

//   let query = db.select().from(locations).$dynamic();

//   // Apply search filter - case insensitive
//   if (search) {
//     query = query.where(
//       sql`(${locations.country} ILIKE ${'%' + search + '%'} OR
//            ${locations.region} ILIKE ${'%' + search + '%'} OR
//            ${locations.incentiveProgram} ILIKE ${'%' + search + '%'})`,
//     );
//   }

//   // Apply country filter
//   if (country && country.toLowerCase() !== 'all') {
//     query = query.where(sql`lower(${locations.country}) = lower(${country})`);
//   }

//   // Get total count for pagination - Apply the same filters to count query
//   let countQuery = db.select({ count: sql<number>`count(*)` }).from(locations).$dynamic();
//   if (search) {
//     countQuery = countQuery.where(
//        sql`(${locations.country} ILIKE ${'%' + search + '%'} OR
//            ${locations.region} ILIKE ${'%' + search + '%'} OR
//            ${locations.incentiveProgram} ILIKE ${'%' + search + '%'})`
//     );
//   }
//   if (country && country.toLowerCase() !== 'all') {
//     countQuery = countQuery.where(sql`lower(${locations.country}) = lower(${country})`);
//   }

//   const countResult = await countQuery;
//   const total = Number(countResult[0]?.count || 0);

//   // Get paginated locations
//   const result = await query
//     .orderBy(asc(locations.country), asc(locations.region))
//     .limit(pageSize)
//     .offset(offset);

//   return {
//     locations: result,
//     totalCount: total,
//     currentPage: page,
//     totalPages: Math.ceil(total / pageSize),
//     pageSize,
//   };
// }


// export async function getLocationById(id: number): Promise<Location | null> {
//   const result = await db
//     .select()
//     .from(locations)
//     .where(eq(locations.id, id))
//     .limit(1);
//   return result.length > 0 ? result[0] : null;
// }

// export async function createLocation(
//   data: Omit<Location, "id" | "createdAt" | "updatedAt">,
// ): Promise<Location> {
//   try {
//     const validatedData = insertLocationSchema.parse({
//       ...data,
//        // Timestamps handled by defaultNow()
//     });

//     const result = await db.insert(locations).values(validatedData).returning();
//     return result[0];
//   } catch (error: unknown) {
//     if (error instanceof ZodError) {
//        console.error("Zod Validation Error in createLocation:", error.errors);
//       throw new Error(
//         `Validation error: ${error.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(", ")}`,
//       );
//     }
//     console.error("Error in createLocation:", error);
//     throw error;
//   }
// }

// export async function updateLocation(
//   id: number,
//   data: Partial<Omit<Location, "id" | "createdAt">>, // Allow updating updatedAt implicitly
// ): Promise<Location | null> {
//   try {
//     const partialSchema = insertLocationSchema.partial().omit({ id: true, createdAt: true, updatedAt: true });
//     const validatedUpdateData = partialSchema.parse(data);

//     const result = await db
//       .update(locations)
//       .set({ ...validatedUpdateData, updatedAt: new Date() })
//       .where(eq(locations.id, id))
//       .returning();

//     return result.length > 0 ? result[0] : null;
//   } catch (error: unknown) {
//     if (error instanceof ZodError) {
//       console.error("Zod Validation Error in updateLocation:", error.errors);
//       throw new Error(
//         `Validation error: ${error.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(", ")}`,
//       );
//     }
//     console.error(`Error in updateLocation for ID ${id}:`, error);
//     throw error;
//   }
// }

// export async function deleteLocation(id: number): Promise<boolean> {
//   const result = await db
//     .delete(locations)
//     .where(eq(locations.id, id))
//     .returning();
//   return result.length > 0;
// }

// // New function to get all actors for AI processing
// export async function getAllActorsForAISuggestion(): Promise<Actor[]> {
//   return await db.select().from(actors).orderBy(asc(actors.name));
// }

// // New function to get an actor by their exact name
// export async function getActorByName(name: string): Promise<Actor | null> {
//   const result = await db
//     .select()
//     .from(actors)
//     .where(eq(actors.name, name)) // Assuming actor names are unique
//     .limit(1);
//   return result.length > 0 ? result[0] : null;
// }


// server/storage.ts
import { db } from "@db";
import {
  products,
  scripts,
  scenes,
  sceneVariations,
  actors,
  locations,
  insertProductSchema,
  insertScriptSchema,
  insertSceneSchema,
  insertSceneVariationSchema,
  insertActorSchema,
  insertLocationSchema,
  Product,
  ProductCategory,
  Script,
  Scene,
  SceneVariation, // Base type from schema
  Actor,
  Location,
} from "@shared/schema";
import { eq, and, like, desc, sql, count, asc, not } from "drizzle-orm";
import { ZodError } from "zod";

// --- Utility: Get Product for Scene Variation ---
async function getProductForVariation(productId: number): Promise<Product | null> {
    const result = await db.select().from(products).where(eq(products.id, productId)).limit(1);
    return result.length > 0 ? result[0] : null;
}

// --- Products ---
export async function getProducts(
  options: {
    search?: string;
    category?: string;
    page?: number;
    pageSize?: number;
  } = {},
) {
  const { search = "", category = "ALL", page = 1, pageSize = 12 } = options;
  const offset = (page - 1) * pageSize;
  let query = db.select().from(products).$dynamic();
  if (search) {
    query = query.where(
      sql`(${products.name} ILIKE ${'%' + search + '%'} OR ${products.companyName} ILIKE ${'%' + search + '%'})`
    );
  }
  if (category && category !== "ALL") {
    query = query.where(eq(products.category, category as ProductCategory));
  }
  let countQuery = db.select({ count: sql<number>`count(*)` }).from(products).$dynamic();
  if (search) {
     countQuery = countQuery.where(
       sql`(${products.name} ILIKE ${'%' + search + '%'} OR ${products.companyName} ILIKE ${'%' + search + '%'})`
     );
  }
  if (category && category !== "ALL") {
    countQuery = countQuery.where(
      eq(products.category, category as ProductCategory),
    );
  }
  const countResult = await countQuery;
  const total = Number(countResult[0]?.count || 0);
  const result = await query
    .orderBy(desc(products.createdAt))
    .limit(pageSize)
    .offset(offset);
  return {
    products: result,
    totalCount: total,
    currentPage: page,
    totalPages: Math.ceil(total / pageSize),
    pageSize,
  };
}
export async function getProductById(id: number): Promise<Product | null> {
  const result = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}
export async function createProduct(data: Omit<Product, "id" | "createdAt" | "updatedAt">): Promise<Product> {
  try {
    const validatedData = insertProductSchema.parse({...data});
    const result = await db.insert(products).values(validatedData).returning();
    return result[0];
  } catch (e) { if (e instanceof ZodError) { throw new Error(`Validation error: ${e.errors.map((err: any) => `${err.path.join('.')}: ${err.message}`).join(", ")}`); } throw e;}
}
export async function updateProduct(id: number, data: Partial<Omit<Product, "id" | "createdAt">>): Promise<Product | null> {
  try {
     const partialSchema = insertProductSchema.partial().omit({ id: true, createdAt: true, updatedAt: true });
     const validatedUpdateData = partialSchema.parse(data);
    const result = await db.update(products).set({ ...validatedUpdateData, updatedAt: new Date() }).where(eq(products.id, id)).returning();
    return result.length > 0 ? result[0] : null;
  } catch (e) { if (e instanceof ZodError) { throw new Error(`Validation error: ${e.errors.map((err: any) => `${err.path.join('.')}: ${err.message}`).join(", ")}`); } throw e;}
}
export async function deleteProduct(id: number): Promise<boolean> {
  const result = await db.delete(products).where(eq(products.id, id)).returning();
  return result.length > 0;
}

// --- Scripts ---
export async function getCurrentScript(): Promise<Script | null> {
  const result = await db.select().from(scripts).orderBy(desc(scripts.createdAt)).limit(1);
  return result.length > 0 ? result[0] : null;
}
export async function getScriptById(id: number): Promise<Script | null> {
  const result = await db.select().from(scripts).where(eq(scripts.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}
export async function createScript(data: Omit<Script, "id" | "createdAt" | "updatedAt">): Promise<Script> {
  try {
    const validatedData = insertScriptSchema.parse({...data});
    const result = await db.insert(scripts).values(validatedData).returning();
    return result[0];
  } catch (e) { if (e instanceof ZodError) { throw new Error(`Validation error: ${e.errors.map((err: any) => `${err.path.join('.')}: ${err.message}`).join(", ")}`); } throw e;}
}
export async function updateScript(id: number, data: Partial<Omit<Script, "id" | "createdAt">>): Promise<Script | null> {
  try {
    const partialSchema = insertScriptSchema.partial().omit({ id: true, createdAt: true, updatedAt: true });
    const validatedUpdateData = partialSchema.parse(data);
    const result = await db.update(scripts).set({ ...validatedUpdateData, updatedAt: new Date() }).where(eq(scripts.id, id)).returning();
    return result.length > 0 ? result[0] : null;
  } catch (e) { if (e instanceof ZodError) { throw new Error(`Validation error: ${e.errors.map((err: any) => `${err.path.join('.')}: ${err.message}`).join(", ")}`); } throw e;}
}
export async function deleteScript(id: number): Promise<boolean> {
  const result = await db.delete(scripts).where(eq(scripts.id, id)).returning();
  return result.length > 0;
}

// --- Scenes ---
export async function getScenesByScriptId(scriptId: number): Promise<Scene[]> {
  return await db.select().from(scenes).where(eq(scenes.scriptId, scriptId)).orderBy(asc(scenes.sceneNumber));
}
export async function getBrandableScenes(scriptId: number): Promise<Scene[]> {
  return await db.select().from(scenes).where(and(eq(scenes.scriptId, scriptId), eq(scenes.isBrandable, true))).orderBy(asc(scenes.sceneNumber));
}
export async function getSceneById(id: number): Promise<Scene | null> {
  const result = await db.select().from(scenes).where(eq(scenes.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}
export async function createScene(data: Omit<Scene, "id" | "createdAt" | "updatedAt">): Promise<Scene> {
  try {
    const validatedData = insertSceneSchema.parse({...data});
    const result = await db.insert(scenes).values(validatedData).returning();
    return result[0];
  } catch (e) { if (e instanceof ZodError) { throw new Error(`Validation error: ${e.errors.map((err: any) => `${err.path.join('.')}: ${err.message}`).join(", ")}`); } throw e;}
}
export async function updateScene(id: number, data: Partial<Omit<Scene, "id" | "createdAt">>): Promise<Scene | null> {
  try {
    const partialSchema = insertSceneSchema.partial().omit({ id: true, createdAt: true, updatedAt: true });
    const validatedUpdateData = partialSchema.parse(data);
    const result = await db.update(scenes).set({ ...validatedUpdateData, updatedAt: new Date() }).where(eq(scenes.id, id)).returning();
    return result.length > 0 ? result[0] : null;
  } catch (e) { if (e instanceof ZodError) { throw new Error(`Validation error: ${e.errors.map((err: any) => `${err.path.join('.')}: ${err.message}`).join(", ")}`); } throw e;}
}
export async function deleteScene(id: number): Promise<boolean> {
  const result = await db.delete(scenes).where(eq(scenes.id, id)).returning();
  return result.length > 0;
}

// --- Scene Variations ---
export async function getSceneVariations(sceneId: number): Promise<SceneVariation[]> {
  const result = await db.select({
      id: sceneVariations.id, sceneId: sceneVariations.sceneId, productId: sceneVariations.productId,
      variationNumber: sceneVariations.variationNumber, description: sceneVariations.description,
      imageUrl: sceneVariations.imageUrl, geminiPrompt: sceneVariations.geminiPrompt,
      isSelected: sceneVariations.isSelected, createdAt: sceneVariations.createdAt, updatedAt: sceneVariations.updatedAt,
      productName: products.name, productCategory: products.category, productImageUrl: products.imageUrl,
    }).from(sceneVariations)
    .leftJoin(products, eq(sceneVariations.productId, products.id))
    .where(eq(sceneVariations.sceneId, sceneId))
    .orderBy(asc(sceneVariations.variationNumber));
   return result.map(v => ({ ...v, productCategory: v.productCategory as ProductCategory | undefined }));
}
export async function getSceneVariationById(id: number): Promise<SceneVariation | null> {
  const result = await db.select({
      id: sceneVariations.id, sceneId: sceneVariations.sceneId, productId: sceneVariations.productId,
      variationNumber: sceneVariations.variationNumber, description: sceneVariations.description,
      imageUrl: sceneVariations.imageUrl, geminiPrompt: sceneVariations.geminiPrompt,
      isSelected: sceneVariations.isSelected, createdAt: sceneVariations.createdAt, updatedAt: sceneVariations.updatedAt,
      productName: products.name, productCategory: products.category, productImageUrl: products.imageUrl,
    }).from(sceneVariations)
    .leftJoin(products, eq(sceneVariations.productId, products.id))
    .where(eq(sceneVariations.id, id))
    .limit(1);
    if (result.length === 0) return null;
    const variation = result[0];
    return { ...variation, productCategory: variation.productCategory as ProductCategory | undefined };
}
export async function createSceneVariation(data: Omit<SceneVariation, "id" | "createdAt" | "updatedAt">): Promise<SceneVariation> {
  try {
    const validatedData = insertSceneVariationSchema.parse({...data});
    if (!validatedData.geminiPrompt) { throw new Error("Gemini prompt is missing."); }
    const result = await db.insert(sceneVariations).values(validatedData).returning();
    const productDetails = await getProductForVariation(result[0].productId);
    return {...result[0], productName: productDetails?.name, productCategory: productDetails?.category as ProductCategory | undefined, productImageUrl: productDetails?.imageUrl,};
  } catch (e) { if (e instanceof ZodError) { throw new Error(`Validation error: ${e.errors.map((err: any) => `${err.path.join('.')}: ${err.message}`).join(", ")}`); } throw e;}
}
export async function updateSceneVariation(id: number, data: Partial<Omit<SceneVariation, "id" | "createdAt">>): Promise<SceneVariation | null> {
  try {
    const partialSchema = insertSceneVariationSchema.partial().omit({ id: true, createdAt: true, updatedAt: true});
    const validatedUpdateData = partialSchema.parse(data);
    const result = await db.update(sceneVariations).set({ ...validatedUpdateData, updatedAt: new Date() }).where(eq(sceneVariations.id, id)).returning();
    if (result.length === 0) return null;
    const productDetails = await getProductForVariation(result[0].productId);
    return {...result[0], productName: productDetails?.name, productCategory: productDetails?.category as ProductCategory | undefined, productImageUrl: productDetails?.imageUrl,};
  } catch (e) { if (e instanceof ZodError) { throw new Error(`Validation error: ${e.errors.map((err: any) => `${err.path.join('.')}: ${err.message}`).join(", ")}`); } throw e;}
}
export async function deleteSceneVariation(id: number): Promise<boolean> {
  const result = await db.delete(sceneVariations).where(eq(sceneVariations.id, id)).returning();
  return result.length > 0;
}
export async function selectVariation(id: number): Promise<SceneVariation | null> {
  try {
    return await db.transaction(async (tx) => {
      const variationToSelect = await tx.select({ sceneId: sceneVariations.sceneId }).from(sceneVariations).where(eq(sceneVariations.id, id)).limit(1);
      if (!variationToSelect || variationToSelect.length === 0) return null;
      const { sceneId } = variationToSelect[0];
      await tx.update(sceneVariations).set({ isSelected: false, updatedAt: new Date() }).where(and(eq(sceneVariations.sceneId, sceneId), not(eq(sceneVariations.id, id))));
      const result = await tx.update(sceneVariations).set({ isSelected: true, updatedAt: new Date() }).where(eq(sceneVariations.id, id)).returning();
      if (result.length > 0) {
        const productDetails = await getProductForVariation(result[0].productId); // Use non-transactional db for this read, or pass tx if product needs to be in same tx
        return {...result[0], productName: productDetails?.name, productCategory: productDetails?.category as ProductCategory | undefined, productImageUrl: productDetails?.imageUrl,};
      }
      return null;
    });
  } catch (e) { throw e; }
}

// --- Product Matching ---
export async function getTopMatchingProductsForScene(sceneId: number, suggestedCategories: ProductCategory[], limit: number = 3): Promise<Product[]> {
  try {
    if (!suggestedCategories || suggestedCategories.length === 0) {
      return await db.select().from(products).orderBy(desc(products.createdAt)).limit(limit);
    }
    const validCategories = suggestedCategories.filter(cat => Object.values(ProductCategory).includes(cat));
    if (validCategories.length === 0) {
      return await db.select().from(products).orderBy(desc(products.createdAt)).limit(limit);
    }
    const matchingProducts = await db.select().from(products).where(sql`${products.category} IN ${validCategories}`).orderBy(desc(products.createdAt)).limit(limit);
    if (matchingProducts.length < limit) {
        const needed = limit - matchingProducts.length;
        const existingIds = matchingProducts.map(p => p.id);
        const additionalProductsQuery = db.select().from(products).orderBy(desc(products.createdAt)).limit(needed);
        if (existingIds.length > 0) { additionalProductsQuery.where(sql`${products.id} NOT IN ${existingIds}`); }
        const additionalProducts = await additionalProductsQuery;
        return [...matchingProducts, ...additionalProducts];
    }
    return matchingProducts;
  } catch (e) { return await db.select().from(products).orderBy(desc(products.createdAt)).limit(limit); }
}

// --- Actors ---
export async function getActors(options: { search?: string; gender?: string; nationality?: string; page?: number; pageSize?: number; } = {}): Promise<{ actors: Actor[]; totalCount: number; currentPage: number; totalPages: number; pageSize: number;}> {
  const { search = "", gender = "", nationality = "", page = 1, pageSize = 10 } = options;
  const offset = (page - 1) * pageSize;
  let query = db.select().from(actors).$dynamic();
  if (search) { query = query.where(sql`${actors.name} ILIKE ${'%' + search + '%'}`); }
  if (gender && gender.toLowerCase() !== 'all') { query = query.where(sql`lower(${actors.gender}) = lower(${gender})`); }
  if (nationality && nationality.toLowerCase() !== 'all') { query = query.where(sql`${actors.nationality} ILIKE ${nationality}`); }
  let countQuery = db.select({ count: sql<number>`count(*)` }).from(actors).$dynamic();
  if (search) { countQuery = countQuery.where(sql`${actors.name} ILIKE ${'%' + search + '%'}`); }
  if (gender && gender.toLowerCase() !== 'all') { countQuery = countQuery.where(sql`lower(${actors.gender}) = lower(${gender})`); }
  if (nationality && nationality.toLowerCase() !== 'all') { countQuery = countQuery.where(sql`${actors.nationality} ILIKE ${nationality}`); }
  const countResult = await countQuery;
  const total = Number(countResult[0]?.count || 0);
  const result = await query.orderBy(asc(actors.name)).limit(pageSize).offset(offset);
  return { actors: result, totalCount: total, currentPage: page, totalPages: Math.ceil(total / pageSize), pageSize, };
}
export async function getActorById(id: number): Promise<Actor | null> {
  const result = await db.select().from(actors).where(eq(actors.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}
export async function createActor(data: Omit<Actor, "id" | "createdAt" | "updatedAt">): Promise<Actor> {
  try {
    const validatedData = insertActorSchema.parse({...data});
    const result = await db.insert(actors).values(validatedData).returning();
    return result[0];
  } catch (e) { if (e instanceof ZodError) { throw new Error(`Validation error: ${e.errors.map((err: any) => `${err.path.join('.')}: ${err.message}`).join(", ")}`); } throw e;}
}
export async function updateActor(id: number, data: Partial<Omit<Actor, "id" | "createdAt">>): Promise<Actor | null> {
  try {
     const partialSchema = insertActorSchema.partial().omit({ id: true, createdAt: true, updatedAt: true });
     const validatedUpdateData = partialSchema.parse(data);
    const result = await db.update(actors).set({ ...validatedUpdateData, updatedAt: new Date() }).where(eq(actors.id, id)).returning();
    return result.length > 0 ? result[0] : null;
  } catch (e) { if (e instanceof ZodError) { throw new Error(`Validation error: ${e.errors.map((err: any) => `${err.path.join('.')}: ${err.message}`).join(", ")}`); } throw e;}
}
export async function deleteActor(id: number): Promise<boolean> {
  const result = await db.delete(actors).where(eq(actors.id, id)).returning();
  return result.length > 0;
}
// New function for AI Actor Suggestion
export async function getAllActorsForAISuggestion(): Promise<Actor[]> {
  return await db.select().from(actors).orderBy(asc(actors.name));
}
export async function getActorByName(name: string): Promise<Actor | null> {
  const result = await db.select().from(actors).where(eq(actors.name, name)).limit(1);
  return result.length > 0 ? result[0] : null;
}


// --- Locations ---
export async function getLocations(options: { search?: string; country?: string; page?: number; pageSize?: number; } = {}): Promise<{ locations: Location[]; totalCount: number; currentPage: number; totalPages: number; pageSize: number; }> {
  const { search = "", country = "", page = 1, pageSize = 10 } = options;
  const offset = (page - 1) * pageSize;
  let query = db.select().from(locations).$dynamic();
  if (search) { query = query.where(sql`(${locations.country} ILIKE ${'%' + search + '%'} OR ${locations.region} ILIKE ${'%' + search + '%'} OR ${locations.incentiveProgram} ILIKE ${'%' + search + '%'})`);}
  if (country && country.toLowerCase() !== 'all') { query = query.where(sql`lower(${locations.country}) = lower(${country})`);}
  let countQuery = db.select({ count: sql<number>`count(*)` }).from(locations).$dynamic();
  if (search) { countQuery = countQuery.where(sql`(${locations.country} ILIKE ${'%' + search + '%'} OR ${locations.region} ILIKE ${'%' + search + '%'} OR ${locations.incentiveProgram} ILIKE ${'%' + search + '%'})`);}
  if (country && country.toLowerCase() !== 'all') { countQuery = countQuery.where(sql`lower(${locations.country}) = lower(${country})`);}
  const countResult = await countQuery;
  const total = Number(countResult[0]?.count || 0);
  const result = await query.orderBy(asc(locations.country), asc(locations.region)).limit(pageSize).offset(offset);
  return { locations: result, totalCount: total, currentPage: page, totalPages: Math.ceil(total / pageSize), pageSize, };
}
export async function getLocationById(id: number): Promise<Location | null> {
  const result = await db.select().from(locations).where(eq(locations.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}
export async function createLocation(data: Omit<Location, "id" | "createdAt" | "updatedAt">): Promise<Location> {
  try {
    const validatedData = insertLocationSchema.parse({...data});
    const result = await db.insert(locations).values(validatedData).returning();
    return result[0];
  } catch (e) { if (e instanceof ZodError) { throw new Error(`Validation error: ${e.errors.map((err: any) => `${err.path.join('.')}: ${err.message}`).join(", ")}`); } throw e;}
}
export async function updateLocation(id: number, data: Partial<Omit<Location, "id" | "createdAt">>): Promise<Location | null> {
  try {
    const partialSchema = insertLocationSchema.partial().omit({ id: true, createdAt: true, updatedAt: true });
    const validatedUpdateData = partialSchema.parse(data);
    const result = await db.update(locations).set({ ...validatedUpdateData, updatedAt: new Date() }).where(eq(locations.id, id)).returning();
    return result.length > 0 ? result[0] : null;
  } catch (e) { if (e instanceof ZodError) { throw new Error(`Validation error: ${e.errors.map((err: any) => `${err.path.join('.')}: ${err.message}`).join(", ")}`); } throw e;}
}
export async function deleteLocation(id: number): Promise<boolean> {
  const result = await db.delete(locations).where(eq(locations.id, id)).returning();
  return result.length > 0;
}
// New function for AI Location Suggestion
export async function getAllLocationsForAISuggestion(): Promise<Location[]> {
  return await db.select().from(locations).orderBy(asc(locations.country), asc(locations.region));
}