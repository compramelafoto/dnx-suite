import { stripCartCopySuffix } from "@/lib/album-photo-ref";

export type RedeemSnapshotBenefitRow = {
  stableKey: string;
  kind: string;
  selectionMode: string;
  includedQuantity: number;
  requiredPhotoCount: number;
  maxPhotosPerUnit: number | null;
  sortOrder: number;
  name?: string;
};

export type RedeemCheckoutItemRow = {
  fileKey: string;
  tipo?: string;
  sellDigital?: boolean;
  sellPrint?: boolean;
};

export type RedeemSelectionPayload = {
  benefitStableKey: string;
  units: number[][];
};

function parsePhotoIdFromCheckoutFileKey(fileKey: string): number | null {
  const base = stripCartCopySuffix(fileKey);
  const m = /^photo:(\d+)$/.exec(base);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Fotos requeridas por unidad según snapshot (alineado a validateRedeemSelectionsAgainstSnapshot). */
export function photosPerUnitForRedeem(ben: {
  selectionMode: string;
  requiredPhotoCount: number;
  maxPhotosPerUnit: number | null;
}): number {
  if (ben.selectionMode === "SINGLE_PHOTO") return 1;
  if (ben.selectionMode === "MULTI_PHOTO_FIXED") {
    return Math.max(1, ben.requiredPhotoCount);
  }
  const maxP = ben.maxPhotosPerUnit ?? Number.MAX_SAFE_INTEGER;
  const rq = Math.max(1, ben.requiredPhotoCount);
  return Math.min(maxP, rq);
}

function matchesBenefitEntry(
  ben: { kind: string },
  entry: { sellDigital: boolean; sellPrint: boolean; tipo: "digital" | "impresa" }
): boolean {
  if (ben.kind === "DIGITAL") {
    return entry.sellDigital && entry.tipo === "digital";
  }
  if (ben.kind === "PHYSICAL") {
    return entry.sellPrint && entry.tipo === "impresa";
  }
  return false;
}

/**
 * Reparte las fotos del checkout (orden de aparición, sin duplicar photoId) en `selections`
 * para POST /api/orders/[id]/redeem. Asignación secuencial por beneficio (sortOrder).
 */
export function buildRedeemSelectionsFromCheckoutItems(
  rawBenefits: RedeemSnapshotBenefitRow[],
  items: RedeemCheckoutItemRow[]
):
  | { ok: true; selections: RedeemSelectionPayload[] }
  | { ok: false; message: string } {
  const sorted = [...rawBenefits].sort((a, b) => a.sortOrder - b.sortOrder);

  const seen = new Set<number>();
  const pool: Array<{
    id: number;
    sellDigital: boolean;
    sellPrint: boolean;
    tipo: "digital" | "impresa";
  }> = [];
  for (const it of items) {
    const pid = parsePhotoIdFromCheckoutFileKey(it.fileKey);
    if (pid == null || seen.has(pid)) continue;
    seen.add(pid);
    const tipo = (it.tipo || "digital") === "impresa" ? "impresa" : "digital";
    pool.push({
      id: pid,
      sellDigital: it.sellDigital ?? true,
      sellPrint: it.sellPrint ?? true,
      tipo,
    });
  }

  const working = [...pool];
  const selections: RedeemSelectionPayload[] = [];

  for (const ben of sorted) {
    if (ben.includedQuantity <= 0) {
      selections.push({ benefitStableKey: ben.stableKey, units: [] });
      continue;
    }
    const perUnit = photosPerUnitForRedeem(ben);
    const units: number[][] = [];
    for (let u = 0; u < ben.includedQuantity; u++) {
      const taken: number[] = [];
      let idx = 0;
      while (taken.length < perUnit && idx < working.length) {
        const ent = working[idx];
        if (matchesBenefitEntry(ben, ent)) {
          taken.push(ent.id);
          working.splice(idx, 1);
          continue;
        }
        idx++;
      }
      if (taken.length !== perUnit) {
        const label = ben.name?.trim() || ben.stableKey;
        return {
          ok: false,
          message: `No alcanzan fotos para «${label}»: necesitás ${ben.includedQuantity} unidad(es) de ${perUnit} foto(s) ${
            ben.kind === "DIGITAL" ? "digital(es)" : "para impresión"
          } (elegí el tipo correcto en cada foto).`,
        };
      }
      units.push(taken);
    }
    selections.push({ benefitStableKey: ben.stableKey, units });
  }

  return { ok: true, selections };
}

/** Total de fotos únicas necesarias (suma por beneficio). */
export function totalPhotosRequiredForRedeem(rawBenefits: RedeemSnapshotBenefitRow[]): number {
  const sorted = [...rawBenefits].sort((a, b) => a.sortOrder - b.sortOrder);
  let n = 0;
  for (const ben of sorted) {
    if (ben.includedQuantity <= 0) continue;
    n += ben.includedQuantity * photosPerUnitForRedeem(ben);
  }
  return n;
}

export type RedeemPreflightHints = {
  build: ReturnType<typeof buildRedeemSelectionsFromCheckoutItems>;
  poolDigitalCount: number;
  poolPrintCount: number;
  requiredDigitalPhotos: number;
  requiredPrintPhotos: number;
};

/**
 * Resultado de `buildRedeemSelectionsFromCheckoutItems` más conteos simples digital/impreso
 * para mensajes de ayuda en UI (no sustituye la validación del servidor).
 */
export function redeemPreflightHints(
  rawBenefits: RedeemSnapshotBenefitRow[],
  items: RedeemCheckoutItemRow[]
): RedeemPreflightHints {
  const sorted = [...rawBenefits].sort((a, b) => a.sortOrder - b.sortOrder);
  let requiredDigitalPhotos = 0;
  let requiredPrintPhotos = 0;
  for (const b of sorted) {
    if (b.includedQuantity <= 0) continue;
    const per = photosPerUnitForRedeem(b);
    const slots = b.includedQuantity * per;
    if (b.kind === "DIGITAL") requiredDigitalPhotos += slots;
    if (b.kind === "PHYSICAL") requiredPrintPhotos += slots;
  }

  const seen = new Set<number>();
  let poolDigitalCount = 0;
  let poolPrintCount = 0;
  for (const it of items) {
    const pid = parsePhotoIdFromCheckoutFileKey(it.fileKey);
    if (pid == null || seen.has(pid)) continue;
    seen.add(pid);
    const tipo = (it.tipo || "digital") === "impresa" ? "impresa" : "digital";
    const sd = it.sellDigital ?? true;
    const sp = it.sellPrint ?? true;
    if (tipo === "digital" && sd) poolDigitalCount += 1;
    if (tipo === "impresa" && sp) poolPrintCount += 1;
  }

  const build = buildRedeemSelectionsFromCheckoutItems(rawBenefits, items);

  return {
    build,
    poolDigitalCount,
    poolPrintCount,
    requiredDigitalPhotos,
    requiredPrintPhotos,
  };
}
