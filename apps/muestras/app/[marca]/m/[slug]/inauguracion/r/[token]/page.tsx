import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { partySize } from "@repo/muestras";
import { DatosInauguracion } from "@/components/inauguracion/datos-inauguracion";
import { MiAsistencia } from "@/components/inauguracion/mi-asistencia";
import { baseUrlPublica } from "@/lib/fichas/cargar";
import { asistenciaPorToken, eventoDeInauguracion } from "@/lib/inauguracion/consultas";

export const dynamic = "force-dynamic";
// El token va en la URL: que no viaje como referencia a ningún otro sitio ni lo indexe nadie.
export const metadata: Metadata = { title: "Tu lugar en la inauguración", referrer: "no-referrer", robots: { index: false, follow: false } };

type Props = { params: Promise<{ slug: string; token: string }> };

const ESTADO: Record<string, string> = {
  CONFIRMED: "Tu lugar está confirmado.",
  WAITLIST: "Estás en lista de espera. Si se libera un lugar, pasás en orden de llegada: volvé a mirar este enlace.",
  CANCELLED: "Cancelaste tu lugar. Si cambiás de idea, podés volver a confirmar desde la invitación.",
};

/** El enlace personal de quien confirmó (D18): ver el estado y cancelar. */
export default async function MiLugar({ params }: Props) {
  const { slug, token } = await params;
  const r = await asistenciaPorToken(token);
  if (!r || r.activity.slug !== slug || r.activity.reviewStatus !== "APPROVED") notFound();
  const a = r.activity;
  const ahora = new Date();
  const empezo = !!a.openingAt && ahora.getTime() >= a.openingAt.getTime();
  const personas = partySize(r.companions);
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4 sm:p-8">
      <p className="text-sm text-[var(--mf-muted)]">Inauguración de «{a.title}»</p>
      <h1 className="mf-titulo text-[clamp(2rem,5vw,3rem)]">Hola, {r.name}</h1>
      <p className="text-lg">
        {ESTADO[r.status] ?? ""}
        {r.status !== "CANCELLED" ? ` ${personas === 1 ? "Anotaste 1 persona." : `Anotaste ${personas} personas (vos y ${r.companions} más).`}` : ""}
      </p>
      <DatosInauguracion a={a} evento={eventoDeInauguracion(a, baseUrlPublica())} />
      {r.status !== "CANCELLED" && !empezo ? <MiAsistencia token={token} /> : null}
      {r.status === "CANCELLED" && !empezo ? <p><Link href={`/m/${a.slug}/inauguracion`} className="underline underline-offset-4">Ir a la invitación</Link></p> : null}
      <p><Link href={`/m/${a.slug}`} className="underline underline-offset-4">Ver la muestra</Link></p>
    </main>
  );
}
