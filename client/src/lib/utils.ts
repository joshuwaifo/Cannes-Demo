import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

export function getFileExtension(filename: string): string {
  return filename.slice(((filename.lastIndexOf(".") - 1) >>> 0) + 2);
}

export function validatePdfFile(file: File): boolean {
  const validExtensions = ['pdf'];
  const fileExtension = getFileExtension(file.name).toLowerCase();
  
  if (!validExtensions.includes(fileExtension)) {
    return false;
  }
  
  // 10MB max size
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    return false;
  }
  
  return true;
}

export function isImageUrl(url: string): boolean {
  const extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'];
  const lowercasedUrl = url.toLowerCase();
  return extensions.some(ext => lowercasedUrl.endsWith(ext));
}

export function extractSceneLocation(sceneHeader: string): string {
  // Common scene header patterns: "INT. LOCATION - TIME" or "EXT. LOCATION - TIME"
  const match = sceneHeader.match(/(?:INT\.|EXT\.)\s+([^-\n]+)(?:\s*-\s*(.+))?/i);
  if (match) {
    const location = match[1].trim();
    const time = match[2]?.trim() || '';
    return time ? `${location} - ${time}` : location;
  }
  return sceneHeader; // Fallback to returning the original text
}

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
