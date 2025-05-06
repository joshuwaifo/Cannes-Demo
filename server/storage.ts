import { db } from "@db";
import { 
  products, 
  scripts, 
  scenes, 
  sceneVariations, 
  insertProductSchema,
  insertScriptSchema,
  insertSceneSchema,
  insertSceneVariationSchema,
  Product,
  ProductCategory,
  Script,
  Scene,
  SceneVariation
} from "@shared/schema";
import { eq, and, like, desc, sql, count, asc } from "drizzle-orm";
import { ZodError } from "zod";

// Products
export async function getProducts(
  options: {
    search?: string;
    category?: string;
    page?: number;
    pageSize?: number;
  } = {}
) {
  const { search = "", category = "ALL", page = 1, pageSize = 12 } = options;
  const offset = (page - 1) * pageSize;

  let query = db.select().from(products);
  
  // Apply search filter - case insensitive
  if (search) {
    query = query.where(
      sql`(LOWER(${products.name}) LIKE LOWER(${'%' + search + '%'}) OR LOWER(${products.companyName}) LIKE LOWER(${'%' + search + '%'}))`
    );
  }
  
  // Apply category filter
  if (category && category !== "ALL") {
    query = query.where(eq(products.category, category as ProductCategory));
  }
  
  // Get total count for pagination
  const countResult = await db.select({ count: count() }).from(products);
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
    pageSize
  };
}

export async function getProductById(id: number): Promise<Product | null> {
  const result = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function createProduct(data: Omit<Product, "id" | "createdAt" | "updatedAt">): Promise<Product> {
  try {
    const validatedData = insertProductSchema.parse({
      ...data,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    const result = await db.insert(products).values(validatedData).returning();
    return result[0];
  } catch (error) {
    if (error instanceof ZodError) {
      throw new Error(`Validation error: ${error.errors.map(e => e.message).join(", ")}`);
    }
    throw error;
  }
}

export async function updateProduct(id: number, data: Partial<Omit<Product, "id" | "createdAt" | "updatedAt">>): Promise<Product | null> {
  try {
    const result = await db
      .update(products)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
    
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    if (error instanceof ZodError) {
      throw new Error(`Validation error: ${error.errors.map(e => e.message).join(", ")}`);
    }
    throw error;
  }
}

export async function deleteProduct(id: number): Promise<boolean> {
  const result = await db.delete(products).where(eq(products.id, id)).returning();
  return result.length > 0;
}

// Scripts
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
    const validatedData = insertScriptSchema.parse({
      ...data,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    const result = await db.insert(scripts).values(validatedData).returning();
    return result[0];
  } catch (error) {
    if (error instanceof ZodError) {
      throw new Error(`Validation error: ${error.errors.map(e => e.message).join(", ")}`);
    }
    throw error;
  }
}

export async function updateScript(id: number, data: Partial<Omit<Script, "id" | "createdAt" | "updatedAt">>): Promise<Script | null> {
  try {
    const result = await db
      .update(scripts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(scripts.id, id))
      .returning();
    
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    if (error instanceof ZodError) {
      throw new Error(`Validation error: ${error.errors.map(e => e.message).join(", ")}`);
    }
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
    .where(and(
      eq(scenes.scriptId, scriptId),
      eq(scenes.isBrandable, true)
    ))
    .orderBy(asc(scenes.sceneNumber));
}

export async function getSceneById(id: number): Promise<Scene | null> {
  const result = await db.select().from(scenes).where(eq(scenes.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function createScene(data: Omit<Scene, "id" | "createdAt">): Promise<Scene> {
  try {
    const validatedData = insertSceneSchema.parse({
      ...data,
      createdAt: new Date()
    });
    
    const result = await db.insert(scenes).values(validatedData).returning();
    return result[0];
  } catch (error) {
    if (error instanceof ZodError) {
      throw new Error(`Validation error: ${error.errors.map(e => e.message).join(", ")}`);
    }
    throw error;
  }
}

export async function updateScene(id: number, data: Partial<Omit<Scene, "id" | "createdAt">>): Promise<Scene | null> {
  try {
    const result = await db
      .update(scenes)
      .set(data)
      .where(eq(scenes.id, id))
      .returning();
    
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    if (error instanceof ZodError) {
      throw new Error(`Validation error: ${error.errors.map(e => e.message).join(", ")}`);
    }
    throw error;
  }
}

export async function deleteScene(id: number): Promise<boolean> {
  const result = await db.delete(scenes).where(eq(scenes.id, id)).returning();
  return result.length > 0;
}

// Scene Variations
export async function getSceneVariations(sceneId: number): Promise<SceneVariation[]> {
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

export async function getSceneVariationById(id: number): Promise<SceneVariation | null> {
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

export async function createSceneVariation(data: Omit<SceneVariation, "id" | "createdAt">): Promise<SceneVariation> {
  try {
    const validatedData = insertSceneVariationSchema.parse({
      ...data,
      createdAt: new Date()
    });
    
    const result = await db.insert(sceneVariations).values(validatedData).returning();
    return result[0];
  } catch (error) {
    if (error instanceof ZodError) {
      throw new Error(`Validation error: ${error.errors.map(e => e.message).join(", ")}`);
    }
    throw error;
  }
}

export async function updateSceneVariation(id: number, data: Partial<Omit<SceneVariation, "id" | "createdAt">>): Promise<SceneVariation | null> {
  try {
    const result = await db
      .update(sceneVariations)
      .set(data)
      .where(eq(sceneVariations.id, id))
      .returning();
    
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    if (error instanceof ZodError) {
      throw new Error(`Validation error: ${error.errors.map(e => e.message).join(", ")}`);
    }
    throw error;
  }
}

export async function deleteSceneVariation(id: number): Promise<boolean> {
  const result = await db.delete(sceneVariations).where(eq(sceneVariations.id, id)).returning();
  return result.length > 0;
}

export async function selectVariation(id: number): Promise<boolean> {
  // First, get the variation to find its scene
  const variation = await getSceneVariationById(id);
  if (!variation) return false;
  
  // Reset all other variations for this scene
  await db
    .update(sceneVariations)
    .set({ isSelected: false })
    .where(eq(sceneVariations.sceneId, variation.sceneId));
  
  // Set this variation as selected
  const result = await db
    .update(sceneVariations)
    .set({ isSelected: true })
    .where(eq(sceneVariations.id, id))
    .returning();
  
  return result.length > 0;
}
