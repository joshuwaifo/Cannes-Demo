/**
 * API routes for the character casting feature
 * Using the modular AI agent pipeline
 */

import { Express, Request, Response, NextFunction } from 'express';
import * as storage from '../storage';
import { Actor as DbActor } from '@shared/schema';
import { 
  extractCharacters,
  predictGenre,
  getCharacterDetails,
  findActorsForCharacter,
  clearCharacterSummaryCache
} from '../services/ai-agents/character-casting-pipeline';
import { filterActorsFromDatabase } from '../services/ai-agents/db-filter-service';
import { ExtractedCharacter } from '../services/ai-agents/shared-types';

// Interface for actor suggestions returned to the client
interface ClientActorSuggestion extends DbActor {
  matchReason: string;
  confidenceScore?: number;
  controversyLevel?: string;
}

export function registerCharacterCastingRoutes(app: Express, apiPrefix: string): void {
  // Get all characters from a script
  app.get(
    `${apiPrefix}/scripts/:scriptId/characters`,
    async (req: Request, res: Response, next: NextFunction) => {
      const scriptIdParam = req.params.scriptId;
      const logPrefix = `[Characters Route for Script ID:${scriptIdParam}]`;
      
      try {
        const scriptId = parseInt(scriptIdParam);
        if (isNaN(scriptId)) {
          return res.status(400).json({ message: "Valid Script ID is required" });
        }
        
        const script = await storage.getScriptById(scriptId);
        if (!script || !script.content) {
          return res.status(404).json({
            message: "Script not found or has no content",
          });
        }
        
        // Extract all characters from the script using the extraction agent
        console.log(`${logPrefix} Extracting characters from script content`);
        const characters: ExtractedCharacter[] = await extractCharacters(script.content);
        
        // Start background prefetch of genre prediction
        try {
          if (characters.length > 0) {
            console.log(`${logPrefix} Starting background genre prediction`);
            // Don't await - let this run in the background
            predictGenre(script.content).catch(error => {
              console.error(`${logPrefix} Background genre prediction error:`, error);
            });
          }
        } catch (prefetchError) {
          // Log but don't fail the request if prefetching fails
          console.error(`${logPrefix} Genre prediction setup error:`, prefetchError);
        }
        
        // Return the extracted characters to the client
        return res.json(characters);
      } catch (error) {
        console.error(`${logPrefix} Error extracting characters:`, error);
        next(error);
      }
    }
  );
  
  // Predict genre for a script
  app.get(
    `${apiPrefix}/scripts/:scriptId/predict-genre`,
    async (req: Request, res: Response, next: NextFunction) => {
      const scriptIdParam = req.params.scriptId;
      const logPrefix = `[Genre Prediction for Script ID:${scriptIdParam}]`;
      
      try {
        const scriptId = parseInt(scriptIdParam);
        if (isNaN(scriptId)) {
          return res.status(400).json({ message: "Valid Script ID is required" });
        }
        
        const script = await storage.getScriptById(scriptId);
        if (!script || !script.content) {
          return res.status(404).json({
            message: "Script not found or has no content",
          });
        }
        
        // Predict genre using the genre agent
        console.log(`${logPrefix} Predicting genre for script`);
        const genrePrediction = await predictGenre(script.content);
        
        if (!genrePrediction) {
          return res.status(404).json({
            message: "Could not predict genre for the script",
          });
        }
        
        return res.json(genrePrediction);
      } catch (error) {
        console.error(`${logPrefix} Error predicting genre:`, error);
        next(error);
      }
    }
  );
  
  // Get character details (pre-fill search criteria)
  app.get(
    `${apiPrefix}/scripts/:scriptId/characters/:characterName/details`,
    async (req: Request, res: Response, next: NextFunction) => {
      const { scriptId: scriptIdParam, characterName } = req.params;
      const logPrefix = `[Character Details for "${characterName}" in Script ID:${scriptIdParam}]`;
      
      try {
        const scriptId = parseInt(scriptIdParam);
        if (isNaN(scriptId)) {
          return res.status(400).json({ message: "Valid Script ID is required" });
        }
        
        if (!characterName) {
          return res.status(400).json({ message: "Character name is required" });
        }
        
        const script = await storage.getScriptById(scriptId);
        if (!script || !script.content) {
          return res.status(404).json({
            message: "Script not found or has no content",
          });
        }
        
        // Get character details using the description agent
        console.log(`${logPrefix} Getting details for character`);
        const characterDetails = await getCharacterDetails(script.content, characterName);
        
        if (!characterDetails) {
          return res.status(404).json({
            message: "Could not get details for the character",
          });
        }
        
        return res.json(characterDetails);
      } catch (error) {
        console.error(`${logPrefix} Error getting character details:`, error);
        next(error);
      }
    }
  );
  
  // Get actor suggestions for a character
  app.get(
    `${apiPrefix}/characters/:characterName/suggest-actors`,
    async (req: Request, res: Response, next: NextFunction) => {
      const characterName = req.params.characterName;
      const {
        scriptId: queryScriptId,
        filmGenre: filmGenreFromUI,
        roleType: roleTypeFromUI,
        budgetTier: budgetTierFromUI,
        gender: genderFilterFromUI,
      } = req.query as {
        scriptId?: string;
        filmGenre?: string;
        roleType?: string;
        budgetTier?: string;
        gender?: string;
      };
      
      const logPrefix = `[Actor Suggestion for "${characterName}" in Script ${queryScriptId}]`;
      
      try {
        if (!characterName) {
          return res.status(400).json({ message: "Character name required" });
        }
        
        if (!queryScriptId) {
          return res.status(400).json({
            message: "Script ID query parameter is required",
          });
        }
        
        const scriptId = parseInt(queryScriptId);
        if (isNaN(scriptId)) {
          return res.status(400).json({ message: "Valid Script ID is required" });
        }
        
        // Get the script content
        const script = await storage.getScriptById(scriptId);
        if (!script || !script.content) {
          return res.status(404).json({
            message: "Script not found or has no content",
          });
        }
        
        // Extract characters from script to get the character details
        const characters = await extractCharacters(script.content);
        const characterDetails = characters.find(c => c.name === characterName.toUpperCase());
        
        if (!characterDetails) {
          return res.status(404).json({
            message: `Character "${characterName}" not found in script`,
          });
        }
        
        // Filter actors from database based on search criteria
        const filteredActors = await filterActorsFromDatabase({
          estimatedAgeRange: characterDetails.estimatedAgeRange,
          gender: genderFilterFromUI,
          roleType: roleTypeFromUI,
          budgetTier: budgetTierFromUI,
          limit: 100
        });
        
        if (filteredActors.length === 0) {
          console.log(`${logPrefix} No actors found after database filtering`);
          return res.json([]);
        }
        
        // Use selection agent to rank actors for this character
        const aiSuggestions = await findActorsForCharacter(
          script.content,
          characterName,
          filteredActors,
          {
            filmGenre: filmGenreFromUI,
            roleType: roleTypeFromUI,
            budgetTier: budgetTierFromUI,
            gender: genderFilterFromUI
          }
        );
        
        if (aiSuggestions.length === 0) {
          console.log(`${logPrefix} No suggestions found for character`);
          return res.json([]);
        }
        
        // Transform AI suggestions to client format with actor details
        const finalSuggestions: ClientActorSuggestion[] = [];
        
        for (const aiSugg of aiSuggestions) {
          // Look up actor details from database
          const directDbActor = await storage.getActorByName(aiSugg.actorName);
          
          if (directDbActor) {
            finalSuggestions.push({
              ...directDbActor,
              matchReason: aiSugg.matchReason,
              confidenceScore: aiSugg.confidenceScore,
              controversyLevel: aiSugg.controversyLevel,
            });
          } else {
            console.warn(
              `${logPrefix} Actor "${aiSugg.actorName}" not found in DB.`,
            );
          }
        }
        
        console.log(`${logPrefix} Returning ${finalSuggestions.length} suggestions`);
        return res.json(finalSuggestions);
      } catch (error) {
        console.error(`${logPrefix} Error processing request:`, error);
        next(error);
      }
    }
  );
  
  // Prefetch character suggestions for a script
  app.post(
    `${apiPrefix}/scripts/:scriptId/prefetch-character-suggestions`,
    async (req: Request, res: Response, next: NextFunction) => {
      const scriptIdParam = req.params.scriptId;
      const logPrefix = `[Prefetch for Script ID:${scriptIdParam}]`;
      
      try {
        const scriptId = parseInt(scriptIdParam);
        if (isNaN(scriptId)) {
          return res.status(400).json({ message: "Valid Script ID is required" });
        }
        
        // Start the prefetch process in the background
        console.log(`${logPrefix} Starting background prefetch`);
        
        // Just return success response immediately
        // The actual prefetch will happen asynchronously
        res.json({ message: "Prefetch initiated" });
        
        // Now do the actual work asynchronously (don't await)
        (async () => {
          try {
            const script = await storage.getScriptById(scriptId);
            if (!script?.content) {
              console.error(`${logPrefix} Script not found or has no content`);
              return;
            }
            
            // Extract characters from script
            const characters = await extractCharacters(script.content);
            
            // Get only a few main characters to prefetch
            const mainCharacters = characters
              .filter(c => c.roleType?.toLowerCase() === 'lead' || c.roleType?.toLowerCase() === 'supporting')
              .slice(0, 5);
            
            console.log(`${logPrefix} Prefetching for ${mainCharacters.length} main characters`);
            
            // Prefetch character details for each main character
            for (const character of mainCharacters) {
              try {
                console.log(`${logPrefix} Prefetching details for "${character.name}"`);
                await getCharacterDetails(script.content, character.name);
              } catch (characterError) {
                console.error(`${logPrefix} Error prefetching for "${character.name}":`, characterError);
                // Continue with next character
              }
            }
            
            console.log(`${logPrefix} Prefetch completed successfully`);
          } catch (error) {
            console.error(`${logPrefix} Error during background prefetch:`, error);
          }
        })().catch(error => {
          console.error(`${logPrefix} Uncaught error in background prefetch:`, error);
        });
      } catch (error) {
        console.error(`${logPrefix} Error setting up prefetch:`, error);
        next(error);
      }
    }
  );
  
  // Clear character cache (for debugging/testing)
  app.post(
    `${apiPrefix}/character-cache/clear`,
    async (req: Request, res: Response, next: NextFunction) => {
      const { characterName } = req.body as { characterName?: string };
      
      try {
        clearCharacterSummaryCache(characterName);
        
        return res.json({
          message: characterName
            ? `Cache cleared for "${characterName}"`
            : "All character caches cleared",
        });
      } catch (error) {
        console.error("Error clearing character cache:", error);
        next(error);
      }
    }
  );
}