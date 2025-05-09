// // client/src/lib/types.ts
// import { z } from "zod";
// import {
//   Product as DbProduct, // Use alias to avoid conflict with local Product type if any
//   ProductCategory as DbProductCategory, // Alias
//   Script as DbScript, // Alias
//   Scene as DbScene, // Alias
//   SceneVariation as DbSceneVariation,
//   Actor as DbActor, // Main actor type from DB schema
//   Location as DbLocation, // Alias
// } from "@shared/schema"; // Import actual schema types

// // --- Re-export or Define Local Types Based on Shared Schema ---
// // It's often good practice to redefine types for the client if they need to be extended
// // or if you want to decouple client types slightly from direct DB schema types.
// // For now, we'll largely re-export or use them directly.

// export type Product = DbProduct;
// export type ProductCategory = DbProductCategory;
// export type Script = DbScript;
// export type Scene = DbScene;
// export type Location = DbLocation;
// export type Actor = DbActor; // Client-side Actor uses the DB schema directly

// // SceneVariation on client-side might include extra fields not in DB (like joined product details)
// export type SceneVariation = DbSceneVariation & {
//   productName?: string;
//   productCategory?: ProductCategory;
//   productImageUrl?: string | null;
//   // Client-side state for video generation
//   videoStatus?: 'idle' | 'pending' | 'generating' | 'succeeded' | 'failed';
//   videoUrl?: string | null;
//   videoError?: string | null;
//   predictionId?: string | null;
//   // Added for progress
//   progress?: number;
//   stageMessage?: string;
// };

// // --- Component Prop Types ---
// export type TabType = "welcome" | "script" | "products" | "actors" | "locations";

// export type FileUploadProps = {
//   onFileUpload: (file: File) => Promise<void>;
//   isLoading: boolean;
// };

// export type HeaderProps = {
//   activeTab: TabType;
//   onTabChange: (tab: TabType) => void;
// };

// export type ScriptDisplayProps = {
//     script: { id: number; title: string; content: string } | null;
//     isLoading: boolean;
//     onSave: () => Promise<void>;
//     onReanalyze: () => Promise<void>;
//     onGeneratePlacements?: () => Promise<void>;
//     onExport?: () => Promise<void>;
//     activeScene: Scene | null;
//     isSaving?: boolean;
//     isReanalyzing?: boolean;
//     isGenerating?: boolean;
//     isExporting?: boolean;
// };

// export type BrandableScenesProps = {
//   activeSceneDetails: Scene | null | undefined;
//   scenes: Scene[];
//   productVariations: SceneVariation[];
//   isLoading: boolean;
//   selectedSceneId: number | null;
//   onGenerateVideoRequest: (variationId: number) => void;
//   videoGenerationStates: {
//       [variationId: number]: {
//           status: 'idle' | 'pending' | 'generating' | 'succeeded' | 'failed';
//           videoUrl?: string | null;
//           error?: string | null;
//           progress?: number;
//           stageMessage?: string;
//       };
//   };
//   onViewVideo: (videoUrl: string, title: string) => void;
// };

// export type SceneBreakdownProps = {
//   scenes: Scene[];
//   activeSceneId: number | null;
//   brandableSceneIds: number[];
//   isLoading: boolean;
//   onSceneSelect: (sceneId: number) => void;
// };

// export type ProductCardProps = {
//   product: Product;
//   onEdit: (product: Product) => void;
//   onDelete: (product: Product) => void;
// };

// export type ProductFormData = {
//   companyName: string;
//   name: string;
//   category: ProductCategory;
//   imageUrl: string;
// };

// export const productFormSchema = z.object({
//   companyName: z.string().min(2, "Company name must be at least 2 characters"),
//   name: z.string().min(2, "Product name must be at least 2 characters"),
//   category: z.enum(Object.keys(DbProductCategory) as [ProductCategory, ...ProductCategory[]]), // Use keys from DbProductCategory
//   imageUrl: z.string().url("Please enter a valid URL"),
// });


// export type AddProductModalProps = {
//   isOpen: boolean;
//   onClose: () => void;
//   onAdd: (product: ProductFormData) => Promise<void>;
//   isSubmitting: boolean;
// };

