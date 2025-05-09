// client/src/components/script/SuggestedLocations.tsx
import { SuggestedLocationsProps, SuggestedLocation as LocationSuggestionType } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Info, AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export default function SuggestedLocations({ activeScene, projectBudget, isLoading: initialLoading }: SuggestedLocationsProps) {

  const { data: suggestedLocations = [], isLoading, isError, error } = useQuery<LocationSuggestionType[]>({
    queryKey: ['/api/scenes/suggest-locations', activeScene?.id, projectBudget],
    queryFn: async ({ queryKey }) => {
        const [, sceneId, budget] = queryKey;
        if (!sceneId) return [];
        const res = await apiRequest("GET", `/api/scenes/${sceneId}/suggest-locations?budget=${budget || 0}`);
        return res.json();
    },
    enabled: !!activeScene?.id, // Only fetch if there's an active scene
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  if (!activeScene) {
    return (
      <div className="text-center text-sm text-muted-foreground py-4">
        <Info className="mx-auto h-6 w-6 mb-1" />
        Select a scene to see location suggestions.
      </div>
    );
  }

  if (isLoading || initialLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-full mb-1" />
              <Skeleton className="h-4 w-5/6" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (isError) {
      return (
          <div className="text-center text-sm text-red-600 py-4">
              <AlertTriangle className="mx-auto h-6 w-6 mb-1" />
              Error loading location suggestions: {(error as Error)?.message || "Unknown error"}
          </div>
      );
  }

  if (suggestedLocations.length === 0) {
    return (
      <div className="text-center text-sm text-muted-foreground py-4">
        <MapPin className="mx-auto h-6 w-6 mb-1" />
        No specific location suggestions available for this scene yet.
      </div>
    );
  }

  return (
    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
      {suggestedLocations.map((loc) => (
        <Card key={loc.id} className="shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center">
              <MapPin className="h-4 w-4 mr-2 text-primary" />
              {loc.country}{loc.region && `, ${loc.region}`}
            </CardTitle>
            <CardDescription className="text-xs">{loc.incentiveProgram}</CardDescription>
          </CardHeader>
          <CardContent className="text-xs space-y-1">
            <p><strong>Incentive:</strong> {loc.incentiveDetails}</p>
            {loc.estimatedIncentiveValue && (
              <p><strong>Est. Value:</strong> <span className="font-semibold text-green-700">{loc.estimatedIncentiveValue}</span></p>
            )}
            {loc.matchReason && (
              <p className="text-muted-foreground italic"><strong>Reason:</strong> {loc.matchReason}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}