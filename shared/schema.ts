import { pgTable, text, serial, integer, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Original user table (don't modify)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Product categories
export const ProductCategory = {
  BEVERAGE: "BEVERAGE",
  ELECTRONICS: "ELECTRONICS",
  FOOD: "FOOD",
  AUTOMOTIVE: "AUTOMOTIVE",
  FASHION: "FASHION",
  OTHER: "OTHER",
} as const;

export type ProductCategory = keyof typeof ProductCategory;

// Products table
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  companyName: text("company_name").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull().$type<ProductCategory>(),
  imageUrl: text("image_url").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const productsRelations = relations(products, ({ many }) => ({
  sceneVariations: many(sceneVariations),
}));

export const insertProductSchema = createInsertSchema(products, {
  companyName: (schema) => schema.min(2, "Company name must be at least 2 characters"),
  name: (schema) => schema.min(2, "Product name must be at least 2 characters"),
  category: (schema) => schema.refine(
    (val) => Object.keys(ProductCategory).includes(val),
    "Invalid product category"
  ),
  imageUrl: (schema) => schema.url("Must be a valid URL"),
});

export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

// Scripts table
export const scripts = pgTable("scripts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const scriptsRelations = relations(scripts, ({ many }) => ({
  scenes: many(scenes),
}));

export const insertScriptSchema = createInsertSchema(scripts, {
  title: (schema) => schema.min(1, "Title cannot be empty"),
  content: (schema) => schema.min(1, "Content cannot be empty"),
});

export type InsertScript = z.infer<typeof insertScriptSchema>;
export type Script = typeof scripts.$inferSelect;

// Scenes table
export const scenes = pgTable("scenes", {
  id: serial("id").primaryKey(),
  scriptId: integer("script_id").references(() => scripts.id, { onDelete: "cascade" }).notNull(),
  sceneNumber: integer("scene_number").notNull(),
  heading: text("heading").notNull(),
  content: text("content").notNull(),
  isBrandable: boolean("is_brandable").default(false).notNull(),
  brandableReason: text("brandable_reason"),
  suggestedCategories: jsonb("suggested_categories").$type<ProductCategory[]>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const scenesRelations = relations(scenes, ({ one, many }) => ({
  script: one(scripts, {
    fields: [scenes.scriptId],
    references: [scripts.id],
  }),
  variations: many(sceneVariations),
}));

export const insertSceneSchema = createInsertSchema(scenes);

export type InsertScene = z.infer<typeof insertSceneSchema>;
export type Scene = typeof scenes.$inferSelect;

// Scene Variations table
export const sceneVariations = pgTable("scene_variations", {
  id: serial("id").primaryKey(),
  sceneId: integer("scene_id").references(() => scenes.id, { onDelete: "cascade" }).notNull(),
  productId: integer("product_id").references(() => products.id, { onDelete: "cascade" }).notNull(),
  variationNumber: integer("variation_number").notNull(),
  description: text("description").notNull(),
  imageUrl: text("image_url").notNull(),
  isSelected: boolean("is_selected").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sceneVariationsRelations = relations(sceneVariations, ({ one }) => ({
  scene: one(scenes, {
    fields: [sceneVariations.sceneId],
    references: [scenes.id],
  }),
  product: one(products, {
    fields: [sceneVariations.productId],
    references: [products.id],
  }),
}));

export const insertSceneVariationSchema = createInsertSchema(sceneVariations);

export type InsertSceneVariation = z.infer<typeof insertSceneVariationSchema>;
export type SceneVariation = typeof sceneVariations.$inferSelect & {
  productName?: string;
  productCategory?: string;
  productImageUrl?: string;
};
