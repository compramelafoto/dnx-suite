import type {
  PlaceholderMap,
  SchoolTemplateRenderInput,
  TemplatePageSpec,
  TemplateSlotRole,
  TemplateTextElement,
} from "@/lib/school-render/template-contract";

type PreflightResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
};

const PHOTO_ROLES: TemplateSlotRole[] = [
  "PHOTO_MAIN",
  "PHOTO_1",
  "PHOTO_2",
  "PHOTO_3",
  "GROUP_PHOTO",
];

const ASSET_ROLES: TemplateSlotRole[] = ["SCHOOL_LOGO", "FOOTER_LOGO", "BANNER"];

function extractPlaceholders(text: string) {
  const out: Array<{ key: string; fallback?: string }> = [];
  const re = /\{\{\s*([a-zA-Z0-9_.]+)(?:\s*\|\s*"([^"]*)")?\s*\}\}/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    const key = match[1]?.trim();
    if (!key) continue;
    const fallback = match[2] ?? undefined;
    out.push({ key, fallback });
  }
  return out;
}

function placeholderHasValue(placeholders: PlaceholderMap, key: string) {
  const v = placeholders[key];
  if (v === undefined || v === null) return false;
  if (typeof v === "string") return v.trim().length > 0;
  return true;
}

function normalizePages(input: SchoolTemplateRenderInput): TemplatePageSpec[] {
  const basePage: TemplatePageSpec = {
    pageIndex: 0,
    width: input.template.widthCm,
    height: input.template.heightCm,
    background: { imageUrl: input.template.imageUrl },
    slots: input.template.slots ?? [],
    textElements: (input.template.textElementsJson ?? []).map((t) => t.id),
  };
  const extraPages = Array.isArray(input.template.pagesJson)
    ? input.template.pagesJson
    : [];
  return [basePage, ...extraPages];
}

function validateTextElements(
  elements: TemplateTextElement[],
  placeholders: PlaceholderMap,
  errors: string[],
  warnings: string[]
) {
  const seen = new Set<string>();
  for (const el of elements) {
    if (!el.id || typeof el.id !== "string") {
      errors.push("textElementsJson: hay elementos sin id.");
      continue;
    }
    if (seen.has(el.id)) {
      errors.push(`textElementsJson: id duplicado "${el.id}".`);
    }
    seen.add(el.id);
    if (!Number.isFinite(el.x) || !Number.isFinite(el.y)) {
      errors.push(`textElement "${el.id}": x/y inválidos.`);
    }
    if (!Number.isFinite(el.fontSize) || el.fontSize <= 0) {
      errors.push(`textElement "${el.id}": fontSize inválido.`);
    }
    if (!el.text || typeof el.text !== "string") {
      errors.push(`textElement "${el.id}": text vacío.`);
      continue;
    }
    const placeholdersInText = extractPlaceholders(el.text);
    for (const ph of placeholdersInText) {
      const resolved = placeholderHasValue(placeholders, ph.key);
      if (!resolved && !ph.fallback) {
        const msg = `textElement "${el.id}": placeholder sin dato "${ph.key}".`;
        if (el.required) {
          errors.push(msg);
        } else {
          warnings.push(msg);
        }
      }
    }
  }
}

function resolvePhotoIdBySlot(
  role: TemplateSlotRole | null | undefined,
  slotIndex: number,
  photosByRole: Map<TemplateSlotRole, number>,
  orderedPhotoIds: number[]
) {
  if (role && PHOTO_ROLES.includes(role)) {
    const byRole = photosByRole.get(role);
    if (byRole != null) return byRole;
  }
  const fallback = orderedPhotoIds[slotIndex];
  return Number.isFinite(fallback) ? fallback : null;
}

export function validateSchoolTemplateRenderInput(
  input: SchoolTemplateRenderInput
): PreflightResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!input.template || !Number.isFinite(input.template.id)) {
    errors.push("Template no resuelta.");
  }
  if (!Number.isFinite(input.template.widthCm) || input.template.widthCm <= 0) {
    errors.push("Template: widthCm inválido.");
  }
  if (!Number.isFinite(input.template.heightCm) || input.template.heightCm <= 0) {
    errors.push("Template: heightCm inválido.");
  }

  const pages = normalizePages(input);
  if (pages.length === 0) {
    errors.push("Template: no hay páginas definidas.");
  }

  const textElements = Array.isArray(input.template.textElementsJson)
    ? input.template.textElementsJson
    : [];
  validateTextElements(textElements, input.placeholders, errors, warnings);

  const photosByRole = new Map<TemplateSlotRole, number>();
  const orderedPhotoIds = input.photos.map((p) => p.id);
  for (const p of input.photos) {
    if (p.role && PHOTO_ROLES.includes(p.role as TemplateSlotRole)) {
      if (!photosByRole.has(p.role as TemplateSlotRole)) {
        photosByRole.set(p.role as TemplateSlotRole, p.id);
      }
    }
  }

  const assets = input.assets ?? {};
  for (const slot of input.template.slots ?? []) {
    const slotPage = Number.isFinite(slot.pageIndex) ? slot.pageIndex : 0;
    if (slotPage < 0 || slotPage >= pages.length) {
      errors.push(`TemplateSlot index ${slot.index}: pageIndex fuera de rango.`);
    }
    const bbox = slot.bbox;
    if (
      !bbox ||
      !Number.isFinite(bbox.x) ||
      !Number.isFinite(bbox.y) ||
      !Number.isFinite(bbox.width) ||
      !Number.isFinite(bbox.height) ||
      bbox.width <= 0 ||
      bbox.height <= 0
    ) {
      errors.push(`TemplateSlot index ${slot.index}: bbox inválido.`);
    }
    const role = slot.role ?? null;
    if (slot.required) {
      if (role && PHOTO_ROLES.includes(role)) {
        const photoId = resolvePhotoIdBySlot(role, slot.index, photosByRole, orderedPhotoIds);
        if (!photoId) {
          errors.push(`Slot requerido sin foto asignada (index ${slot.index}).`);
        }
      } else if (role && ASSET_ROLES.includes(role)) {
        const assetOk =
          (role === "SCHOOL_LOGO" && assets.schoolLogoUrl) ||
          (role === "FOOTER_LOGO" && assets.footerLogoUrl) ||
          (role === "BANNER" && assets.bannerUrl);
        if (!assetOk) {
          errors.push(`Slot requerido sin asset (${role}) en index ${slot.index}.`);
        }
      } else {
        const fallbackId = resolvePhotoIdBySlot(null, slot.index, photosByRole, orderedPhotoIds);
        if (!fallbackId) {
          errors.push(`Slot requerido sin foto (index ${slot.index}).`);
        }
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}
