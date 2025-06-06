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
  
  // Track if prefetch has been initiated
  const [prefetchInitiated, setPrefetchInitiated] = useState<boolean>(false);

  // Get all characters from the script
  const { data: characters = [], isLoading: isLoadingCharacters } = useQuery<ScriptCharacter[]>({
    queryKey: ['/api/scripts/characters', scriptId],
    queryFn: async ({ queryKey }) => {
      const [, sId] = queryKey as [string, number | null];
      if (!sId) return [];
      const res = await apiRequest("GET", `/api/scripts/${sId}/characters`);
      return res.json();
    },
    enabled: !!scriptId,
    onSuccess: (data) => {
      // Check if selected character still exists in the new data
      if (selectedCharacterName && !data.find(c => c.name === selectedCharacterName)) {
        setSelectedCharacterName(null);
      }
      
      // Trigger prefetch of character suggestions when characters are first loaded
      // This happens in the background and makes subsequent character selections faster
      if (data.length > 0 && !prefetchInitiated && scriptId) {
        setPrefetchInitiated(true);
        triggerPrefetch(scriptId);
      }
    }
  });

  // Function to trigger background prefetch of all character suggestions
  const triggerPrefetch = async (sId: number) => {
    try {
      console.log("[CharacterCasting] Starting prefetch for all characters...");
      const res = await apiRequest("POST", `/api/scripts/${sId}/prefetch-character-suggestions`);
      console.log("[CharacterCasting] Prefetch initiated successfully");
    } catch (error) {
      console.error("[CharacterCasting] Error initiating prefetch:", error);
      // Non-critical error, no need to show to user
    }
  };

  const selectedCharacterObject = characters.find(c => c.name === selectedCharacterName);

  // Use React Query to get actor suggestions for the selected character
  const { 
    data: actorSuggestions = [], 
    isLoading: isLoadingActorSuggestions, 
    refetch: refetchActorSuggestions, 
    isFetching: isFetchingActorSuggestions, 
    isError, 
    error 
  } = useQuery<ActorSuggestion[]>({
    queryKey: [
      '/api/characters/suggest-actors',
      selectedCharacterName,
      scriptId,
      customGenre,
      customRoleType,
      customBudgetTier,
      customGender,
      selectedCharacterObject?.estimatedAgeRange
    ],
    queryFn: async ({ queryKey }) => {
      const [, charName, currentScriptId, genre, roleType, budget, gender, charAge] = queryKey;
      if (!charName || !currentScriptId) return [];

      // Use the optimized endpoint with caching
      const params = new URLSearchParams({
        scriptId: String(currentScriptId),
        genre: genre as string,
        roleType: roleType as string,
        budgetTier: budget as string,
        gender: gender as string,
      });

      const res = await apiRequest("GET", `/api/characters/${charName}/suggest-actors?${params.toString()}`);
      return res.json();
    },
    enabled: !!selectedCharacterName && !!scriptId,
    // Add shorter staleTime to take advantage of server-side caching
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
  });

  // Keep custom criteria in sync with props
  useEffect(() => {
    if (filmGenre) setCustomGenre(filmGenre);
  }, [filmGenre]);

  useEffect(() => {
    if (projectBudgetTier) setCustomBudgetTier(projectBudgetTier);
  }, [projectBudgetTier]);

  // Handler for manual search
  const handleSearchActors = () => {
    if (selectedCharacterName && scriptId) {
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
        Script not loaded or ID missing.
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

      {selectedCharacterObject && (
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
            <Button onClick={handleSearchActors} size="sm" disabled={isFetchingActorSuggestions || !selectedCharacterName || !scriptId}>
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