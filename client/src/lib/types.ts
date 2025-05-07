import { z } from "zod";
import {
  Product,
  ProductCategory,
  Script,
  Scene,
  SceneVariation,
} from "@shared/schema";

export type TabType = "welcome" | "script" | "products" | "actors" | "locations";

export type FileUploadProps = {
  onFileUpload: (file: File) => Promise<void>;
  isLoading: boolean;
};

export type HeaderProps = {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
};

export type ScriptDisplayProps = {
  script: Script | null;
  isLoading: boolean;
  onSave: () => void;
  onReanalyze: () => void;
  onGeneratePlacements?: () => void;
  activeScene: Scene | null;
};

export type BrandableScenesProps = {
  brandableScenes: Scene[];
  productVariations: SceneVariation[];
  isLoading: boolean;
  selectedSceneId: number | null;
  onOptionSelect: (variationId: number) => void;
};

export type SceneBreakdownProps = {
  scenes: Scene[];
  activeSceneId: number | null;
  brandableSceneIds: number[];
  isLoading: boolean;
  onSceneSelect: (sceneId: number) => void;
};

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
    "OTHER",
  ]),
  imageUrl: z.string().url("Please enter a valid URL"),
});

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
  notableRoles: string;
  genres: string;
  recentPopularity: string;
  typicalRoles: string;
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
  socialMediaFollowing: z.string().min(1, "Social media information is required"),
  availability: z.string().min(1, "Availability is required"),
  bestSuitedRolesStrategic: z.string().min(1, "Best suited roles is required"),
  imageUrl: z.string().url("Please enter a valid URL").or(z.string().length(0)),
});

export type Location = {
  id?: number;
  country: string;
  region: string;
  incentiveProgram: string;
  incentiveDetails: string;
  minimumSpend: string;
  eligibleProductionTypes: string;
  limitsCaps?: string;
  qualifyingExpenses?: string;
  applicationProcess?: string;
  applicationDeadlines?: string;
  imageUrl?: string;
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
  incentiveProgram: z.string().min(2, "Incentive program must be at least 2 characters"),
  incentiveDetails: z.string().min(2, "Incentive details must be at least 2 characters"),
  minimumSpend: z.string().min(1, "Minimum spend is required"),
  eligibleProductionTypes: z.string().min(1, "Eligible production types is required"),
  limitsCaps: z.string(),
  qualifyingExpenses: z.string(),
  applicationProcess: z.string(),
  applicationDeadlines: z.string(),
  imageUrl: z.string().url("Please enter a valid URL").or(z.string().length(0)),
});
