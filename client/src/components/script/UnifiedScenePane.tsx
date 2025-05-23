// client/src/components/script/UnifiedScenePane.tsx
import React, { useState } from 'react';
import { Scene, SceneVariation } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Star, Sparkles, Zap, Eye, Play, ShoppingCart, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import BrandableScenes from './BrandableScenes';
import VfxScenes from './VfxScenes';

interface UnifiedScenePaneProps {
  activeSceneDetails: Scene;
  projectTitle?: string;
  scenes: Scene[];
  productVariations: SceneVariation[];
  isLoading: boolean;
  selectedSceneId: number;
  onGenerateVideoRequest: (variationId: number) => void;
  videoGenerationStates: Record<number, any>;
  onViewVideo: (videoUrl: string, title: string) => void;
  onImageZoom: (imageUrl: string, title: string) => void;
  selectedProducts: any[];
  onProductSelect: (product: any) => void;
  onVfxTierSelect: (sceneId: number, tier: string) => void;
}

type PaneMode = 'brand' | 'vfx';

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
  const [paneMode, setPaneMode] = useState<PaneMode>('brand');

  const isBrandableScene = activeSceneDetails?.isBrandable;
  const isVfxScene = activeSceneDetails?.isVfxScene;

  // If scene is neither brandable nor VFX, default to brand mode
  // If scene is only VFX, force VFX mode
  // If scene is only brandable, force brand mode
  const availableModes = {
    brand: isBrandableScene,
    vfx: isVfxScene
  };

  // Auto-switch mode if current mode is not available
  React.useEffect(() => {
    if (!availableModes[paneMode]) {
      if (availableModes.vfx) {
        setPaneMode('vfx');
      } else if (availableModes.brand) {
        setPaneMode('brand');
      }
    }
  }, [selectedSceneId, availableModes.brand, availableModes.vfx, paneMode]);

  const renderToggleButtons = () => {
    if (!isBrandableScene && !isVfxScene) {
      return (
        <div className="flex items-center justify-center p-4 text-gray-500">
          <div className="text-center">
            <Zap className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">This scene has no brand placement or VFX opportunities identified.</p>
          </div>
        </div>
      );
    }

    if (!isBrandableScene || !isVfxScene) {
      // Only one mode available, show a simple badge instead of toggle
      return (
        <div className="flex items-center justify-center mb-4">
          <Badge variant={isVfxScene ? "secondary" : "default"} className={cn(
            "px-4 py-2 text-sm font-medium",
            isVfxScene ? "bg-purple-100 text-purple-800 border-purple-200" : "bg-green-100 text-green-800 border-green-200"
          )}>
            {isVfxScene ? (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                VFX Scene
              </>
            ) : (
              <>
                <Star className="h-4 w-4 mr-2" />
                Brandable Scene
              </>
            )}
          </Badge>
        </div>
      );
    }

    // Both modes available, show toggle
    return (
      <div className="flex items-center justify-center mb-6">
        <div className="bg-gray-100 p-1 rounded-lg flex">
          <Button
            variant={paneMode === 'brand' ? "default" : "ghost"}
            size="sm"
            onClick={() => setPaneMode('brand')}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-all",
              paneMode === 'brand' 
                ? "bg-green-600 hover:bg-green-700 text-white shadow-sm" 
                : "text-gray-600 hover:text-green-600 hover:bg-green-50"
            )}
          >
            <ShoppingCart className="h-4 w-4 mr-2" />
            Brand Placement
          </Button>
          <Button
            variant={paneMode === 'vfx' ? "default" : "ghost"}
            size="sm"
            onClick={() => setPaneMode('vfx')}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-all",
              paneMode === 'vfx' 
                ? "bg-purple-600 hover:bg-purple-700 text-white shadow-sm" 
                : "text-gray-600 hover:text-purple-600 hover:bg-purple-50"
            )}
          >
            <Wand2 className="h-4 w-4 mr-2" />
            VFX
          </Button>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    if (!isBrandableScene && !isVfxScene) {
      return null;
    }

    if (paneMode === 'brand' && isBrandableScene) {
      return (
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
      );
    }

    if (paneMode === 'vfx' && isVfxScene) {
      return (
        <VfxScenes
          activeSceneDetails={activeSceneDetails}
          projectTitle={projectTitle}
          scenes={scenes}
          vfxScenes={[]}
          isLoading={isLoading}
          selectedSceneId={selectedSceneId}
          onVfxTierSelect={onVfxTierSelect}
          onGenerateVideoRequest={onGenerateVideoRequest}
          videoGenerationStates={videoGenerationStates}
          onViewVideo={onViewVideo}
          onImageZoom={onImageZoom}
        />
      );
    }

    return null;
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          Scene {activeSceneDetails?.sceneNumber}: {activeSceneDetails?.heading}
        </h2>
        {renderToggleButtons()}
      </div>
      <div className="p-4">
        {renderContent()}
      </div>
    </div>
  );
}