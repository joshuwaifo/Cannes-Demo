// client/src/lib/types.ts
import { z } from "zod";
import {
  Product as DbProduct,
  ProductCategory as DbProductCategoryEnumMap,
  Script as DbScriptType, // Renamed from DbScript to avoid conflict
  Scene as DbScene,
  SceneVariation as DbSceneVariation,
  Actor as DbActor,
  Location as DbLocation,
  FilmRatingEnum,
  FilmRatingType,
  DemographicGenderEnum,
  DemographicGenderType,
  DemographicAgeEnum,
  DemographicAgeType,
  GenreEnum,
  GenreType,
  scriptGenerationFormSchema as dbScriptGenerationFormSchema, // Import the Zod schema
} from "@shared/schema";
import { ControversyLevel as ServerControversyLevel } from "../../../server/services/ai-suggestion-service"; // Import from server types

export type Product = DbProduct;
export type ProductCategory = keyof typeof DbProductCategoryEnumMap;
export type Script = DbScriptType;
export type Scene = DbScene;
export type Actor = DbActor;
export type Location = DbLocation;

export type SceneVariation = DbSceneVariation & {
  productName?: string;
  productCategory?: ProductCategory;
  productImageUrl?: string | null;
  videoStatus?: "idle" | "pending" | "generating" | "succeeded" | "failed";
  videoUrl?: string | null;
  videoError?: string | null;
  predictionId?: string | null;
  progress?: number;
  stageMessage?: string;
};

export type TabType =
  | "welcome"
  | "script"
  | "products"
  | "actors"
  | "script-writer" // Added new tab type
  | "locations";
export type FileUploadProps = {
  onFileUpload: (file: File) => Promise<void>;
  isLoading: boolean;
};
export type HeaderProps = {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
};

export type ScriptDisplayProps = {
  script: { id: number; title: string; content: string } | null;
  isLoading: boolean;
  onSave: () => Promise<void>;
  onReanalyze: () => Promise<void>;
  onAnalyzeVfx?: () => Promise<void>;
  onGeneratePlacements?: () => Promise<void>;
  onExport?: () => Promise<void>;
  activeScene: Scene | null;
  isSaving?: boolean;
  isReanalyzing?: boolean;
  isAnalyzingVfx?: boolean;
  isGenerating?: boolean;
  isExporting?: boolean;
};

export type BrandableScenesProps = {
  activeSceneDetails: Scene | null | undefined;
  scenes: Scene[];
  projectTitle?: string; // Added projectTitle
  productVariations: SceneVariation[];
  isLoading: boolean;
  selectedSceneId: number | null;
  onGenerateVideoRequest: (variationId: number) => void;
  videoGenerationStates: {
    [key: number]: {
      status: "idle" | "pending" | "generating" | "succeeded" | "failed";
      videoUrl?: string | null;
      error?: string | null;
      progress?: number;
      stageMessage?: string;
    };
  };
  onViewVideo: (videoUrl: string, title: string) => void;
  onImageZoom: (imageUrl: string, title: string) => void; // Added for image zoom
  selectedProducts?: SceneVariation[];
  onProductSelect?: (product: SceneVariation) => void;
};

export type SceneBreakdownProps = {
  scenes: Scene[];
  activeSceneId: number | null;
  projectTitle?: string; // Added projectTitle
  brandableSceneIds: number[];
  isLoading: boolean;
  onSceneSelect: (sceneId: number) => void;
};

export type ProductCardProps = {
  product: Product;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
};

