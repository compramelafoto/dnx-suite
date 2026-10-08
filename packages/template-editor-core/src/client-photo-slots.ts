/**
 * Huecos de "foto del cliente" en una plantilla V2, y el recorte de la foto dentro del hueco.
 *
 * Un hueco es un bloque de imagen atado a la variable `photo_<n>`. El número ordena el armado
 * automático: la primera foto que eligió el cliente va a `photo_1`, la segunda a `photo_2`. Si
 * dos bloques usan la misma variable (la misma foto en el frente y en el dorso) reciben la misma
 * foto.
 *
 * El recorte vive acá, isomorfo, porque lo usan dos lados que tienen que dar idéntico: la
 * pantalla donde el fotógrafo encuadra (CSS) y la exportación que va a la imprenta (`sharp`).
 * Si cada lado hiciera su cuenta, lo aprobado y lo impreso podrían no coincidir.
 */

export const CLIENT_PHOTO_VARIABLE_PATTERN = /^photo_(\d+)$/;

/** Encuadre de una foto en su hueco. `zoom` ≥ 1; `x` e `y` entre -1 y 1 (0 = centrada). */
export type PhotoCrop = { zoom: number; x: number; y: number };

export const DEFAULT_PHOTO_CROP: PhotoCrop = { zoom: 1, x: 0, y: 0 };

export const PHOTO_CROP_MAX_ZOOM = 4;

export type ClientPhotoSlot = {
  blockId: string;
  /** El `n` de `photo_<n>`. */
  slotNumber: number;
  variableKey: string;
  pageIndex: number;
  /** Para mostrar: la etiqueta de `metaJson.photoInputs` si la hay, si no "Foto n". */
  label: string;
  width: number;
  height: number;
};

type BlockLike = {
  id: string;
  type: string;
  pageIndex?: number | null;
  configJson?: unknown;
  /** Las filas de base traen las medidas sueltas; el documento del editor, dentro de `layout`. */
  width?: number;
  height?: number;
  layout?: { width?: number; height?: number };
};

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

/** La variable a la que está atado un bloque de imagen, o null. */
export function imageBlockVariableKey(configJson: unknown): string | null {
  const config = asRecord(configJson);
  const source = asRecord(config.source);
  const key =
    typeof source.variableKey === "string" && source.variableKey.trim()
      ? source.variableKey.trim()
      : typeof config.variableKey === "string" && config.variableKey.trim()
        ? config.variableKey.trim()
        : null;
  return key;
}

