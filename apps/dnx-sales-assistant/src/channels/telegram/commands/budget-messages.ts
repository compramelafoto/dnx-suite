import type { PricingReviewResult } from "../../../pricing-review/domain/pricing-review-models.js";
import type { QuoteRequestDraft } from "../../../quote-request/models.js";
import { keyboardFromButtons } from "../bot/telegram-api-client.js";
import type { TelegramOutboundMessage } from "../domain/models.js";
import { formatMoney } from "../rendering/format.js";

const SERVICE_LABELS: Record<string, string> = {
  WEDDING: "Casamiento",
  FIFTEENTH_BIRTHDAY: "Cumpleaños de quince",
  BIRTHDAY: "Cumpleaños",
  SOCIAL_EVENT: "Evento social",
  SPORTS_EVENT: "Evento deportivo",
  FAMILY_SESSION: "Sesión familiar",
  PORTRAIT_SESSION: "Sesión de retrato",
  CORPORATE_EVENT: "Evento corporativo",
  PRODUCT_PHOTOGRAPHY: "Producto",
  OTHER: "Otro",
};

export function budgetKeyboard() {
  return keyboardFromButtons(
    [
      { text: "Ver explicación", callbackData: "budget:explain" },
      { text: "Ver supuestos", callbackData: "budget:assumptions" },
      { text: "Aprobar", callbackData: "budget:approve" },
      { text: "Necesita ajuste", callbackData: "budget:adjust" },
      { text: "Nueva cotización", callbackData: "budget:new" },
    ],
    2,
  );
}

export function formatBudgetMessage(
  draft: QuoteRequestDraft | undefined,
  review: PricingReviewResult,
): string {
  if (review.status === "NOT_CONFIGURED") {
    return [
      "Todavía no tengo tu perfil económico local configurado en esta máquina.",
      "Completalo con pricing:checklist y volvé a pedir /presupuesto.",
    ].join("\n");
  }

  if (review.status === "INCOMPLETE" || !review.result) {
    const missing = review.missingInformation[0];
    if (missing) {
      return [
        "Todavía no puedo cerrar el presupuesto.",
        `Me falta: ${missing.label}.`,
        missing.action === "preguntarle al fotógrafo"
          ? "Contame ese dato y lo retomo."
          : "Revisá la configuración local del perfil.",
      ].join("\n");
    }
    return "Todavía me faltan datos para armar el presupuesto. Seguí la conversación y después pedí /presupuesto.";
  }

  if (review.status === "FAILED") {
    return "No pude completar el cálculo con la configuración actual. Revisá el perfil local y probá de nuevo.";
  }

  const work =
    SERVICE_LABELS[draft?.serviceType ?? ""] ??
    draft?.serviceType ??
    "Trabajo";
  const lines = [
    "Presupuesto listo",
    "",
    `Trabajo: ${work}`,
    `Lugar: ${draft?.city ?? "—"}`,
    `Duración: ${draft?.durationHours ?? "—"} horas`,
    "Fotógrafos: 1",
    "",
    `Mínimo sostenible: ${formatMoney(review.result.currency, review.result.minimumSustainable)}`,
    `Precio recomendado: ${formatMoney(review.result.currency, review.result.recommendedPrice)}`,
    "",
    "El mínimo es el valor por debajo del cual este trabajo dejaría de ser sostenible.",
    "",
    "El recomendado agrega el factor comercial definido en tu perfil y es el valor que te conviene tomar como base para cotizar.",
  ];

  const warns = review.warnings
    .filter((w) => w.severity !== "INFO")
    .slice(0, 3)
    .map((w) => `• ${w.message}`);
  if (warns.length) {
    lines.push("", "Advertencias:", ...warns);
  }

  return lines.join("\n");
}

export function formatAssumptionsMessage(review: PricingReviewResult): string {
  const relevant = review.assumptions.filter((a) => a.canChangeResult);
  if (!relevant.length) {
    return "No hay supuestos relevantes marcados para este cálculo.";
  }
  return [
    "Supuestos relevantes",
    "",
    ...relevant.map((a) => `• ${a.label}: ${a.valueDescription}`),
  ].join("\n");
}

export function formatEstadoMessage(input: {
  draft?: QuoteRequestDraft;
  quoteStatus?: string;
  missingFields?: string[];
  pricingStatus?: string;
}): string {
  const d = input.draft;
  return [
    "Estado de la cotización",
    "",
    `Trabajo: ${d?.serviceType && d.serviceType !== "UNKNOWN" ? SERVICE_LABELS[d.serviceType] ?? d.serviceType : "—"}`,
    `Fecha: ${d?.eventDate ?? "—"}`,
    `Ciudad: ${d?.city ?? "—"}`,
    `Duración: ${d?.durationHours !== undefined ? `${d.durationHours} horas` : "—"}`,
    `Faltantes: ${(input.missingFields ?? []).join(", ") || "(ninguno)"}`,
    `Estado quote: ${input.quoteStatus ?? "—"}`,
    `Estado cálculo: ${input.pricingStatus ?? "—"}`,
  ].join("\n");
}

export function outboundBudget(
  chatId: string,
  text: string,
  withButtons: boolean,
): TelegramOutboundMessage {
  return {
    chatId,
    text,
    replyMarkup: withButtons ? budgetKeyboard() : undefined,
  };
}