export const productFormSchema = z.object({
  companyName: z.string().min(2, "Company name must be at least 2 characters"),
  name: z.string().min(2, "Product name must be at least 2 characters"),
  category: z.enum(
    Object.keys(DbProductCategoryEnumMap) as [
      ProductCategory,
      ...ProductCategory[],
    ],
  ),
  filmRating: z.nativeEnum(FilmRatingEnum).optional().nullable(),
  demographicGender: z.nativeEnum(DemographicGenderEnum).optional().nullable(),
  demographicAge: z
    .array(z.nativeEnum(DemographicAgeEnum))
    .default([])
    .optional()
    .nullable(),
  genre: z.nativeEnum(GenreEnum).optional().nullable(),
  imageUrl: z.string().url("Please enter a valid URL"),
  placementLimitations: z.string().optional().nullable(), // Added here
});
export type ProductFormData = z.infer<typeof productFormSchema>;

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
export type ActorFormData = {
  name: string;
  gender: string;
  nationality: string;
  notableRoles: string;
  genres: string;
  recentPopularity: string;
  typicalRoles: string;
  estSalaryRange: string;
  socialMediaFollowing: string;
  availability: string;
  bestSuitedRolesStrategic: string;
  dateOfBirth: string;
  imageUrl: string;
};
export const actorFormSchema = z.object({
  name: z.string().min(2),
  gender: z.string().min(1),
  nationality: z.string().min(2),
  notableRoles: z.string(),
  genres: z.string(),
  recentPopularity: z.string().min(1),
  typicalRoles: z.string(),
  estSalaryRange: z.string().min(1),
  socialMediaFollowing: z.string().min(1),
  availability: z.string().min(1),
  bestSuitedRolesStrategic: z.string().min(1),
  dateOfBirth: z.string().optional(),
  imageUrl: z.string().url().or(z.string().length(0).optional()),
});
export type EditActorModalProps = {
  isOpen: boolean;
  actor: Actor | null;
  onClose: () => void;
  onEdit: (id: number, actor: ActorFormData) => Promise<void>;
  isSubmitting: boolean;
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
  country: z.string().min(2),
  region: z.string().min(2),
  incentiveProgram: z.string().min(2),
  incentiveDetails: z.string().min(2),
  minimumSpend: z.string().min(1),
  eligibleProductionTypes: z.string().min(1),
  limitsCaps: z.string().optional(),
  qualifyingExpenses: z.string().optional(),
  applicationProcess: z.string().optional(),
  applicationDeadlines: z.string().optional(),
  imageUrl: z.string().url().or(z.string().length(0).optional()),
});
export type AddLocationModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (location: LocationFormData) => Promise<void>;
  isSubmitting: boolean;
};
export type EditLocationModalProps = {
  isOpen: boolean;
  location: Location | null;
  onClose: () => void;
  onEdit: (id: number, location: LocationFormData) => Promise<void>;
  isSubmitting: boolean;
};
export type DeleteLocationDialogProps = {
  isOpen: boolean;
  location: Location | null;
  onClose: () => void;
  onDelete: (id: number) => Promise<void>;
  isDeleting: boolean;
};
export type AIAnalysisResponse = {
  brandableScenes: {
    sceneId: number;
    reason: string;
    suggestedProducts: ProductCategory[];
  }[];
};
export type VideoPlayerModalProps = {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string | null;
  title: string;
};

export type ImageZoomModalProps = {
  // Ensure this matches the component's usage
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string | null;
  title: string;
};

export interface ClientSuggestedLocation extends Location {
  // Changed from SuggestedLocation to ClientSuggestedLocation
  estimatedIncentiveValue?: string; // This was previously estimatedIncentiveNotes from server
  matchReason?: string;
  confidenceScore?: number;
}

export interface SuggestedLocationsProps {
  scriptId: number | null; // Changed from activeScene: Scene | null
  projectBudget?: number;
  isLoading: boolean;
  selectedLocations?: ClientSuggestedLocation[];
  onLocationSelect?: (location: ClientSuggestedLocation) => void;
}

export interface ScriptCharacter {
  name: string;
  estimatedAgeRange?: string;
  actorId?: number;
  actorName?: string;
}

export type ControversyLevel = ServerControversyLevel; // Use the type from the server

