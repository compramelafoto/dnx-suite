export const DEFAULT_EVENT_PHOTOGRAPHER_TERMS =
  "Al inscribirte confirmás que participarás del evento y respetarás las normas del organizador. " +
  "Si no podés asistir, avisá con al menos 24 horas de anticipación desde tu panel.";

type EventTermsSource = {
  photographerTerms?: string | null;
};

export function resolveEventPhotographerTerms(event: EventTermsSource | null | undefined): string {
  const custom = event?.photographerTerms?.trim();
  return custom && custom.length > 0 ? custom : DEFAULT_EVENT_PHOTOGRAPHER_TERMS;
}
