import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Sparkles, Info, DollarSign, Play, Eye, Loader2 } from "lucide-react";
import type { Scene, VfxQualityTierType, VfxSceneDetail } from "@shared/schema";
import ImageZoomModal from "@/components/script/ImageZoomModal";

export interface VfxScenesProps {
  activeSceneDetails: Scene | null;
  projectTitle?: string;
  scenes: Scene[];
  vfxScenes: any[];
  isLoading: boolean;
  selectedSceneId: number | null;
  onVfxTierSelect: (sceneId: number, tier: VfxQualityTierType, cost: number) => void;
  onGenerateVideoRequest?: (variationId: number) => void;
  videoGenerationStates?: { [key: number]: any };
  onViewVideo?: (videoUrl: string, title: string) => void;
  onImageZoom?: (imageUrl: string, title: string) => void;
  sceneVariations?: any[]; // Brandable scene variations with images
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
  vfxScenes,
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

  // Get brandable scene variations (images) for this VFX scene
  const availableImages = sceneVariations?.filter(variation => 
    variation.sceneId === activeSceneDetails?.id && variation.imageUrl
  ) || [];

  // Generate VFX video for a specific quality tier using brandable scene image
  const handleGenerateVfxVideo = async (tier: VfxQualityTierType) => {
    if (!activeSceneDetails || availableImages.length === 0) return;
    
    const firstImage = availableImages[0]; // Use the first available brandable image
    
    if (firstImage?.id && onGenerateVideoRequest) {
      console.log(`[VFX Video ${tier}] Generating VFX video for tier ${tier} using brandable image`);
      onGenerateVideoRequest(firstImage.id);
    }
  };

  if (!activeSceneDetails || !activeSceneDetails.isVfxScene) {
    return null;
  }

  const sceneWithDetails = activeSceneDetails as SceneWithVfxDetails;
  const vfxDetails = sceneWithDetails.vfxDetails || [];
  const isLoadingVfx = vfxDetails.length === 0;

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

  const handleGenerateImage = async (tier: VfxQualityTierType) => {
    if (!activeSceneDetails) return;
    
    const tierKey = `${activeSceneDetails.id}-${tier}`;
    setGeneratingImages(prev => new Set([...prev, tierKey]));
    
    try {
      const response = await fetch(`/api/scenes/${activeSceneDetails.id}/generate-vfx-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          qualityTier: tier
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to generate VFX image: ${response.statusText}`);
      }

      const result = await response.json();
      setGeneratedImages(prev => ({
        ...prev,
        [tierKey]: result.imageUrl
      }));
      
      console.log(`VFX image generated for ${tier} tier:`, result.imageUrl);
      
    } catch (error) {
      console.error('Error generating VFX image:', error);
    } finally {
      setGeneratingImages(prev => {
        const newSet = new Set(prev);
        newSet.delete(tierKey);
        return newSet;
      });
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
            VADIS AI SUGGESTED VFX SCENES
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

          {/* VFX Quality Tiers */}
          <div>
            <h4 className="text-sm font-medium mb-3">VFX Quality Tiers</h4>
            
            {isLoadingVfx ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(['LOW', 'MEDIUM', 'HIGH'] as const).map((tier) => (
                  <Card key={tier} className="relative">
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <Skeleton className="h-32 w-full rounded" />
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                        <div className="flex gap-2">
                          <Skeleton className="h-8 flex-1" />
                          <Skeleton className="h-8 w-24" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(['LOW', 'MEDIUM', 'HIGH'] as const).map((tier) => {
                  const tierDetail = vfxDetails.find(detail => detail.qualityTier === tier);
                  const config = VFX_TIER_CONFIG[tier];
                  const isSelected = activeSceneDetails.selectedVfxTier === tier;
                  
                  return (
                    <Card 
                      key={tier} 
                      className={`relative transition-all duration-200 hover:shadow-md ${
                        isSelected ? 'ring-2 ring-purple-500 bg-purple-50' : config.color
                      }`}
                    >
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          {/* Use brandable scene image for VFX */}
                          {availableImages.length > 0 ? (
                            <div 
                              className="h-32 w-full rounded overflow-hidden cursor-pointer group relative"
                              onClick={() => {
                                if (onImageZoom && availableImages[0]?.imageUrl) {
                                  onImageZoom(availableImages[0].imageUrl, `VFX ${config.name} - Scene ${activeSceneDetails.sceneNumber}`);
                                }
                              }}
                            >
                              <img 
                                src={availableImages[0].imageUrl} 
                                alt={`VFX ${config.name} base image`}
                                className="w-full h-full object-cover transition-transform group-hover:scale-105"
                              />
                              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Eye className="h-6 w-6 text-white" />
                              </div>
                              <div className="absolute top-2 left-2 bg-purple-600 text-white text-xs px-2 py-1 rounded">
                                VFX {config.name}
                              </div>
                            </div>
                          ) : (
                            <div className="h-32 w-full rounded bg-gray-100 flex flex-col items-center justify-center gap-2">
                              <Sparkles className="h-8 w-8 text-gray-400" />
                              <p className="text-xs text-gray-600">No brandable image available</p>
                              <p className="text-xs text-gray-500">Generate brand placement first</p>
                            </div>
                          )}
                          
                          {/* Tier Info */}
                          <div>
                            <h5 className="font-medium text-sm">{config.name}</h5>
                            <p className="text-xs text-gray-600 mt-1">{config.description}</p>
                            <p className="text-xs font-medium text-purple-600 mt-1">{config.costRange}</p>
                            {tierDetail?.estimatedVfxCost && (
                              <p className="text-sm font-semibold text-green-600">
                                Est: {formatCost(tierDetail.estimatedVfxCost)}
                              </p>
                            )}
                          </div>

                          {/* Action Buttons */}
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant={isSelected ? "default" : "outline"}
                              className="flex-1"
                              onClick={async () => {
                                if (tierDetail?.estimatedVfxCost) {
                                  onVfxTierSelect(activeSceneDetails.id, tier, tierDetail.estimatedVfxCost);
                                }
                              }}
                              disabled={!tierDetail?.estimatedVfxCost}
                            >
                              {isSelected ? 'Selected' : 'Select Tier'}
                            </Button>
                            
                            {availableImages.length > 0 && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleGenerateVfxVideo(tier)}
                                      disabled={!onGenerateVideoRequest || !availableImages[0]?.id}
                                    >
                                      <Play className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Generate VFX Video ({config.name})</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        </div>
                      </CardContent>
                      
                      {isSelected && (
                        <div className="absolute top-2 right-2">
                          <Badge className="bg-purple-600 text-white">Selected</Badge>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Image Zoom Modal */}
      <ImageZoomModal
        isOpen={isImageZoomModalOpen}
        onClose={() => setIsImageZoomModalOpen(false)}
        imageUrl={selectedImageUrl}
        title="VFX Concept Image"
      />
    </>
  );
}