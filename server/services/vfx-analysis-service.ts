// server/services/vfx-analysis-service.ts
import { GoogleGenerativeAI, GenerateContentRequest, GenerateContentResult } from "@google/generative-ai";
import type { Scene } from "@shared/schema";
import { updateScene } from "../storage";

// Initialize Gemini AI client
function initializeGenAIClient(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY or GOOGLE_API_KEY environment variable is required");
  }
  return new GoogleGenerativeAI(apiKey);
}

// Extract and clean JSON from AI response string
function extractJsonFromString(str: string): string | null {
  try {
    // Remove markdown code blocks and extra formatting
    let cleanStr = str.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    
    // Look for JSON array pattern
    const jsonMatch = cleanStr.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      let jsonStr = jsonMatch[0];
      
      // Fix various array formatting issues in vfxKeywords
      jsonStr = jsonStr.replace(/"vfxKeywords":\s*"?\[([^\]]*)\]"?/g, (match, content) => {
        try {
          // Extract individual items from the array content
          const items = [];
          let current = '';
          let inQuotes = false;
          let escapeNext = false;
          
          for (let i = 0; i < content.length; i++) {
            const char = content[i];
            
            if (escapeNext) {
              current += char;
              escapeNext = false;
              continue;
            }
            
            if (char === '\\') {
              escapeNext = true;
              continue;
            }
            
            if (char === '"') {
              inQuotes = !inQuotes;
              continue;
            }
            
            if (char === ',' && !inQuotes) {
              if (current.trim()) {
                items.push(current.trim());
              }
              current = '';
              continue;
            }
            
            current += char;
          }
          
          // Add the last item
          if (current.trim()) {
            items.push(current.trim());
          }
          
          // Clean and quote the items
          const cleanItems = items.map(item => {
            const cleaned = item.replace(/^["']+|["']+$/g, '').trim();
            return `"${cleaned}"`;
          });
          
          return `"vfxKeywords": [${cleanItems.join(', ')}]`;
        } catch (error) {
          // Fallback to empty array if parsing fails
          return `"vfxKeywords": []`;
        }
      });
      
      // Clean up common JSON formatting issues
      jsonStr = jsonStr
        .replace(/,\s*}/g, '}')  // Remove trailing commas before }
        .replace(/,\s*]/g, ']')  // Remove trailing commas before ]
        .replace(/([{,]\s*)(\w+):/g, '$1"$2":')  // Quote unquoted keys
        .replace(/:\s*([^"\d\[\{][^,\]\}]*)/g, (match, value) => {
          // Quote unquoted string values
          const trimmed = value.trim();
          if (trimmed !== 'true' && trimmed !== 'false' && trimmed !== 'null') {
            return `: "${trimmed.replace(/"/g, '\\"')}"`;
          }
          return match;
        });
      
      return jsonStr;
    }
    
    // Try to find JSON starting with array bracket
    const startIndex = cleanStr.indexOf('[');
    const endIndex = cleanStr.lastIndexOf(']');
    
    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
      return cleanStr.substring(startIndex, endIndex + 1);
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
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-8b" });
    
    // Import VFX quality tiers and services
    const { VfxQualityTierEnum } = await import("@shared/schema");
    const { generateVFXImage } = await import("./replicate-service");
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
    
    const prompt = `Analyze these script scenes to identify which ones require VFX work.

VFX scenes include: explosions, supernatural elements, impossible physics, weather effects, sci-fi technology, green screen needs, digital environments, superhuman abilities.

NON-VFX scenes include: regular dialogue, normal human actions, real vehicles, natural outdoor scenes, interior scenes with practical props.

${scenesFormatted}

For each scene, respond with exactly this format (one line per scene):
sceneId|isVfxScene|description|keywords

Examples:
123|true|Explosion destroys building|explosion,destruction,debris
124|false||
125|true|Character flies through air|flying,supernatural,gravity

Use this exact format - one line per scene, separated by | characters. For non-VFX scenes, use "false" and leave description and keywords empty but keep the | separators.`;

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
    
    // Parse the simple text format: sceneId|isVfxScene|description|keywords
    const lines = responseText.trim().split('\n');
    const analysisResults: VfxSceneAnalysis[] = [];
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine || !trimmedLine.includes('|')) continue;
      
      const parts = trimmedLine.split('|');
      if (parts.length < 2) continue;
      
      const sceneId = parseInt(parts[0]);
      const isVfxScene = parts[1].toLowerCase() === 'true';
      const vfxDescription = parts[2] || null;
      const vfxKeywords = parts[3] ? parts[3].split(',').map(k => k.trim()) : [];
      
      if (!isNaN(sceneId)) {
        // Find scene number from the scenes array
        const scene = allScenes.find(s => s.id === sceneId);
        const sceneNumber = scene ? scene.sceneNumber : 0;
        
        analysisResults.push({
          sceneId,
          sceneNumber,
          isVfxScene,
          vfxDescription,
          vfxKeywords
        });
      }
    }
    
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