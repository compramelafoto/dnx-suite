import {
  CATEGORY_KEYWORD_RULES,
  EDITORIAL_MESSAGES,
  EDITORIAL_THRESHOLDS,
  TAG_STOPWORDS,
} from "../config";
import type {
  EditorialAssistantResult,
  EditorialChecklistItem,
  EditorialDraftSnapshot,
  EditorialQualityLevel,
  EditorialSuggestion,
  EditorialSuggestionProvider,
} from "../types";

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function corpus(draft: EditorialDraftSnapshot): string {
  return [draft.title, draft.excerpt, draft.content].filter(Boolean).join("\n");
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function titleSimilarity(a: string, b: string): number {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const ta = new Set(na.split(/\s+/).filter((w) => w.length > 2));
  const tb = new Set(nb.split(/\s+/).filter((w) => w.length > 2));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  return inter / Math.max(ta.size, tb.size);
}

export function suggestCategorySlug(draft: EditorialDraftSnapshot): string | null {
  const text = normalizeText(corpus(draft));
  if (!text) return null;
  let best: { slug: string; hits: number } | null = null;
  for (const rule of CATEGORY_KEYWORD_RULES) {
    let hits = 0;
    for (const kw of rule.keywords) {
      if (text.includes(normalizeText(kw))) hits += 1;
    }
    if (hits === 0) continue;
    if (!best || hits > best.hits) best = { slug: rule.slug, hits };
  }
  if (!best) return null;
  const exists = draft.availableCategories.some((c) => c.slug === best!.slug);
  return exists ? best.slug : null;
}

export function suggestTags(draft: EditorialDraftSnapshot): string[] {
  const out: string[] = [];
  const push = (v: string | null | undefined) => {
    const t = (v || "").trim();
    if (!t) return;
    if (out.some((x) => normalizeText(x) === normalizeText(t))) return;
    out.push(t);
  };

  push(draft.city);
  push(draft.province);
  push(draft.categoryName);
  push(draft.placeName);

  const proper = (draft.title.match(
    /\b([A-ZÁÉÍÓÚÑ][\p{L}']+(?:\s+[A-ZÁÉÍÓÚÑ][\p{L}']+){0,2})\b/gu,
  ) ?? []) as string[];
  for (const name of proper.slice(0, 5)) {
    if (!TAG_STOPWORDS.has(normalizeText(name))) push(name);
  }

  const tokens = normalizeText(`${draft.title} ${draft.excerpt}`)
    .split(/[^a-z0-9áéíóúñü]+/i)
    .filter((t) => t.length >= 5 && !TAG_STOPWORDS.has(t));
  for (const t of tokens.slice(0, 8)) {
    push(t.charAt(0).toUpperCase() + t.slice(1));
  }

  const selected = new Set((draft.selectedTags ?? []).map(normalizeText));
  return out.filter((t) => !selected.has(normalizeText(t))).slice(0, 10);
}

function buildChecklist(draft: EditorialDraftSnapshot): EditorialChecklistItem[] {
  const m = EDITORIAL_MESSAGES.checklist;
  const bodyLen = draft.content.trim().length;
  const tagsOk = (draft.selectedTags?.length ?? 0) > 0 || suggestTags(draft).length > 0;
  const locOk = Boolean(
    draft.geographicScope === "UNSPECIFIED" ||
      draft.geographicScope === "NATIONAL" ||
      draft.geographicScope === "INTERNATIONAL" ||
      (draft.city && draft.province) ||
      (draft.latitude != null && draft.longitude != null),
  );
  const seoOk =
    Boolean(draft.seoDescription.trim()) ||
    draft.excerpt.trim().length >= EDITORIAL_THRESHOLDS.excerptMin;
  const callOk =
    !draft.linkedEventStartsAt ||
    Boolean(draft.hasPhotographerCall) ||
    true; /* convocatoria opcional */

  return [
    {
      id: "title",
      label: m.title,
      ok: draft.title.trim().length >= EDITORIAL_THRESHOLDS.titleMin,
      required: true,
    },
    { id: "cover", label: m.cover, ok: draft.hasCover, required: false },
    {
      id: "category",
      label: m.category,
      ok: Boolean(draft.categoryId),
      required: true,
    },
    { id: "location", label: m.location, ok: locOk, required: true },
    {
      id: "body",
      label: m.body,
      ok: bodyLen >= EDITORIAL_THRESHOLDS.bodyMin,
      required: true,
    },
    { id: "tags", label: m.tags, ok: tagsOk, required: false },
    { id: "seo", label: m.seo, ok: seoOk, required: false },
    { id: "author", label: m.author, ok: draft.hasAuthor, required: true },
    {
      id: "date",
      label: m.date,
      ok: Boolean(draft.publishedAt) || true,
      required: false,
    },
    {
      id: "call",
      label: m.call,
      ok: callOk,
      required: false,
    },
    {
      id: "source",
      label: m.source,
      ok: draft.hasSource,
      required: false,
    },
  ];
}

