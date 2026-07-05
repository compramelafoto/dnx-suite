import type {
  BenefitDefinition,
  BenefitSelectionMode,
  BenefitTemplatePolicy,
  PackBenefitKind,
  PackDefinition,
} from "@/lib/prisma";
import {
  buildBenefitDashboardSummary,
  buildBenefitListHeadline,
  kindLabelEs,
} from "@/lib/preventa-canjeable/benefit-copy";

/** Versión de esquema del JSON congelado en Order.preventaPackSnapshotJson */
export const PREVENTA_PACK_SNAPSHOT_SCHEMA_VERSION = 1 as const;

export type PreventaPackSnapshotBenefitKindV1 = "DIGITAL" | "PHYSICAL";

export type PreventaPackSnapshotSelectionModeV1 =
  | "SINGLE_PHOTO"
  | "MULTI_PHOTO_FIXED"
  | "ALBUM_CHOICE";

export type BenefitForSnapshotBuild = BenefitDefinition & {
  template?: { name: string } | null;
  photographerProduct?: { name: string } | null;
};

export type PreventaPackSnapshotBenefitV1 = {
  stableKey: string;
  benefitDefinitionId: number;
  kind: PreventaPackSnapshotBenefitKindV1;
  selectionMode: PreventaPackSnapshotSelectionModeV1;
  includedQuantity: number;
  requiredPhotoCount: number;
  maxPhotosPerUnit: number | null;
  photographerProductId: number | null;
  templatePolicy: string;
  templateId: number | null;
  extraUnitPriceOverrideArs: number | null;
  regularUnitPriceAfterPreventaArs: number | null;
  sortOrder: number;
  /** Título corto para listados (consistente con benefit-copy) */
  name: string;
  description: string | null;
  kindLabel: string;
  /** Texto largo para UI cliente / soporte */
  summary: string;
};

export type PreventaPackSnapshotV1 = {
  schemaVersion: typeof PREVENTA_PACK_SNAPSHOT_SCHEMA_VERSION;
  frozenAt: string;
  packDefinitionId: number;
  packName: string;
  packDescription: string | null;
  packVersion: number;
  priceClientArs: number;
  currency: string;
  redemptionDeadlineAt: string | null;
  benefits: PreventaPackSnapshotBenefitV1[];
};

export function benefitStableKey(
  packDefinitionId: number,
  benefitDefinitionId: number
): string {
  return `${packDefinitionId}:benefit:${benefitDefinitionId}`;
}

function humanFieldsForBenefit(
  b: BenefitForSnapshotBuild
): Pick<
  PreventaPackSnapshotBenefitV1,
  "name" | "description" | "kindLabel" | "summary"
> {
  const kind = b.kind as PackBenefitKind;
  const selectionMode = b.selectionMode as BenefitSelectionMode;
  const iq = Math.max(0, b.includedQuantity);
  const rpc = Math.max(1, b.requiredPhotoCount);
  const name = buildBenefitListHeadline({
    kind,
    includedQuantity: iq,
    selectionMode,
    requiredPhotoCount: rpc,
  });
  const summary = buildBenefitDashboardSummary({
    kind,
    includedQuantity: iq,
    selectionMode,
    requiredPhotoCount: rpc,
    maxPhotosPerUnit: b.maxPhotosPerUnit ?? null,
    templatePolicy: b.templatePolicy,
    templateName: b.template?.name ?? null,
    photographerProductName: b.photographerProduct?.name ?? null,
    extraUnitPriceOverrideArs: b.extraUnitPriceOverrideArs ?? null,
  });
  return {
    name,
    description: null,
    kindLabel: kindLabelEs(kind),
    summary,
  };
}

