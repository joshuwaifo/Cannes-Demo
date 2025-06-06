// server/storage.ts
import { db } from "@db";
import {
  products,
  scripts, // Ensure scripts is imported
  scenes,
  sceneVariations,
  actors,
  locations,
  vfxSceneDetails,
  insertProductSchema,
  insertScriptSchema, // Ensure insertScriptSchema is imported
  insertSceneSchema,
  insertSceneVariationSchema,
  insertActorSchema,
  insertLocationSchema,
  insertVfxSceneDetailSchema,
  Product,
  ProductCategory,
  Script, // Ensure Script type is imported
  Scene,
  SceneVariation, 
  Actor,
  Location,
  VfxSceneDetail,
  VfxQualityTierType,
} from "@shared/schema";
import {
  eq,
  and,
  like,
  desc,
  sql,
  count,
  asc,
  not,
  or,
  gte,
  lte,
  placeholder,
  ilike,
} from "drizzle-orm";
import { ZodError } from "zod";

// --- Utility: Get Product for Scene Variation ---
// ... (getProductForVariation remains the same)
async function getProductForVariation(
  productId: number,
): Promise<Product | null> {
  const result = await db
    .select()
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}


// --- Products ---
// ... (Product functions remain the same)
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
  const conditions = [];
  if (search) {
    conditions.push(
      or(
        ilike(products.name, `%${search}%`),
        ilike(products.companyName, `%${search}%`),
      ),
    );
  }
  if (category && category !== "ALL") {
    conditions.push(eq(products.category, category as ProductCategory));
  }
  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  let countQuery = db
    .select({ count: sql<number>`count(*)` })
    .from(products)
    .$dynamic();
  if (conditions.length > 0) {
    countQuery = countQuery.where(and(...conditions));
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
    const validatedData = insertProductSchema.parse({ ...data });
    const result = await db.insert(products).values(validatedData).returning();
    return result[0];
  } catch (e) {
    if (e instanceof ZodError) {
      throw new Error(
        `Validation error: ${e.errors.map((err: any) => `${err.path.join(".")}: ${err.message}`).join(", ")}`,
      );
    }
    throw e;
  }
}
export async function updateProduct(
  id: number,
  data: Partial<Omit<Product, "id" | "createdAt">>,
): Promise<Product | null> {
  try {
    const partialSchema = insertProductSchema
      .partial()
      .omit({ id: true, createdAt: true, updatedAt: true });
    const validatedUpdateData = partialSchema.parse(data);
    const result = await db
      .update(products)
      .set({ ...validatedUpdateData, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
    return result.length > 0 ? result[0] : null;
  } catch (e) {
    if (e instanceof ZodError) {
      throw new Error(
        `Validation error: ${e.errors.map((err: any) => `${err.path.join(".")}: ${err.message}`).join(", ")}`,
      );
    }
    throw e;
  }
}
export async function deleteProduct(id: number): Promise<boolean> {
  const result = await db
    .delete(products)
    .where(eq(products.id, id))
    .returning();
  return result.length > 0;
}


// --- Scripts ---
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

// --- BEGIN MODIFICATION (Task 1.2) ---
export async function createScript(
  data: Omit<Script, "id" | "createdAt" | "updatedAt"> & {
    expectedReleaseDate?: string | null;
    totalBudget?: number | null;
  },
): Promise<Script> {
  try {
    // The insertScriptSchema from shared/schema.ts already includes these new fields as optional
    // So, we can directly parse the data object.
    const validatedData = insertScriptSchema.parse({
      title: data.title,
      content: data.content,
      expectedReleaseDate: data.expectedReleaseDate, // Will be undefined or null if not provided
      totalBudget: data.totalBudget, // Will be undefined or null if not provided
    });

    const result = await db.insert(scripts).values(validatedData).returning();
    return result[0];
  } catch (e) {
    if (e instanceof ZodError) {
      console.error("Zod validation error in createScript:", e.errors);
      throw new Error(
        `Validation error creating script: ${e.errors.map((err) => `${err.path.join(".")}: ${err.message}`).join(", ")}`,
      );
    }
    console.error("Error in createScript:", e);
    throw e;
  }
}
// --- END MODIFICATION (Task 1.2) ---

export async function updateScript(
  id: number,
  data: Partial<Omit<Script, "id" | "createdAt">>,
): Promise<Script | null> {
  try {
    // Ensure the partial schema also considers the new optional fields if they can be updated
    const partialSchema = insertScriptSchema 
      .partial()
      .omit({ id: true, createdAt: true, updatedAt: true });
    const validatedUpdateData = partialSchema.parse(data);

    const result = await db
      .update(scripts)
      .set({ ...validatedUpdateData, updatedAt: new Date() })
      .where(eq(scripts.id, id))
      .returning();
    return result.length > 0 ? result[0] : null;
  } catch (e) {
    if (e instanceof ZodError) {
      throw new Error(
        `Validation error updating script: ${e.errors.map((err) => `${err.path.join(".")}: ${err.message}`).join(", ")}`,
      );
    }
    throw e;
  }
}

export async function deleteScript(id: number): Promise<boolean> {
  const result = await db.delete(scripts).where(eq(scripts.id, id)).returning();
  return result.length > 0;
}

// --- Scenes ---
// ... (Scene functions remain the same)
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
    const validatedData = insertSceneSchema.parse({ ...data });
    const result = await db.insert(scenes).values(validatedData).returning();
    return result[0];
  } catch (e) {
    if (e instanceof ZodError) {
      throw new Error(
        `Validation error: ${e.errors.map((err: any) => `${err.path.join(".")}: ${err.message}`).join(", ")}`,
      );
    }
    throw e;
  }
}
export async function updateScene(
  id: number,
  data: Partial<Omit<Scene, "id" | "createdAt">>,
): Promise<Scene | null> {
  try {
    const partialSchema = insertSceneSchema
      .partial()
      .omit({ id: true, createdAt: true, updatedAt: true });
    const validatedUpdateData = partialSchema.parse(data);
    const result = await db
      .update(scenes)
      .set({ ...validatedUpdateData, updatedAt: new Date() })
      .where(eq(scenes.id, id))
      .returning();
    return result.length > 0 ? result[0] : null;
  } catch (e) {
    if (e instanceof ZodError) {
      throw new Error(
        `Validation error: ${e.errors.map((err: any) => `${err.path.join(".")}: ${err.message}`).join(", ")}`,
      );
    }
    throw e;
  }
}
export async function deleteScene(id: number): Promise<boolean> {
  const result = await db.delete(scenes).where(eq(scenes.id, id)).returning();
  return result.length > 0;
}


