import { BrandableScenesProps } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { getSafeImageUrl } from "@/lib/utils";

export default function BrandableScenes({ 
  brandableScenes,
  productVariations,
  isLoading,
  selectedSceneId,
  onOptionSelect
}: BrandableScenesProps) {
  // Process and validate all URLs in variations
  const sanitizedVariations = productVariations.map(variation => ({
    ...variation,
    imageUrl: getSafeImageUrl(variation.imageUrl),
    productImageUrl: getSafeImageUrl(variation.productImageUrl || '')
  }));
  
  // Filter variations for current scene
  const currentSceneVariations = sanitizedVariations.filter(
    variation => variation.sceneId === selectedSceneId
  );

  if (isLoading) {
    return (
      <div>
        <h3 className="text-md font-semibold text-secondary mb-3">Current Scene: Product Placement Options</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="h-48 w-full" />
              <CardContent className="p-3">
                <div className="flex items-center space-x-2 mb-2">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div>
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-16 mt-1" />
                  </div>
                </div>
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!selectedSceneId || currentSceneVariations.length === 0) {
    return (
      <div>
        <h3 className="text-md font-semibold text-secondary mb-3">
          {selectedSceneId ? "Loading Options..." : "Select a Brandable Scene"}
        </h3>
        <div className="bg-muted p-6 rounded-lg text-center">
          <p className="text-muted-foreground">
            {selectedSceneId 
              ? "Generating product placement options for this scene..." 
              : "Select a scene with the indicator icon to see product placement options."}
          </p>
        </div>
      </div>
    );
  }

  const currentScene = brandableScenes.find(scene => scene.id === selectedSceneId);

  return (
    <div>
      <h3 className="text-md font-semibold text-secondary mb-3">
        {currentScene ? `Scene ${currentScene.sceneNumber}: Product Placement Options` : "Product Placement Options"}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {currentSceneVariations.map((variation) => (
          <Card key={variation.id} className="border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200">
            <div className="relative">
              <img 
                src={variation.imageUrl} 
                alt={`${variation.productName} product placement option`}
                className="w-full h-48 object-cover"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                <span className="text-white text-sm font-bold">Option {variation.variationNumber}: {variation.productName}</span>
              </div>
            </div>
            <CardContent className="p-3">
              <div className="flex items-center space-x-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
                  <img 
                    src={variation.productImageUrl} 
                    alt={variation.productName} 
                    className="w-full h-full object-contain"
                  />
                </div>
                <div>
                  <p className="text-sm font-medium">{variation.productName}</p>
                  <Badge variant="outline" className="text-xs">
                    {variation.productCategory}
                  </Badge>
                </div>
              </div>
              <p className="text-xs text-gray-600">
                {variation.description}
              </p>
            </CardContent>
            <CardFooter className="p-3 pt-0 flex justify-end">
              <Button 
                variant="default" 
                size="sm"
                onClick={() => onOptionSelect(variation.id)}
              >
                Select
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
