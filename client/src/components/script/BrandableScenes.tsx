// // client/src/components/script/BrandableScenes.tsx
// import { BrandableScenesProps, SceneVariation } from "@/lib/types"; // Use updated SceneVariation
// import { Button } from "@/components/ui/button";
// import { Card, CardContent, CardFooter } from "@/components/ui/card";
// import { Skeleton } from "@/components/ui/skeleton";
// import { Badge } from "@/components/ui/badge";
// import { getSafeImageUrl } from "@/lib/utils";
// import {
//   ImageOff,
//   Info,
//   Loader2,
//   Video,
//   PlayCircle,
//   AlertTriangle,
//   Download,
//   RefreshCcw, // Icon for regenerate
// } from "lucide-react";
// import { Progress } from "@/components/ui/progress";
// import { Scene } from "@shared/schema";
// import { Textarea } from "@/components/ui/textarea"; // Import Textarea
// import { useState, useEffect } from "react"; // Import useState and useEffect
// import { useMutation, useQueryClient } from "@tanstack/react-query"; // For mutation
// import { apiRequest } from "@/lib/queryClient"; // For API requests
// import { useToast } from "@/hooks/use-toast"; // For toasts

// export default function BrandableScenes({
//   brandableScenes,
//   scenes,
//   productVariations,
//   isLoading,
//   selectedSceneId,
//   onGenerateVideoRequest,
//   videoGenerationStates,
//   onViewVideo,
// }: BrandableScenesProps) {
//   const queryClient = useQueryClient();
//   const { toast } = useToast();
//   const [editedPrompts, setEditedPrompts] = useState<{
//     [variationId: number]: string;
//   }>({});

//   // Effect to initialize editedPrompts when variations or selectedSceneId change
//   useEffect(() => {
//     const initialPrompts: { [variationId: number]: string } = {};
//     if (productVariations && selectedSceneId) {
//       productVariations
//         .filter((v) => v.sceneId === selectedSceneId)
//         .forEach((v) => {
//           initialPrompts[v.id] = v.geminiPrompt || "";
//         });
//     }
//     setEditedPrompts(initialPrompts);
//   }, [productVariations, selectedSceneId]);

//   const currentScene = brandableScenes.find(
//     (scene) => scene.id === selectedSceneId,
//   );

//   const currentSceneVariations = productVariations
//     .filter((variation) => variation.sceneId === selectedSceneId)
//     .map((variation) => ({
//       ...variation,
//       imageUrl: getSafeImageUrl(
//         variation.imageUrl,
//         "https://placehold.co/864x480/333/white?text=Processing...",
//       ),
//       productImageUrl: getSafeImageUrl(variation.productImageUrl || ""),
//     }));

//   const handlePromptChange = (variationId: number, newPrompt: string) => {
//     setEditedPrompts((prev) => ({ ...prev, [variationId]: newPrompt }));
//   };

//   const regenerateImageMutation = useMutation({
//     mutationFn: async ({
//       variationId,
//       newPrompt,
//     }: {
//       variationId: number;
//       newPrompt: string;
//     }) => {
//       return apiRequest(
//         "PUT",
//         `/api/variations/${variationId}/update-prompt-and-image`,
//         { newPrompt },
//       );
//     },
//     onSuccess: (data, variables) => {
//       toast({
//         title: "Image Regenerated",
//         description: `Image for variation ${variables.variationId} has been updated.`,
//       });
//       queryClient.invalidateQueries({
//         queryKey: ["/api/scripts/scene-variations", selectedSceneId],
//       });
//       // Reset the edited prompt for this variation to the newly saved one from the backend
//       // The query invalidation will refetch, and the useEffect will update editedPrompts
//     },
//     onError: (error: Error, variables) => {
//       toast({
//         variant: "destructive",
//         title: "Image Regeneration Failed",
//         description: `Could not regenerate image for variation ${variables.variationId}: ${error.message}`,
//       });
//     },
//   });

//   const handleRegenerateImage = (variationId: number) => {
//     const newPrompt = editedPrompts[variationId];
//     if (newPrompt) {
//       regenerateImageMutation.mutate({ variationId, newPrompt });
//     } else {
//       toast({
//         variant: "destructive",
//         title: "No Prompt",
//         description: "Please enter a prompt to regenerate.",
//       });
//     }
//   };