// --- Scene Variations ---
// ... (SceneVariation functions remain the same)
export async function getSceneVariations(
  sceneId: number,
): Promise<SceneVariation[]> {
  const result = await db
    .select({
      id: sceneVariations.id,
      sceneId: sceneVariations.sceneId,
      productId: sceneVariations.productId,
      variationNumber: sceneVariations.variationNumber,
      description: sceneVariations.description,
      imageUrl: sceneVariations.imageUrl,
      geminiPrompt: sceneVariations.geminiPrompt,
      isSelected: sceneVariations.isSelected,
      createdAt: sceneVariations.createdAt,
      updatedAt: sceneVariations.updatedAt,
      productName: products.name,
      productCategory: products.category,
      productImageUrl: products.imageUrl,
    })
    .from(sceneVariations)
    .leftJoin(products, eq(sceneVariations.productId, products.id))
    .where(eq(sceneVariations.sceneId, sceneId))
    .orderBy(asc(sceneVariations.variationNumber));
  return result.map((v) => ({
    ...v,
    productCategory: v.productCategory as ProductCategory | undefined,
  }));
}
export async function getSceneVariationById(
  id: number,
): Promise<SceneVariation | null> {
  const result = await db
    .select({
      id: sceneVariations.id,
      sceneId: sceneVariations.sceneId,
      productId: sceneVariations.productId,
      variationNumber: sceneVariations.variationNumber,
      description: sceneVariations.description,
      imageUrl: sceneVariations.imageUrl,
      geminiPrompt: sceneVariations.geminiPrompt,
      isSelected: sceneVariations.isSelected,
      createdAt: sceneVariations.createdAt,
      updatedAt: sceneVariations.updatedAt,
      productName: products.name,
      productCategory: products.category,
      productImageUrl: products.imageUrl,
    })
    .from(sceneVariations)
    .leftJoin(products, eq(sceneVariations.productId, products.id))
    .where(eq(sceneVariations.id, id))
    .limit(1);
  if (result.length === 0) return null;
  const variation = result[0];
  return {
    ...variation,
    productCategory: variation.productCategory as ProductCategory | undefined,
  };
}
export async function createSceneVariation(
  data: Omit<SceneVariation, "id" | "createdAt" | "updatedAt">,
): Promise<SceneVariation> {
  try {
    const validatedData = insertSceneVariationSchema.parse({ ...data });
    if (!validatedData.geminiPrompt) {
      throw new Error("Gemini prompt is missing.");
    }
    const result = await db
      .insert(sceneVariations)
      .values(validatedData)
      .returning();
    const productDetails = await getProductForVariation(result[0].productId);
    return {
      ...result[0],
      productName: productDetails?.name,
      productCategory: productDetails?.category as ProductCategory | undefined,
      productImageUrl: productDetails?.imageUrl,
    };
  } catch (e) {
    if (e instanceof ZodError) {
      throw new Error(
        `Validation error: ${e.errors.map((err: any) => `${err.path.join(".")}: ${err.message}`).join(", ")}`,
      );
    }
    throw e;
  }
}
export async function updateSceneVariation(
  id: number,
  data: Partial<Omit<SceneVariation, "id" | "createdAt">>,
): Promise<SceneVariation | null> {
  try {
    const partialSchema = insertSceneVariationSchema
      .partial()
      .omit({ id: true, createdAt: true, updatedAt: true });
    const validatedUpdateData = partialSchema.parse(data);
    const result = await db
      .update(sceneVariations)
      .set({ ...validatedUpdateData, updatedAt: new Date() })
      .where(eq(sceneVariations.id, id))
      .returning();
    if (result.length === 0) return null;
    const productDetails = await getProductForVariation(result[0].productId);
    return {
      ...result[0],
      productName: productDetails?.name,
      productCategory: productDetails?.category as ProductCategory | undefined,
      productImageUrl: productDetails?.imageUrl,
    };
  } catch (e) {
    if (e instanceof ZodError) {
      throw new Error(
        `Validation error: ${e.errors.map((err: any) => `${err.path.join(".")}: ${err.message}`).join(", ")}`,
      );
    }
    throw e;
  }
}
export async function deleteSceneVariation(id: number): Promise<boolean> {
  const result = await db
    .delete(sceneVariations)
    .where(eq(sceneVariations.id, id))
    .returning();
  return result.length > 0;
}
export async function selectVariation(
  id: number,
): Promise<SceneVariation | null> {
  try {
    return await db.transaction(async (tx) => {
      const variationToSelect = await tx
        .select({ sceneId: sceneVariations.sceneId })
        .from(sceneVariations)
        .where(eq(sceneVariations.id, id))
        .limit(1);
      if (!variationToSelect || variationToSelect.length === 0) return null;
      const { sceneId } = variationToSelect[0];
      await tx
        .update(sceneVariations)
        .set({ isSelected: false, updatedAt: new Date() })
        .where(
          and(
            eq(sceneVariations.sceneId, sceneId),
            not(eq(sceneVariations.id, id)),
          ),
        );
      const result = await tx
        .update(sceneVariations)
        .set({ isSelected: true, updatedAt: new Date() })
        .where(eq(sceneVariations.id, id))
        .returning();
      if (result.length > 0) {
        const productDetails = await getProductForVariation(
          result[0].productId,
        );
        return {
          ...result[0],
          productName: productDetails?.name,
          productCategory: productDetails?.category as
            | ProductCategory
            | undefined,
          productImageUrl: productDetails?.imageUrl,
        };
      }
      return null;
    });
  } catch (e) {
    throw e;
  }
}


