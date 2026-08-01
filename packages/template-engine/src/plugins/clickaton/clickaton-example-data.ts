import {
  formatDateDayMonthUppercase,
  formatDateShort,
  formatParticipantNumber,
} from "../../variables/date-format";
import { normalizeInstagramHandle } from "./normalize-instagram";

/**
 * PNG 1×1 amarillo Clickatón (#FFE600) — fixture local, sin PII.
 * Usar como photoUrl / logo placeholder en preview.
 */
export const CLICKATON_FIXTURE_PHOTO_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5/hPwAIAgL/4d1j8wAAAABJRU5ErkJggg==";

export type ClickatonExampleDataOverrides = Record<string, unknown>;

function deepMerge(
  base: Record<string, unknown>,
  overrides?: Record<string, unknown>
): Record<string, unknown> {
  if (!overrides) return base;
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(overrides)) {
    if (
      v &&
      typeof v === "object" &&
      !Array.isArray(v) &&
      out[k] &&
      typeof out[k] === "object" &&
      !Array.isArray(out[k])
    ) {
      out[k] = deepMerge(out[k] as Record<string, unknown>, v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Datos de ejemplo no sensibles para preview/tests Clickatón.
 * No consulta inscripciones ni participantes reales.
 */
export function createClickatonTemplateExampleData(
  overrides?: ClickatonExampleDataOverrides
): Record<string, unknown> {
  const eventDate = "2026-09-19";
  const number = 154;
  const igRaw = "dnxfotografia";
  const ig = normalizeInstagramHandle(igRaw);

  const nested: Record<string, unknown> = {
    participant: {
      id: "p-demo-001",
      fullName: "Daniel Fotógrafo",
      firstName: "Daniel",
      lastName: "Fotógrafo",
      displayName: "DANIEL FOTÓGRAFO",
      instagram: ig.ok ? ig.handle : "",
      instagramHandle: ig.ok ? ig.displayHandle : "",
      city: "Rosario",
      province: "Santa Fe",
      country: "Argentina",
      category: "Profesional",
      number,
      numberFormatted: formatParticipantNumber(number, 4),
      photo: CLICKATON_FIXTURE_PHOTO_DATA_URL,
      photoUrl: CLICKATON_FIXTURE_PHOTO_DATA_URL,
    },
    edition: {
      id: "ed-rosario-2026",
      name: "Clickatón Rosario",
      shortName: "Rosario",
      city: "Rosario",
      venue: "Centro de la ciudad",
      eventDate,
      eventDateFormatted: formatDateDayMonthUppercase(eventDate),
      registrationDate: "2026-08-01",
      registrationDateFormatted: formatDateShort("2026-08-01"),
      theme: "Miradas urbanas",
      slug: "clickaton-rosario-2026",
    },
    event: {
      name: "Clickatón Rosario",
      date: eventDate,
      dateFormatted: formatDateDayMonthUppercase(eventDate),
      city: "Rosario",
      venue: "Centro de la ciudad",
    },
    branding: {
      name: "Clickatón",
      logo: CLICKATON_FIXTURE_PHOTO_DATA_URL,
      logoUrl: CLICKATON_FIXTURE_PHOTO_DATA_URL,
      isotype: CLICKATON_FIXTURE_PHOTO_DATA_URL,
      isotypeUrl: CLICKATON_FIXTURE_PHOTO_DATA_URL,
      primaryColor: "#FFE600",
      secondaryColor: "#000000",
      accentColor: "#3B1F6E",
      website: "maratonfotografica.com",
      instagram: "@clickaton",
    },
    organization: {
      name: "DNX",
      logo: "",
      instagram: "@dnxfotografia",
    },
    sponsors: {
      primary: { name: "Sponsor Principal", logo: "" },
      secondary: { name: "Sponsor Secundario", logo: "" },
    },
    card: {
      title: "¡BIENVENID@ A CLICKATÓN!",
      subtitle: "SOY PARTE DE CLICKATÓN",
      message:
        "Una comunidad que recorre, crea y muestra la ciudad desde nuevas miradas.",
      callToAction: "Compartí tu placa",
    },
  };

  const merged = deepMerge(nested, overrides);

  // Normalizar Instagram si vino en overrides
  const participant = merged.participant as Record<string, unknown> | undefined;
  if (participant) {
    const rawIg =
      participant.instagramHandle ?? participant.instagram ?? "";
    if (rawIg !== undefined && rawIg !== null && String(rawIg).trim() !== "") {
      const n = normalizeInstagramHandle(rawIg);
      if (n.ok) {
        participant.instagram = n.handle;
        participant.instagramHandle = n.displayHandle;
      } else {
        participant.instagram = "";
        participant.instagramHandle = "";
      }
    } else {
      participant.instagram = "";
      participant.instagramHandle = "";
    }
    if (participant.number != null && participant.numberFormatted == null) {
      participant.numberFormatted = formatParticipantNumber(participant.number, 4);
    }
  }

  // Flat paths (compat resolución)
  const flat: Record<string, unknown> = {};
  const walk = (obj: Record<string, unknown>, prefix: string) => {
    for (const [k, v] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${k}` : k;
      if (v && typeof v === "object" && !Array.isArray(v)) {
        walk(v as Record<string, unknown>, path);
      } else {
        flat[path] = v;
      }
    }
  };
  walk(merged, "");

  return { ...merged, ...flat };
}

/** Alias constante para tests / imports estáticos. */
export const CLICKATON_TEMPLATE_EXAMPLE_DATA = createClickatonTemplateExampleData();