export function buildPreventaPackSnapshotV1(
  pack: PackDefinition & { benefits: BenefitForSnapshotBuild[] },
  frozenAt: Date
): PreventaPackSnapshotV1 {
  const benefits = [...pack.benefits].sort((a, b) => a.sortOrder - b.sortOrder);
  return {
    schemaVersion: PREVENTA_PACK_SNAPSHOT_SCHEMA_VERSION,
    frozenAt: frozenAt.toISOString(),
    packDefinitionId: pack.id,
    packName: pack.name.trim() || `Pack #${pack.id}`,
    packDescription: pack.description?.trim() ? pack.description.trim() : null,
    packVersion: pack.version,
    priceClientArs: pack.priceClientArs,
    currency: pack.currency,
    redemptionDeadlineAt: pack.redemptionDeadlineAt
      ? pack.redemptionDeadlineAt.toISOString()
      : null,
    benefits: benefits.map((b) => ({
      stableKey: benefitStableKey(pack.id, b.id),
      benefitDefinitionId: b.id,
      kind: b.kind as PreventaPackSnapshotBenefitKindV1,
      selectionMode: b.selectionMode as PreventaPackSnapshotSelectionModeV1,
      includedQuantity: Math.max(0, b.includedQuantity),
      requiredPhotoCount: Math.max(1, b.requiredPhotoCount),
      maxPhotosPerUnit: b.maxPhotosPerUnit ?? null,
      photographerProductId: b.photographerProductId ?? null,
      templatePolicy: b.templatePolicy,
      templateId: b.templateId ?? null,
      extraUnitPriceOverrideArs: b.extraUnitPriceOverrideArs ?? null,
      regularUnitPriceAfterPreventaArs: b.regularUnitPriceAfterPreventaArs ?? null,
      sortOrder: b.sortOrder,
      ...humanFieldsForBenefit(b),
    })),
  };
}

/**
 * Escala cantidades incluidas y el precio mostrado del pack cuando el cliente compra
 * varias unidades del mismo `PackDefinition` en un solo pedido (PreCompraOrder).
 */
