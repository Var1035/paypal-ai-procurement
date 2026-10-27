import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Sanitizes agent text so it reads naturally like a human message.
 * Strips markdown asterisks (**bold**, *italic*), underscores, and headers.
 */
export function cleanHumanChatText(text?: string | null): string {
  if (!text) return "";
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1") // bold **text**
    .replace(/\*(.*?)\*/g, "$1")     // italic *text*
    .replace(/__(.*?)__/g, "$1")     // bold __text__
    .replace(/_(.*?)_/g, "$1")       // italic _text_
    .replace(/^#+\s+/gm, "")         // headers
    .replace(/`([^`]+)`/g, "$1")     // inline code
    .trim();
}
