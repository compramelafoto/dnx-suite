const STORAGE_KEY = "cc-wizard-active-consulta-id";

export function setActiveWizardConsultaId(consultaId: number | null): void {
  if (typeof window === "undefined") return;
  if (consultaId == null || consultaId <= 0) {
    sessionStorage.removeItem(STORAGE_KEY);
    return;
  }
  sessionStorage.setItem(STORAGE_KEY, String(consultaId));
}

export function getActiveWizardConsultaId(): number | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export function parseConsultaIdParam(value: string | string[] | undefined): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return null;
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export function parseQuoteIdParam(value: string | string[] | undefined): number | null {
  return parseConsultaIdParam(value);
}
