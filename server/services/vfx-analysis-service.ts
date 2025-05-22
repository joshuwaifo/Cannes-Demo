// server/services/vfx-analysis-service.ts
import { GoogleGenerativeAI, GenerateContentRequest, GenerateContentResult } from "@google/generative-ai";
import type { Scene } from "@shared/schema";
import { updateScene } from "../storage";

// Initialize Gemini AI client
function initializeGenAIClient(): GoogleGenerativeAI {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_AI_API_KEY environment variable is required");
  }
  return new GoogleGenerativeAI(apiKey);
}

// Extract JSON from AI response string
function extractJsonFromString(str: string): string | null {
  try {
    // Look for JSON array pattern
    const jsonMatch = str.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return jsonMatch[0];
    }
    
    // Try to find JSON starting with array bracket
    const startIndex = str.indexOf('[');
    const endIndex = str.lastIndexOf(']');
    
    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
      return str.substring(startIndex, endIndex + 1);
    }
    
    return null;
  } catch (error) {
    console.error("Error extracting JSON from string:", error);
    return null;
  }
}

// Interface for AI response
interface VfxSceneAnalysis {
  sceneId: number;
  sceneNumber: number;
  isVfxScene: boolean;
  vfxDescription?: string;
  vfxKeywords?: string[];
}

interface GeminiVfxAnalysisResponse {
  scenes: VfxSceneAnalysis[];
}

// Format scenes for the AI prompt
function formatScenesForPrompt(scenes: Scene[]): string {
  return scenes.map(scene => `
Scene ID: ${scene.id}
Scene Number: ${scene.sceneNumber}
Scene Heading: ${scene.heading}
Scene Content: ${scene.content.substring(0, 1000)}${scene.content.length > 1000 ? '...' : ''}
---`).join('\n');
}

/**
 * Analyze script scenes for VFX requirements using Gemini AI
 */
export async function generateAndStoreVFXTierDetailsForScene(scene: Scene): Promise<void> {
  const logPrefix = `[VFX Tier Gen Scene ${scene.id}]`;
  
  try {
    // Check if scene has VFX description
    if (!scene.vfxDescription || scene.vfxDescription.trim() === '') {
      console.warn(`${logPrefix} Scene has no VFX description, skipping tier generation`);
      return;
    }

    console.log(`${logPrefix} Starting VFX tier detail generation`);
    
    const genAI = initializeGenAIClient();
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    // Import VFX quality tiers and services
    const { VfxQualityTierEnum } = await import("@shared/schema");
    const { generateVFXConceptualImage } = await import("./replicate-service");
    const { createOrUpdateVfxSceneDetail } = await import("../storage");
    
    const vfxKeywords = scene.vfxKeywords || [];
    const qualityTiers = Object.keys(VfxQualityTierEnum) as Array<keyof typeof VfxQualityTierEnum>;
    
    console.log(`${logPrefix} Processing ${qualityTiers.length} quality tiers: ${qualityTiers.join(', ')}`);
    
    // Process each quality tier
    for (const tier of qualityTiers) {
      try {
        console.log(`${logPrefix} Processing ${tier} tier`);
        
        // Generate tier-specific details with Gemini
        const prompt = `You are a VFX supervisor creating detailed cost estimates and element breakdowns.

TASK: Analyze this VFX scene and provide specific details for ${tier} quality tier production.

SCENE DESCRIPTION: ${scene.vfxDescription}
VFX KEYWORDS: ${vfxKeywords.join(', ')}
QUALITY TIER: ${tier}

COST ESTIMATION GUIDELINES:
- LOW tier: Basic VFX, simple compositing (5k-15k USD for short sequence)
- MEDIUM tier: Professional VFX, detailed simulations (20k-75k USD for short sequence) 
- HIGH tier: Photorealistic, complex VFX (100k-500k USD for short sequence)

Please provide a JSON response with this exact structure:
{
  "vfxElementsSummary": "Brief description of VFX elements for this tier",
  "estimatedVfxCost": 25000,
  "costEstimationNotes": "Brief justification for the cost estimate"
}

INSTRUCTIONS:
1. vfxElementsSummary: 1-2 sentences describing what VFX elements would be created for this tier
2. estimatedVfxCost: Specific dollar amount within the tier range
3. costEstimationNotes: Brief explanation of cost factors

Return ONLY the JSON object, no additional text.`;

        const request: GenerateContentRequest = {
          contents: [{
            role: "user",
            parts: [{ text: prompt }]
          }]
        };

        const result: GenerateContentResult = await model.generateContent(request);
        
        if (!result.response?.text) {
          throw new Error(`No response from Gemini for ${tier} tier`);
        }

        const responseText = result.response.text();
        console.log(`${logPrefix} Received ${tier} tier response (${responseText.length} chars)`);
        
        // Extract and parse JSON
        const jsonStr = extractJsonFromString(responseText) || responseText.trim();
        const tierDetails = JSON.parse(jsonStr);
        
        if (!tierDetails.vfxElementsSummary || !tierDetails.estimatedVfxCost || !tierDetails.costEstimationNotes) {
          throw new Error(`Invalid tier details structure for ${tier}`);
        }

        console.log(`${logPrefix} ${tier} tier: ${tierDetails.vfxElementsSummary} (Cost: $${tierDetails.estimatedVfxCost})`);
        
        // Generate concept image
        let conceptualImageUrl = null;
        try {
          console.log(`${logPrefix} Generating concept image for ${tier} tier`);
          const imageResult = await generateVFXConceptualImage({
            vfxDescription: scene.vfxDescription,
            vfxKeywords: vfxKeywords,
            qualityTier: tier,
            vfxElementsSummary: tierDetails.vfxElementsSummary
          });
          
          if (imageResult.success) {
            conceptualImageUrl = imageResult.imageUrl;
            console.log(`${logPrefix} ${tier} tier concept image generated successfully`);
          } else {
            console.warn(`${logPrefix} ${tier} tier concept image generation failed: ${imageResult.error}`);
          }
        } catch (imageError) {
          console.error(`${logPrefix} Error generating ${tier} tier concept image:`, imageError);
        }
        
        // Store tier details in database
        await createOrUpdateVfxSceneDetail(scene.id, tier, {
          vfxElementsSummaryForTier: tierDetails.vfxElementsSummary,
          estimatedVfxCost: parseInt(tierDetails.estimatedVfxCost),
          costEstimationNotes: tierDetails.costEstimationNotes,
          conceptualImageUrl: conceptualImageUrl,
          conceptualVideoUrl: null, // Future enhancement
        });
        
        console.log(`${logPrefix} ${tier} tier details stored successfully`);
        
      } catch (tierError) {
        console.error(`${logPrefix} Error processing ${tier} tier:`, tierError);
        // Continue with other tiers even if one fails
      }
    }
    
    console.log(`${logPrefix} VFX tier detail generation completed`);
    
  } catch (error) {
    console.error(`${logPrefix} Error during VFX tier generation:`, error);
    throw error;
  }
}