// export type EditProductModalProps = {
//   isOpen: boolean;
//   product: Product | null;
//   onClose: () => void;
//   onEdit: (id: number, product: ProductFormData) => Promise<void>;
//   isSubmitting: boolean;
// };

// export type DeleteProductDialogProps = {
//   isOpen: boolean;
//   product: Product | null;
//   onClose: () => void;
//   onDelete: (id: number) => Promise<void>;
//   isDeleting: boolean;
// };


// export type ActorFormData = { // Form data uses string for array-like fields
//   name: string;
//   gender: string;
//   nationality: string;
//   notableRoles: string; // Comma-separated string
//   genres: string;       // Comma-separated string
//   recentPopularity: string;
//   typicalRoles: string; // Comma-separated string
//   estSalaryRange: string;
//   socialMediaFollowing: string;
//   availability: string;
//   bestSuitedRolesStrategic: string;
//   imageUrl: string;
// };

// export const actorFormSchema = z.object({
//   name: z.string().min(2, "Name must be at least 2 characters"),
//   gender: z.string().min(1, "Gender is required"),
//   nationality: z.string().min(2, "Nationality must be at least 2 characters"),
//   notableRoles: z.string(), // Allow empty, will be split
//   genres: z.string(),       // Allow empty, will be split
//   recentPopularity: z.string().min(1, "Popularity status is required"),
//   typicalRoles: z.string(), // Allow empty, will be split
//   estSalaryRange: z.string().min(1, "Salary range is required"),
//   socialMediaFollowing: z.string().min(1, "Social media information is required"),
//   availability: z.string().min(1, "Availability is required"),
//   bestSuitedRolesStrategic: z.string().min(1, "Best suited roles is required"),
//   imageUrl: z.string().url("Please enter a valid URL").or(z.string().length(0).optional()),
// });

// export type EditActorModalProps = {
//   isOpen: boolean;
//   actor: Actor | null; // Uses DbActor
//   onClose: () => void;
//   onEdit: (id: number, actor: ActorFormData) => Promise<void>;
//   isSubmitting: boolean;
// };


// export type LocationFormData = {
//   country: string;
//   region: string;
//   incentiveProgram: string;
//   incentiveDetails: string;
//   minimumSpend: string;
//   eligibleProductionTypes: string;
//   limitsCaps: string;
//   qualifyingExpenses: string;
//   applicationProcess: string;
//   applicationDeadlines: string;
//   imageUrl: string;
// };

// export const locationFormSchema = z.object({
//   country: z.string().min(2, "Country must be at least 2 characters"),
//   region: z.string().min(2, "Region must be at least 2 characters"),
//   incentiveProgram: z.string().min(2, "Incentive program must be at least 2 characters"),
//   incentiveDetails: z.string().min(2, "Incentive details must be at least 2 characters"),
//   minimumSpend: z.string().min(1, "Minimum spend is required"),
//   eligibleProductionTypes: z.string().min(1, "Eligible production types is required"),
//   limitsCaps: z.string().optional(),
//   qualifyingExpenses: z.string().optional(),
//   applicationProcess: z.string().optional(),
//   applicationDeadlines: z.string().optional(),
//   imageUrl: z.string().url("Please enter a valid URL").or(z.string().length(0).optional()),
// });


// export type AddLocationModalProps = {
//   isOpen: boolean;
//   onClose: () => void;
//   onAdd: (location: LocationFormData) => Promise<void>;
//   isSubmitting: boolean;
// };

// export type EditLocationModalProps = {
//   isOpen: boolean;
//   location: Location | null; // Uses DbLocation
//   onClose: () => void;
//   onEdit: (id: number, location: LocationFormData) => Promise<void>;
//   isSubmitting: boolean;
// };

// export type DeleteLocationDialogProps = {
//   isOpen: boolean;
//   location: Location | null; // Uses DbLocation
//   onClose: () => void;
//   onDelete: (id: number) => Promise<void>;
//   isDeleting: boolean;
// };


// export type AIAnalysisResponse = {
//   brandableScenes: {
//     sceneId: number;
//     reason: string;
//     suggestedProducts: ProductCategory[];
//   }[];
// };

