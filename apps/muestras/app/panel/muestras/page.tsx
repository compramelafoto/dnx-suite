import Link from "next/link";
import { ACTIVITY_ROLE_LABELS, ACTIVITY_TYPE_LABELS, REVIEW_STATUS_LABELS, toArDay, type ActivityType, type ReviewStatus } from "@repo/muestras";
import { listarMias } from "@/lib/actividades/consultas";
import { puede } from "@/lib/equipo/permisos";
import { pendientesPorMuestra } from "@/lib/expositores/consultas";
import { requireUsuario } from "@/lib/usuario";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mis muestras" };

export default async function MisMuestras({ searchParams }: { searchParams: Promise<{ enviada?: string }> }) {
  const usuario = await requireUsuario("/panel/muestras");
  const { enviada } = await searchParams;
  const mias = await listarMias(usuario);
  // Sólo donde esta persona revisa expositores (el rol de textos no ve el contador).
  const pendientes = await pendientesPorMuestra(mias.filter((m) => m.type === "MUESTRA" && puede(usuario, "exhibitors", m.rol)).map((m) => m.id));
  return (
    <main className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="mf-titulo text-[2.45rem]">Mis muestras</h1>
          <p className="text-[var(--mf-muted)]">Las que propusiste y las que organizás en equipo</p>
        </div>
        <Link href="/panel/proponer" className="rounded-[2px] bg-[var(--mf-accent)] px-4 py-2 font-medium text-[var(--mf-accent-ink)]">Proponer otra</Link>
      </div>
      {enviada ? <p className="rounded-[2px] bg-[var(--mf-teal)]/12 p-3 text-[var(--mf-deep)]">¡Listo! La enviaste a revisión. Te avisamos por mail.</p> : null}
      {mias.length === 0 ? <p>Todavía no propusiste ninguna ni formás parte de un equipo.</p> : (
        <ul className="divide-y divide-[var(--mf-line)] border-y border-[var(--mf-line)]">
          {mias.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 py-3">
              <div>
                <Link href={`/panel/muestras/${m.id}`} className="font-medium underline">{m.title}</Link>
                {m.rol && m.rol !== "OWNER" ? <span className="ml-2 text-sm text-[var(--mf-muted)]">{ACTIVITY_ROLE_LABELS[m.rol]}</span> : null}
                <p className="text-sm text-[var(--mf-muted)]">
                  {ACTIVITY_TYPE_LABELS[m.type as ActivityType] ?? m.type}, del {toArDay(m.startsAt)} al {toArDay(m.endsAt)}
                  {m.isCancelled ? ". Cancelada" : ""}
                </p>
                {m.reviewStatus === "REJECTED" && m.rejectionReason ? <p className="text-sm text-[var(--mf-accent)]">Motivo: {m.rejectionReason}</p> : null}
                {pendientes.get(m.id) ? (
                  <p className="text-sm">
                    <Link href={`/panel/muestras/${m.id}/expositores`} className="underline">
                      {pendientes.get(m.id) === 1 ? "1 obra para revisar" : `${pendientes.get(m.id)} obras para revisar`}
                    </Link>
                  </p>
                ) : null}
              </div>
              <span className="text-sm">{REVIEW_STATUS_LABELS[m.reviewStatus as ReviewStatus]}</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
