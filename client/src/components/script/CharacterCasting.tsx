// client/src/components/script/CharacterCasting.tsx
import { CharacterCastingProps, ScriptCharacter, ActorSuggestion } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, UserSearch, Info, AlertTriangle, Edit3, UserCircle2, CheckCircle } from "lucide-react"; 
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState, useEffect } from "react";
import ActorSuggestionCard from "./ActorSuggestionCard";

export default function CharacterCasting({ 
  scriptId, 
  isLoading: isLoadingInitial, 
  filmGenre, 
  projectBudgetTier,
  selectedCharacters = [],
  onCharacterSelect
}: CharacterCastingProps) {
  const [selectedCharacterName, setSelectedCharacterName] = useState<string | null>(null);
  const [customGenre, setCustomGenre] = useState(filmGenre || "");
  const [customRoleType, setCustomRoleType] = useState("lead");
  const [customBudgetTier, setCustomBudgetTier] = useState(projectBudgetTier || "medium");
  const [customGender, setCustomGender] = useState<string>("any");

  const { data: characters = [], isLoading: isLoadingCharacters } = useQuery<ScriptCharacter[]>({
    queryKey: ['/api/scripts/characters', scriptId],
    queryFn: async ({ queryKey }) => {
      const [, sId] = queryKey;
      if (!sId) return [];
      const res = await apiRequest("GET", `/api/scripts/${sId}/characters`);
      return res.json();
    },
    enabled: !!scriptId,
    onSuccess: (data) => {
        // If a character was previously selected, try to keep it selected if still present
        if (selectedCharacterName && !data.find(c => c.name === selectedCharacterName)) {
            setSelectedCharacterName(null); // Deselect if no longer in list
        } else if (!selectedCharacterName && data.length > 0) {
            // Optionally auto-select first character if none is selected
            // setSelectedCharacterName(data[0].name);
        }
    }
  });

  // Find the full selected character object to access estimatedAgeRange
  const selectedCharacterObject = characters.find(c => c.name === selectedCharacterName);

  const { data: actorSuggestions = [], isLoading: isLoadingActorSuggestions, refetch: refetchActorSuggestions, isFetching: isFetchingActorSuggestions, isError, error } = useQuery<ActorSuggestion[]>({
    queryKey: ['/api/characters/suggest-actors', selectedCharacterName, customGenre, customRoleType, customBudgetTier, customGender, selectedCharacterObject?.estimatedAgeRange], // Added gender
    queryFn: async ({ queryKey }) => {
      const [, charName, genre, roleType, budget, gender, charAge] = queryKey; // Added gender
      if (!charName) return [];

      // Pass the character object to the backend API if needed,
      // or just the name and let backend refetch character details if necessary
      // For now, sending name and let backend handle fetching character details including age
      const params = new URLSearchParams({
        genre: genre as string,
        roleType: roleType as string,
        budgetTier: budget as string,
        gender: gender as string, // Added gender parameter
      });
      // The character's age is now part of the queryKey and will be implicitly handled by backend
      // if the backend's suggestActorsForCharacterViaGemini is modified to accept it.
      // The actual API call doesn't need to change here if the backend directly uses characterName to fetch its details including age.
      // However, if we want to explicitly pass the character's age:
      // if (charAge) params.append('characterEstimatedAge', charAge as string); // Backend needs to handle this query param

      const res = await apiRequest("GET", `/api/characters/${charName}/suggest-actors?${params.toString()}`);
      return res.json();
    },
    enabled: !!selectedCharacterName, // Only fetch if a character is selected
  });

  // Update customGenre and customBudgetTier if props change
  useEffect(() => {
    if (filmGenre) setCustomGenre(filmGenre);
  }, [filmGenre]);

  useEffect(() => {
    if (projectBudgetTier) setCustomBudgetTier(projectBudgetTier);
  }, [projectBudgetTier]);


  const handleSearchActors = () => {
      if (selectedCharacterName) {
          refetchActorSuggestions();
      }
  };

  if (isLoadingInitial || isLoadingCharacters) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-1/2 mb-2" />
        <Skeleton className="h-10 w-full mb-4" />
        {[...Array(2)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader><Skeleton className="h-5 w-3/5" /></CardHeader>
            <CardContent><Skeleton className="h-4 w-full" /></CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!scriptId) {
    return (
      <div className="text-center text-sm text-muted-foreground py-4">
        <Info className="mx-auto h-6 w-6 mb-1" />
        Script not loaded.
      </div>
    );
  }

  if (characters.length === 0 && !isLoadingCharacters) {
      return (
          <div className="text-center text-sm text-muted-foreground py-4">
              <Users className="mx-auto h-6 w-6 mb-1" />
              No characters found in the script, or script content is too short to extract characters.
          </div>
      )
  }


  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="character-select">Select Character to Cast</Label>
        <Select
          value={selectedCharacterName || ""}
          onValueChange={(value) => setSelectedCharacterName(value || null)}
        >
          <SelectTrigger id="character-select">
            <SelectValue placeholder="Select a character..." />
          </SelectTrigger>
          <SelectContent>
            {characters.map((char) => (
              <SelectItem key={char.name} value={char.name}>
                {char.name} {char.estimatedAgeRange && `(${char.estimatedAgeRange})`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedCharacterObject && ( // Use selectedCharacterObject here
        <Card className="bg-muted/50 p-3 border-dashed">
            <div className="flex justify-between items-center">
                <CardDescription className="text-xs mb-2">Refine search criteria for "{selectedCharacterObject.name}"</CardDescription>
                {selectedCharacterObject.estimatedAgeRange && (
                    <div className="text-xs text-muted-foreground mb-2 flex items-center">
                        <UserCircle2 className="h-3.5 w-3.5 mr-1" />
                        AI Est. Age: {selectedCharacterObject.estimatedAgeRange}
                    </div>
                )}
            </div>
            <div className="grid grid-cols-2 gap-2 mb-2">
                <div>
                    <Label htmlFor="cast-genre" className="text-xs">Genre</Label>
                    <Input id="cast-genre" value={customGenre} onChange={e => setCustomGenre(e.target.value)} placeholder="e.g., Action, Drama"/>
                </div>
                <div>
                    <Label htmlFor="cast-role" className="text-xs">Role Type</Label>
                     <Select value={customRoleType} onValueChange={setCustomRoleType}>
                        <SelectTrigger id="cast-role"><SelectValue/></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="lead">Lead</SelectItem>
                            <SelectItem value="supporting">Supporting</SelectItem>
                            <SelectItem value="cameo">Cameo</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label htmlFor="cast-gender" className="text-xs">Gender</Label>
                     <Select value={customGender} onValueChange={setCustomGender}>
                        <SelectTrigger id="cast-gender"><SelectValue placeholder="Any gender" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="male">Male</SelectItem>
                            <SelectItem value="female">Female</SelectItem>
                            <SelectItem value="non-binary">Non-binary</SelectItem>
                            <SelectItem value="any">Any</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div>
                     <Label htmlFor="cast-budget" className="text-xs">Budget Tier</Label>
                     <Select value={customBudgetTier} onValueChange={setCustomBudgetTier}>
                        <SelectTrigger id="cast-budget"><SelectValue/></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="low">Low (e.g., &lt;$1M)</SelectItem>
                            <SelectItem value="medium">Medium (e.g., $1M - $20M)</SelectItem>
                            <SelectItem value="high">High (e.g., $20M+)</SelectItem>
                            <SelectItem value="any">Any</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <Button onClick={handleSearchActors} size="sm" disabled={isFetchingActorSuggestions || !selectedCharacterName}>
                <UserSearch className="h-4 w-4 mr-1"/>
                {isFetchingActorSuggestions ? "Searching..." : "Find Actors"}
            </Button>
        </Card>
      )}

      {selectedCharacterName && (isLoadingActorSuggestions || isFetchingActorSuggestions) && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-muted-foreground text-center">Finding actor suggestions for {selectedCharacterName}...</p>
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      )}

      {selectedCharacterName && !isLoadingActorSuggestions && !isFetchingActorSuggestions && isError && (
          <div className="text-center text-sm text-red-600 py-4 mt-4">
              <AlertTriangle className="mx-auto h-6 w-6 mb-1" />
              Error loading actor suggestions: {(error as Error)?.message || "Unknown error"}
          </div>
      )}

      {selectedCharacterName && !isLoadingActorSuggestions && !isFetchingActorSuggestions && !isError && actorSuggestions.length === 0 && (
        <div className="mt-4 text-center text-sm text-muted-foreground py-4">
          <Info className="mx-auto h-6 w-6 mb-1" />
          No actor suggestions found for "{selectedCharacterName}" with the current criteria. Try adjusting the filters.
        </div>
      )}

      {selectedCharacterName && !isLoadingActorSuggestions && !isFetchingActorSuggestions && !isError && actorSuggestions.length > 0 && (
        <div className="mt-4 space-y-3 max-h-[300px] overflow-y-auto pr-2">
          <h4 className="text-sm font-medium">
            Suggestions for {selectedCharacterName}:
            {selectedCharacters?.some(c => c.name === selectedCharacterName) && (
              <span className="ml-2 text-green-600 text-xs">(Selected)</span>
            )}
          </h4>
          {actorSuggestions.map((actor) => (
            <ActorSuggestionCard 
              key={actor.id} 
              actor={actor} 
              characterName={selectedCharacterName}
              onSelect={onCharacterSelect}
              isSelected={selectedCharacters?.some(selected => 
                selected.name === selectedCharacterName && selected.actorId === actor.id
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// // client/src/components/script/CharacterCasting.tsx
// import { CharacterCastingProps, ActorSuggestion, ScriptCharacter } from "@/lib/types";
// import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card";
// import { Skeleton } from "@/components/ui/skeleton";
// import { Users, UserSearch, Info, AlertTriangle, Edit3, UserCircle2 } from "lucide-react";
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label";
// import { useQuery } from "@tanstack/react-query";
// import { apiRequest } from "@/lib/queryClient";
// import { useState, useEffect } from "react";
// import ActorSuggestionCard from "./ActorSuggestionCard";

// export default function CharacterCasting({
//   scriptId,
//   isLoadingScript,
//   allScriptCharacters,
//   isLoadingAllScriptCharacters,
//   filmGenre,
//   projectBudgetTier
// }: CharacterCastingProps) {
//   const [selectedCharacterName, setSelectedCharacterName] = useState<string | null>(null);
//   const [customGenre, setCustomGenre] = useState(filmGenre || "");
//   const [customRoleType, setCustomRoleType] = useState("");
//   const [customBudgetTier, setCustomBudgetTier] = useState("");

//   const selectedCharacterObject = allScriptCharacters.find(c => c.name === selectedCharacterName);

//   useEffect(() => {
//     if (selectedCharacterObject) {
//       // Prioritize UI prop if available and different, then AI, then default
//       setCustomRoleType(projectBudgetTier || selectedCharacterObject.roleType || "Unknown");
//       setCustomBudgetTier(projectBudgetTier || selectedCharacterObject.recommendedBudgetTier || "Any");
//     } else {
//       setCustomRoleType(projectBudgetTier || "Unknown");
//       setCustomBudgetTier(projectBudgetTier || "Any");
//     }
//   }, [selectedCharacterObject, projectBudgetTier]); // projectBudgetTier (as UI override source)

//   useEffect(() => {
//     if (filmGenre) setCustomGenre(filmGenre);
//   }, [filmGenre]);

//   const actorSuggestionsQuery = useQuery<ActorSuggestion[]>({
//     queryKey: [
//         '/api/characters/suggest-actors',
//         scriptId,
//         selectedCharacterName,
//         customGenre,
//         customRoleType,
//         customBudgetTier,
//     ],
//     queryFn: async ({ queryKey }) => {
//       const [, sId, charName, genre, roleType, budget] = queryKey;
//       if (!sId || !charName) return [];
//       const params = new URLSearchParams({
//         scriptId: String(sId),
//         genre: genre as string,
//         roleType: roleType as string,
//         budgetTier: budget as string,
//       });
//       const res = await apiRequest("GET", `/api/characters/${charName}/suggest-actors?${params.toString()}`);
//       return res.json();
//     },
//     enabled: !!scriptId && !!selectedCharacterName && !!selectedCharacterObject,
//   });

//   // --- RE-ADD THIS FUNCTION ---
//   const handleSearchActors = () => {
//       if (selectedCharacterName) {
//           actorSuggestionsQuery.refetch();
//       }
//   };
//   // --- END RE-ADD ---

//   if (isLoadingScript || isLoadingAllScriptCharacters) {
//     return (
//       <div className="space-y-3">
//         <Skeleton className="h-8 w-1/2 mb-2" />
//         <Skeleton className="h-10 w-full mb-4" />
//         {[...Array(2)].map((_, i) => (
//           <Card key={i} className="animate-pulse">
//             <CardHeader><Skeleton className="h-5 w-3/5" /></CardHeader>
//             <CardContent><Skeleton className="h-4 w-full" /></CardContent>
//           </Card>
//         ))}
//       </div>
//     );
//   }
//   if (!scriptId) { return <div className="text-center text-sm text-muted-foreground py-4"> <Info className="mx-auto h-6 w-6 mb-1" /> Script not loaded. </div>; }
//   if (allScriptCharacters.length === 0 && !isLoadingAllScriptCharacters) { return ( <div className="text-center text-sm text-muted-foreground py-4"> <Users className="mx-auto h-6 w-6 mb-1" /> No characters found in the script, or script content is too short to extract characters. </div> ) }

//   return (
//     <div className="space-y-4">
//       <div>
//         <Label htmlFor="character-select">Select Character to Cast</Label>
//         <Select
//           value={selectedCharacterName || ""}
//           onValueChange={(value) => setSelectedCharacterName(value || null)}
//         >
//           <SelectTrigger id="character-select">
//             <SelectValue placeholder="Select a character..." />
//           </SelectTrigger>
//           <SelectContent>
//             {allScriptCharacters.map((char) => (
//               <SelectItem key={char.name} value={char.name}>
//                 {char.name} ({char.estimatedAgeRange || 'Age N/A'})
//                  {char.roleType && char.roleType !== 'Unknown' && ` - ${char.roleType}`}
//               </SelectItem>
//             ))}
//           </SelectContent>
//         </Select>
//       </div>

//       {selectedCharacterObject && (
//         <Card className="bg-muted/50 p-3 border-dashed">
//             <div className="flex justify-between items-center mb-2">
//                 <CardDescription className="text-xs">
//                     Profile & Criteria for "{selectedCharacterObject.name}"
//                 </CardDescription>
//                 <div className="text-xs text-muted-foreground flex flex-col items-end">
//                     {selectedCharacterObject.estimatedAgeRange && <span>AI Est. Age: {selectedCharacterObject.estimatedAgeRange}</span>}
//                     {selectedCharacterObject.gender && selectedCharacterObject.gender !== 'Unknown' && <span>AI Est. Gender: {selectedCharacterObject.gender}</span>}
//                 </div>
//             </div>
//             {selectedCharacterObject.description && (
//                  <p className="text-xs italic text-gray-600 mb-2 p-2 bg-slate-100 rounded-md">
//                     <strong>AI Summary:</strong> {selectedCharacterObject.description}
//                  </p>
//             )}
//             <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
//                 <div>
//                     <Label htmlFor="cast-genre" className="text-xs">Film Genre (Preference)</Label>
//                     <Input id="cast-genre" value={customGenre} onChange={e => setCustomGenre(e.target.value)} placeholder="e.g., Action, Drama"/>
//                 </div>
//                 <div>
//                     <Label htmlFor="cast-role" className="text-xs">Role Type (AI: {selectedCharacterObject.roleType || 'N/A'})</Label>
//                      <Select value={customRoleType} onValueChange={setCustomRoleType}>
//                         <SelectTrigger id="cast-role"><SelectValue placeholder="Select role type..."/></SelectTrigger>
//                         <SelectContent>
//                             <SelectItem value="Lead">Lead</SelectItem>
//                             <SelectItem value="Supporting">Supporting</SelectItem>
//                             <SelectItem value="Cameo">Cameo</SelectItem>
//                             <SelectItem value="Unknown">Unknown/Any</SelectItem>
//                         </SelectContent>
//                     </Select>
//                 </div>
//                 <div className="sm:col-span-2">
//                      <Label htmlFor="cast-budget" className="text-xs">Budget Tier (AI: {selectedCharacterObject.recommendedBudgetTier || 'N/A'})</Label>
//                      <Select value={customBudgetTier} onValueChange={setCustomBudgetTier}>
//                         <SelectTrigger id="cast-budget"><SelectValue placeholder="Select budget tier..."/></SelectTrigger>
//                         <SelectContent>
//                             <SelectItem value="Low">Low (e.g., &lt;$1M)</SelectItem>
//                             <SelectItem value="Medium">Medium (e.g., $1M - $20M)</SelectItem>
//                             <SelectItem value="High">High (e.g., $20M+)</SelectItem>
//                             <SelectItem value="Any">Any</SelectItem>
//                         </SelectContent>
//                     </Select>
//                 </div>
//             </div>
//             {/* This button now correctly calls handleSearchActors */}
//             <Button onClick={handleSearchActors} size="sm" disabled={actorSuggestionsQuery.isFetching || !selectedCharacterName}>
//                 <UserSearch className="h-4 w-4 mr-1"/>
//                 {actorSuggestionsQuery.isFetching ? "Searching..." : "Find Actors"}
//             </Button>
//         </Card>
//       )}

//       {selectedCharacterName && (actorSuggestionsQuery.isLoading || actorSuggestionsQuery.isFetching) && ( <div className="mt-4 space-y-3"> <p className="text-sm text-muted-foreground text-center">Finding actor suggestions for {selectedCharacterName}...</p> {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)} </div> )}
//       {selectedCharacterName && !actorSuggestionsQuery.isLoading && !actorSuggestionsQuery.isFetching && actorSuggestionsQuery.isError && ( <div className="text-center text-sm text-red-600 py-4 mt-4"> <AlertTriangle className="mx-auto h-6 w-6 mb-1" /> Error loading actor suggestions: {(actorSuggestionsQuery.error as Error)?.message || "Unknown error"} </div> )}
//       {selectedCharacterName && !actorSuggestionsQuery.isLoading && !actorSuggestionsQuery.isFetching && !actorSuggestionsQuery.isError && actorSuggestionsQuery.data?.length === 0 && ( <div className="mt-4 text-center text-sm text-muted-foreground py-4"> <Info className="mx-auto h-6 w-6 mb-1" /> No actor suggestions found for "{selectedCharacterName}" with the current criteria. Try adjusting the filters. </div> )}
//       {selectedCharacterName && !actorSuggestionsQuery.isLoading && !actorSuggestionsQuery.isFetching && !actorSuggestionsQuery.isError && actorSuggestionsQuery.data && actorSuggestionsQuery.data.length > 0 && ( <div className="mt-4 space-y-3 max-h-[300px] overflow-y-auto pr-2"> <h4 className="text-sm font-medium">Suggestions for {selectedCharacterName}:</h4> {actorSuggestionsQuery.data.map((actor) => ( <ActorSuggestionCard key={actor.id} actor={actor} /> ))} </div> )}
//     </div>
//   );
// }