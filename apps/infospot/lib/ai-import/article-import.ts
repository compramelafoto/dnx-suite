import {
  assertHeadersForContext,
  detectCsvContext,
  parseCsvWithPapa,
} from "./csv-parser";
import {
  matchCategory,
  normalizeDate,
  normalizeProvince,
  normalizeUrl,
  normalizeWhitespace,
  parseTags,
  unescapeMarkdownBody,
} from "./normalizers";
import type {
  AiImportContext,
  AiImportParseResult,
  ArticleFormImportValues,
  CategoryOption,
  PreviewField,
} from "./schemas";

const LABELS: Record<string, string> = {
  title: "Título",
  subtitle: "Subtítulo",
  excerpt: "Extracto",
  body_markdown: "Cuerpo",
  category: "Categoría",
  author_name: "Autor",
  event_name: "Evento relacionado",
  event_date: "Fecha del evento",
  city: "Ciudad",
  province: "Provincia",
  source_name: "Fuente",
  source_url: "URL fuente",
  seo_title: "SEO título",
  seo_description: "SEO descripción",
  cover_credit: "Crédito portada",
  tags: "Etiquetas",
  fact_check_notes: "Fact-check",
  notes_for_editor: "Notas para el editor",
};

function field(
  key: string,
  value: string,
  status: PreviewField["status"],
  note?: string,
): PreviewField {
  return {
    key,
    label: LABELS[key] ?? key,
    value,
    status,
    note,
  };
}

export function analyzeArticleCsv(params: {
  rawCsv: string;
  categories: CategoryOption[];
  Papa: Parameters<typeof parseCsvWithPapa>[1];
  expectedContext?: AiImportContext;
}): AiImportParseResult {
  const parsed = parseCsvWithPapa(params.rawCsv, params.Papa);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const detected = detectCsvContext(parsed.table.headers);
  if (params.expectedContext && detected && detected !== params.expectedContext) {
    return {
      ok: false,
      error: "Este CSV parece de evento, pero el contexto actual es artículo.",
    };
  }
  const context: AiImportContext = params.expectedContext ?? detected ?? "ARTICLE";
  if (context !== "ARTICLE") {
    return { ok: false, error: "El CSV no corresponde a un artículo." };
  }

  const headerErr = assertHeadersForContext("ARTICLE", parsed.table.headers);
  if (headerErr) return { ok: false, error: headerErr };

  const row = parsed.table.rows[0]!;
  const warnings: string[] = [];
  const preview: PreviewField[] = [];
  const values: ArticleFormImportValues = {};

  const title = normalizeWhitespace(row.title ?? "");
  if (title) {
    values.title = title;
    preview.push(field("title", title, "detected"));
  } else {
    preview.push(field("title", "", "missing", "Obligatorio"));
  }

  const excerpt = normalizeWhitespace(row.excerpt ?? row.subtitle ?? "");
  if (excerpt) {
    values.excerpt = excerpt;
    preview.push(field("excerpt", excerpt, "detected"));
  } else {
    preview.push(field("excerpt", "", "missing"));
  }

  const body = unescapeMarkdownBody(row.body_markdown ?? "");
  if (body.trim()) {
    values.content = body;
    preview.push(field("body_markdown", body.slice(0, 180), "detected"));
  } else {
    preview.push(field("body_markdown", "", "missing", "Conviene una base editable"));
  }

  const catRaw = normalizeWhitespace(row.category ?? "");
  if (catRaw) {
    const matched = matchCategory(catRaw, params.categories);
    values.categoryLabel = catRaw;
    values.categoryUnknown = matched.unknown;
    values.categoryId = matched.id ?? undefined;
    preview.push(
      field(
        "category",
        catRaw,
        matched.unknown ? "review" : "detected",
        matched.suggestion,
      ),
    );
    if (matched.suggestion) warnings.push(matched.suggestion);
  } else {
    preview.push(field("category", "", "missing"));
  }

  const seoTitle = normalizeWhitespace(row.seo_title ?? "");
  if (seoTitle) {
    values.seoTitle = seoTitle;
    preview.push(field("seo_title", seoTitle, "detected"));
  }
  const seoDescription = normalizeWhitespace(row.seo_description ?? "");
  if (seoDescription) {
    values.seoDescription = seoDescription;
    preview.push(field("seo_description", seoDescription, "detected"));
  }

  const sourceName = normalizeWhitespace(row.source_name ?? "");
  if (sourceName) {
    values.sourceName = sourceName;
    preview.push(field("source_name", sourceName, "detected"));
  }
  const sourceUrl = normalizeUrl(row.source_url ?? "");
  if (sourceUrl.review) {
    preview.push(field("source_url", row.source_url ?? "", "review", sourceUrl.review));
    warnings.push(sourceUrl.review);
  } else if (sourceUrl.value) {
    values.sourceUrl = sourceUrl.value;
    preview.push(field("source_url", sourceUrl.value, "detected"));
  }

  const coverCredit = normalizeWhitespace(row.cover_credit ?? "");
  if (coverCredit) {
    values.coverCredit = coverCredit;
    preview.push(field("cover_credit", coverCredit, "detected"));
  }

  const tags = parseTags(row.tags ?? "");
  if (tags.length) {
    values.tags = tags;
    preview.push(field("tags", tags.join(" | "), "detected"));
  }

  const eventName = normalizeWhitespace(row.event_name ?? "");
  if (eventName) {
    values.eventName = eventName;
    preview.push(field("event_name", eventName, "review", "Sugerí vincular un evento manualmente"));
    warnings.push(`Evento mencionado: «${eventName}». Buscalo y vinculalo si corresponde.`);
  }
  const eventDate = normalizeDate(row.event_date ?? "");
  if (eventDate.review) {
    preview.push(field("event_date", row.event_date ?? "", "review", eventDate.review));
  } else if (eventDate.value) {
    values.eventDate = eventDate.value;
    preview.push(field("event_date", eventDate.value, "detected"));
  }

  const city = normalizeWhitespace(row.city ?? "");
  if (city) {
    values.city = city;
    preview.push(field("city", city, "detected"));
  }
  const province = normalizeProvince(row.province ?? "");
  if (province) {
    values.province = province;
    preview.push(field("province", province, "detected"));
  }

  const fact = (row.fact_check_notes ?? "").trim();
  if (fact) {
    values.factCheckNotes = fact;
    preview.push(field("fact_check_notes", fact, "review"));
    warnings.push("Hay puntos de fact-check pendientes.");
  }

  const notes = (row.notes_for_editor ?? "").trim();
  if (notes) {
    values.notesForEditor = notes;
    preview.push(field("notes_for_editor", notes, "review"));
    warnings.push("La IA dejó notas para el editor.");
  }

  const author = normalizeWhitespace(row.author_name ?? "");
  if (author) preview.push(field("author_name", author, "detected"));

  return {
    ok: true,
    context: "ARTICLE",
    rawRow: row,
    preview,
    articleValues: values,
    warnings,
  };
}
