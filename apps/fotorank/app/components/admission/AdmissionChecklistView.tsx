/**
 * Checklist visual canónico para organizador (semáforo + resultado final).
 * Fuente de color: status del check (PASS/WARNING/FAIL), no inferencia por texto.
 */

export type AdmissionCheckRow = {
  checkCode: string;
  status: string;
  title: string;
  message: string;
  reasonCode?: string | null;
  source?: "automatic" | "manual" | string | null;
  updatedAt?: string | null;
  evidenceSummary?: string | null;
};

export type ChecklistLight = "GREEN" | "YELLOW" | "RED";

export type ChecklistFinalResult = "LISTA_PARA_ADMITIR" | "REQUIERE_REVISION" | "RECHAZADA";

export function lightForCheckStatus(status: string): {
  light: ChecklistLight;
  emoji: string;
  label: string;
  className: string;
} {
  const s = status.toUpperCase();
  if (s === "PASS" || s === "OK" || s === "APPROVED") {
    return {
      light: "GREEN",
      emoji: "🟢",
      label: "Correcto",
      className: "text-emerald-300",
    };
  }
  if (s === "FAIL" || s === "REJECTED" || s === "TECHNICALLY_REJECTED") {
    return {
      light: "RED",
      emoji: "🔴",
      label: "Error",
      className: "text-red-300",
    };
  }
  // WARNING / REQUIRES_REVIEW / PENDING / UNKNOWN → amarillo (revisión humana)
  return {
    light: "YELLOW",
    emoji: "🟡",
    label: "Revisión manual",
    className: "text-amber-300",
  };
}

export function summarizeChecklistLights(checks: AdmissionCheckRow[]): {
  green: number;
  yellow: number;
  red: number;
} {
  let green = 0;
  let yellow = 0;
  let red = 0;
  for (const c of checks) {
    const light = lightForCheckStatus(c.status).light;
    if (light === "GREEN") green += 1;
    else if (light === "RED") red += 1;
    else yellow += 1;
  }
  return { green, yellow, red };
}

export function resolveChecklistFinalResult(input: {
  technicalSummaryStatus?: string | null;
  admissionStatus?: string | null;
  entryStatus?: string | null;
  logicalState?: string | null;
  checks?: AdmissionCheckRow[];
}): ChecklistFinalResult {
  const tech = (input.technicalSummaryStatus ?? "").toUpperCase();
  const adm = (input.admissionStatus ?? "").toUpperCase();
  const entry = (input.entryStatus ?? "").toUpperCase();
  const logical = (input.logicalState ?? "").toUpperCase();
  const counts = summarizeChecklistLights(input.checks ?? []);

  if (
    adm === "REJECTED" ||
    entry === "REJECTED" ||
    tech === "TECHNICALLY_REJECTED" ||
    logical === "REJECTED" ||
    counts.red > 0
  ) {
    return "RECHAZADA";
  }
  if (
    adm === "PENDING_MANUAL_REVIEW" ||
    entry === "REQUIRES_REVIEW" ||
    tech === "REQUIRES_REVIEW" ||
    logical === "MANUAL_REVIEW_REQUIRED" ||
    logical === "EVIDENCE_REQUESTED" ||
    counts.yellow > 0
  ) {
    return "REQUIERE_REVISION";
  }
  if (
    adm === "ADMITTED" ||
    adm === "FROZEN_FOR_JURY" ||
    adm === "ELIGIBLE" ||
    tech === "APPROVED" ||
    tech === "APPROVED_WITH_WARNINGS"
  ) {
    return "LISTA_PARA_ADMITIR";
  }
  return "REQUIERE_REVISION";
}

const FINAL_LABEL: Record<ChecklistFinalResult, string> = {
  LISTA_PARA_ADMITIR: "LISTA PARA ADMITIR",
  REQUIERE_REVISION: "REQUIERE REVISIÓN",
  RECHAZADA: "NO ADMISIBLE / RECHAZABLE",
};

const FINAL_CLASS: Record<ChecklistFinalResult, string> = {
  LISTA_PARA_ADMITIR: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
  REQUIERE_REVISION: "border-amber-500/40 bg-amber-500/10 text-amber-200",
  RECHAZADA: "border-red-500/40 bg-red-500/10 text-red-200",
};

export function AdmissionChecklistView(props: {
  checks: AdmissionCheckRow[];
  technicalSummaryStatus?: string | null;
  admissionStatus?: string | null;
  entryStatus?: string | null;
  logicalState?: string | null;
}) {
  const finalResult = resolveChecklistFinalResult(props);
  const counts = summarizeChecklistLights(props.checks);
  return (
    <div className="space-y-6" data-testid="admission-checklist-view">
      <div
        className={`rounded-lg border px-4 py-3 text-sm font-semibold tracking-wide ${FINAL_CLASS[finalResult]}`}
        data-testid="admission-checklist-final"
        data-result={finalResult}
      >
        Resultado: {FINAL_LABEL[finalResult]}
      </div>
      <div
        className="flex flex-wrap gap-4 text-sm text-fr-muted"
        data-testid="admission-checklist-counts"
        data-green={counts.green}
        data-yellow={counts.yellow}
        data-red={counts.red}
      >
        <span>🟢 {counts.green}</span>
        <span>🟡 {counts.yellow}</span>
        <span>🔴 {counts.red}</span>
      </div>
      <ul className="space-y-3 text-sm">
        {props.checks.map((c) => {
          const light = lightForCheckStatus(c.status);
          return (
            <li
              key={c.checkCode}
              className="flex gap-3 border-b border-fr-border/40 pb-3"
              data-testid={`check-row-${c.checkCode}`}
              data-status={c.status}
              data-light={light.light}
              data-reason={c.reasonCode ?? undefined}
            >
              <span className={`w-40 shrink-0 font-medium ${light.className}`} title={light.label}>
                <span aria-hidden>{light.emoji}</span> {light.label}
              </span>
              <span>
                <span className="text-fr-primary">{c.title}</span>
                <span className="mt-1 block text-fr-muted">{c.message}</span>
                {c.evidenceSummary ? (
                  <span className="mt-1 block text-xs text-fr-muted">{c.evidenceSummary}</span>
                ) : null}
                {c.reasonCode ? (
                  <span className="mt-1 block text-xs text-fr-muted">Código: {c.reasonCode}</span>
                ) : null}
              </span>
            </li>
          );
        })}
        {props.checks.length === 0 ? (
          <li className="text-fr-muted">Sin checks técnicos aún.</li>
        ) : null}
      </ul>
    </div>
  );
}

export function AdmissionSemaphoreBadge(props: {
  technicalSummaryStatus?: string | null;
  admissionStatus?: string | null;
  entryStatus?: string | null;
  logicalState?: string | null;
  checks?: AdmissionCheckRow[];
}) {
  const finalResult = resolveChecklistFinalResult(props);
  const emoji =
    finalResult === "LISTA_PARA_ADMITIR" ? "🟢" : finalResult === "RECHAZADA" ? "🔴" : "🟡";
  return (
    <span
      className={`inline-flex items-center gap-2 rounded border px-2 py-1 text-xs ${FINAL_CLASS[finalResult]}`}
      data-testid="admission-semaphore"
      data-result={finalResult}
      title={FINAL_LABEL[finalResult]}
    >
      <span aria-hidden>{emoji}</span>
      {FINAL_LABEL[finalResult]}
    </span>
  );
}
