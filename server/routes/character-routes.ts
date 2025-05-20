/**
 * Character Routes
 * 
 * This file contains the API routes for character-related functionality.
 */

import { Express, Request, Response, NextFunction } from 'express';
import * as storage from '../storage';
import { generateCharacterSummary, getCachedSummary } from '../services/character-summary-service';
import { ActorAISuggestion, suggestActorsForCharacterViaGemini } from '../services/ai-suggestion-service';

/**
 * Register all character-related routes
 */
export const registerCharacterRoutes = (app: Express, apiPrefix: string): void => {
  
  // Get character summary from script
  app.get(
    `${apiPrefix}/characters/:characterName/summary`,
    async (req: Request, res: Response, next: NextFunction) => {
      const { characterName } = req.params;
      const { scriptId } = req.query;
      const logPrefix = `[Character Summary for "${characterName}"]`;
      
      try {
        if (!characterName) {
          return res.status(400).json({ message: "Character name is required" });
        }
        
        if (!scriptId) {
          return res.status(400).json({ 
            message: "Script ID query parameter is required" 
          });
        }
        
        const scriptIdNum = parseInt(scriptId as string);
        if (isNaN(scriptIdNum)) {
          return res.status(400).json({ message: "Valid Script ID is required" });
        }
        
        // Check cache first, then generate if not cached
        let characterSummary = getCachedSummary(characterName, scriptIdNum);
        
        if (!characterSummary) {
          console.log(`${logPrefix} No cached summary found. Generating new summary...`);
          characterSummary = await generateCharacterSummary(scriptIdNum, characterName);
        }
        
        return res.json({ summary: characterSummary });
      } catch (error) {
        console.error(`${logPrefix} Error:`, error);
        next(error);
      }
    }
  );
  
  // Get actor suggestions for a character
  app.get(
    `${apiPrefix}/characters/:characterName/suggest-actors`,
    async (req: Request, res: Response, next: NextFunction) => {
      const { characterName } = req.params;
      const {
        scriptId,
        genre,
        roleType,
        budgetTier,
        gender,
        actorAge,
      } = req.query as {
        scriptId?: string;
        genre?: string;
        roleType?: string;
        budgetTier?: string;
        gender?: string;
        actorAge?: string;
      };
      
      const logPrefix = `[Actor Suggestion for "${characterName}"]`;
      
      try {
        if (!characterName) {
          return res.status(400).json({ message: "Character name is required" });
        }
        
        if (!scriptId) {
          return res.status(400).json({ 
            message: "Script ID query parameter is required" 
          });
        }
        
        const scriptIdNum = parseInt(scriptId);
        if (isNaN(scriptIdNum)) {
          return res.status(400).json({ message: "Valid Script ID is required" });
        }
        
        // Get script content
        const script = await storage.getScriptById(scriptIdNum);
        if (!script || !script.content) {
          return res.status(404).json({ 
            message: "Script not found or has no content" 
          });
        }
        
        // First get character summary
        let characterSummary = getCachedSummary(characterName, scriptIdNum);
        if (!characterSummary) {
          console.log(`${logPrefix} No cached summary found. Generating new summary...`);
          characterSummary = await generateCharacterSummary(scriptIdNum, characterName);
        }
        
        // Determine appropriate age range for DB query
        let minBirthYear: number | undefined = undefined;
        let maxBirthYear: number | undefined = undefined;
        
        // Parse actor age from query parameter (numerical input field)
        const parsedAge = actorAge ? parseInt(actorAge) : null;
        if (parsedAge && !isNaN(parsedAge) && parsedAge > 0) {
          const currentYear = new Date().getFullYear();
          // Allow for a +/- 5 year range around the target age
          minBirthYear = currentYear - (parsedAge + 5);
          maxBirthYear = currentYear - (parsedAge - 5);
        }
        
        // Gender determination for DB query
        let genderForDbFilter: string | undefined = undefined;
        if (gender && gender.toLowerCase() !== "any") {
          genderForDbFilter = gender;
        }
        
        // Pre-filter actors based on criteria
        const preFilteredActors = await storage.getActorsForAISuggestionByCriteria({
          minBirthYear,
          maxBirthYear,
          gender: genderForDbFilter,
          limit: 100,
        });
        
        if (preFilteredActors.length === 0) {
          console.log(`${logPrefix} No actors found matching the specified criteria`);
          return res.json([]);
        }
        
        // Create a simple mock character object for the AI service
        const mockCharacter = {
          name: characterName,
          description: characterSummary,
        };
        
        // Get actor suggestions from AI
        const aiSuggestions = await suggestActorsForCharacterViaGemini(
          script.content,
          mockCharacter as any, // Temporary type casting
          preFilteredActors,
          {
            filmGenre: genre || "Any",
            roleType: roleType || "Unknown",
            budgetTier: budgetTier || "Any",
            gender: gender || "Any",
          },
          5
        );
        
        if (aiSuggestions.length === 0) {
          return res.json([]);
        }
        
        // Transform AI suggestions to client format with actor details
        const finalSuggestions = [];
        
        for (const aiSugg of aiSuggestions) {
          // Look up actor details from database
          const actorDetails = await storage.getActorByName(aiSugg.actorName);
          
          if (actorDetails) {
            finalSuggestions.push({
              ...actorDetails,
              matchReason: aiSugg.matchReason,
              controversyLevel: aiSugg.controversyLevel,
            });
          } else {
            console.warn(`${logPrefix} Actor "${aiSugg.actorName}" not found in DB.`);
          }
        }
        
        return res.json(finalSuggestions);
      } catch (error) {
        console.error(`${logPrefix} Error:`, error);
        next(error);
      }
    }
  );
};