//   if (!selectedSceneId) {
//     return (
//       <div>
//         <h3 className="text-md font-semibold text-secondary mb-3">
//           Select a Scene
//         </h3>
//         <div className="bg-muted p-6 rounded-lg text-center border border-dashed">
//           <Info className="h-10 w-10 text-gray-400 mx-auto mb-3" />
//           <p className="text-muted-foreground">
//             Select a scene marked with the{" "}
//             <Info className="inline h-4 w-4 text-primary align-middle" /> icon
//             from the "Scene Breakdown" list to view or generate product
//             placement options.
//           </p>
//         </div>
//       </div>
//     );
//   }

//   if (selectedSceneId && !currentScene) {
//     return (
//       <div>
//         <h3 className="text-md font-semibold text-secondary mb-3">
//           Scene Not Brandable
//         </h3>
//         <div className="bg-muted p-6 rounded-lg text-center border border-dashed">
//           <p className="text-muted-foreground">
//             This scene is not currently identified as brandable. Try
//             re-analyzing the script or selecting another scene.
//           </p>
//         </div>
//       </div>
//     );
//   }

//   if (isLoading && currentSceneVariations.length === 0) {
//     return (
//       <div>
//         <h3 className="text-md font-semibold text-secondary mb-3">
//           Scene {currentScene?.sceneNumber || selectedSceneId}: Product
//           Placement Options
//         </h3>
//         <div className="text-center py-8">
//           <Loader2 className="h-8 w-8 text-primary animate-spin mx-auto mb-3" />
//           <p className="text-muted-foreground">Loading placement options...</p>
//         </div>
//         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
//           {Array.from({ length: 3 }).map((_, i) => (
//             <Card key={i} className="overflow-hidden animate-pulse">
//               <Skeleton className="h-48 w-full bg-gray-200" />
//               <CardContent className="p-3">
//                 <Skeleton className="h-8 w-8 rounded-full bg-gray-200 inline-block mr-2" />
//                 <Skeleton className="h-4 w-24 bg-gray-200 inline-block" />
//                 <Skeleton className="h-10 w-full bg-gray-200 mt-2" />
//               </CardContent>
//               <CardFooter className="p-3 pt-0 flex justify-end">
//                 <Skeleton className="h-9 w-32 bg-gray-200" />
//               </CardFooter>
//             </Card>
//           ))}
//         </div>
//       </div>
//     );
//   }

//   if (currentSceneVariations.length === 0 && currentScene && !isLoading) {
//     return (
//       <div>
//         <h3 className="text-md font-semibold text-secondary mb-3">
//           Scene {currentScene?.sceneNumber}: Product Placement Options
//         </h3>
//         <div className="bg-muted p-6 rounded-lg text-center border border-dashed">
//           <ImageOff className="h-10 w-10 text-gray-400 mx-auto mb-3" />
//           <p className="text-muted-foreground mb-3">
//             No placement options generated yet for Scene{" "}
//             {currentScene?.sceneNumber}.
//           </p>
//           <p className="text-sm text-gray-500">
//             Use the "Generate Placements" button above to create visual options.
//           </p>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div>
//       <h3 className="text-md font-semibold text-secondary mb-3">
//         Scene {currentScene?.sceneNumber}: Product Placement Options
//       </h3>
//       {currentScene && (
//         <>
//           <p className="text-sm text-muted-foreground mb-1">
//             Reason: {currentScene.brandableReason || "Suitable for placement."}
//           </p>
//           <p className="text-sm text-muted-foreground mb-4">
//             Suggested Categories:{" "}
//             {currentScene.suggestedCategories?.join(", ") || "N/A"}
//           </p>
//           {brandableScenes.length > 0 && scenes.length > 0 && (
//             <p className="text-sm text-yellow-800 mb-2 font-medium">
//               AI has identified {brandableScenes.length} of {scenes.length}{" "}
//               scenes with product placement potential.
//             </p>
//           )}
//         </>
//       )}
//       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
//         {currentSceneVariations.map((variation) => {
//           const videoState = videoGenerationStates[variation.id] || {
//             status: "idle",
//           };
//           const isGeneratingThisVideo =
//             videoState.status === "pending" ||
//             videoState.status === "generating";

