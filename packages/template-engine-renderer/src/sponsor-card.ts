/**
 * Render de placas de agradecimiento a sponsors (Clickatón / FotoRank).
 *
 * Vive en el renderer porque es la única capa del monorepo que ya combina
 * template-engine + Chromium: así ambas apps consumen el mismo pipeline sin
 * duplicar la resolución de variables.
 */
import {
  createTemplateVariableRegistry,
  fromLegacyTemplateV2,
  parseTemplateDocument,
  resolveTemplateDocument,
  sponsorTemplateVariablesPlugin,
  type ResolvedTemplateDocument,
} from "@repo/template-engine";
import {
  getSponsorThankYouPresetForProduct,
  instantiateSponsorThankYouPreset,
  type SponsorThankYouProduct,
} from "@repo/template-engine/sponsor-presets";
import { renderTemplatePreviewPng } from "./preview-renderer";
import { previewAssetFailed } from "./render-errors";

export type SponsorThankYouCardData = {
  sponsor: {
    name: string;
    /** Data URL o URL https. Una ruta relativa no resuelve en el render. */
    logoUrl?: string | null;
    tierLabel?: string | null;
    instagram?: string | null;
    website?: string | null;
    message?: string | null;
  };
  program: {
    productLabel: string;
    name: string;
    dateFormatted?: string | null;
    city?: string | null;
    logoUrl?: string | null;
    participantsCount?: string | number | null;
  };
};

export type SponsorThankYouCardResult = {
  png: Buffer;
  width: number;
  height: number;
  mimeType: "image/png";
  durationMs: number;
  templateKey: string;
  templateVersion: number;
  warnings: string[];
};

function text(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

/** Aplana a `a.b` además del objeto anidado: el resolver acepta ambas formas. */
function flatten(
  source: Record<string, unknown>,
  prefix = "",
  target: Record<string, unknown> = {}
): Record<string, unknown> {
  for (const [key, value] of Object.entries(source)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      flatten(value as Record<string, unknown>, path, target);
    } else {
      target[path] = value;
    }
  }
  return target;
}

export function buildSponsorThankYouTemplateData(
  data: SponsorThankYouCardData
): Record<string, unknown> {
  const dateFormatted = text(data.program.dateFormatted);
  const city = text(data.program.city);
  // Sin ciudad (caso FotoRank) no debe quedar un « · » colgando.
  const metaLine = [dateFormatted, city].filter(Boolean).join(" · ");

  const nested: Record<string, unknown> = {
    sponsor: {
      name: text(data.sponsor.name),
      logoUrl: text(data.sponsor.logoUrl),
      tierLabel: text(data.sponsor.tierLabel).toUpperCase(),
      instagram: text(data.sponsor.instagram),
      website: text(data.sponsor.website),
      message: text(data.sponsor.message),
    },
    program: {
      productLabel: text(data.program.productLabel).toUpperCase(),
      name: text(data.program.name),
      dateFormatted,
      city,
      metaLine,
      logoUrl: text(data.program.logoUrl),
      participantsCount: text(data.program.participantsCount),
    },
  };
  return { ...nested, ...flatten(nested) };
}

export function resolveSponsorThankYouDocument(input: {
  product: SponsorThankYouProduct;
  data: SponsorThankYouCardData;
}): { document: ResolvedTemplateDocument; templateKey: string; templateVersion: number } {
  const preset = getSponsorThankYouPresetForProduct(input.product);
  const bridged = fromLegacyTemplateV2(instantiateSponsorThankYouPreset(preset), {
    id: preset.presetId,
    name: preset.name,
  });

  const parsed = parseTemplateDocument(bridged.document);
  if (!parsed.ok) {
    throw previewAssetFailed(`Plantilla de sponsor inválida: ${parsed.error}`);
  }

  const registry = createTemplateVariableRegistry({
    plugins: [sponsorTemplateVariablesPlugin],
  });

  const resolved = resolveTemplateDocument({
    template: parsed.data,
    data: buildSponsorThankYouTemplateData(input.data),
    registry,
  });

  if (resolved.errors.length > 0) {
    throw previewAssetFailed(
      `Plantilla de sponsor con errores de resolución: ${resolved.errors.join(", ")}`
    );
  }

  return {
    document: resolved.document,
    templateKey: preset.meta.templateKey,
    templateVersion: preset.meta.templateVersion,
  };
}

export async function renderSponsorThankYouCardPng(input: {
  product: SponsorThankYouProduct;
  data: SponsorThankYouCardData;
}): Promise<SponsorThankYouCardResult> {
  const { document, templateKey, templateVersion } =
    resolveSponsorThankYouDocument(input);
  const rendered = await renderTemplatePreviewPng(document);
  return {
    png: rendered.png,
    width: rendered.width,
    height: rendered.height,
    mimeType: "image/png",
    durationMs: rendered.durationMs,
    templateKey,
    templateVersion,
    warnings: rendered.warnings,
  };
}
