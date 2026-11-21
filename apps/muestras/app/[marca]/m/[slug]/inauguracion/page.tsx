import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { rsvpState } from "@repo/muestras";
import { DatosInauguracion } from "@/components/inauguracion/datos-inauguracion";
import { FormularioAsistencia } from "@/components/inauguracion/formulario-asistencia";
import { baseUrlPublica } from "@/lib/fichas/cargar";
import { eventoDeInauguracion, invitacionPublica } from "@/lib/inauguracion/consultas";
import { esUrlWeb } from "@/lib/url";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const a = await invitacionPublica((await params).slug);
  if (!a || rsvpState(a, new Date()) === "UNAVAILABLE") return {};
  const titulo = `Inauguración: ${a.title}`;
  return { title: titulo, openGraph: { title: titulo, images: esUrlWeb(a.coverImageUrl) ? [a.coverImageUrl] : [] } };
}

/** La invitación pública a la inauguración (D14). No muestra quiénes ni cuántos van. */
export default async function Invitacion({ params }: Props) {
  const a = await invitacionPublica((await params).slug);
  if (!a) notFound();
  const estado = rsvpState(a, new Date());
  if (estado === "UNAVAILABLE") notFound();
  const evento = eventoDeInauguracion(a, baseUrlPublica());
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4 sm:p-8">
      <Link href={`/m/${a.slug}`} className="text-sm underline underline-offset-4">Ver la muestra</Link>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {esUrlWeb(a.coverImageUrl) ? <img src={a.coverImageUrl} alt="" className="max-h-[50vh] w-full rounded-[2px] object-cover" /> : null}
      <header className="space-y-2">
        <p className="text-sm text-[var(--mf-muted)]">Inauguración</p>
        <h1 className="mf-titulo text-[clamp(2rem,5vw,3rem)]">{a.title}</h1>
        <p className="text-[var(--mf-muted)]">Organiza {a.organizersText}</p>
      </header>
      <DatosInauguracion a={a} evento={evento} />
      {a.isCancelled ? (
        <p className="border-t border-[var(--mf-line)] pt-6 text-lg">Esta actividad se suspendió.</p>
      ) : estado === "OPEN" ? (
        <FormularioAsistencia muestra={a.id} maxAcompanantes={a.rsvpMaxCompanions} />
      ) : estado === "OFF" ? (
        <p className="border-t border-[var(--mf-line)] pt-6 text-lg">Entrada libre: no hace falta confirmar.</p>
      ) : (
        <p className="border-t border-[var(--mf-line)] pt-6 text-lg">Ya no se reciben confirmaciones.</p>
      )}
    </main>
  );
}
