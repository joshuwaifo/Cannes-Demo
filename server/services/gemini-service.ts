import Replicate from "replicate";
import { Scene, Product, ProductCategory } from "@shared/schema";

interface GenerationRequest {
  scene: Scene;
  product: Product;
  variationNumber: number;
}

interface GenerationResult {
  imageUrl: string;
  description: string;
}

export async function generateProductPlacement(
  request: GenerationRequest,
): Promise<GenerationResult> {
  try {
    const apiToken = process.env.REPLICATE_API_TOKEN;

    if (!apiToken) {
      throw new Error("REPLICATE_API_TOKEN environment variable is not set");
    }

    const replicate = new Replicate({
      auth: apiToken,
    });

    // Create a prompt describing the scene and product placement
    const prompt = createProductPlacementPrompt(request);

    // Generate image using Replicate's flux-1.1-pro model
    console.log("Generating image with Replicate...");
    console.log("Prompt:", prompt);
    let output;

    try {
      console.log(
        "Calling Replicate API with model: black-forest-labs/flux-1.1-pro",
      );
      output = await replicate.run("black-forest-labs/flux-1.1-pro", {
        input: {
          prompt: prompt,
          width: 1024, // Must be multiple of 32
          height: 576, // Must be multiple of 32
          aspect_ratio: "custom", // Since width and height are provided
          prompt_upsampling: true, // For more creative generation
          output_format: "webp", // Default, can be 'png'
          output_quality: 90, // 0-100, default 80
          safety_tolerance: 2, // 1 (strict) to 6 (permissive), default 2
          seed: Math.floor(Math.random() * Number.MAX_SAFE_INTEGER), // For random seed; use a fixed number for reproducibility
          // No negative_prompt, num_inference_steps, guidance_scale, num_outputs, or scheduler in this schema
        },
      });
      console.log("Replicate API response type:", typeof output);
      console.log(
        "Replicate API raw response:",
        JSON.stringify(output, null, 2),
      );

      // Handle ReadableStream output (common in newer Replicate API responses)
      if (output instanceof ReadableStream) {
        console.log("Got ReadableStream from Replicate, processing stream...");
        const reader = output.getReader();
        let result = "";

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
          console.log(
            "Stream output is not JSON, using as direct URL:",
            result,
          );
          output = [result.trim()];
        }
      }
    } catch (error) {
      console.error("Error running Replicate model:", error);
      throw error;
    }

    // Create a description of the product placement
    const description = createPlacementDescription(request);

    // Return image URL and description
    console.log("Processing Replicate output:", JSON.stringify(output));

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
        console.error("Invalid URL format:", url, error);
        // Return a placeholder image if URL is invalid
        return "https://placehold.co/600x400/gray/white?text=Image+Generation+Failed";
      }
    };

    if (Array.isArray(output) && output.length > 0) {
      console.log("Output is an array, using first element as image URL");

      // Check if we have empty object in array
      if (
        output[0] &&
        typeof output[0] === "object" &&
        Object.keys(output[0]).length === 0
      ) {
        console.log("Empty object returned, using fallback image URL");
        return {
          imageUrl:
            "https://placehold.co/864x480/333/white?text=Image+Generation+Failed",
          description,
        };
      }

      const imageUrl =
        typeof output[0] === "string" ? sanitizeUrl(output[0]) : "";
      return {
        imageUrl,
        description,
      };
    } else if (output && typeof output === "object") {
      // Handle other output formats
      console.log("Output is an object, looking for image URL");
      const anyOutput = output as any;

      // For stability-ai/sdxl style outputs with output property
      if (anyOutput.output) {
        console.log("Found output property:", anyOutput.output);
        const imageUrls = Array.isArray(anyOutput.output)
          ? anyOutput.output
          : [anyOutput.output];
        if (imageUrls.length > 0 && typeof imageUrls[0] === "string") {
          console.log("Using output[0] as image URL:", imageUrls[0]);
          return {
            imageUrl: sanitizeUrl(imageUrls[0]),
            description,
          };
        }
      }

      // For flux-schnell which might return a direct URL string
      if (typeof anyOutput === "string" && anyOutput.startsWith("http")) {
        console.log("Output is a direct URL string:", anyOutput);
        return {
          imageUrl: sanitizeUrl(anyOutput),
          description,
        };
      }

      // For other possibilities
      console.log("Checking all object properties for URLs");
      for (const key in anyOutput) {
        const value = anyOutput[key];
        if (typeof value === "string" && value.startsWith("http")) {
          console.log(`Found URL in property ${key}:`, value);
          return {
            imageUrl: sanitizeUrl(value),
            description,
          };
        }
        if (Array.isArray(value)) {
          const urls = value.filter(
            (item) => typeof item === "string" && item.startsWith("http"),
          );
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
    console.error(
      "Unexpected output format from Replicate:",
      JSON.stringify(output, null, 2),
    );
    throw new Error("No image was generated");
  } catch (error) {
    console.error("Replicate API error:", error);
    throw new Error("Failed to generate product placement image");
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
  promptBase +=
    ", professional lighting, high-quality, film still, 35mm film, cinematic composition, high detail";

  return promptBase;
}

function createPlacementDescription(request: GenerationRequest): string {
  const { scene, product, variationNumber } = request;

  // Define placement templates based on product category
  const templates: Record<ProductCategory, string[]> & { OTHER: string[] } = {
    [ProductCategory.BEVERAGE]: [
      `${product.name} is featured prominently on a table.`,
      `A character is enjoying ${product.name} in the scene.`,
      `Multiple characters are sharing ${product.name} together.`,
    ],
    [ProductCategory.ELECTRONICS]: [
      `A character is using a ${product.name} device.`,
      `A ${product.name} device is placed prominently in the scene.`,
      `Multiple characters are interacting with ${product.name} products.`,
    ],
    [ProductCategory.FOOD]: [
      `Characters are enjoying ${product.name} during a meal.`,
      `${product.name} products are arranged attractively in the scene.`,
      `A character is eating or holding ${product.name} with packaging visible.`,
    ],
    [ProductCategory.AUTOMOTIVE]: [
      `A ${product.name} car is parked on the street or driven by a character.`,
      `A character is entering or exiting a ${product.name} vehicle.`,
      `A ${product.name} vehicle is a focal point in the background.`,
    ],
    [ProductCategory.FASHION]: [
      `A character is wearing or carrying a ${product.name} item.`,
      `A ${product.name} item is being used or worn prominently in the scene.`,
      `Multiple characters are wearing or using ${product.name} products.`,
    ],
    // OTHER is a fallback, so it's handled slightly differently
    OTHER: [
      `${product.name} is subtly placed in the background of the scene.`,
      `${product.name} is visible on a shelf or counter.`,
      `${product.name} is part of the scene's natural environment.`,
    ],
  };

  // Get appropriate template for this category and variation
  const categoryTemplates = templates[product.category] || templates.OTHER;
  const template =
    categoryTemplates[(variationNumber - 1) % categoryTemplates.length];

  return template;
}
