import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Sparkles, Info, DollarSign, Play, Eye, Loader2, ZoomIn, Check } from "lucide-react";
import type { Scene, VfxQualityTierType, VfxSceneDetail } from "@shared/schema";
import ImageZoomModal from "@/components/script/ImageZoomModal";

export interface VfxScenesProps {
  activeSceneDetails: Scene | null;
  projectTitle?: string;
  scenes: Scene[];
  vfxScenes: any[]; // This will now contain the placement variations
  isLoading: boolean;
  selectedSceneId: number | null;
  onVfxTierSelect: (sceneId: number, tier: VfxQualityTierType) => void;
  onGenerateVideoRequest?: (variationId: number) => void;
  videoGenerationStates?: { [key: number]: any };
  onViewVideo?: (videoUrl: string, title: string) => void;
  onImageZoom?: (imageUrl: string, title: string) => void;
}

interface SceneWithVfxDetails extends Scene {
  vfxDetails?: VfxSceneDetail[];
}

const VFX_TIER_CONFIG = {
  LOW: {
    name: "Low Quality VFX",
    description: "Basic visual effects for simple scenes",
    color: "bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800",
    costRange: "$5K - $15K"
  },
  MEDIUM: {
    name: "Medium Quality VFX", 
    description: "Professional grade effects for standard production",
    color: "bg-purple-50 border-purple-200 dark:bg-purple-950 dark:border-purple-800",
    costRange: "$20K - $75K"
  },
  HIGH: {
    name: "High Quality VFX",
    description: "Premium cinematic quality effects",
    color: "bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800",
    costRange: "$100K - $500K"
  }
} as const;