export async function analyzeAndStoreScriptVFX(
  scriptId: number,
  scriptContent: string,
  allScenes: Scene[]
): Promise<void> {
  const logPrefix = `[VFX Analysis for Script ${scriptId}]`;
  
  try {
    console.log(`${logPrefix} Starting VFX analysis for ${allScenes.length} scenes`);
    
    const genAI = initializeGenAIClient();
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const scenesFormatted = formatScenesForPrompt(allScenes);
    
    const prompt = `You are a VFX supervisor analyzing a script to identify scenes that require visual effects work.

TASK: Analyze each scene and determine if it contains VFX elements that would require post-production visual effects work.

VFX SCENES typically include:
- Explosions, fire effects, or destruction
- Supernatural/magical elements
- Creatures or monsters (dragons, aliens, etc.)
- Flying vehicles or impossible physics
- Weather effects (storms, tornadoes, etc.)
- Sci-fi technology or energy effects
- Green screen/background replacement needs
- Digital environments or impossible locations
- Superhuman abilities or powers
- Time manipulation or dimensional effects

NON-VFX SCENES typically include:
- Regular dialogue in normal locations
- Standard human actions and interactions
- Real-world vehicles and technology
- Natural outdoor scenes without effects
- Interior scenes with practical props
- Basic stunts that can be done practically

SCENES TO ANALYZE:
${scenesFormatted}

INSTRUCTIONS:
1. For each scene, determine if it requires VFX work
2. If it's a VFX scene, provide a brief 1-2 sentence description of the main VFX elements
3. If it's a VFX scene, list 3-5 specific keywords describing the VFX elements

Return your analysis as a JSON array with this exact structure:
[
  {
    "sceneId": 123,
    "sceneNumber": 1,
    "isVfxScene": true,
    "vfxDescription": "Massive explosion destroys the building with debris flying everywhere",
    "vfxKeywords": ["explosion", "debris", "destruction", "fire", "smoke"]
  },
  {
    "sceneId": 124,
    "sceneNumber": 2,
    "isVfxScene": false
  }
]

IMPORTANT: Return ONLY the JSON array, no additional text or formatting.`;

    const request: GenerateContentRequest = {
      contents: [{
        role: "user",
        parts: [{ text: prompt }]
      }]
    };

    console.log(`${logPrefix} Sending VFX analysis request to Gemini`);
    const result: GenerateContentResult = await model.generateContent(request);
    
    if (!result.response?.text) {
      throw new Error("No response text from Gemini");
    }

    const responseText = result.response.text();
    console.log(`${logPrefix} Received response from Gemini (${responseText.length} chars)`);
    
    // Extract and parse JSON
    const jsonStr = extractJsonFromString(responseText);
    if (!jsonStr) {
      throw new Error("Could not extract JSON from Gemini response");
    }

    const analysisResults: VfxSceneAnalysis[] = JSON.parse(jsonStr);
    console.log(`${logPrefix} Successfully parsed ${analysisResults.length} scene analyses`);

    // Update scenes in database
    let updatedCount = 0;
    let vfxScenesCount = 0;

    for (const analysis of analysisResults) {
      try {
        // Find the corresponding scene
        const scene = allScenes.find(s => s.id === analysis.sceneId || s.sceneNumber === analysis.sceneNumber);
        
        if (!scene) {
          console.warn(`${logPrefix} Could not find scene with ID ${analysis.sceneId} or number ${analysis.sceneNumber}`);
          continue;
        }

        // Prepare update data
        const updateData = {
          isVfxScene: analysis.isVfxScene,
          vfxDescription: analysis.isVfxScene ? analysis.vfxDescription || null : null,
          vfxKeywords: analysis.isVfxScene && analysis.vfxKeywords ? analysis.vfxKeywords : null,
        };

        // Update the scene in database
        await updateScene(scene.id, updateData);
        updatedCount++;
        
        if (analysis.isVfxScene) {
          vfxScenesCount++;
          console.log(`${logPrefix} Scene ${scene.sceneNumber} marked as VFX: ${analysis.vfxDescription}`);
        }

      } catch (updateError) {
        console.error(`${logPrefix} Error updating scene ${analysis.sceneId}:`, updateError);
      }
    }

    console.log(`${logPrefix} VFX analysis complete. Updated ${updatedCount} scenes, ${vfxScenesCount} identified as VFX scenes`);

  } catch (error) {
    console.error(`${logPrefix} Error during VFX analysis:`, error);
    throw error;
  }
}