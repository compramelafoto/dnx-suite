import {
  assertHeadersForContext,
  detectCsvContext,
  parseCsvWithPapa,
} from "./csv-parser";
import {
  matchCategory,
  normalizeBool,
  normalizeCountry,
  normalizeDate,
  normalizePhone,
  normalizeProvince,
  normalizeTime,
  normalizeUrl,
  normalizeWhitespace,
  toDatetimeLocal,
} from "./normalizers";
import type {
  AiImportContext,
  AiImportParseResult,
  CategoryOption,
  EventFormImportValues,
  PreviewField,
} from "./schemas";

const LABELS: Record<string, string> = {
  event_name: "Nombre del evento",
  short_description: "Resumen",
  full_description: "Descripción",
  category: "Categoría",
  start_date: "Fecha inicio",
  start_time: "Hora inicio",
  end_date: "Fecha fin",
  end_time: "Hora fin",
  venue_name: "Lugar",
  address: "Dirección",
  city: "Ciudad",
  province: "Provincia",
  country: "País",
  organizer_name: "Organizador",
  organizer_email: "Email organizador",
  organizer_phone: "Teléfono",
  website_url: "Web",
  registration_url: "Inscripción",
  source_name: "Fuente",
  source_url: "URL fuente",
  notes_for_editor: "Notas para el editor",
  is_free: "Gratuito",
  requires_photographers: "Busca fotógrafos",
  requires_participants: "Busca participantes",
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

export function analyzeEventCsv(params: {
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
      error: "Este CSV parece de artículo, pero el contexto actual es evento.",
    };
  }
  const context: AiImportContext = params.expectedContext ?? detected ?? "EVENT";
  if (context !== "EVENT") {
    return { ok: false, error: "El CSV no corresponde a un evento." };
  }

  const headerErr = assertHeadersForContext("EVENT", parsed.table.headers);
  if (headerErr) return { ok: false, error: headerErr };

  const row = parsed.table.rows[0]!;
  const warnings: string[] = [];
  const preview: PreviewField[] = [];
  const values: EventFormImportValues = {};

  const name = normalizeWhitespace(row.event_name ?? "");
  if (name) {
    values.title = name;
    preview.push(field("event_name", name, "detected"));
  } else {
    preview.push(field("event_name", "", "missing", "Obligatorio"));
  }

  const summary = normalizeWhitespace(row.short_description ?? "");
  if (summary) {
    values.summary = summary;
    preview.push(field("short_description", summary, "detected"));
  } else {
    preview.push(field("short_description", "", "missing"));
  }

  const description = (row.full_description ?? "").trim();
  if (description) {
    values.description = description;
    preview.push(field("full_description", description.slice(0, 180), "detected"));
  } else {
    preview.push(field("full_description", "", "missing", "Obligatorio para enviar"));
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

  const startDate = normalizeDate(row.start_date ?? "");
  const startTime = normalizeTime(row.start_time ?? "");
  const endDate = normalizeDate(row.end_date ?? "");
  const endTime = normalizeTime(row.end_time ?? "");
  if (startDate.review) {
    preview.push(field("start_date", row.start_date ?? "", "review", startDate.review));
    warnings.push(startDate.review);
  } else if (startDate.value) {
    preview.push(field("start_date", startDate.value, "detected"));
  } else {
    preview.push(field("start_date", "", "missing", "Obligatorio"));
  }
  if (startTime.review) {
    preview.push(field("start_time", row.start_time ?? "", "review", startTime.review));
    warnings.push(startTime.review);
  } else if (startTime.value) {
    preview.push(field("start_time", startTime.value, "detected"));
  }

  const startAt = toDatetimeLocal(startDate.value, startTime.value);
  if (startAt) values.startAt = startAt;
  const endAt = toDatetimeLocal(endDate.value, endTime.value);
  if (endAt) values.endAt = endAt;
  if (endDate.review) warnings.push(endDate.review);
  if (endTime.review) warnings.push(endTime.review);

  const venue = normalizeWhitespace(row.venue_name ?? "");
  if (venue) {
    values.venueName = venue;
    preview.push(field("venue_name", venue, "detected"));
  } else preview.push(field("venue_name", "", "missing"));

  const address = normalizeWhitespace(row.address ?? "");
  if (address) {
    values.address = address;
    preview.push(field("address", address, "detected"));
  }

  const city = normalizeWhitespace(row.city ?? "");
  if (city) {
    values.city = city;
    preview.push(field("city", city, "detected"));
  } else preview.push(field("city", "", "missing", "Obligatorio"));

  const province = normalizeProvince(row.province ?? "");
  if (province) {
    values.province = province;
    preview.push(field("province", province, "detected"));
  } else preview.push(field("province", "", "missing", "Obligatorio"));

  const country = normalizeCountry(row.country ?? "");
  if (country) preview.push(field("country", country, "detected"));

  const orgName = normalizeWhitespace(row.organizer_name ?? "");
  if (orgName) {
    values.organizerName = orgName;
    preview.push(field("organizer_name", orgName, "detected"));
  } else preview.push(field("organizer_name", "", "missing", "Obligatorio"));

  const orgEmail = normalizeWhitespace(row.organizer_email ?? "");
  if (orgEmail) {
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(orgEmail);
    values.organizerEmail = orgEmail;
    preview.push(
      field("organizer_email", orgEmail, ok ? "detected" : "review", ok ? undefined : "Email dudoso"),
    );
    if (!ok) warnings.push("Email de organizador con formato dudoso.");
  } else preview.push(field("organizer_email", "", "missing", "Obligatorio"));

  const phone = normalizePhone(row.organizer_phone ?? "");
  if (phone) {
    values.organizerPhone = phone;
    preview.push(field("organizer_phone", phone, "detected"));
  }

  for (const [csvKey, formKey] of [
    ["website_url", "organizerWebsite"],
    ["registration_url", "registrationUrl"],
    ["ticket_url", "registrationUrl"],
    ["source_url", "sourceUrl"],
  ] as const) {
    const url = normalizeUrl(row[csvKey] ?? "");
    if (url.review) {
      preview.push(field(csvKey, row[csvKey] ?? "", "review", url.review));
      warnings.push(url.review);
    } else if (url.value) {
      values[formKey] = url.value;
      preview.push(field(csvKey, url.value, "detected"));
    }
  }

  const isFree = normalizeBool(row.is_free ?? "");
  if (row.is_free?.trim() && isFree === null) {
    preview.push(field("is_free", row.is_free, "review", "Booleano inválido"));
  } else if (isFree !== null) {
    preview.push(field("is_free", String(isFree), "detected"));
  }

  for (const key of ["requires_photographers", "requires_participants"] as const) {
    const b = normalizeBool(row[key] ?? "");
    if (row[key]?.trim() && b === null) {
      preview.push(field(key, row[key]!, "review", "Booleano inválido"));
    } else if (b !== null) {
      preview.push(field(key, String(b), "detected"));
    }
  }

  const notes = (row.notes_for_editor ?? "").trim();
  if (notes) {
    values.notesForEditor = notes;
    preview.push(field("notes_for_editor", notes, "review", "Revisar con el equipo"));
    warnings.push("La IA dejó notas para el editor.");
  }

  const sourceName = normalizeWhitespace(row.source_name ?? "");
  if (sourceName) preview.push(field("source_name", sourceName, "detected"));

  return {
    ok: true,
    context: "EVENT",
    rawRow: row,
    preview,
    eventValues: values,
    warnings,
  };
}
