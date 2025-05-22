// shared/schema.ts
import {
  pgTable,
  text,
  serial,
  integer, // Keep integer for budget
  timestamp,
  jsonb,
  boolean,
  // numeric, // Alternative for budget if decimals are needed
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// --- Users ---
// ... (User schema remains the same)
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


// --- Products ---
// ... (Product related enums and schema remain the same)
export const ProductCategory = {
  BEVERAGE: "BEVERAGE",
  ELECTRONICS: "ELECTRONICS",
  FOOD: "FOOD",
  AUTOMOTIVE: "AUTOMOTIVE",
  FASHION: "FASHION",
  WATCH: "WATCH",
} as const;

export const FilmRatingEnum = {
  G: "G",
  PG: "PG",
  PG_13: "PG-13",
  R: "R",
  NC_17: "NC-17",
  NR: "NR", // Not Rated
} as const;
export type FilmRatingType = keyof typeof FilmRatingEnum;

export const DemographicGenderEnum = {
  Male: "Male",
  Female: "Female",
  All: "All",
} as const;
export type DemographicGenderType = keyof typeof DemographicGenderEnum;

export const DemographicAgeEnum = {
  "18-24": "18-24",
  "25-34": "25-34",
  "35-44": "35-44",
  "45-54": "45-54",
  "55-64": "55-64",
  "65+": "65+",
  AllAges: "AllAges",
} as const;
export type DemographicAgeType = keyof typeof DemographicAgeEnum;

export const GenreEnum = {
  Action: "Action",
  Comedy: "Comedy",
  Drama: "Drama",
  Horror: "Horror",
  "Sci-Fi": "Sci-Fi",
  Romance: "Romance",
  Adventure: "Adventure",
  Thriller: "Thriller",
  Documentary: "Documentary",
  Animation: "Animation",
  Fantasy: "Fantasy",
  Any: "Any",
} as const;
export type GenreType = keyof typeof GenreEnum;

export const VfxQualityTierEnum = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
} as const;
export type VfxQualityTierType = keyof typeof VfxQualityTierEnum;

