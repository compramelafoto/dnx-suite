/**
 * Casilleros del canje guiado de preventa: cada beneficio del pack se convierte en lugares
 * para fotos, y la familia los llena tocando fotos. Función pura para poder probar las
 * combinaciones (packs mixtos, varias fotos por unidad) sin pantalla ni base.
 *
 * Reglas que salen del canje del servidor (`validateRedeemSelectionsAgainstSnapshot` y
 * `executePreventaPackRedeemV1`): una foto no puede usarse en dos lugares, los beneficios
 * impresos piden fotos que se vendan impresas y los digitales, fotos que se vendan digitales.
 */

import type {
  PreventaPackSnapshotBenefitV1,
  RedeemUnitSelectionInput,
} from "./preventa-pack-snapshot-v1";

export type CanjeSlotKind = "PHYSICAL" | "DIGITAL";

/**
 * Qué foto pide un lugar cuando la plantilla del beneficio lo dice: la individual, la grupal, la
 * foto con la maestra, con amigos o una libre. Es el mismo rol que da `@repo/template-editor-core`
 * a cada hueco con nombre; sólo la grupal filtra las fotos que se ofrecen.
 */
export type CanjePhotoRole = "individual" | "group" | "teacher" | "friends" | "extra";

export type CanjePhotoInput = { label: string; role: CanjePhotoRole | null };

export type CanjeSlot = {
  benefitKey: string;
  kind: CanjeSlotKind;
  unitIndex: number;
  /** "Foto individual", "Foto con la maestra"… Sólo si la plantilla del beneficio nombra sus huecos. */
  label?: string;
  role?: CanjePhotoRole | null;
};

export type CanjeSlotGroup = {
  benefitKey: string;
  kind: CanjeSlotKind;
  /** Título para la familia: "Copia grupal", "Librito"… */
  label: string;
  units: number;
  photosPerUnit: number;
  /** Índices en la lista plana de lugares. */
  slotIndexes: number[];
};

export type CanjeSlotPlan = { slots: CanjeSlot[]; groups: CanjeSlotGroup[] };

type BenefitInput = Pick<
  PreventaPackSnapshotBenefitV1,
  "stableKey" | "kind" | "selectionMode" | "includedQuantity" | "requiredPhotoCount" | "sortOrder" | "name"
> & {
  /**
   * Lo que pide la plantilla del beneficio, en el orden del armado. La foto `p` de cada unidad
   * va al hueco `p` del diseño, así que el lugar `p` lleva ese nombre.
   */
  photoInputs?: CanjePhotoInput[] | null;
};

function photosPerUnit(b: BenefitInput): number {
  if (b.selectionMode === "SINGLE_PHOTO") return 1;
  return Math.max(1, b.requiredPhotoCount);
}

/**
 * Título del grupo. El nombre guardado en el pack ya trae la cantidad ("1× Copia grupal",
 * "2 impresos", "2 descargas · 2 fotos por descarga") y abajo se dice cuántas fotos son:
 * se deja sólo el producto, o un genérico cuando el nombre no tiene producto.
 */
function groupLabel(b: BenefitInput): string {
  const generico = b.kind === "DIGITAL" ? "Fotos digitales" : "Fotos impresas";
  const nombre = (b.name ?? "").trim();
  const conProducto = nombre.match(/^\d+\s*[×x]\s*(.+?)(?:\s*·.*)?$/i);
  if (conProducto?.[1]) return conProducto[1].trim();
  if (!nombre || /^\d+\s+(impres|descarg|foto|producto)/i.test(nombre)) return generico;
  return nombre;
}

/** Lo mínimo de un hueco de la plantilla para ubicarlo (ver `ClientPhotoSlot`). */
type HuecoDelDiseno = { blockId: string; slotNumber: number };

/**
 * Une cada hueco del diseño con su lugar del canje: la foto `p` de la unidad va al hueco `p`
 * (contando los huecos distintos en el orden del armado, `autoAssignClientPhotos`). Los huecos
 * que comparten foto (la misma foto en tapa e interior) apuntan al mismo lugar. Si la plantilla
 * pide más fotos que las del beneficio, los huecos de más quedan sin lugar.
 */
export function placesForUnit(
  slots: readonly HuecoDelDiseno[],
  slotIndexes: number[],
  unit: number,
  perUnit: number
): Map<string, number> {
  const numbers = [...new Set(slots.map((s) => s.slotNumber))].sort((a, b) => a - b);
  const map = new Map<string, number>();
  for (const s of slots) {
    const order = numbers.indexOf(s.slotNumber);
    if (order < 0 || order >= perUnit) continue;
    const place = slotIndexes[unit * perUnit + order];
    if (place != null) map.set(s.blockId, place);
  }
  return map;
}

export function buildCanjeSlotPlan(benefits: BenefitInput[]): CanjeSlotPlan {
  const slots: CanjeSlot[] = [];
  const groups: CanjeSlotGroup[] = [];
  for (const b of [...benefits].sort((x, y) => x.sortOrder - y.sortOrder)) {
    const units = Math.max(0, b.includedQuantity);
    const per = photosPerUnit(b);
    const slotIndexes: number[] = [];
    for (let u = 0; u < units; u++) {
      for (let p = 0; p < per; p++) {
        slotIndexes.push(slots.length);
        const input = b.photoInputs?.[p];
        slots.push(
          input
            ? { benefitKey: b.stableKey, kind: b.kind, unitIndex: u, label: input.label, role: input.role }
            : { benefitKey: b.stableKey, kind: b.kind, unitIndex: u },
        );
      }
    }
    if (units > 0) {
      groups.push({
        benefitKey: b.stableKey,
        kind: b.kind,
        label: groupLabel(b),
        units,
        photosPerUnit: per,
        slotIndexes,
      });
    }
  }
  return { slots, groups };
}

