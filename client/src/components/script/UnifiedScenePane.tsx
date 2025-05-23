// client/src/components/script/UnifiedScenePane.tsx
import React, { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Star, Sparkles } from "lucide-react";
import BrandableScenes from "./BrandableScenes";
import VfxScenes from "./VfxScenes";
import { Scene, SceneVariation } from "@shared/schema";

// Define types locally since they're used in ScriptEditor
type VideoGenerationStatus = "idle" | "pending" | "generating" | "succeeded" | "failed";
interface VideoGenerationState {
    status: VideoGenerationStatus;
    predictionId?: string | null;
    videoUrl?: string | null;
    error?: string | null;
    logs?: string | null;
    progress?: number;
    stageMessage?: string;
}
type SelectedProduct = SceneVariation;

interface UnifiedScenePaneProps {
  activeSceneDetails: Scene;
  projectTitle?: string;
  scenes: Scene[];
  productVariations: SceneVariation[];
  isLoading: boolean;
  selectedSceneId: number;
  onGenerateVideoRequest: (variationId: number) => void;
  videoGenerationStates: Record<number, VideoGenerationState>;
  onViewVideo: (url: string, title: string) => void;
  onImageZoom: (url: string, title: string) => void;
  selectedProducts: SelectedProduct[];
  onProductSelect: (product: SelectedProduct) => void;
  onVfxTierSelect: (sceneId: number, qualityTier: string) => void;
}

export default function UnifiedScenePane({
  activeSceneDetails,
  projectTitle,
  scenes,
  productVariations,
  isLoading,
  selectedSceneId,
  onGenerateVideoRequest,
  videoGenerationStates,
  onViewVideo,
  onImageZoom,
  selectedProducts,
  onProductSelect,
  onVfxTierSelect,
}: UnifiedScenePaneProps) {
  const [isVfxMode, setIsVfxMode] = useState(false);

  // Check if current scene has both capabilities
  const isBrandableScene = activeSceneDetails.isBrandable;
  const isVfxScene = activeSceneDetails.isVfxScene;
  const hasBothCapabilities = isBrandableScene && isVfxScene;

  // If scene only has one capability, don't show toggle
  const showToggle = hasBothCapabilities;

  // Determine which mode to show
  let effectiveMode = isVfxMode;
  if (!showToggle) {
    if (isVfxScene && !isBrandableScene) {
      effectiveMode = true; // Force VFX mode
    } else {
      effectiveMode = false; // Force brand mode
    }
  }

  return (
    <div className="space-y-4">
      {/* Toggle Header */}
      {showToggle && (
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <Star className="h-5 w-5 text-green-600" />
              <span className="text-sm font-medium text-gray-700">Brand Placement</span>
            </div>
            <Switch
              id="scene-mode-toggle"
              checked={isVfxMode}
              onCheckedChange={setIsVfxMode}
              className="data-[state=checked]:bg-purple-600"
            />
            <div className="flex items-center space-x-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              <span className="text-sm font-medium text-gray-700">VFX Scene</span>
            </div>
          </div>
          <div className="text-xs text-gray-500">
            This scene supports both brand placement and VFX
          </div>
        </div>
      )}

      {/* Scene Content */}
      {effectiveMode ? (
        <VfxScenes
          activeSceneDetails={activeSceneDetails}
          projectTitle={projectTitle}
          scenes={scenes}
          vfxScenes={[]}
          isLoading={false}
          selectedSceneId={selectedSceneId}
          onVfxTierSelect={onVfxTierSelect}
          onGenerateVideoRequest={onGenerateVideoRequest}
          videoGenerationStates={videoGenerationStates}
          onViewVideo={onViewVideo}
          onImageZoom={onImageZoom}
        />
      ) : (
        <BrandableScenes
          activeSceneDetails={activeSceneDetails}
          projectTitle={projectTitle}
          scenes={scenes}
          productVariations={productVariations}
          isLoading={isLoading}
          selectedSceneId={selectedSceneId}
          onGenerateVideoRequest={onGenerateVideoRequest}
          videoGenerationStates={videoGenerationStates}
          onViewVideo={onViewVideo}
          onImageZoom={onImageZoom}
          selectedProducts={selectedProducts}
          onProductSelect={onProductSelect}
        />
      )}
    </div>
  );
}