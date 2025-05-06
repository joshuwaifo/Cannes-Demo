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
    
    // Generate image using Replicate's flux-schnell model
    console.log('Generating image with Replicate...');
    console.log('Prompt:', prompt);
    let output;
    
    try {
      console.log('Calling Replicate API with model: black-forest-labs/flux-schnell');
      output = await replicate.run(
        "black-forest-labs/flux-schnell",
        {
          input: {
            prompt: prompt,
            prompt_upsampling: true,
            width: 864,
            height: 480,
            guidance_scale: 7.5,
            negative_prompt: "poor quality, bad quality, blurry, low resolution, distorted, deformed, unrealistic",
          }
        }
      );
      console.log('Replicate API response type:', typeof output);
      
      // Handle ReadableStream output (common in newer Replicate API responses)
      if (output instanceof ReadableStream) {
        console.log('Got ReadableStream from Replicate, processing stream...');
        const reader = output.getReader();
        let result = '';
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          // Convert Uint8Array to string
          if (value) {
            const chunk = new TextDecoder().decode(value);
            result += chunk;
          }
        }
        
        // Try to parse the result as JSON
        try {
          output = JSON.parse(result);
        } catch (e) {
          console.log('Stream output is not JSON, using as direct URL:', result);
          output = [result.trim()];
        }
      }
    } catch (error) {
      console.error('Error running Replicate model:', error);
      throw error;
    }
    
    // Create a description of the product placement
    const description = createPlacementDescription(request);
    
    // Return image URL and description
    console.log('Processing Replicate output:', JSON.stringify(output));
    
    // Helper function to sanitize URLs
    const sanitizeUrl = (url: string): string => {
      try {
        // Remove any whitespace or newline characters
        url = url.trim();
        
        // Validate if it's a proper URL by creating a URL object
        new URL(url);
        
        // Return the sanitized URL
        return url;
      } catch (error) {
        console.error('Invalid URL format:', url, error);
        // Return a placeholder image if URL is invalid
        return "https://placehold.co/600x400/gray/white?text=Image+Generation+Failed";
      }
    };
    
    if (Array.isArray(output) && output.length > 0) {
      console.log('Output is an array, using first element as image URL');
      
      // Check if we have empty object in array
      if (output[0] && typeof output[0] === 'object' && Object.keys(output[0]).length === 0) {
        console.log('Empty object returned, using fallback image URL');
        return {
          imageUrl: "https://placehold.co/864x480/333/white?text=Image+Generation+Failed",
          description,
        };
      }
      
      const imageUrl = typeof output[0] === 'string' ? sanitizeUrl(output[0]) : '';
      return {
        imageUrl,
        description,
      };
    } else if (output && typeof output === 'object') {
      // Handle other output formats
      console.log('Output is an object, looking for image URL');
      const anyOutput = output as any;
      
      // For stability-ai/sdxl style outputs with output property
      if (anyOutput.output) {
        console.log('Found output property:', anyOutput.output);
        const imageUrls = Array.isArray(anyOutput.output) ? anyOutput.output : [anyOutput.output];
        if (imageUrls.length > 0 && typeof imageUrls[0] === 'string') {
          console.log('Using output[0] as image URL:', imageUrls[0]);
          return {
            imageUrl: sanitizeUrl(imageUrls[0]),
            description,
          };
        }
      } 
      
      // For flux-schnell which might return a direct URL string
      if (typeof anyOutput === 'string' && anyOutput.startsWith('http')) {
        console.log('Output is a direct URL string:', anyOutput);
        return {
          imageUrl: sanitizeUrl(anyOutput),
          description,
        };
      }
      
      // For other possibilities
      console.log('Checking all object properties for URLs');
      for (const key in anyOutput) {
        const value = anyOutput[key];
        if (typeof value === 'string' && value.startsWith('http')) {
          console.log(`Found URL in property ${key}:`, value);
          return {
            imageUrl: sanitizeUrl(value),
            description,
          };
        }
        if (Array.isArray(value)) {
          const urls = value.filter(item => typeof item === 'string' && item.startsWith('http'));
          if (urls.length > 0) {
            console.log(`Found URL in array property ${key}[0]:`, urls[0]);
            return {
              imageUrl: sanitizeUrl(urls[0]),
              description,
            };
          }
        }
      }
    }
    
    // If we reach here, no valid image URL was found
    console.error('Unexpected output format from Replicate:', JSON.stringify(output, null, 2));
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