export function scalePreventaPackSnapshotV1ByPackQuantity(
  snapshot: PreventaPackSnapshotV1,
  packQuantity: number
): PreventaPackSnapshotV1 {
  const q = Math.max(1, Math.floor(Number(packQuantity)) || 1);
  if (q === 1) return snapshot;
  const frozenAt = new Date().toISOString();
  return {
    ...snapshot,
    frozenAt,
    priceClientArs: Math.round(snapshot.priceClientArs * q),
    benefits: snapshot.benefits.map((b) => {
      const nextIq = Math.max(0, Math.round(b.includedQuantity * q));
      const synthetic: BenefitForSnapshotBuild = {
        id: b.benefitDefinitionId,
        packDefinitionId: snapshot.packDefinitionId,
        kind: b.kind as PackBenefitKind,
        includedQuantity: nextIq,
        sortOrder: b.sortOrder,
        photographerProductId: b.photographerProductId,
        templatePolicy: b.templatePolicy as BenefitTemplatePolicy,
        templateId: b.templateId,
        extraUnitPriceOverrideArs: b.extraUnitPriceOverrideArs,
        regularUnitPriceAfterPreventaArs: b.regularUnitPriceAfterPreventaArs,
        requiredPhotoCount: b.requiredPhotoCount,
        selectionMode: b.selectionMode as BenefitSelectionMode,
        maxPhotosPerUnit: b.maxPhotosPerUnit,
        createdAt: new Date(0),
        updatedAt: new Date(0),
        template: null,
        photographerProduct: null,
      };
      const human = humanFieldsForBenefit(synthetic);
      return {
        ...b,
        includedQuantity: nextIq,
        name: human.name,
        description: human.description,
        kindLabel: human.kindLabel,
        summary: human.summary,
      };
    }),
  };
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function expectInt(name: string, v: unknown, opts?: { min?: number }): number {
  if (typeof v !== "number" || !Number.isInteger(v)) {
    throw new Error(`${name}: se esperaba entero`);
  }
  if (opts?.min !== undefined && v < opts.min) {
    throw new Error(`${name}: fuera de rango`);
  }
  return v;
}

function expectString(name: string, v: unknown): string {
  if (typeof v !== "string" || v.trim() === "") {
    throw new Error(`${name}: se esperaba string no vacío`);
  }
  return v;
}

function optionalTrimmedString(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

function enrichBenefitHumanFields(
  packDefinitionId: number,
  b: Omit<
    PreventaPackSnapshotBenefitV1,
    "name" | "description" | "kindLabel" | "summary"
  > & {
    name?: string;
    description?: string | null;
    kindLabel?: string;
    summary?: string;
  }
): PreventaPackSnapshotBenefitV1 {
  const kind = b.kind as PackBenefitKind;
  const selectionMode = b.selectionMode as BenefitSelectionMode;
  const synthetic = {
    id: b.benefitDefinitionId,
    packDefinitionId,
    kind,
    includedQuantity: b.includedQuantity,
    sortOrder: b.sortOrder,
    photographerProductId: b.photographerProductId,
    templatePolicy: b.templatePolicy,
    templateId: b.templateId,
    extraUnitPriceOverrideArs: b.extraUnitPriceOverrideArs,
    regularUnitPriceAfterPreventaArs: b.regularUnitPriceAfterPreventaArs,
    requiredPhotoCount: b.requiredPhotoCount,
    selectionMode,
    maxPhotosPerUnit: b.maxPhotosPerUnit,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    template: null,
    photographerProduct: null,
  } as BenefitForSnapshotBuild;
  const fallback = humanFieldsForBenefit(synthetic);
  const name =
    typeof b.name === "string" && b.name.trim() !== "" ? b.name.trim() : fallback.name;
  const kindLabel =
    typeof b.kindLabel === "string" && b.kindLabel.trim() !== ""
      ? b.kindLabel.trim()
      : fallback.kindLabel;
  const summary =
    typeof b.summary === "string" && b.summary.trim() !== ""
      ? b.summary.trim()
      : fallback.summary;
  const description =
    b.description === undefined
      ? fallback.description
      : optionalTrimmedString(b.description);
  return {
    ...b,
    name,
    description,
    kindLabel,
    summary,
  };
}

/** Valida y tipa el JSON almacenado en Order (falla con Error si es inválido). */
export function parsePreventaPackSnapshotV1(raw: unknown): PreventaPackSnapshotV1 {
  if (!isPlainObject(raw)) {
    throw new Error("snapshot: no es un objeto");
  }
  const schemaVersion = raw.schemaVersion;
  if (schemaVersion !== PREVENTA_PACK_SNAPSHOT_SCHEMA_VERSION) {
    throw new Error(`snapshot: schemaVersion no soportada (${String(schemaVersion)})`);
  }
  const frozenAt = expectString("frozenAt", raw.frozenAt);
  const packDefinitionId = expectInt("packDefinitionId", raw.packDefinitionId, { min: 1 });
  const packVersion = expectInt("packVersion", raw.packVersion, { min: 1 });
  const priceClientArs = expectInt("priceClientArs", raw.priceClientArs, { min: 0 });
  const currency = expectString("currency", raw.currency);
  const packName =
    typeof raw.packName === "string" && raw.packName.trim() !== ""
      ? raw.packName.trim()
      : `Pack #${packDefinitionId}`;
  const packDescription = optionalTrimmedString(raw.packDescription);
  let redemptionDeadlineAt: string | null = null;
  if (raw.redemptionDeadlineAt != null) {
    if (typeof raw.redemptionDeadlineAt !== "string") {
      throw new Error("redemptionDeadlineAt: formato inválido");
    }
    redemptionDeadlineAt = raw.redemptionDeadlineAt;
  }
  if (!Array.isArray(raw.benefits) || raw.benefits.length === 0) {
    throw new Error("snapshot: benefits debe ser array no vacío");
  }
  const kinds = new Set<PreventaPackSnapshotBenefitKindV1>(["DIGITAL", "PHYSICAL"]);
  const modes = new Set<PreventaPackSnapshotSelectionModeV1>([
    "SINGLE_PHOTO",
    "MULTI_PHOTO_FIXED",
    "ALBUM_CHOICE",
  ]);
  const benefits: PreventaPackSnapshotBenefitV1[] = [];
  const seenKeys = new Set<string>();
  for (const b of raw.benefits) {
    if (!isPlainObject(b)) {
      throw new Error("benefit: entrada inválida");
    }
    const stableKey = expectString("stableKey", b.stableKey);
    if (seenKeys.has(stableKey)) {
      throw new Error(`stableKey duplicado: ${stableKey}`);
    }
    seenKeys.add(stableKey);
    const kind = b.kind;
    const selectionMode = b.selectionMode;
    if (typeof kind !== "string" || !kinds.has(kind as PreventaPackSnapshotBenefitKindV1)) {
      throw new Error(`beneficio ${stableKey}: kind inválido`);
    }
    if (
      typeof selectionMode !== "string" ||
      !modes.has(selectionMode as PreventaPackSnapshotSelectionModeV1)
    ) {
      throw new Error(`beneficio ${stableKey}: selectionMode inválido`);
    }
    const technical = {
      stableKey,
      benefitDefinitionId: expectInt("benefitDefinitionId", b.benefitDefinitionId, {
        min: 1,
      }),
      kind: kind as PreventaPackSnapshotBenefitKindV1,
      selectionMode: selectionMode as PreventaPackSnapshotSelectionModeV1,
      includedQuantity: expectInt("includedQuantity", b.includedQuantity, { min: 0 }),
      requiredPhotoCount: expectInt("requiredPhotoCount", b.requiredPhotoCount, { min: 1 }),
      maxPhotosPerUnit:
        b.maxPhotosPerUnit == null
          ? null
          : expectInt("maxPhotosPerUnit", b.maxPhotosPerUnit, { min: 1 }),
      photographerProductId:
        b.photographerProductId == null
          ? null
          : expectInt("photographerProductId", b.photographerProductId, { min: 1 }),
      templatePolicy: expectString("templatePolicy", b.templatePolicy),
      templateId:
        b.templateId == null ? null : expectInt("templateId", b.templateId, { min: 1 }),
      extraUnitPriceOverrideArs:
        b.extraUnitPriceOverrideArs == null
          ? null
          : expectInt("extraUnitPriceOverrideArs", b.extraUnitPriceOverrideArs, { min: 0 }),
      regularUnitPriceAfterPreventaArs:
        b.regularUnitPriceAfterPreventaArs == null
          ? null
          : expectInt(
              "regularUnitPriceAfterPreventaArs",
              b.regularUnitPriceAfterPreventaArs,
              { min: 0 }
            ),
      sortOrder: expectInt("sortOrder", b.sortOrder, { min: 0 }),
      name: typeof b.name === "string" ? b.name : undefined,
      description: b.description as string | null | undefined,
      kindLabel: typeof b.kindLabel === "string" ? b.kindLabel : undefined,
      summary: typeof b.summary === "string" ? b.summary : undefined,
    };
    benefits.push(enrichBenefitHumanFields(packDefinitionId, technical));
  }
  for (const b of benefits) {
    const expected = benefitStableKey(packDefinitionId, b.benefitDefinitionId);
    if (b.stableKey !== expected) {
      throw new Error(
        `stableKey inconsistente para beneficio ${b.benefitDefinitionId}: esperado ${expected}`
      );
    }
  }
  return {
    schemaVersion: PREVENTA_PACK_SNAPSHOT_SCHEMA_VERSION,
    frozenAt,
    packDefinitionId,
    packName,
    packDescription,
    packVersion,
    priceClientArs,
    currency,
    redemptionDeadlineAt,
    benefits,
  };
}

export type RedeemUnitSelectionInput = {
  benefitStableKey: string;
  /** Por beneficio: una fila por unidad incluida; cada fila son photoIds de esa unidad */
  units: number[][];
};

export class PreventaPackRedeemValidationError extends Error {
  readonly httpStatus: number;
  readonly code?: string;
  constructor(message: string, httpStatus: number = 400, code?: string) {
    super(message);
    this.name = "PreventaPackRedeemValidationError";
    this.httpStatus = httpStatus;
    this.code = code;
  }
}

/** Valida plazos y forma de `units` contra el snapshot (consumo total: exactamente un bloque por beneficio). */
export function validateRedeemSelectionsAgainstSnapshot(
  snapshot: PreventaPackSnapshotV1,
  selections: RedeemUnitSelectionInput[],
  now: Date = new Date()
): void {
  if (snapshot.redemptionDeadlineAt) {
    const d = new Date(snapshot.redemptionDeadlineAt);
    if (Number.isFinite(d.getTime()) && now > d) {
      throw new PreventaPackRedeemValidationError(
        "El plazo de canje de este pack ya venció"
      );
    }
  }
  const expectedKeys = new Set(snapshot.benefits.map((b) => b.stableKey));
  const selKeys = new Set<string>();
  for (const s of selections) {
    const k = (s.benefitStableKey ?? "").trim();
    if (!k) {
      throw new PreventaPackRedeemValidationError("benefitStableKey vacío");
    }
    if (selKeys.has(k)) {
      throw new PreventaPackRedeemValidationError(`beneficio duplicado en body: ${k}`);
    }
    selKeys.add(k);
    if (!expectedKeys.has(k)) {
      throw new PreventaPackRedeemValidationError(`beneficio no está en el snapshot: ${k}`);
    }
  }
  if (selKeys.size !== expectedKeys.size) {
    throw new PreventaPackRedeemValidationError(
      "Debés enviar exactamente una selección por cada beneficio del pack (canje único total)"
    );
  }
  const byKey = new Map(selections.map((s) => [s.benefitStableKey.trim(), s] as const));
  for (const ben of snapshot.benefits) {
    const sel = byKey.get(ben.stableKey);
    if (!sel) {
      throw new PreventaPackRedeemValidationError(`Falta selección para ${ben.stableKey}`);
    }
    if (!Array.isArray(sel.units)) {
      throw new PreventaPackRedeemValidationError(`units inválido para ${ben.stableKey}`);
    }
    if (ben.includedQuantity <= 0) {
      if (sel.units.length !== 0) {
        throw new PreventaPackRedeemValidationError(
          `El beneficio ${ben.stableKey} no incluye unidades; units debe ser []`
        );
      }
      continue;
    }
    if (sel.units.length !== ben.includedQuantity) {
      throw new PreventaPackRedeemValidationError(
        `${ben.stableKey}: se esperaban ${ben.includedQuantity} unidades, hay ${sel.units.length}`
      );
    }
    const maxPer =
      ben.maxPhotosPerUnit != null ? ben.maxPhotosPerUnit : Number.MAX_SAFE_INTEGER;
    const allPhotosInBenefit: number[] = [];
    for (let u = 0; u < sel.units.length; u++) {
      const unit = sel.units[u];
      if (!Array.isArray(unit) || unit.length === 0) {
        throw new PreventaPackRedeemValidationError(
          `${ben.stableKey}: unidad ${u} vacía o inválida`
        );
      }
      const seenInUnit = new Set<number>();
      for (const pid of unit) {
        if (typeof pid !== "number" || !Number.isInteger(pid) || pid <= 0) {
          throw new PreventaPackRedeemValidationError(
            `${ben.stableKey}: photoId inválido en unidad ${u}`
          );
        }
        if (seenInUnit.has(pid)) {
          throw new PreventaPackRedeemValidationError(
            `${ben.stableKey}: foto repetida en la misma unidad (unidad ${u})`
          );
        }
        seenInUnit.add(pid);
        allPhotosInBenefit.push(pid);
      }
      const n = unit.length;
      if (ben.selectionMode === "SINGLE_PHOTO") {
        if (n !== 1) {
          throw new PreventaPackRedeemValidationError(
            `${ben.stableKey}: modo SINGLE_PHOTO requiere exactamente 1 foto por unidad`
          );
        }
      } else if (ben.selectionMode === "MULTI_PHOTO_FIXED") {
        if (n !== ben.requiredPhotoCount) {
          throw new PreventaPackRedeemValidationError(
            `${ben.stableKey}: modo MULTI_PHOTO_FIXED requiere ${ben.requiredPhotoCount} fotos por unidad`
          );
        }
      } else {
        if (n < 1 || n > maxPer) {
          throw new PreventaPackRedeemValidationError(
            `${ben.stableKey}: cada unidad debe tener entre 1 y ${maxPer} fotos`
          );
        }
      }
    }
    const uniqueAcrossBenefit = new Set(allPhotosInBenefit);
    if (uniqueAcrossBenefit.size !== allPhotosInBenefit.length) {
      throw new PreventaPackRedeemValidationError(
        `${ben.stableKey}: no podés usar la misma foto más de una vez en este beneficio`
      );
    }
  }
}