function completenessPercent(checklist: EditorialChecklistItem[]): number {
  const required = checklist.filter((c) => c.required);
  const pool = required.length > 0 ? required : checklist;
  if (pool.length === 0) return 0;
  const ok = pool.filter((c) => c.ok).length;
  const optional = checklist.filter((c) => !c.required);
  const optOk = optional.filter((c) => c.ok).length;
  const base = (ok / pool.length) * 85;
  const bonus = optional.length ? (optOk / optional.length) * 15 : 15;
  return Math.round(Math.min(100, base + bonus));
}

function qualityFromCompleteness(
  pct: number,
  bodyLen: number,
): EditorialQualityLevel {
  const t = EDITORIAL_THRESHOLDS.completeness;
  if (pct >= t.excellent && bodyLen >= EDITORIAL_THRESHOLDS.bodyExcellent) {
    return "excellent";
  }
  if (pct >= t.good && bodyLen >= EDITORIAL_THRESHOLDS.bodyGood) return "good";
  if (pct >= t.fair) return "fair";
  return "incomplete";
}

function analyzeGeo(draft: EditorialDraftSnapshot): EditorialSuggestion[] {
  const m = EDITORIAL_MESSAGES.geo;
  const out: EditorialSuggestion[] = [];
  const scope = draft.geographicScope;

  if (!scope) {
    out.push({
      id: "geo-missing-scope",
      kind: "geo",
      severity: "warning",
      title: m.heading,
      message: m.missingScope,
    });
    return out;
  }

  out.push({
    id: "geo-scope",
    kind: "geo",
    severity: "success",
    title: m.heading,
    message: scope,
    meta: { scope },
  });

  if (scope === "LOCAL") {
    if (!draft.city?.trim()) {
      out.push({
        id: "geo-missing-city",
        kind: "geo",
        severity: "warning",
        title: m.heading,
        message: m.missingCity,
      });
    }
    if (!draft.province?.trim()) {
      out.push({
        id: "geo-missing-province",
        kind: "geo",
        severity: "warning",
        title: m.heading,
        message: m.missingProvince,
      });
    }
    if (draft.latitude == null) {
      out.push({
        id: "geo-missing-lat",
        kind: "geo",
        severity: "warning",
        title: m.heading,
        message: m.missingLat,
      });
    }
    if (draft.longitude == null) {
      out.push({
        id: "geo-missing-lng",
        kind: "geo",
        severity: "warning",
        title: m.heading,
        message: m.missingLng,
      });
    }
  }

  if (
    (scope === "PROVINCIAL" || scope === "NATIONAL") &&
    !(draft.countryName || draft.countryCode)
  ) {
    out.push({
      id: "geo-missing-country",
      kind: "geo",
      severity: "warning",
      title: m.heading,
      message: m.missingCountry,
    });
  }

  return out;
}

