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

export type CanjeSlot = {
  benefitKey: string;
  kind: CanjeSlotKind;
  unitIndex: number;
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
>;

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
        slots.push({ benefitKey: b.stableKey, kind: b.kind, unitIndex: u });
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
  photo: CanjePhotoSales | undefined
): ToggleResult {
  const at = filled.indexOf(photoId);
  if (at >= 0) {
    const next = [...filled];
    next[at] = null;
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

export function emptyCanjeFill(plan: CanjeSlotPlan): Array<number | null> {
  return plan.slots.map(() => null);
}

export function isCanjeComplete(filled: Array<number | null>): boolean {
  return filled.length > 0 && filled.every((x) => x != null);
}

/** Lo que espera `POST /api/public/pack/[token]/redeem`: una selección por beneficio. */
export function buildRedeemSelections(
  plan: CanjeSlotPlan,
  filled: Array<number | null>
): RedeemUnitSelectionInput[] {
  return plan.groups.map((g) => {
    const units: number[][] = Array.from({ length: g.units }, () => []);
    for (const i of g.slotIndexes) {
      const pid = filled[i];
      if (pid != null) units[plan.slots[i].unitIndex].push(pid);
    }
    return { benefitStableKey: g.benefitKey, units };
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
