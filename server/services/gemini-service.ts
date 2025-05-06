import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { ProductCategory, Scene } from '@shared/schema';

interface BrandableSceneAnalysis {
  sceneId: number;
  reason: string;
  suggestedProducts: ProductCategory[];
}

interface AIAnalysisResponse {
  brandableScenes: BrandableSceneAnalysis[];
}

// Initialize Gemini API with safety settings
function initializeGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
  }
  
  const genAI = new GoogleGenerativeAI(apiKey);
  
  // Configure safety settings
  const safetySettings = [
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
  ];
  
  return { genAI, safetySettings };
}

export async function analyzeBrandableScenes(scenes: Scene[]): Promise<AIAnalysisResponse> {
  try {
    const { genAI, safetySettings } = initializeGeminiClient();
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash-preview-04-17",
      safetySettings
    });
    
    // Create a prompt for analyzing brandable scenes
    const prompt = createAnalysisPrompt(scenes);
    
    // Generate response from Gemini
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Parse the response
    const analysisResponse = parseGeminiResponse(text, scenes);
    
    return {
      brandableScenes: analysisResponse,
    };
  } catch (error) {
    console.error('Gemini API error:', error);
    throw new Error('Failed to analyze scenes with Gemini AI');
  }
}

function createAnalysisPrompt(scenes: Scene[]): string {
  return `
  You are an expert film script analyzer specialized in identifying product placement opportunities. 
  
  I'll provide you with scenes from a film script. Please analyze these scenes and identify the 5 most suitable scenes for product placement based on:
  1. Naturalness of the placement in the setting
  2. Visibility in the scene
  3. Relevance to the characters and plot
  4. Potential screen time
  
  Here are the available product categories:
  - BEVERAGE (coffee, soda, water, alcohol, etc.)
  - ELECTRONICS (phones, computers, TVs, etc.)
  - FOOD (snacks, meals, desserts, etc.)
  - AUTOMOTIVE (cars, motorcycles, etc.)
  - FASHION (clothing, shoes, accessories, etc.)
  - OTHER (any other products)
  
  For each selected scene, provide:
  1. Scene ID number
  2. A brief explanation of why this scene is good for product placement (1-2 sentences)
  3. The most suitable product categories (1-3 categories)
  
  Format your response as a JSON array with this structure:
  [
    {
      "sceneId": 3,
      "reason": "Character drinking coffee provides natural product placement",
      "suggestedProducts": ["BEVERAGE"]
    },
    ...
  ]
  
  Return only valid JSON in your response without any additional comments or formatting.
  
  Here are the scenes:
  
  ${scenes.map(scene => `
  SCENE ${scene.sceneNumber}: ${scene.heading}
  ${scene.content}
  `).join('\n\n')}
  `;
}

function parseGeminiResponse(responseText: string, scenes: Scene[]): BrandableSceneAnalysis[] {
  try {
    // Extract JSON from the response (clean up any markdown code blocks if needed)
    const jsonText = responseText.replace(/```json\n|\n```/g, '');
    const parsedResponse = JSON.parse(jsonText);
    
    if (!Array.isArray(parsedResponse)) {
      throw new Error('Response is not an array');
    }
    
    // Validate and clean up the response
    const validResponse = parsedResponse
      .filter(item => {
        // Validate scene ID exists
        const sceneExists = scenes.some(scene => scene.id === item.sceneId);
        return sceneExists && item.reason && Array.isArray(item.suggestedProducts);
      })
      .map(item => ({
        sceneId: item.sceneId,
        reason: item.reason,
        suggestedProducts: item.suggestedProducts.filter((product: string) => 
          Object.values(ProductCategory).includes(product as ProductCategory)
        )
      }))
      .slice(0, 5); // Limit to 5 scenes
    
    return validResponse;
  } catch (error) {
    console.error('Failed to parse Gemini response:', error, responseText);
    // Return a fallback response
    return scenes.slice(0, 5).map(scene => ({
      sceneId: scene.id,
      reason: "This scene has potential for product placement.",
      suggestedProducts: [ProductCategory.OTHER]
    }));
  }
}
