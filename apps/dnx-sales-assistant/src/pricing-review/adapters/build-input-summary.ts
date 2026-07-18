import type { QuoteRequestDraft } from "../../quote-request/models.js";
import type { PricingProfile } from "../../pricing/models.js";
import type {
  PricingAssumption,
  PricingInputSummary,
  PricingMissingInformation,
} from "../domain/pricing-review-models.js";

const SERVICE_LABELS: Record<string, string> = {
  WEDDING: "Casamiento",
  FIFTEENTH_BIRTHDAY: "Cumpleaños de quince",
  BIRTHDAY: "Cumpleaños",
  SOCIAL_EVENT: "Evento social",
  SPORTS_EVENT: "Evento deportivo",
  FAMILY_SESSION: "Sesión familiar",
  PORTRAIT_SESSION: "Sesión de retrato",
  CORPORATE_EVENT: "Evento corporativo",
};

export function buildPricingInputSummary(input: {
  draft?: QuoteRequestDraft;
  profile?: PricingProfile;
}): {
  inputSummary: PricingInputSummary;
  assumptions: PricingAssumption[];
  missingInformation: PricingMissingInformation[];
} {
  const draft = input.draft;
  const profile = input.profile;
  const fields: PricingInputSummary["fields"] = [];
  const assumptions: PricingAssumption[] = [];
  const missing: PricingMissingInformation[] = [];

  if (draft?.serviceType && draft.serviceType !== "UNKNOWN") {
    fields.push({
      code: "SERVICE_TYPE",
      label: "Tipo de trabajo",
      valueDescription: SERVICE_LABELS[draft.serviceType] ?? draft.serviceType,
      origin: "PHOTOGRAPHER",
    });
  } else {
    missing.push({
      code: "SERVICE_TYPE",
      label: "Tipo de trabajo",
      whyNeeded: "Define la plantilla y la estructura del cálculo.",
      expectedOrigin: "CONVERSATION",
      action: "preguntarle al fotógrafo",
    });
  }

  if (draft?.eventDate) {
    fields.push({
      code: "EVENT_DATE",
      label: "Fecha",
      valueDescription: draft.eventDate,
      origin: "PHOTOGRAPHER",
    });
  } else {
    fields.push({
      code: "EVENT_DATE",
      label: "Fecha",
      valueDescription: "No informada (metadata; no altera el precio base)",
      origin: "MISSING",
    });
  }

  if (draft?.city) {
    fields.push({
      code: "CITY",
      label: "Ciudad",
      valueDescription: draft.city,
      origin: "PHOTOGRAPHER",
    });
  } else {
    fields.push({
      code: "CITY",
      label: "Ciudad",
      valueDescription: "No informada",
      origin: "MISSING",
    });
  }

  if (draft?.durationHours !== undefined) {
    fields.push({
      code: "DURATION_HOURS",
      label: "Duración de cobertura",
      valueDescription: `${draft.durationHours} horas`,
      origin: "PHOTOGRAPHER",
    });
  } else {
    missing.push({
      code: "DURATION_HOURS",
      label: "Duración de cobertura",
      whyNeeded: "Sin horas no se puede calcular el trabajo.",
      expectedOrigin: "CONVERSATION",
      action: "preguntarle al fotógrafo",
    });
  }

  fields.push({
    code: "PHOTOGRAPHERS",
    label: "Cantidad de fotógrafos",
    valueDescription: "1 (predeterminado)",
    origin: "DEFAULT",
  });
  assumptions.push({
    code: "SINGLE_PHOTOGRAPHER",
    label: "Un solo fotógrafo",
    valueDescription: "Se asume cobertura con un fotógrafo.",
    source: "DEFAULT",
    canChangeResult: true,
  });

  fields.push({
    code: "TRAVEL",
    label: "Traslado",
    valueDescription: "No incluido (predeterminado)",
    origin: "DEFAULT",
  });
  assumptions.push({
    code: "TRAVEL_NOT_INCLUDED",
    label: "Traslado no incluido",
    valueDescription: "No se suma traslado salvo configuración futura.",
    source: "DEFAULT",
    canChangeResult: true,
  });

  if (profile) {
    fields.push({
      code: "CURRENCY",
      label: "Moneda",
      valueDescription: profile.currency || "—",
      origin: "PROFILE",
    });
    fields.push({
      code: "COMMERCIAL_FACTOR",
      label: "Factor comercial",
      valueDescription: profile.commercialPositioningId || "predeterminado",
      origin: "PROFILE",
    });
    assumptions.push({
      code: "COMMERCIAL_POSITIONING",
      label: "Posicionamiento comercial del perfil",
      valueDescription: `Perfil usa «${profile.commercialPositioningId || "default"}».`,
      source: "PROFILE",
      canChangeResult: true,
    });
    if (profile.availability?.billableHoursWeekly) {
      fields.push({
        code: "BILLABLE_HOURS",
        label: "Horas facturables semanales",
        valueDescription: String(profile.availability.billableHoursWeekly),
        origin: "PROFILE",
      });
    }
  } else {
    missing.push({
      code: "PRICING_PROFILE",
      label: "Perfil económico local",
      whyNeeded: "Sin perfil no hay cálculo sostenible.",
      expectedOrigin: "PROFILE",
      action: "configurar archivos .local (pricing:checklist)",
    });
  }

  return { inputSummary: { fields }, assumptions, missingInformation: missing };
}
