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
  SceneVariation,
  Actor,
  Location,
} from "@shared/schema";
import { eq, and, like, desc, sql, count, asc, not } from "drizzle-orm";
import { ZodError } from "zod";

// Products
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

  let query = db.select().from(products);

  // Apply search filter - case insensitive
  if (search) {
    query = query.where(
      sql`(LOWER(${products.name}) LIKE LOWER(${"%" + search + "%"}) OR LOWER(${products.companyName}) LIKE LOWER(${"%" + search + "%"}))`,
    );
  }

  // Apply category filter
  if (category && category !== "ALL") {
    query = query.where(eq(products.category, category as ProductCategory));
  }

  // Get total count for pagination - APPLY FILTERS TO COUNT QUERY
  // Clone the query before applying limit/offset for count, or build count query separately with same where clauses
  let countQuery = db.select({ count: count() }).from(products);
  if (search) {
    countQuery = countQuery.where(
      sql`(LOWER(${products.name}) LIKE LOWER(${"%" + search + "%"}) OR LOWER(${products.companyName}) LIKE LOWER(${"%" + search + "%"}))`,
    );
  }
  if (category && category !== "ALL") {
    countQuery = countQuery.where(
      eq(products.category, category as ProductCategory),
    );
  }

  const countResult = await countQuery;
  const total = Number(countResult[0].count || 0);

  // Get paginated products
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
  const result = await db
    .select()
    .from(products)
    .where(eq(products.id, id))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function createProduct(
  data: Omit<Product, "id" | "createdAt" | "updatedAt">,
): Promise<Product> {
  try {
    const validatedData = insertProductSchema.parse({
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await db.insert(products).values(validatedData).returning();
    return result[0];
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      throw new Error(
        `Validation error: ${error.errors.map((e: any) => e.message).join(", ")}`,
      );
    }
    console.error("Error in createProduct:", error);
    throw error;
  }
}

export async function updateProduct(
  id: number,
  data: Partial<Omit<Product, "id" | "createdAt" | "updatedAt">>,
): Promise<Product | null> {
  try {
    const result = await db
      .update(products)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();

    return result.length > 0 ? result[0] : null;
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      throw new Error(
        `Validation error: ${error.errors.map((e: any) => e.message).join(", ")}`,
      );
    }
    console.error(`Error in updateProduct for ID ${id}:`, error);
    throw error;
  }
}

export async function deleteProduct(id: number): Promise<boolean> {
  const result = await db
    .delete(products)
    .where(eq(products.id, id))
    .returning();
  return result.length > 0;
}

