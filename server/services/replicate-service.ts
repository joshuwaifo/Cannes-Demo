import Replicate from 'replicate';
import { Scene, Product } from '@shared/schema';

interface GenerationRequest {
  scene: Scene;
  product: Product;
  variationNumber: number;
}

interface GenerationResult {
  imageUrl: string;
  description: string;
}

export async function generateProductPlacement(request: GenerationRequest): Promise<GenerationResult> {
  try {
    const apiToken = process.env.REPLICATE_API_TOKEN;
    
    if (!apiToken) {
      throw new Error('REPLICATE_API_TOKEN environment variable is not set');
    }
    
    const replicate = new Replicate({
      auth: apiToken,
    });
    
    // Create a prompt describing the scene and product placement
    const prompt = createProductPlacementPrompt(request);
    
    // Generate image using Replicate's stability-ai/sdxl model
    const output = await replicate.run(
      "stability-ai/sdxl:8beff3369e81422112d93b89ca01426147c99f3fafb8076ca0c1a6227bafc3b9",
      {
        input: {
          prompt: prompt,
          width: 896,
          height: 512,
          num_inference_steps: 30,
          guidance_scale: 7.5,
          negative_prompt: "poor quality, bad quality, blurry, low resolution, distorted, deformed, unrealistic",
        }
      }
    );
    
    // Create a description of the product placement
    const description = createPlacementDescription(request);
    
    // Return image URL and description
    if (Array.isArray(output) && output.length > 0) {
      return {
        imageUrl: output[0],
        description,
      };
    } else if (output && typeof output === 'object' && output.output) {
      // Handle stability-ai/sdxl output format
      const imageUrls = Array.isArray(output.output) ? output.output : [output.output];
      if (imageUrls.length > 0) {
        return {
          imageUrl: imageUrls[0],
          description,
        };
      }
    }
    
    // If we reach here, no valid image URL was found
    console.error('Unexpected output format from Replicate:', output);
    throw new Error('No image was generated');
  } catch (error) {
    console.error('Replicate API error:', error);
    throw new Error('Failed to generate product placement image');
  }
}

function createProductPlacementPrompt(request: GenerationRequest): string {
  const { scene, product, variationNumber } = request;
  
  // Extract scene details
  const sceneLocation = scene.heading;
  const sceneContent = scene.content;
  
  // Create a prompt based on variation number
  let promptBase = `High-quality cinematic film scene, ${sceneLocation}, showing`;
  
  // Customize prompt based on product category and scene
  switch (product.category) {
    case "BEVERAGE":
      if (variationNumber === 1) {
        promptBase += ` a character drinking from a ${product.name} cup or bottle clearly visible in the foreground`;
      } else if (variationNumber === 2) {
        promptBase += ` a ${product.name} bottle or can placed prominently on a table or counter`;
      } else {
        promptBase += ` multiple characters enjoying ${product.name} drinks together`;
      }
      break;
      
    case "ELECTRONICS":
      if (variationNumber === 1) {
        promptBase += ` a character using a ${product.name} device with the logo clearly visible`;
      } else if (variationNumber === 2) {
        promptBase += ` a ${product.name} device placed prominently in the scene`;
      } else {
        promptBase += ` multiple characters interacting with ${product.name} products`;
      }
      break;
      
    case "FOOD":
      if (variationNumber === 1) {
        promptBase += ` a character eating or holding ${product.name} with packaging visible`;
      } else if (variationNumber === 2) {
        promptBase += ` ${product.name} products arranged attractively in the scene`;
      } else {
        promptBase += ` characters sharing and enjoying ${product.name} together`;
      }
      break;
      
    case "AUTOMOTIVE":
      if (variationNumber === 1) {
        promptBase += ` a ${product.name} car prominently parked or driving in the scene`;
      } else if (variationNumber === 2) {
        promptBase += ` a character entering or exiting a ${product.name} vehicle`;
      } else {
        promptBase += ` a ${product.name} vehicle as a focal point in the background`;
      }
      break;
      
    case "FASHION":
      if (variationNumber === 1) {
        promptBase += ` a character wearing ${product.name} with the logo/brand visible`;
      } else if (variationNumber === 2) {
        promptBase += ` a ${product.name} item being used or worn prominently in the scene`;
      } else {
        promptBase += ` multiple characters wearing or using ${product.name} products`;
      }
      break;
      
    default:
      promptBase += ` ${product.name} prominently featured in the scene`;
  }
  
  // Add cinematic quality descriptors
  promptBase += ", professional lighting, high-quality, film still, 35mm film, cinematic composition, high detail";
  
  return promptBase;
}

function createPlacementDescription(request: GenerationRequest): string {
  const { scene, product, variationNumber } = request;
  
  // Create description templates based on product category
  const templates = {
    "BEVERAGE": [
      `Character enters with a ${product.name} in hand. "Sorry I'm late, I had to stop for my ${product.name}."`,
      `Close-up on the ${product.name} as character takes a sip and smiles appreciatively.`,
      `Characters toast with ${product.name} glasses/bottles while celebrating their success.`
    ],
    "ELECTRONICS": [
      `Character works intently on their ${product.name} device, with the logo clearly visible.`,
      `"Let me check that on my ${product.name}," character says, pulling out the device.`,
      `${product.name} device plays an important notification sound, drawing everyone's attention.`
    ],
    "FOOD": [
      `Character opens a package of ${product.name} and offers it to others in the scene.`,
      `"I always keep ${product.name} with me when I travel," character explains, taking a bite.`,
      `Close-up of ${product.name} packaging as character reaches for it during conversation.`
    ],
    "AUTOMOTIVE": [
      `Character pulls up in a sleek ${product.name}, turning heads as they park.`,
      `"Nice ${product.name}," another character comments admiringly as they approach the vehicle.`,
      `Camera pans to reveal a ${product.name} car prominently featured in the background.`
    ],
    "FASHION": [
      `Character adjusts their ${product.name} item, drawing attention to the brand label.`,
      `"Is that the new ${product.name}?" another character asks, clearly impressed.`,
      `Close-up of character's ${product.name} accessory as they confidently enter the scene.`
    ],
    "OTHER": [
      `${product.name} is prominently displayed as character interacts with it.`,
      `Character mentions ${product.name} by name as they use the product.`,
      `Close-up shot focuses on the ${product.name} logo or packaging.`
    ]
  };
  
  // Get appropriate template for this category and variation
  const categoryTemplates = templates[product.category] || templates.OTHER;
  const template = categoryTemplates[(variationNumber - 1) % categoryTemplates.length];
  
  return template;
}
