// // client/src/components/script/SuggestedLocations.tsx
// import { SuggestedLocationsProps, SuggestedLocation as ClientSuggestedLocation } from "@/lib/types"; // Use aliased type
// import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
// import { Skeleton } from "@/components/ui/skeleton";
// import { MapPin, Info, AlertTriangle, FileText } from "lucide-react"; // Added FileText
// import { useQuery } from "@tanstack/react-query";
// import { apiRequest } from "@/lib/queryClient";
// import { Scene } from "@shared/schema"; // For activeScene prop

// export default function SuggestedLocations({ activeScene, projectBudget, isLoading: initialLoading }: SuggestedLocationsProps) {

//   const { data: suggestedLocations = [], isLoading, isError, error } = useQuery<ClientSuggestedLocation[]>({
//     queryKey: ['/api/scenes/suggest-locations', activeScene?.id, projectBudget], // projectBudget in key ensures refetch on change
//     queryFn: async ({ queryKey }) => {
//         const [, sceneId, budget] = queryKey;
//         if (!sceneId) return [];
//         const budgetQueryParam = budget !== undefined ? `budget=${budget}` : "";
//         const res = await apiRequest("GET", `/api/scenes/${sceneId}/suggest-locations?${budgetQueryParam}`);
//         return res.json();
//     },
//     enabled: !!activeScene?.id,
//     staleTime: 5 * 60 * 1000, // Cache for 5 minutes, but will refetch if budget changes due to queryKey
//   });

//   if (!activeScene) {
//     return (
//       <div className="text-center text-sm text-muted-foreground py-4">
//         <Info className="mx-auto h-6 w-6 mb-1" />
//         Select a scene to see AI-powered location suggestions.
//       </div>
//     );
//   }

//   if (isLoading || initialLoading) {
//     return (
//       <div className="space-y-3">
//         {[...Array(3)].map((_, i) => (
//           <Card key={i} className="animate-pulse">
//             <CardHeader>
//               <Skeleton className="h-5 w-3/4" />
//               <Skeleton className="h-4 w-1/2" />
//             </CardHeader>
//             <CardContent>
//               <Skeleton className="h-4 w-full mb-1" />
//               <Skeleton className="h-4 w-5/6" />
//             </CardContent>
//           </Card>
//         ))}
//       </div>
//     );
//   }

//   if (isError) {
//       return (
//           <div className="text-center text-sm text-red-600 py-4">
//               <AlertTriangle className="mx-auto h-6 w-6 mb-1" />
//               Error loading location suggestions: {(error as Error)?.message || "Unknown error"}
//           </div>
//       );
//   }

//   if (suggestedLocations.length === 0) {
//     return (
//       <div className="text-center text-sm text-muted-foreground py-4">
//         <MapPin className="mx-auto h-6 w-6 mb-1" />
//         No specific AI location suggestions available for this scene and budget.
//         <br />
//         Try adjusting the project budget or selecting a different scene.
//       </div>
//     );
//   }

//   return (
//     <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
//       {suggestedLocations.map((loc) => (
//         <Card key={loc.id} className="shadow-sm hover:shadow-md transition-shadow">
//           <CardHeader className="pb-2">
//             <CardTitle className="text-base flex items-center">
//               <MapPin className="h-4 w-4 mr-2 text-primary" />
//               {loc.country}{loc.region && `, ${loc.region}`}
//             </CardTitle>
//             <CardDescription className="text-xs">{loc.incentiveProgram}</CardDescription>
//           </CardHeader>
//           <CardContent className="text-xs space-y-1.5">
//             {loc.matchReason && (
//               <p className="italic"><strong>AI Match Reason:</strong> {loc.matchReason}</p>
//             )}
//             {loc.estimatedIncentiveValue && ( // This is now estimatedIncentiveNotes
//               <div className="mt-1 p-2 bg-blue-50 border border-blue-200 rounded-md">
//                 <p className="font-medium text-blue-700 flex items-center">
//                     <FileText className="h-3.5 w-3.5 mr-1.5 shrink-0" />
//                     Incentive Notes:
//                 </p>
//                 <p className="text-blue-600">{loc.estimatedIncentiveValue}</p>
//               </div>
//             )}
//              {loc.confidenceScore && ( // Display confidence score if available
//                 <p className="text-xs text-muted-foreground">
//                     Match Confidence: {(loc.confidenceScore * 100).toFixed(0)}%
//                 </p>
//             )}
//           </CardContent>
//         </Card>
//       ))}
//     </div>
//   );
// }


// client/src/components/script/SuggestedLocations.tsx
import { SuggestedLocationsProps, ClientSuggestedLocation } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Info, AlertTriangle, FileText } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
// Scene type no longer needed here for props

export default function SuggestedLocations({ scriptId, projectBudget, isLoading: initialLoading }: SuggestedLocationsProps) {

  const { data: suggestedLocations = [], isLoading, isError, error } = useQuery<ClientSuggestedLocation[]>({
    // Updated queryKey to use scriptId and new endpoint structure
    queryKey: ['/api/scripts/suggest-locations', scriptId, { budget: projectBudget, count: 5 }],
    queryFn: async ({ queryKey }) => {
        const [, sId, params] = queryKey as [string, number, { budget?: number, count?: number }]; // Type assertion for params
        if (!sId) return [];

        const queryParams = new URLSearchParams();
        if (params.budget !== undefined) queryParams.append('budget', String(params.budget));
        if (params.count !== undefined) queryParams.append('count', String(params.count));

        const res = await apiRequest("GET", `/api/scripts/${sId}/suggest-locations?${queryParams.toString()}`);
        return res.json();
    },
    enabled: !!scriptId, // Only fetch if there's a scriptId
    staleTime: 5 * 60 * 1000,
  });

  if (!scriptId && !initialLoading) { // Show message if no script is loaded yet, but not during initial page load
    return (
      <div className="text-center text-sm text-muted-foreground py-4">
        <Info className="mx-auto h-6 w-6 mb-1" />
        Load a script to see AI-powered location suggestions.
      </div>
    );
  }

  if (isLoading || initialLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader><Skeleton className="h-5 w-3/4" /><Skeleton className="h-4 w-1/2" /></CardHeader>
            <CardContent><Skeleton className="h-4 w-full mb-1" /><Skeleton className="h-4 w-5/6" /></CardContent>
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
        No specific AI location suggestions available for this script and budget.
        <br />
        Try adjusting the project budget.
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
          <CardContent className="text-xs space-y-1.5">
            {loc.matchReason && ( <p className="italic"><strong>AI Match Reason:</strong> {loc.matchReason}</p> )}
            {loc.estimatedIncentiveValue && (
              <div className="mt-1 p-2 bg-blue-50 border border-blue-200 rounded-md">
                <p className="font-medium text-blue-700 flex items-center"> <FileText className="h-3.5 w-3.5 mr-1.5 shrink-0" /> Incentive Notes: </p>
                <p className="text-blue-600">{loc.estimatedIncentiveValue}</p>
              </div>
            )}
             {loc.confidenceScore && ( <p className="text-xs text-muted-foreground"> Match Confidence: {(loc.confidenceScore * 100).toFixed(0)}% </p> )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}