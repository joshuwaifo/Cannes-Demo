/**
 * AI Agents Module
 * 
 * This file exports all the AI agents as a unified module to simplify integration
 * with the existing codebase.
 */

// Export all agents from the modular pipeline
export * from './extraction-agent';
export * from './genre-agent';
export * from './description-agent';
export * from './summary-agent';
export * from './selection-agent';
export * from './shared-types';

// Re-export the main pipeline coordinator
export * from './character-casting-pipeline';