//           const isRegeneratingThisImage =
//             regenerateImageMutation.isPending &&
//             regenerateImageMutation.variables?.variationId === variation.id;
//           const currentPromptText =
//             editedPrompts[variation.id] ?? variation.geminiPrompt ?? "";
//           const isPromptUnchanged =
//             currentPromptText === (variation.geminiPrompt || "");

//           return (
//             <Card
//               key={variation.id}
//               className={`border-2 rounded-lg overflow-hidden shadow-sm hover:shadow-lg transition-all duration-200 ${variation.isSelected ? "border-blue-400 ring-1 ring-blue-400" : "border-gray-200"} ${isGeneratingThisVideo || isRegeneratingThisImage ? "opacity-70 cursor-not-allowed" : ""}`}
//             >
//               <div className="relative aspect-video bg-gray-100">
//                 <img
//                   src={variation.imageUrl}
//                   alt={`Option ${variation.variationNumber}: ${variation.productName} in ${currentScene?.heading}`}
//                   className="w-full h-full object-cover"
//                   onError={(e) => {
//                     e.currentTarget.src =
//                       "https://placehold.co/864x480/grey/white?text=Image+Error";
//                     e.currentTarget.alt = "Error loading image";
//                   }}
//                 />
//                 {(isGeneratingThisVideo || isRegeneratingThisImage) && (
//                   <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white p-4 text-center">
//                     <Loader2 className="h-8 w-8 animate-spin mb-2" />
//                     <p className="text-sm font-medium">
//                       {isRegeneratingThisImage
//                         ? "Regenerating Image..."
//                         : "Generating Video..."}
//                     </p>
//                   </div>
//                 )}
//                 {videoState.status === "succeeded" && videoState.videoUrl && (
//                   <div
//                     className="absolute top-2 right-2 bg-green-500 text-white p-1 rounded-full shadow-lg"
//                     title="Video Ready"
//                   >
//                     <Video className="h-4 w-4" />
//                   </div>
//                 )}
//                 {videoState.status === "failed" && (
//                   <div
//                     className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full shadow-lg"
//                     title={`Video Failed: ${videoState.error || ""}`}
//                   >
//                     <AlertTriangle className="h-4 w-4" />
//                   </div>
//                 )}
//                 <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
//                   <span className="text-white text-xs font-semibold">
//                     Option {variation.variationNumber}: {variation.productName}
//                   </span>
//                 </div>
//               </div>

//               <CardContent className="p-3">
//                 <div className="flex items-center space-x-2 mb-1.5">
//                   <div className="w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center overflow-hidden border">
//                     <img
//                       src={variation.productImageUrl}
//                       alt={variation.productName}
//                       className="w-full h-full object-contain"
//                       onError={(e) => {
//                         (e.currentTarget as HTMLImageElement).style.display =
//                           "none";
//                         const parent = e.currentTarget.parentElement;
//                         if (
//                           parent &&
//                           !parent.querySelector(".placeholder-icon")
//                         ) {
//                           parent.innerHTML +=
//                             '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400 placeholder-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>';
//                         }
//                       }}
//                     />
//                   </div>
//                   <div>
//                     <p className="text-sm font-medium leading-tight">
//                       {variation.productName}
//                     </p>
//                     <Badge variant="outline" className="text-xs py-0.5 px-1.5">
//                       {variation.productCategory}
//                     </Badge>
//                   </div>
//                 </div>

//                 {/* Prompt Textarea */}
//                 <Textarea
//                   value={currentPromptText}
//                   onChange={(e) =>
//                     handlePromptChange(variation.id, e.target.value)
//                   }
//                   placeholder="Edit prompt for image/video generation..."
//                   className="text-xs mt-2 min-h-[60px] max-h-[100px] resize-y"
//                   disabled={isGeneratingThisVideo || isRegeneratingThisImage}
//                 />

//                 {videoState.status === "failed" ? (
//                   <p
//                     className="text-xs text-red-600 line-clamp-2 mt-1"
//                     title={videoState.error || "Unknown video generation error"}
//                   >
//                     Video Failed: {videoState.error || "Unknown error"}
//                   </p>
//                 ) : (
//                   <p
//                     className="text-xs text-gray-600 line-clamp-2 mt-1" // Kept original description for fallback
//                     title={variation.description}
//                   >
//                     {variation.description}
//                   </p>
//                 )}
//               </CardContent>

