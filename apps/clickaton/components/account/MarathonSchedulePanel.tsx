import {
  formatScheduleRange,
  getCapturePhase,
  getUploadPhase,
  isCaptureClosedUploadOpenSchedule,
  type ResolvedEditionSchedule,
} from "@/lib/photo-upload/edition-schedule";
import type { EditionClock } from "@/lib/timeline/clock";

type Props = {
  schedule: ResolvedEditionSchedule;
  timezone: string;
  clock: EditionClock;
  revealed: boolean;
  deliveredCount: number;
  totalPrompts: number;
};

function fmt(d: Date | null, timezone: string) {
  if (!d) return "a confirmar";
  return d.toLocaleString("es-AR", {
    timeZone: timezone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function remainingLabel(end: Date | null, clock: EditionClock): string | null {
  if (!end) return null;
  const ms = end.getTime() - clock.now().getTime();
  if (ms <= 0) return "finalizado";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
}

export function MarathonSchedulePanel({
  schedule,
  timezone,
  clock,
  revealed,
  deliveredCount,
  totalPrompts,
}: Props) {
  const capturePhase = getCapturePhase(schedule, clock);
  const uploadPhase = getUploadPhase(schedule, clock);
  const captureClosedUploadOpen = isCaptureClosedUploadOpenSchedule(schedule, clock);

  return (
    <div className="space-y-4 rounded-xl border border-ck-border bg-ck-bg-elevated p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ck-yellow">Clickatón</p>
          <h3 className="mt-1 text-lg font-semibold text-ck-text">
            {revealed ? "Tus consignas" : "Antes del evento"}
          </h3>
        </div>
        <p className="text-sm font-semibold tabular-nums text-ck-text">
          {deliveredCount}/{totalPrompts} entregadas
        </p>
      </div>

      {!revealed ? (
        <p className="text-sm leading-relaxed text-ck-text-secondary">
          Las consignas se revelarán:{" "}
          <span className="font-semibold text-ck-text">{fmt(schedule.eventRevealAt, timezone)}</span>
        </p>
      ) : null}

      <dl className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-ck-border/80 bg-ck-bg p-4">
          <dt className="text-xs font-semibold uppercase tracking-wide text-ck-text-muted">
            Horario para sacar fotografías
          </dt>
          <dd className="mt-2 text-sm font-medium text-ck-text">
            {formatScheduleRange(schedule.captureStartsAt, schedule.captureEndsAt, timezone)}
          </dd>
          <dd className="mt-2 text-xs text-ck-text-muted">
            Captura: {capturePhase === "OPEN" ? "abierta" : capturePhase === "CLOSED" ? "cerrada" : "pendiente"}
            {capturePhase === "OPEN"
              ? ` · restante ${remainingLabel(schedule.captureEndsAt, clock) ?? "—"}`
              : null}
          </dd>
        </div>
        <div className="rounded-lg border border-ck-border/80 bg-ck-bg p-4">
          <dt className="text-xs font-semibold uppercase tracking-wide text-ck-text-muted">
            Horario para subir fotografías
          </dt>
          <dd className="mt-2 text-sm font-medium text-ck-text">
            {formatScheduleRange(schedule.uploadStartsAt, schedule.uploadEndsAt, timezone)}
          </dd>
          <dd className="mt-2 text-xs text-ck-text-muted">
            Carga: {uploadPhase === "OPEN" ? "abierta" : uploadPhase === "CLOSED" ? "cerrada" : "pendiente"}
            {uploadPhase === "OPEN"
              ? ` · restante ${remainingLabel(schedule.uploadEndsAt, clock) ?? "—"}`
              : null}
          </dd>
        </div>
      </dl>

      {captureClosedUploadOpen ? (
        <div
          className="rounded-lg border border-ck-yellow/50 bg-ck-yellow/10 px-4 py-3 text-sm leading-relaxed text-ck-text"
          role="status"
        >
          <p className="font-semibold">Finalizó el horario para tomar fotografías.</p>
          <p className="mt-1 text-ck-text-secondary">
            Todavía podés subir las fotografías realizadas dentro del horario válido hasta las{" "}
            {fmt(schedule.uploadEndsAt, timezone)}.
          </p>
        </div>
      ) : null}
    </div>
  );
}
