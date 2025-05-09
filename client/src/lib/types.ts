// // client/src/lib/types.ts
// import { z } from "zod";
// import {
//   Product,
//   ProductCategory,
//   Script,
//   Scene,
//   SceneVariation as DbSceneVariation, // Use specific name
//   Actor, // Import Actor type if not already done
//   Location, // Import Location type if not already done
// } from "@shared/schema";

// // Redefine SceneVariation locally if needed to avoid conflicts or add client-side state
// export type SceneVariation = DbSceneVariation & {
//   productName?: string;
//   productCategory?: string;
//   productImageUrl?: string;
//   // Client-side state for video generation
//   videoStatus?: 'idle' | 'pending' | 'generating' | 'succeeded' | 'failed';
//   videoUrl?: string | null;
//   videoError?: string | null;
//   predictionId?: string | null;
// };

// export type TabType = "welcome" | "script" | "products" | "actors" | "locations";

// export type FileUploadProps = {
//   onFileUpload: (file: File) => Promise<void>;
//   isLoading: boolean;
// };

// export type HeaderProps = {
//   activeTab: TabType;
//   onTabChange: (tab: TabType) => void;
// };

// // Extend ScriptDisplayProps for export and loading states
// export type ScriptDisplayProps = {
//     script: { id: number; title: string; content: string } | null;
//     isLoading: boolean; // Overall loading state for script/scenes
//     onSave: () => Promise<void>;
//     onReanalyze: () => Promise<void>;
//     onGeneratePlacements?: () => Promise<void>;
//     onExport?: () => Promise<void>; // Add export handler prop
//     activeScene: Scene | null;
//     isSaving?: boolean; // Add saving state prop
//     isReanalyzing?: boolean; // Add reanalyzing state prop
//     isGenerating?: boolean; // Add generating state prop
//     isExporting?: boolean; // Add exporting state prop
// };

// // Update BrandableScenesProps for video generation request
// export type BrandableScenesProps = {
//   brandableScenes: Scene[];
//   scenes: Scene[]; // Pass all scenes for context
//   productVariations: SceneVariation[]; // Use updated SceneVariation type
//   isLoading: boolean; // General loading state
//   selectedSceneId: number | null;
//   onGenerateVideoRequest: (variationId: number) => void; // Changed from onOptionSelect
//   videoGenerationStates: { // Pass down video generation status
//       [variationId: number]: {
//           status: 'idle' | 'pending' | 'generating' | 'succeeded' | 'failed';
//           videoUrl?: string | null;
//           error?: string | null;
//       };
//   };
//   onViewVideo: (videoUrl: string, title: string) => void; // Handler to open video modal
// };

// export type SceneBreakdownProps = {
//   scenes: Scene[];
//   activeSceneId: number | null;
//   brandableSceneIds: number[];
//   isLoading: boolean;
//   onSceneSelect: (sceneId: number) => void;
// };

// // --- Product types (keep existing) ---
// export type ProductCardProps = {
//   product: Product;
//   onEdit: (product: Product) => void;
//   onDelete: (product: Product) => void;
// };
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
// export type ProductFormData = {
//   companyName: string;
//   name: string;
//   category: ProductCategory;
//   imageUrl: string;
// };
// export const productFormSchema = z.object({
//   companyName: z.string().min(2, "Company name must be at least 2 characters"),
//   name: z.string().min(2, "Product name must be at least 2 characters"),
//   category: z.enum([
//     "BEVERAGE",
//     "ELECTRONICS",
//     "FOOD",
//     "AUTOMOTIVE",
//     "FASHION",
//     "OTHER",
//   ]),
//   imageUrl: z.string().url("Please enter a valid URL"),
// });

// // --- Actor types (keep existing) ---
// export type Actor = {
//   id?: number;
//   name: string;
//   gender: string;
//   nationality: string;
//   notableRoles: string[];
//   genres: string[];
//   recentPopularity: string;
//   typicalRoles: string[];
//   estSalaryRange: string;
//   socialMediaFollowing: string;
//   availability: string;
//   bestSuitedRolesStrategic: string;
//   imageUrl?: string;
//   createdAt?: Date; // Add if needed from schema
//   updatedAt?: Date; // Add if needed from schema
// };
// export type EditActorModalProps = {
//   isOpen: boolean;
//   actor: Actor | null;
//   onClose: () => void;
//   onEdit: (id: number, actor: ActorFormData) => Promise<void>;
//   isSubmitting: boolean;
// };
// export type ActorFormData = {
//   name: string;
//   gender: string;
//   nationality: string;
//   notableRoles: string; // Keep as string for form input
//   genres: string; // Keep as string for form input
//   recentPopularity: string;
//   typicalRoles: string; // Keep as string for form input
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
//   notableRoles: z.string(),
//   genres: z.string(),
//   recentPopularity: z.string().min(1, "Popularity status is required"),
//   typicalRoles: z.string(),
//   estSalaryRange: z.string().min(1, "Salary range is required"),
//   socialMediaFollowing: z.string().min(1, "Social media information is required"),
//   availability: z.string().min(1, "Availability is required"),
//   bestSuitedRolesStrategic: z.string().min(1, "Best suited roles is required"),
//   imageUrl: z.string().url("Please enter a valid URL").or(z.string().length(0).optional()), // Allow empty/optional
// });

