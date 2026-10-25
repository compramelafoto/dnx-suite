/**
 * Varias cámaras (FOTOFFICE, «Mi estudio», 16/10/2026). PURO.
 *
 * La cámara principal de siempre (`primaryCamera*` del perfil) es la cámara #1, con id "primary": sus
 * datos no se mueven ni se duplican, así un perfil viejo (y CompraMeLaFoto) sigue igual. Las demás van
 * en `profile.cameras` (opcional). Cada concepto puede elegir una cámara (`cameraId`) y si sus disparos
 * son por unidad (carnet: 3 disparos × cantidad) o por trabajo (evento).
 */
import { parseCuantoCobroAmount } from "./amount-format";
import { CAMERA_BODY_PRESETS, getCameraCostPerShot, getCameraDisplayLabel, resolveShutterRating } from "./camera-equipment";
import type { CuantoCobroProfileInput } from "./types";

export const PRIMARY_CAMERA_ID = "primary";
export const MAX_EXTRA_CAMERAS = 10;

/** Una cámara adicional del perfil (la #1 sigue en los campos `primaryCamera*`). */
export type CuantoCobroCamera = {
  id: string;
  name: string;
  /** Un preset de `CAMERA_BODY_PRESETS` (o "custom"/"" para cargar la vida útil a mano). */
  presetId: string;
  /** Vida útil del obturador en disparos. Vacío = la del preset. */
  shutterRating: string;
  currentShutterCount: string;
  replacementValue: string;
};

export type ResolvedCamera = {
  id: string;
  name: string;
  shutterRating: number;
  replacementValue: number;
  /** Valor de reposición / vida útil. null si falta alguno. */
  costPerShot: number | null;
};

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

const str = (v: unknown, max = 40): string => (typeof v === "string" ? v : typeof v === "number" && Number.isFinite(v) ? String(v) : "").slice(0, max);

/** Normaliza la lista guardada (JSON). Sin ids repetidos ni el id reservado de la principal. */
export function normalizeCameras(raw: unknown): CuantoCobroCamera[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>([PRIMARY_CAMERA_ID]);
  const out: CuantoCobroCamera[] = [];
  for (const c of raw) {
    if (!isObject(c) || typeof c.id !== "string" || !c.id || seen.has(c.id)) continue;
    seen.add(c.id);
    out.push({
      id: c.id.slice(0, 64),
      name: str(c.name, 80),
      presetId: str(c.presetId),
      shutterRating: str(c.shutterRating, 12),
      currentShutterCount: str(c.currentShutterCount, 12),
      replacementValue: str(c.replacementValue, 20),
    });
    if (out.length >= MAX_EXTRA_CAMERAS) break;
  }
  return out;
}

export function createCamera(overrides: Partial<CuantoCobroCamera> = {}): CuantoCobroCamera {
  return {
    id: `cam-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name: "",
    presetId: "",
    shutterRating: "",
    currentShutterCount: "",
    replacementValue: "",
    ...overrides,
  };
}

function resolveExtra(camera: CuantoCobroCamera): ResolvedCamera {
  const manual = parseCuantoCobroAmount(camera.shutterRating) ?? 0;
  const preset = CAMERA_BODY_PRESETS.find((p) => p.id === camera.presetId);
  const shutterRating = manual > 0 ? manual : preset && preset.id !== "custom" ? preset.shutterRating : 0;
  const replacementValue = parseCuantoCobroAmount(camera.replacementValue) ?? 0;
  return {
    id: camera.id,
    name: camera.name.trim() || preset?.label || "Otra cámara",
    shutterRating,
    replacementValue,
    costPerShot: shutterRating > 0 && replacementValue > 0 ? replacementValue / shutterRating : null,
  };
}

/** Todas las cámaras del perfil: la principal (#1) y las demás. */
export function resolveProfileCameras(profile: CuantoCobroProfileInput): ResolvedCamera[] {
  const primary: ResolvedCamera = {
    id: PRIMARY_CAMERA_ID,
    name: getCameraDisplayLabel(profile),
    shutterRating: resolveShutterRating(profile),
    replacementValue: parseCuantoCobroAmount(profile.primaryCameraReplacementValue) ?? 0,
    costPerShot: getCameraCostPerShot(profile),
  };
  return [primary, ...normalizeCameras(profile.cameras).map(resolveExtra)];
}
