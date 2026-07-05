import type { PhotographicGearConfidence } from "@/lib/prisma";

const MAKE_ALIASES: Record<string, string> = {
  "nikon corporation": "nikon",
  nikon: "nikon",
  canon: "canon",
  sony: "sony",
  "sony corporation": "sony",
  fujifilm: "fujifilm",
  fuji: "fujifilm",
  "fuji photo film": "fujifilm",
  panasonic: "panasonic",
  lumix: "panasonic",
  olympus: "olympus",
  "om digital": "om-system",
  "om system": "om-system",
  leica: "leica",
  pentax: "pentax",
  ricoh: "ricoh",
  hasselblad: "hasselblad",
  apple: "apple",
  samsung: "samsung",
  dji: "dji",
};

export function normalizeExifToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeGearMake(raw: string | null | undefined): string {
  if (!raw?.trim()) return "desconocido";
  const lower = raw.trim().toLowerCase();
  for (const [alias, canonical] of Object.entries(MAKE_ALIASES)) {
    if (lower === alias || lower.includes(alias)) return canonical;
  }
  return normalizeExifToken(raw);
}

/** Normaliza modelo sin fusionar variantes distintas (p. ej. R6 vs R6 Mark II). */
export function normalizeGearModel(make: string, raw: string | null | undefined): string {
  if (!raw?.trim()) return "desconocido";
  let model = raw.trim().toLowerCase();
  const makeLower = make.toLowerCase();

  if (model.startsWith(makeLower)) {
    model = model.slice(makeLower.length).trim();
  }
  model = model.replace(/^corporation\s+/i, "");
  if (make === "canon") {
    model = model.replace(/^eos\s+/i, "");
  }
  if (make === "nikon") {
    model = model.replace(/^nikkor\s+/i, "");
  }
  model = model.replace(/\s+/g, " ").trim();
  return normalizeExifToken(model) || "desconocido";
}

export function buildGearNormalizedKey(
  photographerId: number,
  kind: "body" | "lens",
  make: string,
  model: string,
  serialNumber?: string | null
): string {
  const parts = [String(photographerId), kind, make, model];
  const serial = serialNumber?.trim();
  if (serial) {
    parts.push(normalizeExifToken(serial));
  }
  return parts.join("|");
}

export function inferGearConfidence(
  make: string | null | undefined,
  model: string | null | undefined,
  serialNumber: string | null | undefined
): PhotographicGearConfidence {
  const hasMake = Boolean(make?.trim()) && make !== "desconocido";
  const hasModel = Boolean(model?.trim()) && model !== "desconocido";
  const hasSerial = Boolean(serialNumber?.trim());

  if (hasMake && hasModel && hasSerial) return "HIGH";
  if (hasMake && hasModel) return "MEDIUM";
  return "LOW";
}

export function hasLensData(lensMake: string | null | undefined, lensModel: string | null | undefined): boolean {
  const make = lensMake?.trim();
  const model = lensModel?.trim();
  if (!make && !model) return false;
  const combined = `${make ?? ""} ${model ?? ""}`.toLowerCase();
  if (combined.includes("unknown") && !model) return false;
  return Boolean(make || model);
}

export function formatGearLabel(make: string, model: string): string {
  const makeDisplay = make.charAt(0).toUpperCase() + make.slice(1);
  const modelDisplay = model.replace(/-/g, " ").toUpperCase();
  return `${makeDisplay} ${modelDisplay}`.trim();
}

/** Evita duplicar marca en UI: "Canon" + "Canon EOS 5D IV" → "Canon EOS 5D IV". */
export function formatEquipmentDisplayLabel(makeRaw: string, modelRaw: string): string {
  const make = makeRaw.trim();
  let model = modelRaw.trim();
  if (make && model.toLowerCase().startsWith(make.toLowerCase())) {
    model = model.slice(make.length).trim();
  }
  return [make, model].filter(Boolean).join(" ");
}