// --- Product Matching ---
// ... (getTopMatchingProductsForScene remains the same)
export async function getTopMatchingProductsForScene(
  sceneId: number,
  suggestedCategories: ProductCategory[],
  limit: number = 3,
): Promise<Product[]> {
  try {
    if (!suggestedCategories || suggestedCategories.length === 0) {
      return await db
        .select()
        .from(products)
        .orderBy(desc(products.createdAt))
        .limit(limit);
    }
    const validCategories = suggestedCategories.filter((cat) =>
      Object.values(ProductCategory).includes(cat),
    );
    if (validCategories.length === 0) {
      return await db
        .select()
        .from(products)
        .orderBy(desc(products.createdAt))
        .limit(limit);
    }
    const matchingProducts = await db
      .select()
      .from(products)
      .where(sql`${products.category} IN ${validCategories}`)
      .orderBy(desc(products.createdAt))
      .limit(limit);
    if (matchingProducts.length < limit) {
      const needed = limit - matchingProducts.length;
      const existingIds = matchingProducts.map((p) => p.id);
      const additionalProductsQuery = db
        .select()
        .from(products)
        .orderBy(desc(products.createdAt))
        .limit(needed);
      if (existingIds.length > 0) {
        additionalProductsQuery.where(
          sql`${products.id} NOT IN ${existingIds}`,
        );
      }
      const additionalProducts = await additionalProductsQuery;
      return [...matchingProducts, ...additionalProducts];
    }
    return matchingProducts;
  } catch (e) {
    return await db
      .select()
      .from(products)
      .orderBy(desc(products.createdAt))
      .limit(limit);
  }
}


