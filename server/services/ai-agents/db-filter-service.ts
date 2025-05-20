/**
 * Database Filter Service for Character Casting
 * 
 * This service filters actors from the database based on search criteria
 * without using AI - just pure logic-based filtering.
 */

import * as storage from '../../storage';
import { Actor as DbActor } from '@shared/schema';

interface FilterCriteria {
  estimatedAgeRange?: string;
  gender?: string;
  roleType?: string;
  budgetTier?: string;
  limit?: number;
}

/**
 * Filter actors from the database based on search criteria
 */
export async function filterActorsFromDatabase(criteria: FilterCriteria): Promise<DbActor[]> {
  console.log('[DB Filter] Filtering actors with criteria:', JSON.stringify(criteria));
  
  try {
    // Process gender filter - only filter if specified and not "any"
    let genderFilter: string | undefined = undefined;
    if (criteria.gender && 
        !['any', 'all', 'unknown'].includes(criteria.gender.toLowerCase())) {
      genderFilter = criteria.gender;
    }
    
    // Get actors from database using storage service
    const filteredActors = await storage.getActorsForAISuggestionByCriteria({
      estimatedAgeRange: criteria.estimatedAgeRange,
      gender: genderFilter,
      limit: criteria.limit || 100
    });
    
    console.log(`[DB Filter] Found ${filteredActors.length} actors matching criteria`);
    return filteredActors;
  } catch (error) {
    console.error('[DB Filter] Error filtering actors:', error);
    return [];
  }
}