// // --- Location types (keep existing) ---
// export type Location = {
//   id?: number;
//   country: string;
//   region: string;
//   incentiveProgram: string;
//   incentiveDetails: string;
//   minimumSpend: string;
//   eligibleProductionTypes: string;
//   limitsCaps?: string | null; // Allow null
//   qualifyingExpenses?: string | null; // Allow null
//   applicationProcess?: string | null; // Allow null
//   applicationDeadlines?: string | null; // Allow null
//   imageUrl?: string | null; // Allow null
//   createdAt?: Date;
//   updatedAt?: Date;
// };
// export type EditLocationModalProps = {
//   isOpen: boolean;
//   location: Location | null;
//   onClose: () => void;
//   onEdit: (id: number, location: LocationFormData) => Promise<void>;
//   isSubmitting: boolean;
// };
// export type AddLocationModalProps = {
//   isOpen: boolean;
//   onClose: () => void;
//   onAdd: (location: LocationFormData) => Promise<void>;
//   isSubmitting: boolean;
// };
// export type DeleteLocationDialogProps = {
//   isOpen: boolean;
//   location: Location | null;
//   onClose: () => void;
//   onDelete: (id: number) => Promise<void>;
//   isDeleting: boolean;
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
//   limitsCaps: z.string().optional(), // Make optional
//   qualifyingExpenses: z.string().optional(), // Make optional
//   applicationProcess: z.string().optional(), // Make optional
//   applicationDeadlines: z.string().optional(), // Make optional
//   imageUrl: z.string().url("Please enter a valid URL").or(z.string().length(0).optional()), // Allow empty/optional
// });

// // --- AI/Generation types (keep existing) ---
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

// // --- NEW Video Player Modal Props ---
// export type VideoPlayerModalProps = {
//     isOpen: boolean;
//     onClose: () => void;
//     videoUrl: string | null;
//     title: string;
// };

// client/src/lib/types.ts
import { z } from "zod";
import {
  Product,
  ProductCategory,
  Script,
  Scene,
  SceneVariation as DbSceneVariation, // Use specific name
  Actor, // Import Actor type if not already done
  Location, // Import Location type if not already done
} from "@shared/schema";

// Redefine SceneVariation locally if needed to avoid conflicts or add client-side state
export type SceneVariation = DbSceneVariation & {
  productName?: string;
  productCategory?: string;
  productImageUrl?: string;
  // Client-side state for video generation
  videoStatus?: "idle" | "pending" | "generating" | "succeeded" | "failed";
  videoUrl?: string | null;
  videoError?: string | null;
  predictionId?: string | null;
};

export type TabType =
  | "welcome"
  | "script"
  | "products"
  | "actors"
  | "locations";

export type FileUploadProps = {
  onFileUpload: (file: File) => Promise<void>;
  isLoading: boolean;
};

export type HeaderProps = {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
};

// Extend ScriptDisplayProps for export and loading states
export type ScriptDisplayProps = {
  script: { id: number; title: string; content: string } | null;
  isLoading: boolean; // Overall loading state for script/scenes
  onSave: () => Promise<void>;
  onReanalyze: () => Promise<void>;
  onGeneratePlacements?: () => Promise<void>;
  onExport?: () => Promise<void>; // Add export handler prop
  activeScene: Scene | null;
  isSaving?: boolean; // Add saving state prop
  isReanalyzing?: boolean; // Add reanalyzing state prop
  isGenerating?: boolean; // Add generating state prop
  isExporting?: boolean; // Add exporting state prop
};