export default function VfxScenes({
  activeSceneDetails,
  projectTitle,
  scenes,
  vfxScenes, // This now contains the placement variations with generated images
  isLoading,
  selectedSceneId,
  onVfxTierSelect,
  onGenerateVideoRequest,
  videoGenerationStates = {},
  onViewVideo,
  onImageZoom
}: VfxScenesProps) {
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [isImageZoomModalOpen, setIsImageZoomModalOpen] = useState(false);

  if (!activeSceneDetails) {
    return null;
  }

  const sceneWithDetails = activeSceneDetails as SceneWithVfxDetails;
  const vfxDetails = sceneWithDetails.vfxDetails || [];
  
  // Get the scene variations with generated images for this scene
  const currentSceneVariations = Array.isArray(vfxScenes) 
    ? vfxScenes.filter(variation => variation.sceneId === activeSceneDetails.id)
    : [];

  const formatCost = (cost: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(cost);
  };

  const handleImageClick = (imageUrl: string, title: string) => {
    if (onImageZoom) {
      onImageZoom(imageUrl, title);
    } else {
      setSelectedImageUrl(imageUrl);
      setIsImageZoomModalOpen(true);
    }
  };

  const vfxKeywords = Array.isArray(activeSceneDetails.vfxKeywords) 
    ? activeSceneDetails.vfxKeywords 
    : (typeof activeSceneDetails.vfxKeywords === 'string' 
        ? activeSceneDetails.vfxKeywords.split(',').map(k => k.trim()).filter(Boolean)
        : []);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-purple-700">
            <Sparkles className="w-5 h-5" />
            VFX Scene Analysis
          </CardTitle>
          <CardDescription>
            Scene {activeSceneDetails.sceneNumber}: {activeSceneDetails.heading}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* VFX Description */}
          {activeSceneDetails.vfxDescription && (
            <div>
              <h4 className="text-sm font-medium mb-2">VFX Requirements</h4>
              <p className="text-sm text-gray-600">{activeSceneDetails.vfxDescription}</p>
            </div>
          )}

          {/* VFX Keywords */}
          {vfxKeywords.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">VFX Elements</h4>
              <div className="flex flex-wrap gap-1">
                {vfxKeywords.map((keyword, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {keyword}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* VFX Quality Tiers Selection Grid */}
          <div>
            <h4 className="text-sm font-medium mb-3">VFX Quality Tiers</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
              {(['LOW', 'MEDIUM', 'HIGH'] as const).map((tier) => {
                const config = VFX_TIER_CONFIG[tier];
                const tierDetail = vfxDetails.find(detail => detail.qualityTier === tier);
                const isSelected = tierDetail?.isSelected || false;
                const videoState = tierDetail ? (videoGenerationStates[tierDetail.id] || { status: "idle" }) : { status: "idle" };
                const isProcessing = videoState.status === "pending" || videoState.status === "generating";
                
                return (
                  <Card
                    key={tier}
                    className={`border-2 rounded-lg overflow-hidden shadow-sm hover:shadow-lg transition-all duration-200 
                      ${isSelected ? "border-purple-500 ring-1 ring-purple-500" : "border-gray-200"} 
                      ${isProcessing ? "opacity-70" : ""} w-full group relative cursor-pointer`}
                    onClick={() => !isProcessing && onVfxTierSelect(activeSceneDetails.id, tier)}
                  >
                    {isSelected && (
                      <div className="absolute top-2 right-2 z-10 bg-purple-500 rounded-full p-1">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    )}
                    
                    <div className="relative aspect-video bg-gradient-to-br from-purple-100 to-purple-200 overflow-hidden">
                      {/* Show generated placement images from the current scene variations */}
                      {currentSceneVariations.length > 0 && currentSceneVariations[0]?.imageUrl ? (
                        <img
                          src={currentSceneVariations[0].imageUrl}
                          alt={`${config.name} preview for Scene ${activeSceneDetails.sceneNumber}`}
                          className="w-full h-full object-cover transform scale-100 hover:scale-105 transition-transform duration-300 cursor-pointer"
                          loading="lazy"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleImageClick(currentSceneVariations[0].imageUrl!, `${config.name} - Scene ${activeSceneDetails.sceneNumber}`);
                          }}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "https://placehold.co/864x480/9333ea/white?text=VFX+Preview";
                          }}
                        />
                      ) : tierDetail?.conceptualImageUrl ? (
                        <img
                          src={tierDetail.conceptualImageUrl}
                          alt={`${config.name} preview for Scene ${activeSceneDetails.sceneNumber}`}
                          className="w-full h-full object-cover transform scale-100 hover:scale-105 transition-transform duration-300 cursor-pointer"
                          loading="lazy"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleImageClick(tierDetail.conceptualImageUrl!, `${config.name} - Scene ${activeSceneDetails.sceneNumber}`);
                          }}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "https://placehold.co/864x480/9333ea/white?text=VFX+Preview";
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-100 to-purple-200">
                          <div className="text-center text-purple-700">
                            <Sparkles className="h-12 w-12 mx-auto mb-2" />
                            <p className="text-sm font-medium">{config.name}</p>
                            <p className="text-xs">{config.costRange}</p>
                          </div>
                        </div>
                      )}
                      
                      {isProcessing && (
                        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white p-2 sm:p-4 text-center">
                          <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin mb-1 sm:mb-2" />
                          <p className="text-xs sm:text-sm font-medium">
                            {videoState.stageMessage || "Processing VFX..."}
                          </p>
                        </div>
                      )}
                      
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                        <span className="text-white text-xs font-semibold">
                          {config.name}
                        </span>
                      </div>
                    </div>

                    <CardContent className="p-2 sm:p-3">
                      <div className="space-y-2">
                        <div>
                          <p className="text-xs sm:text-sm font-medium">{config.name}</p>
                          <p className="text-xs text-gray-600">{config.description}</p>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-xs">
                            {config.costRange}
                          </Badge>
                          {tierDetail && tierDetail.estimatedVfxCost && (
                            <span className="text-xs font-medium text-purple-600">
                              {formatCost(tierDetail.estimatedVfxCost)}
                            </span>
                          )}
                        </div>

                        {videoState.status === "succeeded" && videoState.videoUrl ? (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onViewVideo && onViewVideo(videoState.videoUrl!, `${config.name} - Scene ${activeSceneDetails.sceneNumber}`);
                            }}
                            className="w-full justify-center text-xs py-1 h-auto"
                          >
                            <Play className="mr-1 h-3 w-3" />
                            View VFX Video
                          </Button>
                        ) : isProcessing ? (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={true}
                            className="w-full justify-center text-xs py-1 h-auto"
                          >
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            {videoState.status === "pending" ? "Queueing..." : "Processing..."}
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              tierDetail && onGenerateVideoRequest && onGenerateVideoRequest(tierDetail.id);
                            }}
                            disabled={!tierDetail}
                            className="w-full justify-center text-xs py-1 h-auto"
                          >
                            <Sparkles className="mr-1 h-3 w-3" />
                            Generate VFX
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Image Zoom Modal */}
      <ImageZoomModal
        isOpen={isImageZoomModalOpen}
        onClose={() => setIsImageZoomModalOpen(false)}
        imageUrl={selectedImageUrl || ""}
        title="VFX Concept"
      />
    </>
  );
}