// --- Actors ---
// ... (Actor functions remain the same, except getActorsForAISuggestionByCriteria if modified for age)
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
  const {
    search = "",
    gender = "",
    nationality = "",
    page = 1,
    pageSize = 10,
  } = options;
  const offset = (page - 1) * pageSize;

  const conditions = [];
  if (search) {
    conditions.push(ilike(actors.name, `%${search}%`));
  }
  if (gender && gender.toLowerCase() !== "all") {
    conditions.push(sql`lower(${actors.gender}) = ${gender.toLowerCase()}`);
  }
  if (nationality && nationality.toLowerCase() !== "all") {
    conditions.push(ilike(actors.nationality, nationality));
  }

  let query = db.select().from(actors).$dynamic();
  let countQuery = db
    .select({ count: sql<number>`count(*)` })
    .from(actors)
    .$dynamic();

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
    countQuery = countQuery.where(and(...conditions));
  }

  const countResult = await countQuery;
  const total = Number(countResult[0]?.count || 0);
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
    const validatedData = insertActorSchema.parse({ ...data });
    const result = await db.insert(actors).values(validatedData).returning();
    return result[0];
  } catch (e) {
    if (e instanceof ZodError) {
      throw new Error(
        `Validation error: ${e.errors.map((err: any) => `${err.path.join(".")}: ${err.message}`).join(", ")}`,
      );
    }
    throw e;
  }
}
export async function updateActor(
  id: number,
  data: Partial<Omit<Actor, "id" | "createdAt">>,
): Promise<Actor | null> {
  try {
    const partialSchema = insertActorSchema
      .partial()
      .omit({ id: true, createdAt: true, updatedAt: true });
    const validatedUpdateData = partialSchema.parse(data);
    const result = await db
      .update(actors)
      .set({ ...validatedUpdateData, updatedAt: new Date() })
      .where(eq(actors.id, id))
      .returning();
    return result.length > 0 ? result[0] : null;
  } catch (e) {
    if (e instanceof ZodError) {
      throw new Error(
        `Validation error: ${e.errors.map((err: any) => `${err.path.join(".")}: ${err.message}`).join(", ")}`,
      );
    }
    throw e;
  }
}
export async function deleteActor(id: number): Promise<boolean> {
  const result = await db.delete(actors).where(eq(actors.id, id)).returning();
  return result.length > 0;
}

