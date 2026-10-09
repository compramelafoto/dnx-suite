import type { Metadata } from "next";
import Link from "next/link";
import { CALL_PHASE_PUBLIC_TEXT, callPhase, formatArDay, hasPhysicalVenue, isListedPhase } from "@repo/muestras";
import { listarConvocatoriasPublicas } from "@/lib/convocatorias/consultas";

export const revalidate = 300;

type Fila = Awaited<ReturnType<typeof listarConvocatoriasPublicas>>[number];

/** Recibe (o va a recibir) obras y es para una muestra presencial con lugar cargado. */
const seLista = (c: Fila, ahora: Date) => isListedPhase(callPhase(c, ahora)) && hasPhysicalVenue(c.activity);

export async function generateMetadata(): Promise<Metadata> {
  const ahora = new Date();
  const hay = (await listarConvocatoriasPublicas()).some((c) => seLista(c, ahora));
  return {
    title: "Convocatorias abiertas",
    description: "Convocatorias para exponer en muestras fotográficas de todo el país: mandá tus obras para que las elijan.",
    ...(hay ? {} : { robots: { index: false, follow: true } }),
  };
}

export default async function ConvocatoriasPublicas() {
  const ahora = new Date();
  const lista = (await listarConvocatoriasPublicas()).filter((c) => seLista(c, ahora));
  return (
    <main className="mf-marco py-10 sm:py-16">
      <h1 className="mf-titulo max-w-[16ch] text-[clamp(2.2rem,5vw,3.5rem)]">Convocatorias abiertas</h1>
      <p className="mt-4 max-w-[52ch] text-lg leading-snug text-[var(--mf-muted)]">Muestras presenciales que buscan obras para exponer. Leé las bases y mandá las tuyas desde acá; la selección es anónima.</p>
      {lista.length === 0 ? (
        <p className="mt-10 border-t border-[var(--mf-line)] pt-8 text-lg">Ahora no hay convocatorias abiertas. Volvé pronto.</p>
      ) : (
        <ul className="mt-10 border-t border-[var(--mf-line)]">
          {lista.map((c) => {
            const lugar = [c.activity.venueName, c.activity.city, c.activity.province].filter(Boolean).join(", ");
            return (
              <li key={c.id} className="border-b border-[var(--mf-line)]">
                <Link href={`/convocatorias/${c.slug}`} className="group grid gap-1 py-6">
                  <span className="text-sm text-[var(--mf-muted)]">{CALL_PHASE_PUBLIC_TEXT[callPhase(c, ahora)]} hasta el {formatArDay(c.closesAt)}</span>
                  <span className="mf-titulo text-2xl underline-offset-[6px] group-hover:underline">{c.title}</span>
                  <span className="text-[15px] text-[var(--mf-muted)]">{[c.activity.title !== c.title ? `Para exponer en la muestra “${c.activity.title}”` : null, lugar || null, `hasta ${c.maxWorksPerPerson} ${c.maxWorksPerPerson === 1 ? "obra" : "obras"} por persona`].filter(Boolean).join(". ")}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