// Update BrandableScenesProps for video generation request
// export type BrandableScenesProps = {
//   brandableScenes: Scene[];
//   scenes: Scene[]; // Pass all scenes for context
//   productVariations: SceneVariation[]; // Use updated SceneVariation type
//   isLoading: boolean; // General loading state
//   selectedSceneId: number | null;
//   onGenerateVideoRequest: (variationId: number) => void; // Changed from onOptionSelect
//   videoGenerationStates: {
//     // Pass down video generation status
//     [variationId: number]: {
//       status: "idle" | "pending" | "generating" | "succeeded" | "failed";
//       videoUrl?: string | null;
//       error?: string | null;
//     };
//   };
//   onViewVideo: (videoUrl: string, title: string) => void; // Handler to open video modal
// };

export type BrandableScenesProps = {
  // brandableScenes: Scene[]; // This might become less important if any scene can have placements
  activeSceneDetails: Scene | null | undefined; // Pass the full details of the currently selected scene
  scenes: Scene[]; // Pass all scenes for context
  productVariations: SceneVariation[]; // Use updated SceneVariation type
  isLoading: boolean; // General loading state for variations of the active scene
  selectedSceneId: number | null;
  onGenerateVideoRequest: (variationId: number) => void;
  videoGenerationStates: {
    [variationId: number]: {
      status: 'idle' | 'pending' | 'generating' | 'succeeded' | 'failed';
      videoUrl?: string | null;
      error?: string | null;
      progress?: number; // For progress bar
      stageMessage?: string; // For progress stage
    };
  };
  onViewVideo: (videoUrl: string, title: string) => void;
};

export type SceneBreakdownProps = {
  scenes: Scene[];
  activeSceneId: number | null;
  brandableSceneIds: number[];
  isLoading: boolean;
  onSceneSelect: (sceneId: number) => void;
};

// --- Product types (keep existing) ---
export type ProductCardProps = {
  product: Product;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
};
export type AddProductModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (product: ProductFormData) => Promise<void>;
  isSubmitting: boolean;
};
export type EditProductModalProps = {
  isOpen: boolean;
  product: Product | null;
  onClose: () => void;
  onEdit: (id: number, product: ProductFormData) => Promise<void>;
  isSubmitting: boolean;
};
export type DeleteProductDialogProps = {
  isOpen: boolean;
  product: Product | null;
  onClose: () => void;
  onDelete: (id: number) => Promise<void>;
  isDeleting: boolean;
};
export type ProductFormData = {
  companyName: string;
  name: string;
  category: ProductCategory;
  imageUrl: string;
};
export const productFormSchema = z.object({
  companyName: z.string().min(2, "Company name must be at least 2 characters"),
  name: z.string().min(2, "Product name must be at least 2 characters"),
  category: z.enum([
    "BEVERAGE",
    "ELECTRONICS",
    "FOOD",
    "AUTOMOTIVE",
    "FASHION",
    "WATCH", // Changed from WATCHES
  ]),
  imageUrl: z.string().url("Please enter a valid URL"),
});

// --- Actor types (keep existing) ---
export type Actor = {
  id?: number;
  name: string;
  gender: string;
  nationality: string;
  notableRoles: string[];
  genres: string[];
  recentPopularity: string;
  typicalRoles: string[];
  estSalaryRange: string;
  socialMediaFollowing: string;
  availability: string;
  bestSuitedRolesStrategic: string;
  imageUrl?: string;
  createdAt?: Date; // Add if needed from schema
  updatedAt?: Date; // Add if needed from schema
};
export type EditActorModalProps = {
  isOpen: boolean;
  actor: Actor | null;
  onClose: () => void;
  onEdit: (id: number, actor: ActorFormData) => Promise<void>;
  isSubmitting: boolean;
};
export type ActorFormData = {
  name: string;
  gender: string;
  nationality: string;
  notableRoles: string; // Keep as string for form input
  genres: string; // Keep as string for form input
  recentPopularity: string;
  typicalRoles: string; // Keep as string for form input
  estSalaryRange: string;
  socialMediaFollowing: string;
  availability: string;
  bestSuitedRolesStrategic: string;
  imageUrl: string;
};
export const actorFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  gender: z.string().min(1, "Gender is required"),
  nationality: z.string().min(2, "Nationality must be at least 2 characters"),
  notableRoles: z.string(),
  genres: z.string(),
  recentPopularity: z.string().min(1, "Popularity status is required"),
  typicalRoles: z.string(),
  estSalaryRange: z.string().min(1, "Salary range is required"),
  socialMediaFollowing: z
    .string()
    .min(1, "Social media information is required"),
  availability: z.string().min(1, "Availability is required"),
  bestSuitedRolesStrategic: z.string().min(1, "Best suited roles is required"),
  imageUrl: z
    .string()
    .url("Please enter a valid URL")
    .or(z.string().length(0).optional()), // Allow empty/optional
});

