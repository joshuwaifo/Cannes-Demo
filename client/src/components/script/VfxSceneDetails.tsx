// client/src/components/script/VfxSceneDetails.tsx
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { VfxSceneDetailsProps, ClientVfxScene } from '@/lib/types';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { DollarSign, Image as ImageIcon, Sparkles, AlertTriangle, Info, CheckCircle } from 'lucide-react';
import { VfxQualityTierEnum, VfxQualityTierType, VfxSceneDetail as DbVfxSceneDetail } from "@shared/schema";
import { cn } from '@/lib/utils';
import ImageZoomModal from './ImageZoomModal'; // Assuming you have this for zooming images

const FALLBACK_VFX_IMAGE = "https://placehold.co/1024x576/444/ccc?text=VFX+Concept";

export default function VfxSceneDetails({
  scriptId,
  activeScene,
  onVfxTierSelect,
  selectedVfxTier: initialSelectedTier // Prop to reflect externally managed selection
}: VfxSceneDetailsProps) {
  const [isZoomModalOpen, setIsZoomModalOpen] = useState(false);
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);
  const [localSelectedTier, setLocalSelectedTier] = useState<VfxQualityTierType | null>(initialSelectedTier || VfxQualityTierEnum.MEDIUM);


  // Fetch all VFX scenes and their details for the current script
  // We will then filter for the activeScene client-side.
  const { data: allVfxScenesData, isLoading, isError, error } = useQuery<ClientVfxScene[]>({
    queryKey: [`/api/scripts/${scriptId}/vfx-scenes`, scriptId],
    queryFn: async () => {
      if (!scriptId) return [];
      const response = await apiRequest("GET", `/api/scripts/${scriptId}/vfx-scenes`);
      return response.json();
    },
    enabled: !!scriptId && !!activeScene && activeScene.is_vfx_scene, // Only fetch if it's a VFX scene
    refetchOnWindowFocus: false,
  });

  // Effect to update localSelectedTier if the prop changes (e.g. loaded from saved state)
  useEffect(() => {
    setLocalSelectedTier(initialSelectedTier || VfxQualityTierEnum.MEDIUM);
  }, [initialSelectedTier]);


  const currentVfxSceneData = activeScene && allVfxScenesData?.find(s => s.id === activeScene.id);
  const vfxDetailsForActiveScene = currentVfxSceneData?.vfxDetails || [];

  const handleTierButtonClick = (tier: VfxQualityTierType) => {
    setLocalSelectedTier(tier);
    if (onVfxTierSelect && activeScene) {
      const tierDetail = vfxDetailsForActiveScene.find(d => d.qualityTier === tier);
      onVfxTierSelect(activeScene.id, tier, tierDetail?.estimatedVfxCost || 0);
    }
  };

  const openZoomModal = (url: string | null) => {
    if (url) {
      setZoomImageUrl(url);
      setIsZoomModalOpen(true);
    }
  };

  // Find the conceptual image URL (e.g., from medium tier or first available)
  let conceptualImageUrl = FALLBACK_VFX_IMAGE;
  if (vfxDetailsForActiveScene && vfxDetailsForActiveScene.length > 0) {
    const mediumTierDetail = vfxDetailsForActiveScene.find(d => d.qualityTier === VfxQualityTierEnum.MEDIUM && d.conceptualImageUrl);
    if (mediumTierDetail) {
      conceptualImageUrl = mediumTierDetail.conceptualImageUrl!;
    } else {
      const firstDetailWithImage = vfxDetailsForActiveScene.find(d => d.conceptualImageUrl);
      if (firstDetailWithImage) {
        conceptualImageUrl = firstDetailWithImage.conceptualImageUrl!;
      }
    }
  }


  if (!activeScene) {
    return (
      <Card className="bg-muted/30">
        <CardContent className="pt-6 text-center text-muted-foreground">
          <Info className="mx-auto h-8 w-8 mb-2" />
          Select a scene to view its details.
        </CardContent>
      </Card>
    );
  }

  if (!activeScene.is_vfx_scene) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><Sparkles className="mr-2 h-5 w-5 text-purple-500" />VFX Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No significant VFX elements identified by Vadis AI for this scene.</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-1/2 mt-1" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-48 w-full" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center text-destructive"><AlertTriangle className="mr-2 h-5 w-5" />Error Loading VFX Details</CardTitle>
        </CardHeader>
        <CardContent>
          <p>{(error as Error)?.message || "Could not load VFX details for this scene."}</p>
        </CardContent>
      </Card>
    );
  }

  if (!currentVfxSceneData && activeScene.is_vfx_scene) {
      return (
          <Card>
              <CardHeader>
                  <CardTitle className="flex items-center"><Sparkles className="mr-2 h-5 w-5 text-purple-500" />VFX Details for Scene {activeScene.sceneNumber}</CardTitle>
              </CardHeader>
              <CardContent>
                  <div className="text-center py-8 text-muted-foreground">
                      <Loader2 className="mx-auto h-8 w-8 animate-spin mb-3" />
                      <p>Fetching VFX details...</p>
                      <p className="text-xs mt-1">If this persists, try re-analyzing VFX for the script.</p>
                  </div>
              </CardContent>
          </Card>
      );
  }


  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Sparkles className="mr-2 h-6 w-6 text-purple-500" />
            VFX Analysis for Scene {activeScene.sceneNumber}: {activeScene.heading}
          </CardTitle>
          {activeScene.vfx_description && (
            <CardDescription className="pt-1">{activeScene.vfx_description}</CardDescription>
          )}
           {activeScene.vfx_keywords && activeScene.vfx_keywords.length > 0 && (
             <div className="pt-2">
                {activeScene.vfx_keywords.map(keyword => (
                    <Badge key={keyword} variant="secondary" className="mr-1 mb-1 bg-purple-100 text-purple-700 border-purple-300">
                        {keyword}
                    </Badge>
                ))}
            </div>
           )}
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="text-md font-semibold mb-2">Conceptual Visual</h3>
            {conceptualImageUrl && conceptualImageUrl !== FALLBACK_VFX_IMAGE ? (
              <div 
                className="aspect-video w-full bg-muted rounded-lg overflow-hidden cursor-pointer relative group"
                onClick={() => openZoomModal(conceptualImageUrl)}
              >
                <img src={conceptualImageUrl} alt={`VFX Concept for Scene ${activeScene.sceneNumber}`} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <ZoomIn className="h-10 w-10 text-white" />
                </div>
              </div>
            ) : (
              <div className="aspect-video w-full bg-muted rounded-lg flex items-center justify-center">
                <ImageIcon className="h-12 w-12 text-muted-foreground" />
              </div>
            )}
            {/* Placeholder for video if/when implemented */}
            {/* {vfxDetailsForActiveScene.find(d => d.conceptualVideoUrl) && <p className="text-sm mt-2">Conceptual video available.</p>} */}
          </div>

          <div>
            <h3 className="text-md font-semibold mb-3">Estimated VFX Cost Tiers & Complexity</h3>
            <p className="text-xs text-muted-foreground mb-3">Select a tier to see its impact on the overall project budget in the Financial Analysis.</p>
            {vfxDetailsForActiveScene.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(Object.keys(VfxQualityTierEnum) as VfxQualityTierType[]).map((tierKey) => {
                  const tierValue = VfxQualityTierEnum[tierKey];
                  const detail = vfxDetailsForActiveScene.find(d => d.qualityTier === tierValue);
                  const isSelected = localSelectedTier === tierValue;

                  return (
                    <Card 
                        key={tierValue} 
                        className={cn(
                            "cursor-pointer hover:shadow-md",
                            isSelected ? "border-primary ring-2 ring-primary" : "border-border"
                        )}
                        onClick={() => handleTierButtonClick(tierValue)}
                    >
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base capitalize flex justify-between items-center">
                          {tierValue} Tier
                          {isSelected && <CheckCircle className="h-5 w-5 text-primary" />}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm space-y-1">
                        <p className="flex items-center font-semibold text-lg">
                          <DollarSign className="h-5 w-5 mr-1 text-green-600" />
                          {detail?.estimatedVfxCost !== null && detail?.estimatedVfxCost !== undefined 
                            ? detail.estimatedVfxCost.toLocaleString('en-US') 
                            : 'N/A'}
                        </p>
                        <TooltipProvider delayDuration={100}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <p className="text-xs text-muted-foreground line-clamp-2 cursor-help">
                                        {detail?.costEstimationNotes || "No specific notes."}
                                    </p>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="max-w-xs">
                                    <p className="text-xs">{detail?.costEstimationNotes || "No specific notes for this tier."}</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                         {detail?.vfxElementsSummaryForTier && (
                             <TooltipProvider delayDuration={100}>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2 cursor-help">
                                            Elements: {detail.vfxElementsSummaryForTier}
                                        </p>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="max-w-xs">
                                        <p className="text-xs font-semibold mb-1">Key elements considered for this tier:</p>
                                        <p className="text-xs">{detail.vfxElementsSummaryForTier}</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                         )}
                      </CardContent>
                        <CardFooter>
                            <Button 
                                variant={isSelected ? "default" : "outline"} 
                                size="sm" 
                                className="w-full"
                                onClick={(e) => { e.stopPropagation(); handleTierButtonClick(tierValue); }}
                            >
                                {isSelected ? "Selected" : "Select Tier"}
                            </Button>
                        </CardFooter>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <p className="text-muted-foreground">No detailed cost tiers available for this VFX scene yet. Try re-analyzing.</p>
            )}
          </div>
        </CardContent>
      </Card>
      <ImageZoomModal 
        isOpen={isZoomModalOpen}
        onClose={() => setIsZoomModalOpen(false)}
        imageUrl={zoomImageUrl}
        title={`VFX Concept - Scene ${activeScene?.sceneNumber}`}
      />
    </>
  );
}