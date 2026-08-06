import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * `cn` with the design system's type scale registered.
 *
 * The token bridge introduces `text-xxs` and `text-md`, which stock
 * tailwind-merge does not know about. Without this it fails to recognise them
 * as font-size utilities, so `cn("text-md", "text-lg")` would emit both and the
 * cascade — not the call order — would decide the winner.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["xxs", "md"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
