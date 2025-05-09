// client/src/components/script/CharacterCasting.tsx
import { CharacterCastingProps, ScriptCharacter, ActorSuggestion } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, UserSearch, Info, AlertTriangle, Edit3 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label"; // <<<<<<<<<<<< ADD THIS IMPORT
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import ActorSuggestionCard from "./ActorSuggestionCard";

export default function CharacterCasting({ scriptId, isLoading: isLoadingInitial, filmGenre, projectBudgetTier }: CharacterCastingProps) {
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(null);
  const [customGenre, setCustomGenre] = useState(filmGenre || "");
  const [customRoleType, setCustomRoleType] = useState("lead"); 
  const [customBudgetTier, setCustomBudgetTier] = useState(projectBudgetTier || "medium");

  const { data: characters = [], isLoading: isLoadingCharacters } = useQuery<ScriptCharacter[]>({
    queryKey: ['/api/scripts/characters', scriptId],
    queryFn: async ({ queryKey }) => {
      const [, sId] = queryKey;
      if (!sId) return [];
      const res = await apiRequest("GET", `/api/scripts/${sId}/characters`);
      return res.json();
    },
    enabled: !!scriptId,
  });

  const { data: actorSuggestions = [], isLoading: isLoadingActorSuggestions, refetch: refetchActorSuggestions, isFetching: isFetchingActorSuggestions, isError, error } = useQuery<ActorSuggestion[]>({
    queryKey: ['/api/characters/suggest-actors', selectedCharacter, customGenre, customRoleType, customBudgetTier],
    queryFn: async ({ queryKey }) => {
      const [, charName, genre, roleType, budget] = queryKey;
      if (!charName) return [];
      const params = new URLSearchParams({
        genre: genre as string,
        roleType: roleType as string,
        budgetTier: budget as string,
      });
      const res = await apiRequest("GET", `/api/characters/${charName}/suggest-actors?${params.toString()}`);
      return res.json();
    },
    enabled: !!selectedCharacter,
  });

  const handleSearchActors = () => {
      if (selectedCharacter) {
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
              No characters found in the script, or script content is too short.
          </div>
      )
  }


  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="character-select">Select Character to Cast</Label>
        <Select
          value={selectedCharacter || ""}
          onValueChange={(value) => setSelectedCharacter(value || null)}
        >
          <SelectTrigger id="character-select">
            <SelectValue placeholder="Select a character..." />
          </SelectTrigger>
          <SelectContent>
            {characters.map((char) => (
              <SelectItem key={char.name} value={char.name}>
                {char.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedCharacter && (
        <Card className="bg-muted/50 p-3 border-dashed">
            <CardDescription className="text-xs mb-2">Refine search criteria for "{selectedCharacter}"</CardDescription>
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
                <div className="col-span-2">
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
            <Button onClick={handleSearchActors} size="sm" disabled={isFetchingActorSuggestions}>
                <UserSearch className="h-4 w-4 mr-1"/>
                {isFetchingActorSuggestions ? "Searching..." : "Find Actors"}
            </Button>
        </Card>
      )}

      {selectedCharacter && (isLoadingActorSuggestions || isFetchingActorSuggestions) && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-muted-foreground text-center">Finding actor suggestions for {selectedCharacter}...</p>
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      )}

      {selectedCharacter && !isLoadingActorSuggestions && !isFetchingActorSuggestions && isError && (
          <div className="text-center text-sm text-red-600 py-4 mt-4">
              <AlertTriangle className="mx-auto h-6 w-6 mb-1" />
              Error loading actor suggestions: {(error as Error)?.message || "Unknown error"}
          </div>
      )}

      {selectedCharacter && !isLoadingActorSuggestions && !isFetchingActorSuggestions && !isError && actorSuggestions.length === 0 && (
        <div className="mt-4 text-center text-sm text-muted-foreground py-4">
          <Info className="mx-auto h-6 w-6 mb-1" />
          No actor suggestions found for "{selectedCharacter}" with the current criteria. Try adjusting the filters.
        </div>
      )}

      {selectedCharacter && !isLoadingActorSuggestions && !isFetchingActorSuggestions && !isError && actorSuggestions.length > 0 && (
        <div className="mt-4 space-y-3 max-h-[300px] overflow-y-auto pr-2">
          <h4 className="text-sm font-medium">Suggestions for {selectedCharacter}:</h4>
          {actorSuggestions.map((actor) => (
            <ActorSuggestionCard key={actor.id} actor={actor} />
          ))}
        </div>
      )}
    </div>
  );
}