function analyzeSeo(draft: EditorialDraftSnapshot): EditorialSuggestion[] {
  const m = EDITORIAL_MESSAGES.seo;
  const t = EDITORIAL_THRESHOLDS;
  const out: EditorialSuggestion[] = [];
  const titleLen = draft.title.trim().length;

  if (titleLen > 0 && titleLen < t.titleMin) {
    out.push({
      id: "seo-title-short",
      kind: "seo",
      severity: "warning",
      title: "SEO",
      message: m.titleShort,
    });
  } else if (titleLen > t.titleMax) {
    out.push({
      id: "seo-title-long",
      kind: "seo",
      severity: "info",
      title: "SEO",
      message: m.titleLong,
    });
  }

  if (!draft.seoDescription.trim()) {
    out.push({
      id: "seo-meta-empty",
      kind: "seo",
      severity: "warning",
      title: "SEO",
      message: m.metaEmpty,
    });
  } else if (draft.seoDescription.trim().length < t.seoDescriptionMin) {
    out.push({
      id: "seo-meta-short",
      kind: "seo",
      severity: "info",
      title: "SEO",
      message: m.metaShort,
    });
  } else if (draft.seoDescription.trim().length > t.seoDescriptionMax) {
    out.push({
      id: "seo-meta-long",
      kind: "seo",
      severity: "info",
      title: "SEO",
      message: m.metaLong,
    });
  }

  if (!draft.seoTitle.trim()) {
    out.push({
      id: "seo-title-empty",
      kind: "seo",
      severity: "info",
      title: "SEO",
      message: m.seoTitleEmpty,
    });
  }

  const slug = draft.slug.trim();
  if (
    slug &&
    (slug.length < t.slugMin ||
      /^(nota|articulo|article|untitled|sin-titulo)/.test(slug) ||
      /\d{8,}/.test(slug))
  ) {
    out.push({
      id: "seo-slug-weak",
      kind: "seo",
      severity: "info",
      title: "SEO",
      message: m.slugWeak,
    });
  }

  return out;
}

function analyzeCall(draft: EditorialDraftSnapshot): EditorialSuggestion[] {
  if (draft.hasPhotographerCall) return [];
  const starts = draft.linkedEventStartsAt
    ? Date.parse(draft.linkedEventStartsAt)
    : NaN;
  const future = Number.isFinite(starts) && starts > Date.now();
  const text = normalizeText(corpus(draft));
  const looksLikeEvent =
    future ||
    /\b(festival|partido|concierto|evento|torneo|feria|marat[oó]n)\b/.test(text);

  if (!looksLikeEvent) return [];

  return [
    {
      id: "call-suggest",
      kind: "call",
      severity: "info",
      title: EDITORIAL_MESSAGES.call.heading,
      message: EDITORIAL_MESSAGES.call.cta,
      action: { type: "noop" },
      meta: {
        eventTitle: draft.linkedEventTitle ?? null,
        startsAt: draft.linkedEventStartsAt ?? null,
      },
    },
  ];
}

function analyzeBanner(draft: EditorialDraftSnapshot): EditorialSuggestion[] {
  const priority = draft.editorialPriority ?? 0;
  const national = draft.geographicScope === "NATIONAL";
  const strong =
    priority >= EDITORIAL_THRESHOLDS.banner.minPriority ||
    (national && draft.hasCover && draft.content.trim().length >= EDITORIAL_THRESHOLDS.bodyGood);

  if (!strong) return [];
  return [
    {
      id: "banner-suggest",
      kind: "banner",
      severity: "info",
      title: EDITORIAL_MESSAGES.banner.heading,
      message: EDITORIAL_MESSAGES.banner.heading,
      meta: { priority, national },
    },
  ];
}

/**
 * Proveedor basado en reglas — implementación actual (sin LLM).
 */
export class RuleBasedSuggestionProvider implements EditorialSuggestionProvider {
  readonly id = "rule-based";