export type ProductCategory = keyof typeof ProductCategory;

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  companyName: text("company_name").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull().$type<ProductCategory>(),
  imageUrl: text("image_url").notNull(),
  filmRating: text("film_rating").$type<FilmRatingType | null>(),
  demographicGender: text(
    "demographic_gender",
  ).$type<DemographicGenderType | null>(),
  demographicAge: jsonb("demographic_age")
    .$type<DemographicAgeType[] | null>()
    .default(sql`'{}'::jsonb`),
  genre: text("genre").$type<GenreType | null>(),
  placementLimitations: text("placement_limitations"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const productsRelations = relations(products, ({ many }) => ({
  sceneVariations: many(sceneVariations),
}));

export const insertProductSchema = createInsertSchema(products, {
  companyName: (schema) =>
    schema.min(2, "Company name must be at least 2 characters"),
  name: (schema) => schema.min(2, "Product name must be at least 2 characters"),
  category: (schema) =>
    schema.refine(
      (val): val is ProductCategory =>
        Object.keys(ProductCategory).includes(val),
      "Invalid product category",
    ),
  imageUrl: (schema) => schema.url("Must be a valid URL"),
  filmRating: z.nativeEnum(FilmRatingEnum).optional().nullable(),
  demographicGender: z.nativeEnum(DemographicGenderEnum).optional().nullable(),
  demographicAge: z
    .array(z.nativeEnum(DemographicAgeEnum))
    .optional()
    .nullable(),
  genre: z.nativeEnum(GenreEnum).optional().nullable(),
  placementLimitations: z.string().optional().nullable(),
});

export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;


// --- Scripts ---
export const scripts = pgTable("scripts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  // --- BEGIN MODIFICATION (Task 1.2) ---
  expectedReleaseDate: text("expected_release_date"), // Nullable
  totalBudget: integer("total_budget"), // Nullable, storing as whole dollars
  // --- END MODIFICATION (Task 1.2) ---
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const scriptsRelations = relations(scripts, ({ many }) => ({
  scenes: many(scenes),
}));

export const insertScriptSchema = createInsertSchema(scripts, {
  title: (schema) => schema.min(1, "Title cannot be empty"),
  content: (schema) => schema.min(1, "Content cannot be empty"),
  // --- BEGIN MODIFICATION (Task 1.2) ---
  expectedReleaseDate: z.string().optional().nullable(), // Validate as string (YYYY-MM-DD) or allow null
  totalBudget: z.number().int().positive().optional().nullable(), // Validate as positive integer or allow null
  // --- END MODIFICATION (Task 1.2) ---
});

export type InsertScript = z.infer<typeof insertScriptSchema>;
export type Script = typeof scripts.$inferSelect;


// --- Scenes ---
// ... (Scene schema remains the same)
export const scenes = pgTable("scenes", {
  id: serial("id").primaryKey(),
  scriptId: integer("script_id")
    .references(() => scripts.id, { onDelete: "cascade" })
    .notNull(),
  sceneNumber: integer("scene_number").notNull(),
  heading: text("heading").notNull(),
  content: text("content").notNull(),
  isBrandable: boolean("is_brandable").default(false).notNull(),
  brandableReason: text("brandable_reason"),
  suggestedCategories: jsonb("suggested_categories").$type<ProductCategory[]>(),
  isVfxScene: boolean("is_vfx_scene").default(false).notNull(),
  vfxDescription: text("vfx_description"),
  vfxKeywords: jsonb("vfx_keywords").$type<string[]>(),
  selectedVfxTier: text("selected_vfx_tier").$type<VfxQualityTierType | null>(),
  selectedVfxCost: integer("selected_vfx_cost").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const scenesRelations = relations(scenes, ({ one, many }) => ({
  script: one(scripts, {
    fields: [scenes.scriptId],
    references: [scripts.id],
  }),
  variations: many(sceneVariations),
  vfxDetails: many(vfxSceneDetails),
}));

export const insertSceneSchema = createInsertSchema(scenes);

export type InsertScene = z.infer<typeof insertSceneSchema>;
export type Scene = typeof scenes.$inferSelect;


// --- Scene Variations ---
// ... (SceneVariation schema remains the same)
export const sceneVariations = pgTable("scene_variations", {
  id: serial("id").primaryKey(),
  sceneId: integer("scene_id")
    .references(() => scenes.id, { onDelete: "cascade" })
    .notNull(),
  productId: integer("product_id")
    .references(() => products.id, { onDelete: "cascade" })
    .notNull(),
  variationNumber: integer("variation_number").notNull(),
  description: text("description").notNull(),
  imageUrl: text("image_url").notNull(),
  geminiPrompt: text("gemini_prompt").notNull(),
  isSelected: boolean("is_selected").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const sceneVariationsRelations = relations(
  sceneVariations,
  ({ one }) => ({
    scene: one(scenes, {
      fields: [sceneVariations.sceneId],
      references: [scenes.id],
    }),
    product: one(products, {
      fields: [sceneVariations.productId],
      references: [products.id],
    }),
  }),
);

export const insertSceneVariationSchema = createInsertSchema(sceneVariations, {
  geminiPrompt: (schema) => schema.min(10, "Gemini prompt seems too short."),
});

export type InsertSceneVariation = z.infer<typeof insertSceneVariationSchema>;
export type SceneVariation = typeof sceneVariations.$inferSelect & {
  productName?: string;
  productCategory?: ProductCategory;
  productImageUrl?: string | null;
};


// --- VFX Scene Details ---
export const vfxSceneDetails = pgTable("vfx_scene_details", {
  id: serial("id").primaryKey(),
  sceneId: integer("scene_id")
    .references(() => scenes.id, { onDelete: "cascade" })
    .notNull(),
  qualityTier: text("quality_tier").$type<VfxQualityTierType>().notNull(),
  conceptualImageUrl: text("conceptual_image_url"),
  conceptualVideoUrl: text("conceptual_video_url"),
  estimatedVfxCost: integer("estimated_vfx_cost"),
  costEstimationNotes: text("cost_estimation_notes"),
  vfxElementsSummaryForTier: text("vfx_elements_summary_for_tier"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  // Unique composite index on scene_id and quality_tier
  uniqueSceneQualityTier: sql`UNIQUE (${table.sceneId}, ${table.qualityTier})`,
}));

export const vfxSceneDetailsRelations = relations(vfxSceneDetails, ({ one }) => ({
  scene: one(scenes, {
    fields: [vfxSceneDetails.sceneId],
    references: [scenes.id],
  }),
}));

export const insertVfxSceneDetailSchema = createInsertSchema(vfxSceneDetails);

export type InsertVfxSceneDetail = z.infer<typeof insertVfxSceneDetailSchema>;
export type VfxSceneDetail = typeof vfxSceneDetails.$inferSelect;


// --- Actors ---
// ... (Actor schema remains the same)
export const actors = pgTable("actors", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  gender: text("gender").notNull(),
  nationality: text("nationality").notNull(),
  notableRoles: jsonb("notable_roles").$type<string[]>().notNull(),
  genres: jsonb("genres").$type<string[]>().notNull(),
  recentPopularity: text("recent_popularity").notNull(),
  typicalRoles: jsonb("typical_roles").$type<string[]>().notNull(),
  estSalaryRange: text("est_salary_range").notNull(),
  socialMediaFollowing: text("social_media_following").notNull(),
  availability: text("availability").notNull(),
  bestSuitedRolesStrategic: text("best_suited_roles_strategic").notNull(),
  imageUrl: text("image_url"),
  dateOfBirth: text("date_of_birth"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertActorSchema = createInsertSchema(actors, {
  name: (schema) => schema.min(2, "Actor name must be at least 2 characters"),
  gender: (schema) => schema.min(1, "Gender cannot be empty"),
  nationality: (schema) =>
    schema.min(2, "Nationality must be at least 2 characters"),
  dateOfBirth: (schema) => schema.optional(),
});

export type InsertActor = z.infer<typeof insertActorSchema>;
export type Actor = typeof actors.$inferSelect;


// --- Locations ---
// ... (Location schema remains the same)
export const locations = pgTable("locations", {
  id: serial("id").primaryKey(),
  country: text("country").notNull(),
  region: text("region").notNull(),
  incentiveProgram: text("incentive_program").notNull(),
  incentiveDetails: text("incentive_details").notNull(),
  minimumSpend: text("minimum_spend").notNull(),
  eligibleProductionTypes: text("eligible_production_types").notNull(),
  limitsCaps: text("limits_caps"),
  qualifyingExpenses: text("qualifying_expenses"),
  applicationProcess: text("application_process"),
  applicationDeadlines: text("application_deadlines"),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertLocationSchema = createInsertSchema(locations, {
  country: (schema) =>
    schema.min(2, "Country name must be at least 2 characters"),
  region: (schema) => schema.min(2, "Region must be at least 2 characters"),
  incentiveProgram: (schema) =>
    schema.min(2, "Incentive program must be at least 2 characters"),
  incentiveDetails: (schema) =>
    schema.min(2, "Incentive details must be at least 2 characters"),
});

export type InsertLocation = z.infer<typeof insertLocationSchema>;
export type Location = typeof locations.$inferSelect;


// --- Script Generation Form ---
// ... (ScriptGenerationForm schema remains the same)
export const scriptGenerationFormSchema = z.object({
  projectTitle: z.string().min(1, "Project Title is required."),
  logline: z
    .string()
    .min(10, "Logline should be at least 10 characters.")
    .max(200, "Logline should be at most 200 characters."),
  description: z
    .string()
    .min(20, "Description should be at least 20 characters.")
    .max(1000, "Description should be at most 1000 characters."),
  genre: z
    .string()
    .min(1, "Genre is required.")
    .max(50, "Genre should be at most 50 characters."),
  concept: z
    .string()
    .min(20, "Concept should be at least 20 characters.")
    .max(2000, "Concept should be at most 2000 characters."),
  targetedRating: z.enum(
    Object.keys(FilmRatingEnum) as [FilmRatingType, ...FilmRatingType[]],
    { message: "Invalid rating selected." },
  ),
  storyLocation: z
    .string()
    .min(1, "Story Location is required.")
    .max(100, "Story Location should be at most 100 characters."),
  specialRequest: z
    .string()
    .max(1000, "Special Request should be at most 1000 characters.")
    .optional(),
});
export type ScriptGenerationFormData = z.infer<
  typeof scriptGenerationFormSchema
>;