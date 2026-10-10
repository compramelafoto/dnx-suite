import type { Metadata } from "next";
import Link from "next/link";
import { REVIEW_STATUS_LABELS, SOCIAL_VARIANT_LABELS, formatArDay, recommendedVariant, visibleWorks, type ReviewStatus } from "@repo/muestras";
import { enlace, nota } from "@/components/difusion/estilos";
import { listarMuestrasParaDifusion } from "@/lib/redes/cargar";
import { requireUsuario } from "@/lib/usuario";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Difusión" };

export default async function Difusion() {
  const usuario = await requireUsuario("/panel/difusion");
  const muestras = await listarMuestrasParaDifusion(usuario);
  const ahora = new Date();
  return (
    <main className="max-w-3xl space-y-10">
      <header className="space-y-3">
        <h1 className="mf-titulo text-[clamp(2.2rem,4vw,3rem)]">Difusión</h1>
        <p className="text-lg leading-snug text-[var(--mf-muted)]">
          Piezas para redes, invitación a la inauguración y confirmación de asistencia de tus muestras.
        </p>
      </header>
      {muestras.length === 0 ? (
        <p className="border-t border-[var(--mf-line)] pt-6 text-lg">
          Cuando tengas una muestra, acá vas a armar sus piezas para redes. <Link href="/panel/proponer" className={enlace}>Proponer una muestra</Link>
        </p>
      ) : (
        <ul className="border-t border-[var(--mf-line)]">
          {muestras.map((m) => {
            const publicada = m.reviewStatus === "APPROVED";
            const recomendada = publicada ? recommendedVariant({ ...m, worksCount: m.works.length }, ahora, visibleWorks(m, m.works, ahora).works.length) : null;
            return (
              <li key={m.id} className="space-y-1 border-b border-[var(--mf-line)] py-5">
                <h2 className="mf-titulo text-[1.6rem]"><Link href={`/panel/difusion/${m.id}`} className="underline-offset-[5px] hover:underline">{m.title}</Link></h2>
                <p className={nota}>
                  {formatArDay(m.startsAt)} al {formatArDay(m.endsAt)} · {REVIEW_STATUS_LABELS[m.reviewStatus as ReviewStatus] ?? m.reviewStatus}
                  {m.isCancelled ? " · Cancelada" : ""}
                </p>
                <p className="text-[15px]">
                  {!publicada
                    ? "Las piezas se arman cuando la muestra esté publicada."
                    : recomendada
                      ? `Hoy conviene: ${SOCIAL_VARIANT_LABELS[recomendada]}`
                      : "Ya no hay piezas para armar."}
                </p>
                <p className="flex flex-wrap gap-x-5 text-[15px]">
                  <Link href={`/panel/difusion/${m.id}`} className={enlace}>Piezas</Link>
                  {!m.isVirtualOnly ? <Link href={`/panel/difusion/${m.id}/inauguracion`} className={enlace}>Inauguración</Link> : null}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