// Scripts
export async function getCurrentScript(): Promise<Script | null> {
  const result = await db
    .select()
    .from(scripts)
    .orderBy(desc(scripts.createdAt))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getScriptById(id: number): Promise<Script | null> {
  const result = await db
    .select()
    .from(scripts)
    .where(eq(scripts.id, id))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function createScript(
  data: Omit<Script, "id" | "createdAt" | "updatedAt">,
): Promise<Script> {
  try {
    const validatedData = insertScriptSchema.parse({
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await db.insert(scripts).values(validatedData).returning();
    return result[0];
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      throw new Error(
        `Validation error: ${error.errors.map((e: any) => e.message).join(", ")}`,
      );
    }
    console.error("Error in createScript:", error);
    throw error;
  }
}

export async function updateScript(
  id: number,
  data: Partial<Omit<Script, "id" | "createdAt" | "updatedAt">>,
): Promise<Script | null> {
  try {
    const result = await db
      .update(scripts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(scripts.id, id))
      .returning();

    return result.length > 0 ? result[0] : null;
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      throw new Error(
        `Validation error: ${error.errors.map((e: any) => e.message).join(", ")}`,
      );
    }
    console.error(`Error in updateScript for ID ${id}:`, error);
    throw error;
  }
}

export async function deleteScript(id: number): Promise<boolean> {
  const result = await db.delete(scripts).where(eq(scripts.id, id)).returning();
  return result.length > 0;
}

// Scenes
export async function getScenesByScriptId(scriptId: number): Promise<Scene[]> {
  return await db
    .select()
    .from(scenes)
    .where(eq(scenes.scriptId, scriptId))
    .orderBy(asc(scenes.sceneNumber));
}

export async function getBrandableScenes(scriptId: number): Promise<Scene[]> {
  return await db
    .select()
    .from(scenes)
    .where(and(eq(scenes.scriptId, scriptId), eq(scenes.isBrandable, true)))
    .orderBy(asc(scenes.sceneNumber));
}

export async function getSceneById(id: number): Promise<Scene | null> {
  const result = await db
    .select()
    .from(scenes)
    .where(eq(scenes.id, id))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function createScene(
  data: Omit<Scene, "id" | "createdAt" | "updatedAt">,
): Promise<Scene> {
  try {
    const validatedData = insertSceneSchema.parse({
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await db.insert(scenes).values(validatedData).returning();
    return result[0];
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      throw new Error(
        `Validation error: ${error.errors.map((e: any) => e.message).join(", ")}`,
      );
    }
    console.error("Error in createScene:", error);
    throw error;
  }
}

export async function updateScene(
  id: number,
  data: Partial<Omit<Scene, "id" | "createdAt" | "updatedAt">>,
): Promise<Scene | null> {
  try {
    const result = await db
      .update(scenes)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(scenes.id, id))
      .returning();

    return result.length > 0 ? result[0] : null;
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      throw new Error(
        `Validation error: ${error.errors.map((e: any) => e.message).join(", ")}`,
      );
    }
    console.error(`Error in updateScene for ID ${id}:`, error);
    throw error;
  }
}

export async function deleteScene(id: number): Promise<boolean> {
  const result = await db.delete(scenes).where(eq(scenes.id, id)).returning();
  return result.length > 0;
}

// Scene Variations
export async function getSceneVariations(
  sceneId: number,
): Promise<SceneVariation[]> {
  const result = await db
    .select({
      ...sceneVariations,
      productName: products.name,
      productCategory: products.category,
      productImageUrl: products.imageUrl,
    })
    .from(sceneVariations)
    .leftJoin(products, eq(sceneVariations.productId, products.id))
    .where(eq(sceneVariations.sceneId, sceneId))
    .orderBy(asc(sceneVariations.variationNumber));

  return result;
}

export async function getSceneVariationById(
  id: number,
): Promise<SceneVariation | null> {
  const result = await db
    .select({
      ...sceneVariations,
      productName: products.name,
      productCategory: products.category,
      productImageUrl: products.imageUrl,
    })
    .from(sceneVariations)
    .leftJoin(products, eq(sceneVariations.productId, products.id))
    .where(eq(sceneVariations.id, id))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

export async function createSceneVariation(
  data: Omit<SceneVariation, "id" | "createdAt" | "updatedAt">,
): Promise<SceneVariation> {
  try {
    const validatedData = insertSceneVariationSchema.parse({
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await db
      .insert(sceneVariations)
      .values(validatedData)
      .returning();
    return result[0];
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      throw new Error(
        `Validation error: ${error.errors.map((e: any) => e.message).join(", ")}`,
      );
    }
    console.error("Error in createSceneVariation:", error);
    throw error;
  }
}

export async function updateSceneVariation(
  id: number,
  data: Partial<Omit<SceneVariation, "id" | "createdAt" | "updatedAt">>,
): Promise<SceneVariation | null> {
  try {
    const result = await db
      .update(sceneVariations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(sceneVariations.id, id))
      .returning();

    return result.length > 0 ? result[0] : null;
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      throw new Error(
        `Validation error: ${error.errors.map((e: any) => e.message).join(", ")}`,
      );
    }
    console.error(`Error in updateSceneVariation for ID ${id}:`, error);
    throw error;
  }
}

export async function deleteSceneVariation(id: number): Promise<boolean> {
  const result = await db
    .delete(sceneVariations)
    .where(eq(sceneVariations.id, id))
    .returning();
  return result.length > 0;
}

/**
 * Gets top matching products for a scene based on the suggested categories.
 * This helps optimize product selection for generating scene variations.
 */
export async function getTopMatchingProductsForScene(
  sceneId: number, 
  suggestedCategories: ProductCategory[], 
  limit: number = 3
): Promise<Product[]> {
  try {
    if (!suggestedCategories || suggestedCategories.length === 0) {
      // If no categories suggested, get most recent products
      return await db
        .select()
        .from(products)
        .orderBy(desc(products.createdAt))
        .limit(limit);
    }

    // Filter products by the suggested categories
    const matchingProducts = await db
      .select()
      .from(products)
      .where(
        sql`${products.category} IN (${suggestedCategories.join(',')})`
      )
      .orderBy(desc(products.createdAt)) // Order by newest first
      .limit(limit);

    // If we don't have enough matching products, add more to reach the limit
    if (matchingProducts.length < limit) {
      const additionalProducts = await db
        .select()
        .from(products)
        .where(
          sql`${products.category} NOT IN (${suggestedCategories.join(',')})`
        )
        .orderBy(desc(products.createdAt))
        .limit(limit - matchingProducts.length);

      return [...matchingProducts, ...additionalProducts];
    }

    return matchingProducts;
  } catch (error) {
    console.error(`Error getting top matching products for scene ${sceneId}:`, error);
    return [];
  }
}

export async function selectVariation(
  id: number,
): Promise<SceneVariation | null> {
  try {
    return await db.transaction(async (tx: typeof db) => {
      // 1. Get the scene ID of the variation being selected
      const variationToSelect = await tx
        .select({ sceneId: sceneVariations.sceneId })
        .from(sceneVariations)
        .where(eq(sceneVariations.id, id))
        .limit(1);

      if (!variationToSelect || variationToSelect.length === 0) {
        console.error(`Variation with ID ${id} not found.`);
        // Optionally, throw an error or return null depending on desired behavior
        // For consistency with other functions, returning null if not found.
        return null;
      }
      const { sceneId } = variationToSelect[0];

      // 2. Set isSelected = false for all other variations in the same scene
      await tx
        .update(sceneVariations)
        .set({ isSelected: false, updatedAt: new Date() })
        .where(
          and(
            eq(sceneVariations.sceneId, sceneId),
            not(eq(sceneVariations.id, id)),
          ),
        );

      // 3. Set isSelected = true for the target variation
      const result = await tx
        .update(sceneVariations)
        .set({ isSelected: true, updatedAt: new Date() })
        .where(eq(sceneVariations.id, id))
        .returning();

      return result.length > 0 ? result[0] : null;
    });
  } catch (error: unknown) {
    console.error(`Error in selectVariation for ID ${id}:`, error);
    // Rethrow or handle as appropriate for your application's error strategy
    throw error;
  }
}

// Actors
export async function getActors(
  options: {
    search?: string;
    gender?: string;
    nationality?: string;
    page?: number;
    pageSize?: number;
  } = {},
): Promise<{
  actors: Actor[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
  pageSize: number;
}> {
  const { search = "", gender = "", nationality = "", page = 1, pageSize = 10 } = options;
  const offset = (page - 1) * pageSize;

  let query = db.select().from(actors);

  // Apply search filter - case insensitive for name
  if (search) {
    query = query.where(
      sql`(LOWER(${actors.name}) LIKE LOWER(${"%" + search + "%"}))`,
    );
  }

  // Apply gender filter
  if (gender) {
    query = query.where(
      sql`(LOWER(${actors.gender}) = LOWER(${gender}))`,
    );
  }

  // Apply nationality filter
  if (nationality) {
    query = query.where(
      sql`(LOWER(${actors.nationality}) LIKE LOWER(${"%" + nationality + "%"}))`,
    );
  }

  // Get total count for pagination - Apply the same filters to count query
  let countQuery = db.select({ count: count() }).from(actors);
  if (search) {
    countQuery = countQuery.where(
      sql`(LOWER(${actors.name}) LIKE LOWER(${"%" + search + "%"}))`,
    );
  }
  if (gender) {
    countQuery = countQuery.where(
      sql`(LOWER(${actors.gender}) = LOWER(${gender}))`,
    );
  }
  if (nationality) {
    countQuery = countQuery.where(
      sql`(LOWER(${actors.nationality}) LIKE LOWER(${"%" + nationality + "%"}))`,
    );
  }

  const countResult = await countQuery;
  const total = Number(countResult[0].count || 0);

  // Get paginated actors
  const result = await query
    .orderBy(asc(actors.name))
    .limit(pageSize)
    .offset(offset);

  return {
    actors: result,
    totalCount: total,
    currentPage: page,
    totalPages: Math.ceil(total / pageSize),
    pageSize,
  };
}

export async function getActorById(id: number): Promise<Actor | null> {
  const result = await db
    .select()
    .from(actors)
    .where(eq(actors.id, id))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function createActor(
  data: Omit<Actor, "id" | "createdAt" | "updatedAt">,
): Promise<Actor> {
  try {
    const validatedData = insertActorSchema.parse({
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await db.insert(actors).values(validatedData).returning();
    return result[0];
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      throw new Error(
        `Validation error: ${error.errors.map((e: any) => e.message).join(", ")}`,
      );
    }
    console.error("Error in createActor:", error);
    throw error;
  }
}

export async function updateActor(
  id: number,
  data: Partial<Omit<Actor, "id" | "createdAt" | "updatedAt">>,
): Promise<Actor | null> {
  try {
    const result = await db
      .update(actors)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(actors.id, id))
      .returning();

    return result.length > 0 ? result[0] : null;
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      throw new Error(
        `Validation error: ${error.errors.map((e: any) => e.message).join(", ")}`,
      );
    }
    console.error(`Error in updateActor for ID ${id}:`, error);
    throw error;
  }
}

export async function deleteActor(id: number): Promise<boolean> {
  const result = await db
    .delete(actors)
    .where(eq(actors.id, id))
    .returning();
  return result.length > 0;
}

// Location-related storage functions
export async function getLocations(
  options: {
    search?: string;
    country?: string;
    page?: number;
    pageSize?: number;
  } = {},
): Promise<{
  locations: Location[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
  pageSize: number;
}> {
  const { search = "", country = "", page = 1, pageSize = 10 } = options;
  const offset = (page - 1) * pageSize;

  let query = db.select().from(locations);

  // Apply search filter - case insensitive for name
  if (search) {
    query = query.where(
      sql`(LOWER(${locations.country}) LIKE LOWER(${"%" + search + "%"}) OR 
           LOWER(${locations.region}) LIKE LOWER(${"%" + search + "%"}) OR
           LOWER(${locations.incentiveProgram}) LIKE LOWER(${"%" + search + "%"}))`,
    );
  }

  // Apply country filter
  if (country) {
    query = query.where(
      sql`(LOWER(${locations.country}) = LOWER(${country}))`,
    );
  }

  // Get total count for pagination - Apply the same filters to count query
  let countQuery = db.select({ count: count() }).from(locations);
  if (search) {
    countQuery = countQuery.where(
      sql`(LOWER(${locations.country}) LIKE LOWER(${"%" + search + "%"}) OR 
           LOWER(${locations.region}) LIKE LOWER(${"%" + search + "%"}) OR
           LOWER(${locations.incentiveProgram}) LIKE LOWER(${"%" + search + "%"}))`,
    );
  }
  if (country) {
    countQuery = countQuery.where(
      sql`(LOWER(${locations.country}) = LOWER(${country}))`,
    );
  }

  const countResult = await countQuery;
  const total = Number(countResult[0].count || 0);

  // Get paginated locations
  const result = await query
    .orderBy(asc(locations.country), asc(locations.region))
    .limit(pageSize)
    .offset(offset);

  return {
    locations: result,
    totalCount: total,
    currentPage: page,
    totalPages: Math.ceil(total / pageSize),
    pageSize,
  };
}

export async function getLocationById(id: number): Promise<Location | null> {
  const result = await db
    .select()
    .from(locations)
    .where(eq(locations.id, id))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function createLocation(
  data: Omit<Location, "id" | "createdAt" | "updatedAt">,
): Promise<Location> {
  try {
    const validatedData = insertLocationSchema.parse({
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await db.insert(locations).values(validatedData).returning();
    return result[0];
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      throw new Error(
        `Validation error: ${error.errors.map((e: any) => e.message).join(", ")}`,
      );
    }
    console.error("Error in createLocation:", error);
    throw error;
  }
}

export async function updateLocation(
  id: number,
  data: Partial<Omit<Location, "id" | "createdAt" | "updatedAt">>,
): Promise<Location | null> {
  try {
    const result = await db
      .update(locations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(locations.id, id))
      .returning();

    return result.length > 0 ? result[0] : null;
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      throw new Error(
        `Validation error: ${error.errors.map((e: any) => e.message).join(", ")}`,
      );
    }
    console.error(`Error in updateLocation for ID ${id}:`, error);
    throw error;
  }
}

export async function deleteLocation(id: number): Promise<boolean> {
  const result = await db
    .delete(locations)
    .where(eq(locations.id, id))
    .returning();
  return result.length > 0;
}
