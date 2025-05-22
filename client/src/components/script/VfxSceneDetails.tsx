import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Sparkles, Info, DollarSign } from "lucide-react";
import type { Scene, VfxQualityTierType, VfxSceneDetail } from "@shared/schema";
import ImageZoomModal from "@/components/script/ImageZoomModal";

export interface VfxSceneDetailsProps {
  scriptId: number;
  activeScene: Scene | null;
  initialSelectedVfxTier: VfxQualityTierType | null;
  onVfxTierSelect: (sceneId: number, tier: VfxQualityTierType, cost: number) => void;
}

interface SceneWithVfxDetails extends Scene {
  vfxDetails?: VfxSceneDetail[];
}

const VFX_TIER_CONFIG = {
  LOW: {
    name: "Low Quality VFX",
    description: "Basic visual effects for simple scenes",
    color: "bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800"
  },
  MEDIUM: {
    name: "Medium Quality VFX", 
    description: "Professional grade effects for standard production",
    color: "bg-purple-50 border-purple-200 dark:bg-purple-950 dark:border-purple-800"
  },
  HIGH: {
    name: "High Quality VFX",
    description: "Premium cinematic quality effects",
    color: "bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800"
  }
} as const;

export function VfxSceneDetails({ 
  scriptId, 
  activeScene, 
  initialSelectedVfxTier, 
  onVfxTierSelect 
}: VfxSceneDetailsProps) {
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  
  // Only display if scene is provided and is a VFX scene
  if (!activeScene || !activeScene.isVfxScene) {
    return null;
  }

  const sceneWithDetails = activeScene as SceneWithVfxDetails;
  const vfxDetails = sceneWithDetails.vfxDetails || [];
  const isLoading = vfxDetails.length === 0;

  // Get the conceptual image URL (prefer MEDIUM tier, fallback to first available)
  const getConceptualImageUrl = (): string | null => {
    const mediumTier = vfxDetails.find(detail => detail.qualityTier === 'MEDIUM');
    if (mediumTier?.conceptualImageUrl) return mediumTier.conceptualImageUrl;
    
    const firstWithImage = vfxDetails.find(detail => detail.conceptualImageUrl);
    return firstWithImage?.conceptualImageUrl || null;
  };

  const conceptualImageUrl = getConceptualImageUrl();

  // Format cost as currency
  const formatCost = (cost: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(cost);
  };

  // Parse VFX keywords
  const vfxKeywords = Array.isArray(activeScene.vfxKeywords) 
    ? activeScene.vfxKeywords 
    : (typeof activeScene.vfxKeywords === 'string' 
        ? activeScene.vfxKeywords.split(',').map(k => k.trim()).filter(Boolean)
        : []);

  return (
    <div className="space-y-6">
      {/* Scene VFX Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            VFX Scene Details
          </CardTitle>
          <CardDescription>
            Scene {activeScene.sceneNumber}: {activeScene.heading}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* VFX Description */}
          {activeScene.vfxDescription && (
            <div>
              <h4 className="font-medium text-sm text-muted-foreground mb-2">VFX Requirements</h4>
              <p className="text-sm">{activeScene.vfxDescription}</p>
            </div>
          )}

          {/* VFX Keywords */}
          {vfxKeywords.length > 0 && (
            <div>
              <h4 className="font-medium text-sm text-muted-foreground mb-2">VFX Elements</h4>
              <div className="flex flex-wrap gap-2">
                {vfxKeywords.map((keyword, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {keyword}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Conceptual Image */}
          {conceptualImageUrl && (
            <div>
              <h4 className="font-medium text-sm text-muted-foreground mb-2">Conceptual Visualization</h4>
              <div 
                className="relative cursor-pointer rounded-lg overflow-hidden border hover:opacity-90 transition-opacity"
                onClick={() => setSelectedImageUrl(conceptualImageUrl)}
              >
                <img 
                  src={conceptualImageUrl} 
                  alt="VFX Concept"
                  className="w-full h-48 object-cover"
                />
                <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">Click to view full size</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* VFX Quality Tiers */}
      <div>
        <h3 className="text-lg font-semibold mb-4">VFX Quality Tiers</h3>
        
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <Card key={index}>
                <CardHeader>
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-4 w-32" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-16 w-full mb-4" />
                  <Skeleton className="h-6 w-20 mb-2" />
                  <Skeleton className="h-9 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(['LOW', 'MEDIUM', 'HIGH'] as VfxQualityTierType[]).map((tier) => {
              const tierDetail = vfxDetails.find(detail => detail.qualityTier === tier);
              const tierConfig = VFX_TIER_CONFIG[tier];
              const isSelected = initialSelectedVfxTier === tier;
              
              return (
                <Card 
                  key={tier} 
                  className={`${tierConfig.color} ${isSelected ? 'ring-2 ring-primary' : ''}`}
                >
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between text-base">
                      {tierConfig.name}
                      {tierDetail?.estimatedVfxCost && (
                        <div className="flex items-center gap-1 text-sm font-medium">
                          <DollarSign className="w-4 h-4" />
                          {formatCost(tierDetail.estimatedVfxCost)}
                        </div>
                      )}
                    </CardTitle>
                    <CardDescription>{tierConfig.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {tierDetail ? (
                      <>
                        {/* VFX Elements Summary */}
                        {tierDetail.vfxElementsSummaryForTier && (
                          <div>
                            <p className="text-sm">{tierDetail.vfxElementsSummaryForTier}</p>
                          </div>
                        )}

                        {/* Cost Notes with Tooltip */}
                        {tierDetail.costEstimationNotes && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground cursor-help">
                                  <Info className="w-3 h-3" />
                                  Cost breakdown details
                                </div>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                <p className="text-sm">{tierDetail.costEstimationNotes}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}

                        {/* Select Tier Button */}
                        <Button
                          onClick={() => tierDetail.estimatedVfxCost && onVfxTierSelect(
                            activeScene.id, 
                            tier, 
                            tierDetail.estimatedVfxCost
                          )}
                          variant={isSelected ? "default" : "outline"}
                          className="w-full"
                          disabled={!tierDetail.estimatedVfxCost}
                        >
                          {isSelected ? "Selected" : "Select Tier"}
                        </Button>
                      </>
                    ) : (
                      <div className="text-center py-4">
                        <Skeleton className="h-4 w-full mb-2" />
                        <Skeleton className="h-4 w-3/4 mb-4" />
                        <Skeleton className="h-9 w-full" />
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Image Zoom Modal */}
      {selectedImageUrl && (
        <ImageZoomModal
          imageUrl={selectedImageUrl}
          alt="VFX Concept Visualization"
          isOpen={!!selectedImageUrl}
          onClose={() => setSelectedImageUrl(null)}
        />
      )}
    </div>
  );
}