// --- Location types (keep existing) ---
export type Location = {
  id?: number;
  country: string;
  region: string;
  incentiveProgram: string;
  incentiveDetails: string;
  minimumSpend: string;
  eligibleProductionTypes: string;
  limitsCaps?: string | null; // Allow null
  qualifyingExpenses?: string | null; // Allow null
  applicationProcess?: string | null; // Allow null
  applicationDeadlines?: string | null; // Allow null
  imageUrl?: string | null; // Allow null
  createdAt?: Date;
  updatedAt?: Date;
};
export type EditLocationModalProps = {
  isOpen: boolean;
  location: Location | null;
  onClose: () => void;
  onEdit: (id: number, location: LocationFormData) => Promise<void>;
  isSubmitting: boolean;
};
export type AddLocationModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (location: LocationFormData) => Promise<void>;
  isSubmitting: boolean;
};
export type DeleteLocationDialogProps = {
  isOpen: boolean;
  location: Location | null;
  onClose: () => void;
  onDelete: (id: number) => Promise<void>;
  isDeleting: boolean;
};
export type LocationFormData = {
  country: string;
  region: string;
  incentiveProgram: string;
  incentiveDetails: string;
  minimumSpend: string;
  eligibleProductionTypes: string;
  limitsCaps: string;
  qualifyingExpenses: string;
  applicationProcess: string;
  applicationDeadlines: string;
  imageUrl: string;
};
export const locationFormSchema = z.object({
  country: z.string().min(2, "Country must be at least 2 characters"),
  region: z.string().min(2, "Region must be at least 2 characters"),
  incentiveProgram: z
    .string()
    .min(2, "Incentive program must be at least 2 characters"),
  incentiveDetails: z
    .string()
    .min(2, "Incentive details must be at least 2 characters"),
  minimumSpend: z.string().min(1, "Minimum spend is required"),
  eligibleProductionTypes: z
    .string()
    .min(1, "Eligible production types is required"),
  limitsCaps: z.string().optional(), // Make optional
  qualifyingExpenses: z.string().optional(), // Make optional
  applicationProcess: z.string().optional(), // Make optional
  applicationDeadlines: z.string().optional(), // Make optional
  imageUrl: z
    .string()
    .url("Please enter a valid URL")
    .or(z.string().length(0).optional()), // Allow empty/optional
});

// --- AI/Generation types (keep existing) ---
export type AIAnalysisResponse = {
  brandableScenes: {
    sceneId: number;
    reason: string;
    suggestedProducts: ProductCategory[];
  }[];
};
export type ImageGenerationRequest = {
  sceneId: number;
  productId: number;
  scriptContent: string;
  prompt: string;
};
export type ImageGenerationResponse = {
  imageUrl: string;
  variationId: number;
};

// --- NEW Video Player Modal Props ---
export type VideoPlayerModalProps = {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string | null;
  title: string;
};

// client/src/lib/types.ts
// ... (previous types remain the same) ...

// --- Location Suggestion Types ---
export interface SuggestedLocation {
  id: number;
  country: string;
  region: string;
  incentiveProgram: string;
  incentiveDetails: string;
  estimatedIncentiveValue?: string; // e.g., "$100,000 (25% of $400,000 spend)"
  matchReason?: string; // Why AI suggested this location
  imageUrl?: string | null;
}

export interface SuggestedLocationsProps {
  activeScene: Scene | null;
  projectBudget?: number; // Optional: project budget to estimate incentives
  isLoading: boolean;
}

// --- Character and Actor Suggestion Types ---
export interface ScriptCharacter {
  name: string;
  // Potentially add more details if extracted, like first appearance scene number
}

export interface ActorSuggestion extends Actor { // Extends existing Actor type
  matchReason?: string;
  controversyFlag?: boolean; // Simple flag, real implementation is complex
}

export interface CharacterCastingProps {
  scriptId: number | null;
  isLoading: boolean;
  filmGenre?: string; // To help with actor suggestions
  projectBudgetTier?: 'low' | 'medium' | 'high'; // Simplified budget
}

export interface ActorSuggestionCardProps {
  actor: ActorSuggestion;
  // any other props for interaction
}

// Update ScriptEditorProps if project budget is managed there
export type ScriptEditorProps = { // Assuming this exists or can be created
    // ... any existing props ...
};