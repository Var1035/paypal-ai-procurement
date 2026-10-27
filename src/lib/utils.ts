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

export type TimelineFilterOption = "all" | "today" | "this_week" | "this_month" | "this_year";

export const TIMELINE_FILTER_OPTIONS: { id: TimelineFilterOption; label: string }[] = [
  { id: "all", label: "All Time" },
  { id: "today", label: "Today" },
  { id: "this_week", label: "This week" },
  { id: "this_month", label: "This month" },
  { id: "this_year", label: "This Year" },
];

/**
 * Checks if a given timestamp falls within the specified timeline filter.
 * Defaults to "this_year".
 */
export function isWithinTimeline(
  dateInput?: string | Date | null,
  filter: TimelineFilterOption = "this_year"
): boolean {
  if (filter === "all") return true;
  if (!dateInput) return true;

  const itemDate = new Date(dateInput);
  if (isNaN(itemDate.getTime())) return true;

  const now = new Date();

  if (filter === "today") {
    const isSameLocalDay =
      itemDate.getFullYear() === now.getFullYear() &&
      itemDate.getMonth() === now.getMonth() &&
      itemDate.getDate() === now.getDate();
    const isSameUtcDay =
      itemDate.getUTCFullYear() === now.getUTCFullYear() &&
      itemDate.getUTCMonth() === now.getUTCMonth() &&
      itemDate.getUTCDate() === now.getUTCDate();
    return isSameLocalDay || isSameUtcDay;
  }

  if (filter === "this_week") {
    const day = now.getDay();
    const diffToMonday = (day + 6) % 7;
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday, 0, 0, 0, 0);
    return itemDate >= startOfWeek;
  }

  if (filter === "this_month") {
    return (
      (itemDate.getFullYear() === now.getFullYear() && itemDate.getMonth() === now.getMonth()) ||
      (itemDate.getUTCFullYear() === now.getUTCFullYear() && itemDate.getUTCMonth() === now.getUTCMonth())
    );
  }

  if (filter === "this_year") {
    return (
      itemDate.getFullYear() === now.getFullYear() ||
      itemDate.getUTCFullYear() === now.getUTCFullYear()
    );
  }

  return true;
}