export async function getActorByName(name: string): Promise<Actor | null> {
  const result = await db
    .select()
    .from(actors)
    .where(eq(actors.name, name))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getActorsForAISuggestionByCriteria(criteria: {
  minBirthYear?: number;
  maxBirthYear?: number;
  gender?: string;
  limit?: number;
  estimatedAgeRange?: string;
}): Promise<Actor[]> {
  const { gender, limit = 60, estimatedAgeRange } = criteria;
  let { minBirthYear, maxBirthYear } = criteria;

  const conditions = [];
  const currentYear = new Date().getFullYear();

  if (!minBirthYear && !maxBirthYear && estimatedAgeRange) {
    const ageParts = estimatedAgeRange.match(/\d+/g);
    if (ageParts && ageParts.length === 1) {
      const age = parseInt(ageParts[0]);
      if (!isNaN(age)) {
        minBirthYear = currentYear - age - 2;
        maxBirthYear = currentYear - age + 2;
      }
    } else if (ageParts && ageParts.length >= 2) {
      const minAge = parseInt(ageParts[0]);
      const maxAge = parseInt(ageParts[ageParts.length - 1]);
      if (!isNaN(minAge) && !isNaN(maxAge)) {
        minBirthYear = currentYear - maxAge - 1;
        maxBirthYear = currentYear - minAge + 1;
      }
    } else if (estimatedAgeRange.toLowerCase().includes("teen")) {
      minBirthYear = currentYear - 19;
      maxBirthYear = currentYear - 13;
    } else if (estimatedAgeRange.toLowerCase().includes("child")) {
      minBirthYear = currentYear - 12;
      maxBirthYear = currentYear - 7;
    }
  }

  if (minBirthYear) {
    conditions.push(
      sql`CAST(SUBSTRING(${actors.dateOfBirth}, 1, 4) AS INTEGER) >= ${minBirthYear}`,
    );
  }
  if (maxBirthYear) {
    conditions.push(
      sql`CAST(SUBSTRING(${actors.dateOfBirth}, 1, 4) AS INTEGER) <= ${maxBirthYear}`,
    );
  }
  if (minBirthYear || maxBirthYear) {
    conditions.push(
      sql`${actors.dateOfBirth} IS NOT NULL AND ${actors.dateOfBirth} != ''`,
    );
  }

  if (
    gender &&
    gender.toLowerCase() !== "any" &&
    gender.toLowerCase() !== "all" &&
    gender.toLowerCase() !== "unknown"
  ) {
    conditions.push(sql`lower(${actors.gender}) = ${gender.toLowerCase()}`);
  }

  let query = db.select().from(actors).$dynamic();
  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  const results = await query.orderBy(asc(actors.name)).limit(limit);
  return results;
}


// --- Locations ---
// ... (Location functions remain the same)
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

  const conditions = [];
  if (search) {
    conditions.push(
      or(
        ilike(locations.country, `%${search}%`),
        ilike(locations.region, `%${search}%`),
        ilike(locations.incentiveProgram, `%${search}%`),
      ),
    );
  }
  if (country && country.toLowerCase() !== "all") {
    conditions.push(
      sql`lower(${locations.country}) = ${country.toLowerCase()}`,
    );
  }

  let query = db.select().from(locations).$dynamic();
  let countQuery = db
    .select({ count: sql<number>`count(*)` })
    .from(locations)
    .$dynamic();

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
    countQuery = countQuery.where(and(...conditions));
  }

  const countResult = await countQuery;
  const total = Number(countResult[0]?.count || 0);
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
    const validatedData = insertLocationSchema.parse({ ...data });
    const result = await db.insert(locations).values(validatedData).returning();
    return result[0];
  } catch (e) {
    if (e instanceof ZodError) {
      throw new Error(
        `Validation error: ${e.errors.map((err: any) => `${err.path.join(".")}: ${err.message}`).join(", ")}`,
      );
    }
    throw e;
  }
}
export async function updateLocation(
  id: number,
  data: Partial<Omit<Location, "id" | "createdAt">>,
): Promise<Location | null> {
  try {
    const partialSchema = insertLocationSchema
      .partial()
      .omit({ id: true, createdAt: true, updatedAt: true });
    const validatedUpdateData = partialSchema.parse(data);
    const result = await db
      .update(locations)
      .set({ ...validatedUpdateData, updatedAt: new Date() })
      .where(eq(locations.id, id))
      .returning();
    return result.length > 0 ? result[0] : null;
  } catch (e) {
    if (e instanceof ZodError) {
      throw new Error(
        `Validation error: ${e.errors.map((err: any) => `${err.path.join(".")}: ${err.message}`).join(", ")}`,
      );
    }
    throw e;
  }
}
export async function deleteLocation(id: number): Promise<boolean> {
  const result = await db
    .delete(locations)
    .where(eq(locations.id, id))
    .returning();
  return result.length > 0;
}
export async function getAllLocationsForAISuggestion(): Promise<Location[]> {
  return await db
    .select()
    .from(locations)
    .orderBy(asc(locations.country), asc(locations.region));
}

