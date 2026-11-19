import {
  type ParticipantParticipationView,
  type ParticipantProgressStep,
} from "../../lib/fotorank/participant-experience";

/**
 * Texto corto debajo de cada etapa: qué pasa con ella o cuándo empieza.
 * Es lo que le faltaba al participante para entender "en qué parte estoy y qué sigue"
 * sin abrir el detalle.
 */
export function participantStepHints(
  view: ParticipantParticipationView,
): Partial<Record<ParticipantProgressStep["key"], string>> {
  const hints: Partial<Record<ParticipantProgressStep["key"], string>> = {};
  const sameYear = (d: Date) => d.getFullYear() === new Date().getFullYear();
  /** "4 dic." — sin el año si es el actual, para que entre debajo de cada etapa. */
  const short = (d: Date | null | undefined) => {
    if (!d || Number.isNaN(d.getTime())) return null;
    try {
      return new Intl.DateTimeFormat("es-AR", {
        day: "numeric",
        month: "short",
        ...(sameYear(d) ? {} : { year: "numeric" }),
        timeZone: view.timezone || "America/Argentina/Buenos_Aires",
      }).format(d);
    } catch {
      return null;
    }
  };

  for (const step of view.progress) {
    if (step.state === "completed") {
      hints[step.key] = "Listo";
      continue;
    }
    if (step.state === "current") {
      if (step.key === "upload" && view.upload.closesAt) {
        const until = short(view.upload.closesAt);
        hints[step.key] = until ? `Hasta el ${until}` : "Ahora";
      } else {
        hints[step.key] = "Ahora";
      }
      continue;
    }

    let hint: string | null = null;
    if (step.key === "upload") {
      if (view.upload.phase === "not_yet_open") {
        const opens = short(view.upload.opensAt);
        hint = opens ? `Abre el ${opens}` : "Todavía no abre";
      } else if (view.upload.phase === "closed" || view.upload.phase === "contest_closed") {
        hint = "Cerrada";
      }
    } else if (step.key === "evaluation") {
      const from = short(view.dates.judgingStartAt);
      if (from) hint = `Desde el ${from}`;
    } else if (step.key === "results") {
      const at = short(view.dates.resultsAt);
      if (at) hint = `El ${at}`;
    }
    hints[step.key] = hint ?? (step.state === "locked" ? "Bloqueada" : "Después");
  }
  return hints;
}