// export type ImageGenerationRequest = {
//   sceneId: number;
//   productId: number;
//   scriptContent: string;
//   prompt: string;
// };

// export type ImageGenerationResponse = {
//   imageUrl: string;
//   variationId: number;
// };

// export type VideoPlayerModalProps = {
//     isOpen: boolean;
//     onClose: () => void;
//     videoUrl: string | null;
//     title: string;
// };

// export interface SuggestedLocation extends Location { // Extends DbLocation
//   estimatedIncentiveValue?: string;
//   matchReason?: string;
// }

// export interface SuggestedLocationsProps {
//   activeScene: Scene | null; // Uses DbScene
//   projectBudget?: number;
//   isLoading: boolean;
// }

// export interface ScriptCharacter {
//   name: string;
// }

// // This is the type the frontend components will expect for actor suggestions
// export interface ActorSuggestion extends Actor { // Extends DbActor
//   matchReason?: string;
//   controversyFlag?: boolean; // This will likely be undefined if not sourced from Gemini/DB
// }

// export interface CharacterCastingProps {
//   scriptId: number | null;
//   isLoading: boolean;
//   filmGenre?: string;
//   projectBudgetTier?: 'low' | 'medium' | 'high' | 'any';
// }

// export interface ActorSuggestionCardProps {
//   actor: ActorSuggestion; // Uses the client-specific extended type
// }

// export type ScriptEditorProps = {}; // Placeholder, can be expanded if ScriptEditor page needs direct props

// client/src/lib/types.ts
import { z } from "zod";
import {
  Product as DbProduct,
  ProductCategory as DbProductCategoryEnumMap,
  Script as DbScript,
  Scene as DbScene,
  SceneVariation as DbSceneVariation,
  Actor as DbActor,
  Location as DbLocation, // Client directly uses the DbLocation type for its base
} from "@shared/schema";

export type Product = DbProduct;
export type ProductCategory = keyof typeof DbProductCategoryEnumMap;
export type Script = DbScript;
export type Scene = DbScene;
export type Actor = DbActor;
export type Location = DbLocation; // Client's base Location type is the DB schema

export type SceneVariation = DbSceneVariation & {
  productName?: string;
  productCategory?: ProductCategory;
  productImageUrl?: string | null;
  videoStatus?: 'idle' | 'pending' | 'generating' | 'succeeded' | 'failed';
  videoUrl?: string | null;
  videoError?: string | null;
  predictionId?: string | null;
  progress?: number;
  stageMessage?: string;
};

