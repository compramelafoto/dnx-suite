import { createHash } from "node:crypto";
import { normalizeInstagramHandle } from "@repo/template-engine";
import type { ClickatonCardPreset } from "./participant-card-presets";
import { CLICKATON_CARD_RENDERER_VERSION } from "./participant-card-renderer-version";
import type {
  ClickatonParticipantCardType,
  ParticipantCardRegistrationSnapshot,
} from "./participant-card-types";

export const CLICKATON_CARD_FONT_CONFIG_VERSION = "preview-fonts:1";

export type ClickatonParticipantCardHashInput = {
  cardType: ClickatonParticipantCardType;
  preset: ClickatonCardPreset;
  registration: ParticipantCardRegistrationSnapshot;
  templateData: Record<string, unknown>;
  photoAssetId: string | null;
  photoContentHash: string | null;
  forceGenerationId?: string;
};

type NormalizedBlock = {
  name: string;
  type: string;
  pageIndex: number;
  layout: Record<string, unknown>;
  configJson: Record<string, unknown>;
};

function stableSortKeys(value: unknown): unknown {
  if (value == null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(stableSortKeys);
  const obj = value as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    const v = obj[key];
    if (v === undefined) continue;
    sorted[key] = stableSortKeys(v);
  }
  return sorted;
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out as T;
}

/** Normaliza canvas + bloques del preset fuente (sin IDs efímeros de instancia). */
export function normalizeTemplateDocumentForHash(
  preset: ClickatonCardPreset
): { canvas: Record<string, unknown>; blocks: NormalizedBlock[] } {
  const blocks: NormalizedBlock[] = [...preset.payload.blocks]
    .sort((a, b) => {
      const byName = (a.name ?? "").localeCompare(b.name ?? "");
      if (byName !== 0) return byName;
      return a.id.localeCompare(b.id);
    })
    .map((block) => ({
      name: block.name ?? "",
      type: block.type,
      pageIndex: block.pageIndex ?? 0,
      layout: stripUndefined({ ...block.layout } as Record<string, unknown>),
      configJson: stripUndefined({
        ...block.configJson,
      } as Record<string, unknown>),
    }));

  return {
    canvas: stripUndefined({ ...preset.payload.canvas } as Record<string, unknown>),
    blocks,
  };
}

function readNestedString(data: Record<string, unknown>, path: string): string {
  const parts = path.split(".");
  let cur: unknown = data;
  for (const part of parts) {
    if (!cur || typeof cur !== "object") return "";
    cur = (cur as Record<string, unknown>)[part];
  }
  return typeof cur === "string" ? cur.trim() : cur != null ? String(cur) : "";
}

function normalizeInstagramForHash(
  registration: ParticipantCardRegistrationSnapshot
): string {
  const raw =
    registration.instagramHandleNormalized ??
    registration.instagramHandle ??
    "";
  if (!raw.trim()) return "";
  const normalized = normalizeInstagramHandle(raw);
  return normalized.ok ? normalized.handle : raw.trim().toLowerCase();
}

function buildParticipantHashFields(
  registration: ParticipantCardRegistrationSnapshot,
  templateData: Record<string, unknown>
): Record<string, unknown> {
  const participant = (templateData.participant ?? {}) as Record<string, unknown>;
  return stripUndefined({
    firstName: registration.firstName.trim(),
    lastName: registration.lastName.trim(),
    displayName: readNestedString(templateData, "participant.displayName"),
    instagram: normalizeInstagramForHash(registration),
    city: readNestedString(templateData, "participant.city"),
    province: readNestedString(templateData, "participant.province"),
    country: registration.country,
    category: readNestedString(templateData, "participant.category"),
    number: participant.number ?? null,
    numberFormatted: readNestedString(templateData, "participant.numberFormatted"),
  });
}

function buildEditionHashFields(
  templateData: Record<string, unknown>
): Record<string, unknown> {
  return stripUndefined({
    name: readNestedString(templateData, "edition.name"),
    eventDate: readNestedString(templateData, "edition.eventDate"),
    eventDateFormatted: readNestedString(templateData, "edition.eventDateFormatted"),
    city: readNestedString(templateData, "edition.city"),
    venue: readNestedString(templateData, "edition.venue"),
    slug: readNestedString(templateData, "edition.slug"),
  });
}

function buildBrandingHashFields(
  templateData: Record<string, unknown>
): Record<string, unknown> {
  return stripUndefined({
    name: readNestedString(templateData, "branding.name"),
    logo: readNestedString(templateData, "branding.logo"),
    logoUrl: readNestedString(templateData, "branding.logoUrl"),
    primaryColor: readNestedString(templateData, "branding.primaryColor"),
    secondaryColor: readNestedString(templateData, "branding.secondaryColor"),
    accentColor: readNestedString(templateData, "branding.accentColor"),
  });
}

function buildCardCopyHashFields(
  templateData: Record<string, unknown>
): Record<string, unknown> {
  return stripUndefined({
    message: readNestedString(templateData, "card.message"),
  });
}

export function computeClickatonParticipantCardRenderHash(
  input: ClickatonParticipantCardHashInput
): string {
  const templateDocumentNormalized = normalizeTemplateDocumentForHash(input.preset);
  const canonical = stableSortKeys(
    stripUndefined({
      cardType: input.cardType,
      templateKey: input.preset.meta.templateKey,
      templateVersion: input.preset.meta.templateVersion,
      templateDocumentNormalized,
      participant: buildParticipantHashFields(input.registration, input.templateData),
      photoAssetId: input.photoAssetId,
      photoContentHash: input.photoContentHash,
      edition: buildEditionHashFields(input.templateData),
      branding: buildBrandingHashFields(input.templateData),
      sponsors: [] as unknown[],
      card: buildCardCopyHashFields(input.templateData),
      rendererVersion: CLICKATON_CARD_RENDERER_VERSION,
      fontConfigVersion: CLICKATON_CARD_FONT_CONFIG_VERSION,
      forceGenerationId: input.forceGenerationId,
    })
  );

  return createHash("sha256")
    .update(JSON.stringify(canonical))
    .digest("hex");
}

export function renderHashPrefix(hash: string): string {
  return hash.slice(0, 12);
}
