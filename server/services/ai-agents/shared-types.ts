/**
 * Shared types for AI agents
 */

export interface ExtractedCharacter {
  name: string;
  estimatedAgeRange?: string;
  gender?: string;
  roleType?: string;
  recommendedBudgetTier?: string;
  description?: string;
}

export interface CharacterSummary {
  name: string;
  description: string;
  keyTraits: string[];
  importanceLevel: number; // 1-10 scale
}

export interface GenrePrediction {
  primaryGenre: string;
  secondaryGenres: string[];
  confidence: number;
}