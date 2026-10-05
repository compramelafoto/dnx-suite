import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Flash } from "@/components/governance/member-select";
import { requireGovernanceViewer } from "@/lib/governance/access";
import { listMeetings } from "@/lib/governance/repository";
import { fechaHora } from "@/lib/governance/labels";
import { meetingStatusLabel } from "@/lib/governance/meetings";
import { createMeetingAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function ReunionesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { workspace, canManage } = await requireGovernanceViewer();
  const params = await searchParams;
  const reuniones = await listMeetings(workspace.id);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Reuniones"
        description="El temario se arma solo con los proyectos que esperan una decisión, ordenados por prioridad. Lo que se resuelve en cada tema cambia el estado del proyecto y va al acta."
      />

      <Flash error={params.error} ok={params.ok} />

      {canManage ? (
        <details className="fo-card p-6" open={reuniones.length === 0}>
          <summary className="cursor-pointer text-sm font-medium">+ Convocar una reunión</summary>
          <form action={createMeetingAction} className="mt-6 grid max-w-2xl gap-5 sm:grid-cols-2">
            <div className="fo-field-stack sm:col-span-2">
              <label className="fo-label" htmlFor="title">
                Título
              </label>
              <input id="title" name="title" className="fo-input" maxLength={160} placeholder="Reunión de comisión" />
            </div>
            <div className="fo-field-stack">
              <label className="fo-label" htmlFor="scheduledAt">
                Fecha y hora
              </label>
              <input id="scheduledAt" name="scheduledAt" type="datetime-local" className="fo-input" required />
              <p className="fo-helper">En hora de Argentina.</p>
            </div>
            <div className="fo-field-stack">
              <label className="fo-label" htmlFor="location">
                Lugar o enlace
              </label>
              <input id="location" name="location" className="fo-input" maxLength={500} placeholder="Sede, o el enlace de Meet" />
            </div>
            <div className="sm:col-span-2">
              <button type="submit" className="fo-btn fo-btn-primary text-sm">
                Convocar y armar el temario
              </button>
            </div>
          </form>
        </details>
      ) : null}

      {reuniones.length === 0 ? (
        <div className="fo-card flex flex-col items-center gap-4 px-6 py-16 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-[var(--fo-accent-muted)] text-[var(--fo-accent)]">
            <CalendarClock className="size-7" aria-hidden />
          </div>
          <p className="text-base font-semibold">Todavía no hay reuniones</p>
        </div>
      ) : (
        <ul className="fo-card divide-y divide-[var(--fo-border-muted)]">
          {reuniones.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-sm">
              <div>
                <Link href={`/gobierno/reuniones/${r.id}`} className="font-medium hover:underline">
                  {r.title}
                </Link>
                <p className="text-xs text-[var(--fo-muted)]">
                  {fechaHora(r.scheduledAt)}
                  {r.location ? ` · ${r.location}` : ""} · {r._count.items} tema{r._count.items === 1 ? "" : "s"}
                </p>
              </div>
              <span className="text-xs font-medium text-[var(--fo-text-secondary)]">{meetingStatusLabel(r.status)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
