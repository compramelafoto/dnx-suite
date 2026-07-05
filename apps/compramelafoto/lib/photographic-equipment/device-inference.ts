import type {
  PhotographerDeviceConfidence,
  PhotographerDeviceType,
} from "@/lib/prisma";

const PHONE_MARKERS = [
  "apple",
  "iphone",
  "samsung",
  "xiaomi",
  "motorola",
  "huawei",
  "google pixel",
  "pixel",
];

const DRONE_MARKERS = [
  "dji",
  "hasselblad l2d",
  "fc",
  "mini",
  "mavic",
  "phantom",
  " air",
];

const CAMERA_MARKERS = [
  "canon",
  "nikon",
  "sony",
  "fujifilm",
  "fuji",
  "panasonic",
  "lumix",
  "olympus",
  "om digital",
  "leica",
  "pentax",
];

export function normalizeExifToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildNormalizedKey(
  photographerId: number,
  brand: string,
  model: string,
  serialNumber?: string | null
): string {
  const parts = [
    String(photographerId),
    normalizeExifToken(brand),
    normalizeExifToken(model),
  ];
  const serial = serialNumber?.trim();
  if (serial) {
    parts.push(normalizeExifToken(serial));
  }
  return parts.join("|");
}

export function inferDeviceType(
  make: string | null | undefined,
  model: string | null | undefined
): PhotographerDeviceType {
  const haystack = `${make ?? ""} ${model ?? ""}`.toLowerCase();
  if (!haystack.trim()) return "UNKNOWN";

  if (PHONE_MARKERS.some((m) => haystack.includes(m))) return "PHONE";
  if (DRONE_MARKERS.some((m) => haystack.includes(m))) return "DRONE";
  if (CAMERA_MARKERS.some((m) => haystack.includes(m))) return "CAMERA";
  return "UNKNOWN";
}

export function inferConfidence(
  brand: string | null | undefined,
  model: string | null | undefined,
  serialNumber: string | null | undefined
): PhotographerDeviceConfidence {
  const hasBrand = Boolean(brand?.trim());
  const hasModel = Boolean(model?.trim());
  const hasSerial = Boolean(serialNumber?.trim());

  if (hasBrand && hasModel && hasSerial) return "HIGH";
  if (hasBrand && hasModel) return "MEDIUM";
  return "LOW";
}

export function hasUsefulDeviceData(
  make: string | null | undefined,
  model: string | null | undefined,
  serialNumber: string | null | undefined
): boolean {
  return Boolean(make?.trim() || model?.trim() || serialNumber?.trim());
}