/** El número de hueco de un bloque, o null si no es un hueco de foto del cliente. */
export function clientPhotoSlotNumber(block: Pick<BlockLike, "type" | "configJson">): number | null {
  if (block.type !== "IMAGE" && block.type !== "PHOTO") return null;
  const key = imageBlockVariableKey(block.configJson);
  if (!key) return null;
  const match = CLIENT_PHOTO_VARIABLE_PATTERN.exec(key);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function labelsFromMeta(metaJson: unknown): Map<string, string> {
  const labels = new Map<string, string>();
  const inputs = asRecord(metaJson).photoInputs;
  if (!Array.isArray(inputs)) return labels;
  for (const input of inputs) {
    const row = asRecord(input);
    if (typeof row.slotKey === "string" && typeof row.label === "string" && row.label.trim()) {
      labels.set(row.slotKey, row.label.trim());
    }
  }
  return labels;
}

/** Los huecos de foto del cliente de una plantilla, ordenados por número y cara. */
export function listClientPhotoSlots(blocks: BlockLike[], metaJson?: unknown): ClientPhotoSlot[] {
  const labels = labelsFromMeta(metaJson);
  const slots: ClientPhotoSlot[] = [];
  for (const block of blocks) {
    const slotNumber = clientPhotoSlotNumber(block);
    if (slotNumber == null) continue;
    const variableKey = `photo_${slotNumber}`;
    slots.push({
      blockId: block.id,
      slotNumber,
      variableKey,
      pageIndex: block.pageIndex ?? 0,
      label: labels.get(variableKey) ?? `Foto ${slotNumber}`,
      width: Number(block.layout?.width ?? block.width ?? 0),
      height: Number(block.layout?.height ?? block.height ?? 0),
    });
  }
  return slots.sort((a, b) => a.slotNumber - b.slotNumber || a.pageIndex - b.pageIndex);
}

/** Cuántas fotos distintas pide la plantilla (huecos que comparten variable cuentan una vez). */
export function countClientPhotoInputs(slots: ClientPhotoSlot[]): number {
  return new Set(slots.map((s) => s.slotNumber)).size;
}

export type SlotAssignment = { photoId: number | null; crop: PhotoCrop };

/**
 * Armado automático: la foto `n` de la selección va al hueco `photo_n`.
 *
 * Los números de hueco no tienen por qué ser seguidos (una plantilla puede tener `photo_1` y
 * `photo_3`): se recorren en orden y cada número distinto toma la siguiente foto. Si faltan
 * fotos, los huecos que sobran quedan vacíos; si sobran fotos, quedan disponibles para cambiar.
 */
export function autoAssignClientPhotos(
  slots: ClientPhotoSlot[],
  photoIds: number[],
): Record<string, SlotAssignment> {
  const numbers = [...new Set(slots.map((s) => s.slotNumber))].sort((a, b) => a - b);
  const photoByNumber = new Map<number, number | null>();
  numbers.forEach((n, i) => photoByNumber.set(n, photoIds[i] ?? null));

  const result: Record<string, SlotAssignment> = {};
  for (const slot of slots) {
    result[slot.blockId] = {
      photoId: photoByNumber.get(slot.slotNumber) ?? null,
      crop: { ...DEFAULT_PHOTO_CROP },
    };
  }
  return result;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Deja un recorte dentro de rango; lo que no sea número vuelve al valor por defecto. */
export function normalizePhotoCrop(raw: unknown): PhotoCrop {
  const r = asRecord(raw);
  const num = (v: unknown, fallback: number) =>
    typeof v === "number" && Number.isFinite(v) ? v : fallback;
  return {
    zoom: clamp(num(r.zoom, 1), 1, PHOTO_CROP_MAX_ZOOM),
    x: clamp(num(r.x, 0), -1, 1),
    y: clamp(num(r.y, 0), -1, 1),
  };
}

export type CropRect = { left: number; top: number; width: number; height: number };

/**
 * La porción de la foto (en píxeles de la foto) que se ve en el hueco.
 *
 * Primero se ajusta "cubriendo": el rectángulo más grande con la proporción del hueco que entra
 * en la foto. El zoom lo achica alrededor del centro, y `x`/`y` lo corren sobre lo que sobra:
 * -1 pega el rectángulo al borde izquierdo (o superior), 1 al derecho (o inferior).
 */
export function computeCoverCropRect(input: {
  srcWidth: number;
  srcHeight: number;
  slotWidth: number;
  slotHeight: number;
  crop?: PhotoCrop;
}): CropRect {
  const crop = normalizePhotoCrop(input.crop ?? DEFAULT_PHOTO_CROP);
  const W = Math.max(1, input.srcWidth);
  const H = Math.max(1, input.srcHeight);
  const aspect = Math.max(1e-6, input.slotWidth) / Math.max(1e-6, input.slotHeight);

  let width = W;
  let height = W / aspect;
  if (height > H) {
    height = H;
    width = H * aspect;
  }
  width /= crop.zoom;
  height /= crop.zoom;

  const centerX = W / 2 + (crop.x * (W - width)) / 2;
  const centerY = H / 2 + (crop.y * (H - height)) / 2;

  return {
    left: clamp(centerX - width / 2, 0, W - width),
    top: clamp(centerY - height / 2, 0, H - height),
    width,
    height,
  };
}