// --- VFX Scene Details Functions ---
export async function createOrUpdateVfxSceneDetail(
  sceneId: number,
  qualityTier: VfxQualityTierType,
  data: {
    vfxElementsSummaryForTier: string;
    estimatedVfxCost: number;
    costEstimationNotes: string;
    conceptualImageUrl?: string | null;
    conceptualVideoUrl?: string | null;
  }
): Promise<VfxSceneDetail> {
  try {
    // Check if a record already exists for this scene and tier
    const existing = await db
      .select()
      .from(vfxSceneDetails)
      .where(
        and(
          eq(vfxSceneDetails.sceneId, sceneId),
          eq(vfxSceneDetails.qualityTier, qualityTier)
        )
      )
      .limit(1);

    const vfxData = {
      sceneId,
      qualityTier,
      vfxElementsSummaryForTier: data.vfxElementsSummaryForTier,
      estimatedVfxCost: data.estimatedVfxCost,
      costEstimationNotes: data.costEstimationNotes,
      conceptualImageUrl: data.conceptualImageUrl || null,
      conceptualVideoUrl: data.conceptualVideoUrl || null,
    };

    if (existing.length > 0) {
      // Update existing record
      const [updated] = await db
        .update(vfxSceneDetails)
        .set({
          vfxElementsSummaryForTier: vfxData.vfxElementsSummaryForTier,
          estimatedVfxCost: vfxData.estimatedVfxCost,
          costEstimationNotes: vfxData.costEstimationNotes,
          conceptualImageUrl: vfxData.conceptualImageUrl,
          conceptualVideoUrl: vfxData.conceptualVideoUrl,
        })
        .where(eq(vfxSceneDetails.id, existing[0].id))
        .returning();
      return updated;
    } else {
      // Create new record
      const validated = insertVfxSceneDetailSchema.parse(vfxData);
      const [created] = await db
        .insert(vfxSceneDetails)
        .values(validated)
        .returning();
      return created;
    }
  } catch (e) {
    if (e instanceof ZodError) {
      throw new Error(
        `VFX scene detail validation failed: ${e.errors
          .map((err) => `${err.path.join(".")}: ${err.message}`)
          .join(", ")}`
      );
    }
    throw e;
  }
}

export async function getVfxSceneDetailsBySceneId(sceneId: number): Promise<VfxSceneDetail[]> {
  return await db
    .select()
    .from(vfxSceneDetails)
    .where(eq(vfxSceneDetails.sceneId, sceneId))
    .orderBy(asc(vfxSceneDetails.qualityTier));
}