export interface ActorSuggestion extends Actor {
  matchReason?: string;
  controversyLevel?: ControversyLevel;
}
export interface CharacterCastingProps {
  scriptId: number | null;
  isLoading: boolean;
  filmGenre?: string;
  projectBudgetTier?: "low" | "medium" | "high" | "any";
  selectedCharacters?: ScriptCharacter[];
  onCharacterSelect?: (character: ScriptCharacter) => void;
}
export interface ActorSuggestionCardProps {
  actor: ActorSuggestion;
  onSelect?: (character: ScriptCharacter) => void;
  isSelected?: boolean;
  characterName?: string;
}
export type ScriptEditorProps = {};

// --- BEGIN MODIFICATION (Task 1.4) ---
export interface FinancialLineItem {
  account: string;
  description: string;
  total: number | null;
}

export interface AboveTheLineFinancials { // Renamed to avoid conflict if backend types were directly imported
  storyRights: FinancialLineItem;
  producer: FinancialLineItem;
  director: FinancialLineItem;
  castAndStunts: FinancialLineItem;
  fringes: FinancialLineItem;
  total: number | null;
}

export interface BelowTheLineProductionFinancials {
  productionStaff: FinancialLineItem;
  extrasStandins: FinancialLineItem;
  setDesign: FinancialLineItem;
  setConstruction: FinancialLineItem;
  setOperations: FinancialLineItem;
  specialEffects: FinancialLineItem;
  setDressing: FinancialLineItem;
  props: FinancialLineItem;
  wardrobe: FinancialLineItem;
  ledVirtual: FinancialLineItem;
  makeupHairdressing: FinancialLineItem;
  setLighting: FinancialLineItem;
  camera: FinancialLineItem;
  productionSound: FinancialLineItem;
  transportation: FinancialLineItem;
  locationExpenses: FinancialLineItem;
  pictureVehiclesAnimals: FinancialLineItem;
  productionFilmLab: FinancialLineItem;
  miscProduction: FinancialLineItem;
  healthSafety: FinancialLineItem;
  overtime: FinancialLineItem;
  studioEquipmentFacilities: FinancialLineItem;
  tests: FinancialLineItem;
  btlTravelLiving: FinancialLineItem;
  serviceCompany: FinancialLineItem;
  fringes: FinancialLineItem;
  total: number | null;
}

export interface PostProductionFinancials {
  filmEditing: FinancialLineItem;
  music: FinancialLineItem;
  sound: FinancialLineItem;
  filmLabPost: FinancialLineItem;
  titles: FinancialLineItem;
  vfx: FinancialLineItem;
  fringes: FinancialLineItem;
  total: number | null;
}

export interface OtherBelowTheLineFinancials {
  publicity: FinancialLineItem;
  insurance: FinancialLineItem;
  miscExpenses: FinancialLineItem;
  legalAccounting: FinancialLineItem;
  fringes: FinancialLineItem;
  total: number | null;
}

export interface FinancialBreakdown {
  projectName: string | null;
  expectedReleaseDate: string | null;
  location: string | null;
  prepWeeks: number | null;
  shootDays: string | null;
  unions: string | null;

  aboveTheLine: AboveTheLineFinancials;
  belowTheLineProduction: BelowTheLineProductionFinancials;
  postProduction: PostProductionFinancials;
  otherBelowTheLine: OtherBelowTheLineFinancials;

  bondFee: FinancialLineItem;
  contingency: FinancialLineItem;

  summaryTotalAboveTheLine: number | null;
  summaryTotalBelowTheLine: number | null;
  summaryTotalAboveAndBelowTheLine: number | null;
  summaryGrandTotal: number | null;

  totalBudgetInput: number | null;
  estimatedBrandSponsorshipValue: number | null;
  estimatedLocationIncentiveValue: number | null;
  netExternalCapitalRequired: number | null;
}

export interface FinancialAnalysisModalProps {
    isOpen: boolean;
    onClose: () => void;
    scriptId: number | null; // To fetch data
    scriptTitle?: string;
}

// --- END MODIFICATION (Task 1.4) ---


// --- Script Writer Page Types ---
export type ScriptGenerationFormData = z.infer<
  typeof dbScriptGenerationFormSchema
>;
