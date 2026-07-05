import type { CuantoCobroConsultaDetailDto } from "./types";
import {
  INITIAL_CUANTO_COBRO_CLIENT_HOURS,
  INITIAL_CUANTO_COBRO_QUOTE,
  type CuantoCobroProfileInput,
  type CuantoCobroQuoteInput,
} from "../types";

function buildJobLocation(consulta: CuantoCobroConsultaDetailDto): string {
  const parts = [
    consulta.eventLocation,
    consulta.eventCity,
    consulta.eventProvince,
    consulta.eventCountry,
  ]
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.join(", ");
}

function buildInternalNotes(consulta: CuantoCobroConsultaDetailDto): string {
  const lines: string[] = [];

  if (consulta.brief.trim()) {
    lines.push(consulta.brief.trim());
  }

  for (const note of consulta.notes) {
    const body = note.body.trim();
    if (body) lines.push(body);
  }

  return lines.join("\n\n");
}

/** Precarga el wizard con datos de la consulta comercial. */
export function applyConsultaToQuoteSeed(
  consulta: CuantoCobroConsultaDetailDto,
  baseQuote: CuantoCobroQuoteInput = INITIAL_CUANTO_COBRO_QUOTE,
): CuantoCobroQuoteInput {
  const jobLocation = buildJobLocation(consulta);
  const internalNotes = buildInternalNotes(consulta);

  return {
    ...baseQuote,
    client: {
      ...baseQuote.client,
      hours: { ...INITIAL_CUANTO_COBRO_CLIENT_HOURS },
      name: consulta.clientDisplayName.trim(),
      company: consulta.clientCompany.trim(),
      email: consulta.clientEmail.trim(),
      phone: consulta.clientPhone.trim(),
      jobDate: consulta.eventDate ?? "",
      jobLocation,
      jobLatitude: consulta.eventLatitude.trim(),
      jobLongitude: consulta.eventLongitude.trim(),
      jobType: consulta.jobType.trim() || consulta.title.trim(),
      clfClientKey: consulta.clfClientKey ?? undefined,
    },
    concepts: [],
    internalNotes,
    chosenPrice: "",
    status: "draft",
  };
}

export function applyConsultaCurrencyToProfile(
  consulta: CuantoCobroConsultaDetailDto,
  profile: CuantoCobroProfileInput,
): CuantoCobroProfileInput {
  const currency = consulta.currency.trim().toUpperCase();
  if (!currency) return profile;
  return { ...profile, currency };
}