export type TabType = "welcome" | "script" | "products" | "actors" | "locations";
export type FileUploadProps = { onFileUpload: (file: File) => Promise<void>; isLoading: boolean; };
export type HeaderProps = { activeTab: TabType; onTabChange: (tab: TabType) => void; };
export type ScriptDisplayProps = { script: { id: number; title: string; content: string } | null; isLoading: boolean; onSave: () => Promise<void>; onReanalyze: () => Promise<void>; onGeneratePlacements?: () => Promise<void>; onExport?: () => Promise<void>; activeScene: Scene | null; isSaving?: boolean; isReanalyzing?: boolean; isGenerating?: boolean; isExporting?: boolean; };
export type BrandableScenesProps = { activeSceneDetails: Scene | null | undefined; scenes: Scene[]; productVariations: SceneVariation[]; isLoading: boolean; selectedSceneId: number | null; onGenerateVideoRequest: (variationId: number) => void; videoGenerationStates: { [key: number]: { status: 'idle' | 'pending' | 'generating' | 'succeeded' | 'failed'; videoUrl?: string | null; error?: string | null; progress?: number; stageMessage?: string; }; }; onViewVideo: (videoUrl: string, title: string) => void; };
export type SceneBreakdownProps = { scenes: Scene[]; activeSceneId: number | null; brandableSceneIds: number[]; isLoading: boolean; onSceneSelect: (sceneId: number) => void; };
export type ProductCardProps = { product: Product; onEdit: (product: Product) => void; onDelete: (product: Product) => void; };
export type ProductFormData = { companyName: string; name: string; category: ProductCategory; imageUrl: string; };
export const productFormSchema = z.object({ companyName: z.string().min(2), name: z.string().min(2), category: z.enum(Object.keys(DbProductCategoryEnumMap) as [ProductCategory, ...ProductCategory[]]), imageUrl: z.string().url(), });
export type AddProductModalProps = { isOpen: boolean; onClose: () => void; onAdd: (product: ProductFormData) => Promise<void>; isSubmitting: boolean; };
export type EditProductModalProps = { isOpen: boolean; product: Product | null; onClose: () => void; onEdit: (id: number, product: ProductFormData) => Promise<void>; isSubmitting: boolean; };
export type DeleteProductDialogProps = { isOpen: boolean; product: Product | null; onClose: () => void; onDelete: (id: number) => Promise<void>; isDeleting: boolean; };
export type ActorFormData = { name: string; gender: string; nationality: string; notableRoles: string; genres: string; recentPopularity: string; typicalRoles: string; estSalaryRange: string; socialMediaFollowing: string; availability: string; bestSuitedRolesStrategic: string; imageUrl: string; };
export const actorFormSchema = z.object({ name: z.string().min(2), gender: z.string().min(1), nationality: z.string().min(2), notableRoles: z.string(), genres: z.string(), recentPopularity: z.string().min(1), typicalRoles: z.string(), estSalaryRange: z.string().min(1), socialMediaFollowing: z.string().min(1), availability: z.string().min(1), bestSuitedRolesStrategic: z.string().min(1), imageUrl: z.string().url().or(z.string().length(0).optional()), });
export type EditActorModalProps = { isOpen: boolean; actor: Actor | null; onClose: () => void; onEdit: (id: number, actor: ActorFormData) => Promise<void>; isSubmitting: boolean; };
export type LocationFormData = { country: string; region: string; incentiveProgram: string; incentiveDetails: string; minimumSpend: string; eligibleProductionTypes: string; limitsCaps: string; qualifyingExpenses: string; applicationProcess: string; applicationDeadlines: string; imageUrl: string; };
export const locationFormSchema = z.object({ country: z.string().min(2), region: z.string().min(2), incentiveProgram: z.string().min(2), incentiveDetails: z.string().min(2), minimumSpend: z.string().min(1), eligibleProductionTypes: z.string().min(1), limitsCaps: z.string().optional(), qualifyingExpenses: z.string().optional(), applicationProcess: z.string().optional(), applicationDeadlines: z.string().optional(), imageUrl: z.string().url().or(z.string().length(0).optional()), });
export type AddLocationModalProps = { isOpen: boolean; onClose: () => void; onAdd: (location: LocationFormData) => Promise<void>; isSubmitting: boolean; };
export type EditLocationModalProps = { isOpen: boolean; location: Location | null; onClose: () => void; onEdit: (id: number, location: LocationFormData) => Promise<void>; isSubmitting: boolean; };
export type DeleteLocationDialogProps = { isOpen: boolean; location: Location | null; onClose: () => void; onDelete: (id: number) => Promise<void>; isDeleting: boolean; };
export type AIAnalysisResponse = { brandableScenes: { sceneId: number; reason: string; suggestedProducts: ProductCategory[]; }[]; };
export type VideoPlayerModalProps = { isOpen: boolean; onClose: () => void; videoUrl: string | null; title: string; };

// --- MODIFIED: SuggestedLocation now uses string for incentive notes ---
export interface SuggestedLocation extends Location { // Extends DbLocation directly
  estimatedIncentiveValue?: string; // This will hold Gemini's textual notes
  matchReason?: string;
  confidenceScore?: number; // Optional, if Gemini starts providing it
}

export interface SuggestedLocationsProps {
  activeScene: Scene | null;
  projectBudget?: number;
  isLoading: boolean;
}

export interface ScriptCharacter { name: string; }
export interface ActorSuggestion extends Actor { matchReason?: string; controversyFlag?: boolean; } // Extends DbActor
export interface CharacterCastingProps { scriptId: number | null; isLoading: boolean; filmGenre?: string; projectBudgetTier?: 'low' | 'medium' | 'high' | 'any'; }
export interface ActorSuggestionCardProps { actor: ActorSuggestion; }
export type ScriptEditorProps = {};