  analyze(draft: EditorialDraftSnapshot): EditorialAssistantResult {
    const suggestions: EditorialSuggestion[] = [];
    const checklist = buildChecklist(draft);
    const pct = completenessPercent(checklist);
    const bodyLen = draft.content.trim().length;
    const qualityLevel = qualityFromCompleteness(pct, bodyLen);
    const qualityLabel = EDITORIAL_MESSAGES.quality[qualityLevel];

    suggestions.push({
      id: "quality",
      kind: "quality",
      severity:
        qualityLevel === "excellent" || qualityLevel === "good"
          ? "success"
          : qualityLevel === "fair"
            ? "info"
            : "warning",
      title: "Calidad editorial",
      message: qualityLabel,
      meta: { qualityLevel, completenessPercent: pct },
    });

    const suggestedSlug = suggestCategorySlug(draft);
    if (suggestedSlug) {
      const cat = draft.availableCategories.find((c) => c.slug === suggestedSlug);
      if (cat) {
        const same = draft.categoryId === cat.id;
        if (!same) {
          suggestions.push({
            id: "category-suggest",
            kind: "category",
            severity: "info",
            title: draft.categoryId
              ? EDITORIAL_MESSAGES.category.alternative
              : EDITORIAL_MESSAGES.category.suggested,
            message: cat.name,
            action: {
              type: "applyCategory",
              payload: { categoryId: cat.id, slug: cat.slug, name: cat.name },
            },
          });
        }
      }
    }

    const tags = suggestTags(draft);
    if (tags.length > 0) {
      suggestions.push({
        id: "tags-suggest",
        kind: "tag",
        severity: "info",
        title: EDITORIAL_MESSAGES.tags.heading,
        message: tags.join(" · "),
        action: { type: "applyTag", payload: { tags } },
        meta: { tags },
      });
    }

    suggestions.push(...analyzeGeo(draft));
    suggestions.push(...analyzeSeo(draft));
    suggestions.push(...analyzeCall(draft));
    suggestions.push(...analyzeBanner(draft));

    const duplicates = draft.duplicateHits ?? [];
    if (duplicates.length > 0) {
      suggestions.push({
        id: "duplicates",
        kind: "duplicate",
        severity: "warning",
        title: EDITORIAL_MESSAGES.duplicates.heading,
        message: `${duplicates.length} posible(s)`,
        meta: { items: duplicates },
      });
    } else if (draft.title.trim().length >= 8) {
      // Placeholder: la app puede enriquecer; heurística local contra relatedHits.
      const similar = (draft.relatedHits ?? []).filter(
        (h) =>
          titleSimilarity(draft.title, h.title) >=
          EDITORIAL_THRESHOLDS.duplicate.titleSimilarity,
      );
      if (similar.length > 0) {
        suggestions.push({
          id: "duplicates-related",
          kind: "duplicate",
          severity: "warning",
          title: EDITORIAL_MESSAGES.duplicates.heading,
          message: `${similar.length} posible(s)`,
          meta: { items: similar },
        });
      }
    }

    const related = draft.relatedHits ?? [];
    if (related.length > 0) {
      suggestions.push({
        id: "related",
        kind: "related",
        severity: "info",
        title: EDITORIAL_MESSAGES.related.heading,
        message: `${related.length} hallazgo(s)`,
        meta: { items: related },
      });
    }

    const links = draft.linkHits ?? related.slice(0, 5);
    if (links.length > 0) {
      suggestions.push({
        id: "links",
        kind: "link",
        severity: "info",
        title: EDITORIAL_MESSAGES.links.heading,
        message: `${links.length} enlace(s)`,
        meta: { items: links },
      });
    }

    for (const item of checklist.filter((c) => c.required && !c.ok)) {
      suggestions.push({
        id: `checklist-${item.id}`,
        kind: "checklist",
        severity: "warning",
        title: "Checklist",
        message: item.label,
        meta: { checklistId: item.id },
      });
    }

    const score = Math.round(
      pct * 0.7 +
        Math.min(30, wordCount(draft.content) / 20) +
        (draft.hasCover ? 5 : 0) +
        (draft.seoDescription.trim() ? 5 : 0),
    );

    const locationLabel = [draft.city, draft.province, draft.countryName]
      .filter(Boolean)
      .join(", ");

    const callSuggested = suggestions.some((s) => s.kind === "call");
    const bannerSuggested = suggestions.some((s) => s.kind === "banner");

    suggestions.push({
      id: "summary",
      kind: "summary",
      severity: "info",
      title: EDITORIAL_MESSAGES.summary.heading,
      message: `${qualityLabel} · ${pct}% · score ${Math.min(100, score)}`,
      meta: {
        category: draft.categoryName,
        scope: draft.geographicScope,
        hasCover: draft.hasCover,
        locationLabel: locationLabel || null,
        seoOk: Boolean(draft.seoDescription.trim()),
        callSuggested,
        bannerSuggested,
        duplicateCount: duplicates.length,
        relatedCount: related.length,
        score: Math.min(100, score),
      },
    });

    return {
      qualityLevel,
      qualityLabel,
      score: Math.min(100, score),
      completenessPercent: pct,
      checklist,
      suggestions,
      summary: {
        category: draft.categoryName,
        scope: draft.geographicScope,
        hasCover: draft.hasCover,
        locationLabel: locationLabel || null,
        seoOk: Boolean(draft.seoDescription.trim()),
        callSuggested,
        bannerSuggested,
        duplicateCount: (draft.duplicateHits ?? []).length,
        relatedCount: related.length,
        score: Math.min(100, score),
      },
      providerId: this.id,
    };
  }
}