//               <CardFooter className="p-3 pt-2 flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-2">
//                 <Button
//                   variant="outline"
//                   size="sm"
//                   onClick={() => handleRegenerateImage(variation.id)}
//                   disabled={
//                     isGeneratingThisVideo ||
//                     isRegeneratingThisImage ||
//                     isPromptUnchanged ||
//                     regenerateImageMutation.isPending
//                   }
//                   className="w-full sm:w-auto"
//                 >
//                   {isRegeneratingThisImage ? (
//                     <>
//                       <Loader2 className="mr-1 h-4 w-4 animate-spin" />
//                       Updating...
//                     </>
//                   ) : (
//                     <>
//                       <RefreshCcw className="mr-1 h-4 w-4" />
//                       Update Image
//                     </>
//                   )}
//                 </Button>

//                 {videoState.status === "succeeded" && videoState.videoUrl && (
//                   <Button
//                     variant="default"
//                     size="sm"
//                     onClick={() =>
//                       onViewVideo(
//                         videoState.videoUrl!,
//                         `Scene ${currentScene?.sceneNumber} - ${variation.productName}`,
//                       )
//                     }
//                     disabled={isLoading || isRegeneratingThisImage}
//                     className="w-full sm:w-auto"
//                   >
//                     <PlayCircle className="mr-1 h-4 w-4" />
//                     View Video
//                   </Button>
//                 )}

//                 {videoState.status !== "succeeded" && (
//                   <Button
//                     variant={
//                       videoState.status === "failed" ? "destructive" : "outline"
//                     }
//                     size="sm"
//                     onClick={() => onGenerateVideoRequest(variation.id)}
//                     disabled={
//                       isGeneratingThisVideo ||
//                       isLoading ||
//                       isRegeneratingThisImage
//                     }
//                     className="w-full sm:w-auto"
//                   >
//                     {isGeneratingThisVideo ? (
//                       <>
//                         <Loader2 className="mr-1 h-4 w-4 animate-spin" />
//                         Generating...
//                       </>
//                     ) : videoState.status === "failed" ? (
//                       <>
//                         <AlertTriangle className="mr-1 h-4 w-4" />
//                         Retry Video
//                       </>
//                     ) : (
//                       <>
//                         <Video className="mr-1 h-4 w-4" />
//                         Generate Video
//                       </>
//                     )}
//                   </Button>
//                 )}
//               </CardFooter>
//             </Card>
//           );
//         })}
//       </div>
//     </div>
//   );
// }

// client/src/components/script/BrandableScenes.tsx
import { BrandableScenesProps, SceneVariation } from "@/lib/types"; // Use updated SceneVariation
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { getSafeImageUrl } from "@/lib/utils";
import {
  ImageOff,
  Info,
  Loader2,
  Video,
  PlayCircle,
  AlertTriangle,
  Download,
  RefreshCcw,
  Replace,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Scene } from "@shared/schema";
import { Textarea } from "@/components/ui/textarea";
import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import ChangeProductModal from "./ChangeProductModal";

