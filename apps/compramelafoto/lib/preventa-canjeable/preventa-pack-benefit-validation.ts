import type { BenefitDefinition } from "@/lib/prisma";
import {
  BenefitSelectionMode,
  BenefitTemplatePolicy,
  PackBenefitKind,
} from "@/lib/prisma";
import {
  assertPhotographerProductOwnedByUser,
  assertTemplateAccessibleForAlbum,
} from "./dashboard-pack-helpers";

const KIND_VALUES = new Set<string>(Object.values(PackBenefitKind));
const POLICY_VALUES = new Set<string>(Object.values(BenefitTemplatePolicy));
const MODE_VALUES = new Set<string>(Object.values(BenefitSelectionMode));

function parseKind(value: unknown): PackBenefitKind {
  if (typeof value !== "string" || !KIND_VALUES.has(value)) {
    throw new Error("kind es requerido: DIGITAL o PHYSICAL");
  }
  return value as PackBenefitKind;
}

function parsePolicy(value: unknown, fallback: BenefitTemplatePolicy): BenefitTemplatePolicy {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "string" || !POLICY_VALUES.has(value)) {
    throw new Error("templatePolicy inválido (NONE | REQUIRED | OPTIONAL)");
  }
  return value as BenefitTemplatePolicy;
}

function parseMode(value: unknown, fallback: BenefitSelectionMode): BenefitSelectionMode {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "string" || !MODE_VALUES.has(value)) {
    throw new Error("selectionMode inválido");
  }
  return value as BenefitSelectionMode;
}

function parsePositiveInt(value: unknown, field: string, min: number): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min) {
    throw new Error(`${field} debe ser un entero >= ${min}`);
  }
  return n;
}

function parseNonNegativeInt(value: unknown, field: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`${field} debe ser un entero >= 0`);
  }
  return n;
}

export type ParsedBenefitForCreate = {
  kind: PackBenefitKind;
  includedQuantity: number;
  sortOrder: number;
  photographerProductId: number | null;
  templatePolicy: BenefitTemplatePolicy;
  templateId: number | null;
  extraUnitPriceOverrideArs: number | null;
  requiredPhotoCount: number;
  selectionMode: BenefitSelectionMode;
  maxPhotosPerUnit: number | null;
};

export function parseBenefitBodyCreate(body: unknown): ParsedBenefitForCreate {
  if (!body || typeof body !== "object") {
    throw new Error("Body JSON inválido");
  }
  const b = body as Record<string, unknown>;
  const kind = parseKind(b.kind);
  const includedQuantity = parsePositiveInt(b.includedQuantity, "includedQuantity", 1);
  const sortOrder =
    b.sortOrder === undefined || b.sortOrder === null
      ? 0
      : parseNonNegativeInt(b.sortOrder, "sortOrder");
  const templatePolicy = parsePolicy(b.templatePolicy, BenefitTemplatePolicy.NONE);
  let photographerProductId: number | null = null;
  if (b.photographerProductId !== undefined && b.photographerProductId !== null) {
    photographerProductId = parsePositiveInt(b.photographerProductId, "photographerProductId", 1);
  }
  let templateId: number | null = null;
  if (b.templateId !== undefined && b.templateId !== null) {
    templateId = parsePositiveInt(b.templateId, "templateId", 1);
  }
  let extraUnitPriceOverrideArs: number | null = null;
  if (b.extraUnitPriceOverrideArs !== undefined && b.extraUnitPriceOverrideArs !== null) {
    const x = Number(b.extraUnitPriceOverrideArs);
    if (!Number.isInteger(x) || x < 0) {
      throw new Error("extraUnitPriceOverrideArs debe ser entero >= 0 o null");
    }
    extraUnitPriceOverrideArs = x;
  }
  const requiredPhotoCount =
    b.requiredPhotoCount === undefined || b.requiredPhotoCount === null
      ? 1
      : parsePositiveInt(b.requiredPhotoCount, "requiredPhotoCount", 1);
  const selectionMode = parseMode(b.selectionMode, BenefitSelectionMode.SINGLE_PHOTO);
  let maxPhotosPerUnit: number | null = null;
  if (b.maxPhotosPerUnit !== undefined && b.maxPhotosPerUnit !== null) {
    maxPhotosPerUnit = parsePositiveInt(b.maxPhotosPerUnit, "maxPhotosPerUnit", 1);
  }
  return {
    kind,
    includedQuantity,
    sortOrder,
    photographerProductId,
    templatePolicy,
    templateId,
    extraUnitPriceOverrideArs,
    requiredPhotoCount,
    selectionMode,
    maxPhotosPerUnit,
  };
}

