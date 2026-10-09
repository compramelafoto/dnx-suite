import Link from "next/link";
import { ACTIVITY_TYPE_LABELS, REVIEW_STATUS_LABELS, toArDay, type ActivityType, type ReviewStatus } from "@repo/muestras";
import { listarMias } from "@/lib/actividades/consultas";
import { requireUsuario } from "@/lib/usuario";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mis muestras" };

export default async function MisMuestras({ searchParams }: { searchParams: Promise<{ enviada?: string }> }) {
  const usuario = await requireUsuario("/mis-muestras");
  const { enviada } = await searchParams;
  const mias = await listarMias(usuario.id);
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4 sm:p-8">
      <div className="flex items-center justify-between">
        <h1 className="mf-titulo text-[2.45rem]">Mis muestras</h1>
        <Link href="/proponer" className="rounded-[10px] bg-[var(--mf-accent)] px-4 py-2 font-medium text-[var(--mf-accent-ink)]">Proponer otra</Link>
      </div>
      {enviada ? <p className="rounded-[10px] bg-[var(--mf-teal)]/12 p-3 text-[var(--mf-deep)]">¡Listo! La enviaste a revisión. Te avisamos por mail.</p> : null}
      {mias.length === 0 ? <p>Todavía no propusiste ninguna.</p> : (
        <ul className="divide-y divide-[var(--mf-line)] border-y border-[var(--mf-line)]">
          {mias.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 py-3">
              <div>
                <Link href={`/mis-muestras/${m.id}`} className="font-medium underline">{m.title}</Link>
                <p className="text-sm text-[var(--mf-muted)]">
                  {ACTIVITY_TYPE_LABELS[m.type as ActivityType] ?? m.type}, del {toArDay(m.startsAt)} al {toArDay(m.endsAt)}
                  {m.isCancelled ? ". Cancelada" : ""}
                </p>
                {m.reviewStatus === "REJECTED" && m.rejectionReason ? <p className="text-sm text-[var(--mf-accent)]">Motivo: {m.rejectionReason}</p> : null}
              </div>
              <span className="text-sm">{REVIEW_STATUS_LABELS[m.reviewStatus as ReviewStatus]}</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