export type CanjePhotoSales = { sellPrint: boolean; sellDigital: boolean };

function fits(kind: CanjeSlotKind, photo: CanjePhotoSales | undefined): boolean {
  if (!photo) return false;
  return kind === "PHYSICAL" ? photo.sellPrint : photo.sellDigital;
}

export type ToggleResult =
  | { ok: true; filled: Array<number | null> }
  | { ok: false; reason: "lleno" | "no_corresponde"; filled: Array<number | null> };

/**
 * Tocar una foto: si ya está, sale de su lugar; si no, entra en el primer lugar libre que
 * acepte su formato. `filled[i]` es la foto del lugar `i` o `null`.
 */
export function toggleCanjePhoto(
  plan: CanjeSlotPlan,
  filled: Array<number | null>,
  photoId: number,
  photo: CanjePhotoSales | undefined,
  /** El lugar que la familia tocó antes de elegir la foto ("ahora la grupal"). */
  targetIndex?: number | null
): ToggleResult {
  const at = filled.indexOf(photoId);
  if (at >= 0) {
    const next = [...filled];
    next[at] = null;
    return { ok: true, filled: next };
  }
  if (targetIndex != null && targetIndex >= 0 && targetIndex < plan.slots.length && filled[targetIndex] == null) {
    if (!fits(plan.slots[targetIndex].kind, photo)) return { ok: false, reason: "no_corresponde", filled };
    const next = [...filled];
    next[targetIndex] = photoId;
    return { ok: true, filled: next };
  }
  const free = plan.slots.findIndex((s, i) => filled[i] == null && fits(s.kind, photo));
  if (free < 0) {
    const anyFree = filled.some((x) => x == null);
    return { ok: false, reason: anyFree ? "no_corresponde" : "lleno", filled };
  }
  const next = [...filled];
  next[free] = photoId;
  return { ok: true, filled: next };
}

/** El lugar que se está llenando: el que tocó la familia o, si no, el primero libre. */
export function currentCanjeSlotIndex(filled: Array<number | null>, targetIndex?: number | null): number | null {
  if (targetIndex != null && filled[targetIndex] == null) return targetIndex;
  const free = filled.findIndex((x) => x == null);
  return free >= 0 ? free : null;
}

/** Cuántos rostros necesita una foto para ofrecerse como grupal. */
export const GROUP_PHOTO_MIN_FACES = 5;

/**
 * Las fotos para el lugar que se está llenando. Para la grupal, sólo las que tienen más de
 * `GROUP_PHOTO_MIN_FACES` rostros; si el álbum todavía no se analizó (ninguna foto con
 * rostros contados) se muestran todas, para no dejar a la familia sin opciones.
 */
export function photosForCanjeRole(
  photoIds: number[],
  facesById: ReadonlyMap<number, number | null>,
  role: CanjePhotoRole | null | undefined
): { ids: number[]; filtered: boolean } {
  if (role !== "group") return { ids: photoIds, filtered: false };
  const grupales = photoIds.filter((id) => (facesById.get(id) ?? 0) > GROUP_PHOTO_MIN_FACES);
  return grupales.length > 0 ? { ids: grupales, filtered: true } : { ids: photoIds, filtered: false };
}

export function emptyCanjeFill(plan: CanjeSlotPlan): Array<number | null> {
  return plan.slots.map(() => null);
}

export function isCanjeComplete(filled: Array<number | null>): boolean {
  return filled.length > 0 && filled.every((x) => x != null);
}

/** Lo que espera `POST /api/public/pack/[token]/redeem`: una selección por beneficio. */
export type CanjeCrop = { zoom: number; x: number; y: number };

export function buildRedeemSelections(
  plan: CanjeSlotPlan,
  filled: Array<number | null>,
  /** Cómo acomodó la familia la foto de cada lugar (índice del lugar), si la acomodó. */
  crops?: Readonly<Record<number, CanjeCrop>>
): RedeemUnitSelectionInput[] {
  return plan.groups.map((g) => {
    const units: number[][] = Array.from({ length: g.units }, () => []);
    const unitCrops: Array<Array<CanjeCrop | null>> = Array.from({ length: g.units }, () => []);
    let anyCrop = false;
    for (const i of g.slotIndexes) {
      const pid = filled[i];
      if (pid == null) continue;
      const u = plan.slots[i].unitIndex;
      units[u].push(pid);
      const crop = crops?.[i] ?? null;
      if (crop) anyCrop = true;
      unitCrops[u].push(crop);
    }
    return anyCrop
      ? { benefitStableKey: g.benefitKey, units, crops: unitCrops }
      : { benefitStableKey: g.benefitKey, units };
  });
}

const normalizarNombre = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

/**
 * Nombre del alumno para decir "el pack de …". Varias familias cargaron su propio nombre en
 * el campo del alumno; repetirlo ("Hola, Stephanie · el pack de Stephanie Hourcade") confunde.
 */
export function studentNameForGreeting(
  studentName: string | null | undefined,
  buyerName: string | null | undefined
): string | null {
  const alumno = studentName?.trim();
  if (!alumno) return null;
  if (buyerName?.trim() && normalizarNombre(alumno) === normalizarNombre(buyerName)) return null;
  return alumno;
}
