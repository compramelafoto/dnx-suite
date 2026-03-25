/**
 * Paleta neutral compartida.
 * Soporta dark (base) y light mode.
 */

export type ColorMode = "dark" | "light";

const dark = {
  background: {
    primary: "#050505",
    secondary: "#0a0a0a",
    tertiary: "#0f0f0f",
  },
  surface: {
    base: "#141414",
    elevated: "#1a1a1a",
    overlay: "#1f1f1f",
  },
  border: {
    subtle: "#262626",
    default: "#333333",
    strong: "#404040",
  },
  text: {
    primary: "#fafafa",
    secondary: "#a1a1a1",
    tertiary: "#737373",
    disabled: "#525252",
  },
  state: {
    hover: "rgba(255, 255, 255, 0.04)",
    active: "rgba(255, 255, 255, 0.08)",
    focus: "rgba(255, 255, 255, 0.06)",
  },
} as const;

const light = {
  background: {
    primary: "#ffffff",
    secondary: "#f5f5f5",
    tertiary: "#e5e5e5",
  },
  surface: {
    base: "#ffffff",
    elevated: "#fafafa",
    overlay: "#f5f5f5",
  },
  border: {
    subtle: "#e5e5e5",
    default: "#d4d4d4",
    strong: "#a3a3a3",
  },
  text: {
    primary: "#171717",
    secondary: "#525252",
    tertiary: "#737373",
    disabled: "#a3a3a3",
  },
  state: {
    hover: "rgba(0, 0, 0, 0.04)",
    active: "rgba(0, 0, 0, 0.08)",
    focus: "rgba(0, 0, 0, 0.06)",
  },
} as const;

export const colorModes = { dark, light } as const;

/** @deprecated Use colorModes.dark or colorModes[mode] */
export const colors = dark;

export type Colors = typeof dark;