export async function assertBenefitBusinessRules(
  albumId: number,
  userId: number,
  fields: ParsedBenefitForCreate
): Promise<void> {
  if (
    fields.kind === PackBenefitKind.PHYSICAL &&
    fields.templatePolicy === BenefitTemplatePolicy.REQUIRED &&
    fields.templateId == null
  ) {
    throw new Error(
      "Con kind PHYSICAL y templatePolicy REQUIRED, templateId es obligatorio"
    );
  }
  if (fields.photographerProductId != null) {
    await assertPhotographerProductOwnedByUser(fields.photographerProductId, userId);
  }
  if (fields.templateId != null) {
    await assertTemplateAccessibleForAlbum(fields.templateId, albumId);
  }
}

export type ParsedBenefitPatch = Partial<{
  kind: PackBenefitKind;
  includedQuantity: number;
  sortOrder: number;
  photographerProductId: number | null;
  templatePolicy: BenefitTemplatePolicy;
  templateId: number | null;
  extraUnitPriceOverrideArs: number | null;
  requiredPhotoCount: number;
  selectionMode: BenefitSelectionMode;
  maxPhotosPerUnit: number | null;
}>;

export function parseBenefitBodyPatch(body: unknown): ParsedBenefitPatch {
  if (!body || typeof body !== "object") {
    throw new Error("Body JSON inválido");
  }
  const b = body as Record<string, unknown>;
  const out: ParsedBenefitPatch = {};
  if ("kind" in b) out.kind = parseKind(b.kind);
  if ("includedQuantity" in b) {
    out.includedQuantity = parsePositiveInt(b.includedQuantity, "includedQuantity", 1);
  }
  if ("sortOrder" in b) {
    out.sortOrder = parseNonNegativeInt(b.sortOrder, "sortOrder");
  }
  if ("templatePolicy" in b) {
    out.templatePolicy = parsePolicy(b.templatePolicy, BenefitTemplatePolicy.NONE);
  }
  if ("photographerProductId" in b) {
    if (b.photographerProductId === null || b.photographerProductId === "") {
      out.photographerProductId = null;
    } else {
      out.photographerProductId = parsePositiveInt(
        b.photographerProductId,
        "photographerProductId",
        1
      );
    }
  }
  if ("templateId" in b) {
    if (b.templateId === null || b.templateId === "") {
      out.templateId = null;
    } else {
      out.templateId = parsePositiveInt(b.templateId, "templateId", 1);
    }
  }
  if ("extraUnitPriceOverrideArs" in b) {
    if (b.extraUnitPriceOverrideArs === null || b.extraUnitPriceOverrideArs === "") {
      out.extraUnitPriceOverrideArs = null;
    } else {
      const x = Number(b.extraUnitPriceOverrideArs);
      if (!Number.isInteger(x) || x < 0) {
        throw new Error("extraUnitPriceOverrideArs debe ser entero >= 0 o null");
      }
      out.extraUnitPriceOverrideArs = x;
    }
  }
  if ("requiredPhotoCount" in b) {
    out.requiredPhotoCount = parsePositiveInt(b.requiredPhotoCount, "requiredPhotoCount", 1);
  }
  if ("selectionMode" in b) {
    out.selectionMode = parseMode(b.selectionMode, BenefitSelectionMode.SINGLE_PHOTO);
  }
  if ("maxPhotosPerUnit" in b) {
    if (b.maxPhotosPerUnit === null || b.maxPhotosPerUnit === "") {
      out.maxPhotosPerUnit = null;
    } else {
      out.maxPhotosPerUnit = parsePositiveInt(b.maxPhotosPerUnit, "maxPhotosPerUnit", 1);
    }
  }
  return out;
}

function mergedBenefitForValidation(
  existing: BenefitDefinition,
  patch: ParsedBenefitPatch
): ParsedBenefitForCreate {
  return {
    kind: patch.kind ?? existing.kind,
    includedQuantity: patch.includedQuantity ?? existing.includedQuantity,
    sortOrder: patch.sortOrder ?? existing.sortOrder,
    photographerProductId:
      patch.photographerProductId !== undefined
        ? patch.photographerProductId
        : existing.photographerProductId,
    templatePolicy: patch.templatePolicy ?? existing.templatePolicy,
    templateId: patch.templateId !== undefined ? patch.templateId : existing.templateId,
    extraUnitPriceOverrideArs:
      patch.extraUnitPriceOverrideArs !== undefined
        ? patch.extraUnitPriceOverrideArs
        : existing.extraUnitPriceOverrideArs,
    requiredPhotoCount: patch.requiredPhotoCount ?? existing.requiredPhotoCount,
    selectionMode: patch.selectionMode ?? existing.selectionMode,
    maxPhotosPerUnit:
      patch.maxPhotosPerUnit !== undefined ? patch.maxPhotosPerUnit : existing.maxPhotosPerUnit,
  };
}

export async function validateBenefitPatch(
  albumId: number,
  userId: number,
  existing: BenefitDefinition,
  patch: ParsedBenefitPatch
): Promise<void> {
  if (Object.keys(patch).length === 0) {
    throw new Error("No hay campos para actualizar");
  }
  const merged = mergedBenefitForValidation(existing, patch);
  await assertBenefitBusinessRules(albumId, userId, merged);
}
