import type { IconName } from "@/components/Icon";
import type { ThemeName } from "./types";

export const DEFAULT_BRAND = "#1f5fd0";
export const DEFAULT_THEME: ThemeName = "clean";

/** The preview colors stay fixed, so each card shows its own theme whichever one is active. */
export const THEMES: {
  value: ThemeName;
  label: string;
  description: string;
  preview: { page: string; accent: string; cards: string[] };
}[] = [
  {
    value: "clean",
    label: "Clean white",
    description: "Bright and simple, like iPhone apps",
    preview: { page: "#f2f2f7", accent: "#007aff", cards: ["#ffffff", "#ffffff"] },
  },
  {
    value: "pastel",
    label: "Colorful pastel",
    description: "White, with soft colored modules",
    preview: { page: "#ffffff", accent: "#7c5cfc", cards: ["#ddf1ff", "#ffe3ec"] },
  },
  {
    value: "black",
    label: "Black and vivid",
    description: "True black, with bright modules",
    preview: { page: "#000000", accent: "#ffffff", cards: ["#0a84ff", "#30d158"] },
  },
  {
    value: "paper",
    label: "Warm paper",
    description: "Calm cream tones, like a notebook",
    preview: { page: "#faf6ee", accent: "#2f5d50", cards: ["#ffffff", "#e9dfcb"] },
  },
  {
    value: "custom",
    label: "My color",
    description: "Dark, built from any color you pick",
    preview: { page: "#0b1f3f", accent: "#1f5fd0", cards: ["#14305c", "#14305c"] },
  },
];

export const MODULE_ICONS: { value: IconName; label: string }[] = [
  { value: "globe", label: "Globe" },
  { value: "work", label: "Briefcase" },
  { value: "car", label: "Car" },
  { value: "heart", label: "Heart" },
  { value: "house", label: "House" },
  { value: "book", label: "Book" },
  { value: "user", label: "Person" },
  { value: "note", label: "Note" },
];

export const MODULE_COLORS = [
  { value: "sky", label: "Blue" },
  { value: "mint", label: "Green" },
  { value: "sun", label: "Yellow" },
  { value: "moon", label: "Purple" },
  { value: "ember", label: "Pink" },
  { value: "mist", label: "Grey" },
];

export const PALETTE = [
  { value: "#1f5fd0", label: "Blue" },
  { value: "#12346e", label: "Dark blue" },
  { value: "#0f8b8d", label: "Teal" },
  { value: "#1f9d55", label: "Green" },
  { value: "#9ccc3c", label: "Lime" },
  { value: "#ffcb2e", label: "Yellow" },
  { value: "#f2812b", label: "Orange" },
  { value: "#d92d3a", label: "Red" },
  { value: "#e84a9a", label: "Pink" },
  { value: "#7a3fe0", label: "Purple" },
  { value: "#56657a", label: "Slate" },
  { value: "#1a1a1a", label: "Black" },
];
