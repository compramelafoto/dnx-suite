export type PolaroidPresetId = "p75x10" | "p9x13" | "p15x10";

export type SheetPreset = {
  widthCm: number;
  heightCm: number;
  label: string;
};

export type PolaroidPreset = {
  id: PolaroidPresetId;
  label: string;
  widthCm: number;
  heightCm: number;
  sheet: SheetPreset;
  rotateForSheet: boolean;
  maxPerSheet?: number;
};

export const POLAROID_PRESETS: PolaroidPreset[] = [
  {
    id: "p75x10",
    label: "7.5 × 10 cm",
    widthCm: 7.5,
    heightCm: 10,
    sheet: { widthCm: 10.2, heightCm: 15.2, label: "10.2 × 15.2 cm" },
    rotateForSheet: true,
  },
  {
    id: "p9x13",
    label: "9 × 13 cm",
    widthCm: 9,
    heightCm: 13,
    sheet: { widthCm: 13, heightCm: 18, label: "13 × 18 cm" },
    rotateForSheet: true,
  },
  {
    id: "p15x10",
    label: "10 × 15 cm",
    widthCm: 10,
    heightCm: 15,
    sheet: { widthCm: 10, heightCm: 15, label: "10 × 15 cm" },
    rotateForSheet: false,
    maxPerSheet: 1,
  },
];

export function getPolaroidLayoutCm(preset: PolaroidPreset) {
  if (preset.rotateForSheet) {
    return { widthCm: preset.heightCm, heightCm: preset.widthCm };
  }
  return { widthCm: preset.widthCm, heightCm: preset.heightCm };
}