export default function BrandableScenes({
  brandableScenes,
  scenes,
  productVariations,
  isLoading,
  selectedSceneId,
  onGenerateVideoRequest,
  videoGenerationStates,
  onViewVideo,
}: BrandableScenesProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editedPrompts, setEditedPrompts] = useState<{
    [variationId: number]: string;
  }>({});
  const [isChangeProductModalOpen, setIsChangeProductModalOpen] =
    useState(false);
  const [changingProductForVariationId, setChangingProductForVariationId] =
    useState<number | null>(null);

  useEffect(() => {
    const initialPrompts: { [variationId: number]: string } = {};
    if (productVariations && selectedSceneId) {
      productVariations
        .filter((v) => v.sceneId === selectedSceneId)
        .forEach((v) => {
          initialPrompts[v.id] = v.geminiPrompt || "";
        });
    }
    setEditedPrompts(initialPrompts);
  }, [productVariations, selectedSceneId]);

  const currentScene = brandableScenes.find(
    (scene) => scene.id === selectedSceneId,
  );

  const currentSceneVariations = productVariations
    .filter((variation) => variation.sceneId === selectedSceneId)
    .map((variation) => ({
      ...variation,
      imageUrl: getSafeImageUrl(
        variation.imageUrl,
        "https://placehold.co/864x480/333/white?text=Processing...",
      ),
      productImageUrl: getSafeImageUrl(variation.productImageUrl || ""),
    }));

  const handlePromptChange = (variationId: number, newPrompt: string) => {
    setEditedPrompts((prev) => ({ ...prev, [variationId]: newPrompt }));
  };

  const regenerateImageMutation = useMutation({
    mutationFn: async ({
      variationId,
      newPrompt,
    }: {
      variationId: number;
      newPrompt: string;
    }) => {
      return apiRequest(
        "PUT",
        `/api/variations/${variationId}/update-prompt-and-image`,
        { newPrompt },
      );
    },
    onSuccess: (data, variables) => {
      toast({
        title: "Image Regenerated",
        description: `Image for variation ${variables.variationId} has been updated.`,
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/scripts/scene-variations", selectedSceneId],
      });
    },
    onError: (error: Error, variables) => {
      toast({
        variant: "destructive",
        title: "Image Regeneration Failed",
        description: `Could not regenerate image for variation ${variables.variationId}: ${error.message}`,
      });
    },
  });

  const handleChangeProductMutation = useMutation({
    mutationFn: async ({
      variationId,
      newProductId,
    }: {
      variationId: number;
      newProductId: number;
    }) => {
      return apiRequest(
        "PUT",
        `/api/variations/${variationId}/change-product`,
        { newProductId },
      );
    },
    onSuccess: (data, variables) => {
      toast({
        title: "Product Changed",
        description: `Product for variation ${variables.variationId} has been updated and image is regenerating.`,
      });
      setIsChangeProductModalOpen(false);
      setChangingProductForVariationId(null);
      queryClient.invalidateQueries({
        queryKey: ["/api/scripts/scene-variations", selectedSceneId],
      });
    },
    onError: (error: Error, variables) => {
      toast({
        variant: "destructive",
        title: "Product Change Failed",
        description: `Could not change product for variation ${variables.variationId}: ${error.message}`,
      });
      setIsChangeProductModalOpen(false);
      setChangingProductForVariationId(null);
    },
  });

  const handleRegenerateImage = (variationId: number) => {
    const newPrompt = editedPrompts[variationId];
    if (newPrompt) {
      regenerateImageMutation.mutate({ variationId, newPrompt });
    } else {
      toast({
        variant: "destructive",
        title: "No Prompt",
        description: "Please enter a prompt to regenerate.",
      });
    }
  };

  const openChangeProductModal = (variationId: number) => {
    setChangingProductForVariationId(variationId);
    setIsChangeProductModalOpen(true);
  };

  const handleProductSelectedFromModal = (newProductId: number) => {
    if (changingProductForVariationId !== null) {
      handleChangeProductMutation.mutate({
        variationId: changingProductForVariationId,
        newProductId,
      });
    }
  };

  if (!selectedSceneId) {
    return (
      <div>
        <h3 className="text-md font-semibold text-secondary mb-3">
          Select a Scene
        </h3>
        <div className="bg-muted p-6 rounded-lg text-center border border-dashed">
          <Info className="h-10 w-10 text-gray-400 mx-auto mb-3" />
          <p className="text-muted-foreground">
            Select a scene marked with the{" "}
            <Info className="inline h-4 w-4 text-primary align-middle" /> icon
            from the "Scene Breakdown" list to view or generate product
            placement options.
          </p>
        </div>
      </div>
    );
  }

  if (selectedSceneId && !currentScene) {
    return (
      <div>
        <h3 className="text-md font-semibold text-secondary mb-3">
          Scene Not Brandable
        </h3>
        <div className="bg-muted p-6 rounded-lg text-center border border-dashed">
          <p className="text-muted-foreground">
            This scene is not currently identified as brandable. Try
            re-analyzing the script or selecting another scene.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading && currentSceneVariations.length === 0) {
    return (
      <div>
        <h3 className="text-md font-semibold text-secondary mb-3">
          Scene {currentScene?.sceneNumber || selectedSceneId}: Product
          Placement Options
        </h3>
        <div className="text-center py-8">
          <Loader2 className="h-8 w-8 text-primary animate-spin mx-auto mb-3" />
          <p className="text-muted-foreground">Loading placement options...</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="overflow-hidden animate-pulse">
              <Skeleton className="h-48 w-full bg-gray-200" />
              <CardContent className="p-3">
                <Skeleton className="h-8 w-8 rounded-full bg-gray-200 inline-block mr-2" />
                <Skeleton className="h-4 w-24 bg-gray-200 inline-block" />
                <Skeleton className="h-10 w-full bg-gray-200 mt-2" />
              </CardContent>
              <CardFooter className="p-3 pt-0 flex justify-end">
                <Skeleton className="h-9 w-32 bg-gray-200" />
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (currentSceneVariations.length === 0 && currentScene && !isLoading) {
    return (
      <div>
        <h3 className="text-md font-semibold text-secondary mb-3">
          Scene {currentScene?.sceneNumber}: Product Placement Options
        </h3>
        <div className="bg-muted p-6 rounded-lg text-center border border-dashed">
          <ImageOff className="h-10 w-10 text-gray-400 mx-auto mb-3" />
          <p className="text-muted-foreground mb-3">
            No placement options generated yet for Scene{" "}
            {currentScene?.sceneNumber}.
          </p>
          <p className="text-sm text-gray-500">
            Use the "Generate Placements" button above to create visual options.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-md font-semibold text-secondary mb-3">
        Scene {currentScene?.sceneNumber}: Product Placement Options
      </h3>
      {currentScene && (
        <>
          <p className="text-sm text-muted-foreground mb-1">
            Reason: {currentScene.brandableReason || "Suitable for placement."}
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            Suggested Categories:{" "}
            {currentScene.suggestedCategories?.join(", ") || "N/A"}
          </p>
          {brandableScenes.length > 0 && scenes.length > 0 && (
            <p className="text-sm text-yellow-800 mb-2 font-medium">
              AI has identified {brandableScenes.length} of {scenes.length}{" "}
              scenes with product placement potential.
            </p>
          )}
        </>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {currentSceneVariations.map((variation) => {
          const videoState = videoGenerationStates[variation.id] || {
            status: "idle",
          };
          const isGeneratingThisVideo =
            videoState.status === "pending" ||
            videoState.status === "generating";

          const isRegeneratingThisImage =
            regenerateImageMutation.isPending &&
            regenerateImageMutation.variables?.variationId === variation.id;
          const currentPromptText =
            editedPrompts[variation.id] ?? variation.geminiPrompt ?? "";
          const isPromptUnchanged =
            currentPromptText === (variation.geminiPrompt || "");
          const isChangingThisProduct =
            handleChangeProductMutation.isPending &&
            handleChangeProductMutation.variables?.variationId === variation.id;

          return (
            <Card
              key={variation.id}
              className={`border-2 rounded-lg overflow-hidden shadow-sm hover:shadow-lg transition-all duration-200 ${variation.isSelected ? "border-blue-400 ring-1 ring-blue-400" : "border-gray-200"} ${isGeneratingThisVideo || isRegeneratingThisImage || isChangingThisProduct ? "opacity-70 cursor-not-allowed" : ""}`}
            >
              <div className="relative aspect-video bg-gray-100">
                <img
                  src={variation.imageUrl}
                  alt={`Option ${variation.variationNumber}: ${variation.productName} in ${currentScene?.heading}`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.src =
                      "https://placehold.co/864x480/grey/white?text=Image+Error";
                    e.currentTarget.alt = "Error loading image";
                  }}
                />
                {(isGeneratingThisVideo ||
                  isRegeneratingThisImage ||
                  isChangingThisProduct) && (
                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white p-4 text-center">
                    <Loader2 className="h-8 w-8 animate-spin mb-2" />
                    <p className="text-sm font-medium">
                      {isChangingThisProduct
                        ? "Changing Product..."
                        : isRegeneratingThisImage
                          ? "Updating Image..."
                          : "Generating Video..."}
                    </p>
                  </div>
                )}
                {videoState.status === "succeeded" && videoState.videoUrl && (
                  <div
                    className="absolute top-2 right-2 bg-green-500 text-white p-1 rounded-full shadow-lg"
                    title="Video Ready"
                  >
                    <Video className="h-4 w-4" />
                  </div>
                )}
                {videoState.status === "failed" && (
                  <div
                    className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full shadow-lg"
                    title={`Video Failed: ${videoState.error || ""}`}
                  >
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                  <span className="text-white text-xs font-semibold">
                    Option {variation.variationNumber}: {variation.productName}
                  </span>
                </div>
              </div>

              <CardContent className="p-3">
                <div className="flex items-center space-x-2 mb-1.5">
                  <div className="w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center overflow-hidden border">
                    <img
                      src={variation.productImageUrl}
                      alt={variation.productName}
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display =
                          "none";
                        const parent = e.currentTarget.parentElement;
                        if (
                          parent &&
                          !parent.querySelector(".placeholder-icon")
                        ) {
                          parent.innerHTML +=
                            '<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400 placeholder-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>';
                        }
                      }}
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium leading-tight">
                      {variation.productName}
                    </p>
                    <Badge variant="outline" className="text-xs py-0.5 px-1.5">
                      {variation.productCategory}
                    </Badge>
                  </div>
                </div>

                <Textarea
                  value={currentPromptText}
                  onChange={(e) =>
                    handlePromptChange(variation.id, e.target.value)
                  }
                  placeholder="Edit prompt for image/video generation..."
                  className="text-xs mt-2 min-h-[60px] max-h-[100px] resize-y"
                  disabled={
                    isGeneratingThisVideo ||
                    isRegeneratingThisImage ||
                    isChangingThisProduct
                  }
                />

                {videoState.status === "failed" ? (
                  <p
                    className="text-xs text-red-600 line-clamp-2 mt-1"
                    title={videoState.error || "Unknown video generation error"}
                  >
                    Video Failed: {videoState.error || "Unknown error"}
                  </p>
                ) : (
                  <p
                    className="text-xs text-gray-600 line-clamp-2 mt-1"
                    title={variation.description}
                  >
                    {variation.description}
                  </p>
                )}
              </CardContent>

              <CardFooter className="p-3 pt-2 grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openChangeProductModal(variation.id)}
                  disabled={
                    isGeneratingThisVideo ||
                    isRegeneratingThisImage ||
                    isChangingThisProduct ||
                    handleChangeProductMutation.isPending
                  }
                >
                  <Replace className="mr-1 h-3.5 w-3.5" />
                  Change Product
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRegenerateImage(variation.id)}
                  disabled={
                    isGeneratingThisVideo ||
                    isRegeneratingThisImage ||
                    isChangingThisProduct ||
                    isPromptUnchanged ||
                    regenerateImageMutation.isPending
                  }
                >
                  {isRegeneratingThisImage ? (
                    <>
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <RefreshCcw className="mr-1 h-4 w-4" />
                      Update Image
                    </>
                  )}
                </Button>

                {videoState.status === "succeeded" && videoState.videoUrl && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() =>
                      onViewVideo(
                        videoState.videoUrl!,
                        `Scene ${currentScene?.sceneNumber} - ${variation.productName}`,
                      )
                    }
                    disabled={
                      isLoading ||
                      isRegeneratingThisImage ||
                      isChangingThisProduct
                    }
                    className="col-span-2"
                  >
                    <PlayCircle className="mr-1 h-4 w-4" />
                    View Video
                  </Button>
                )}

                {videoState.status !== "succeeded" && (
                  <Button
                    variant={
                      videoState.status === "failed" ? "destructive" : "outline"
                    }
                    size="sm"
                    onClick={() => onGenerateVideoRequest(variation.id)}
                    disabled={
                      isGeneratingThisVideo ||
                      isLoading ||
                      isRegeneratingThisImage ||
                      isChangingThisProduct
                    }
                    className="col-span-2"
                  >
                    {isGeneratingThisVideo ? (
                      <>
                        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : videoState.status === "failed" ? (
                      <>
                        <AlertTriangle className="mr-1 h-4 w-4" />
                        Retry Video
                      </>
                    ) : (
                      <>
                        <Video className="mr-1 h-4 w-4" />
                        Generate Video
                      </>
                    )}
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {isChangeProductModalOpen && changingProductForVariationId !== null && (
        <ChangeProductModal
          isOpen={isChangeProductModalOpen}
          onClose={() => {
            setIsChangeProductModalOpen(false);
            setChangingProductForVariationId(null);
          }}
          currentProductId={
            productVariations.find(
              (v) => v.id === changingProductForVariationId,
            )?.productId || 0
          }
          onProductSelect={handleProductSelectedFromModal}
          isSubmitting={handleChangeProductMutation.isPending}
        />
      )}
    </div>
  );
}
