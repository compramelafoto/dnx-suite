import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { openingHasTime, openingWhenText, rsvpState } from "@repo/muestras";
import { CopiarEnlace } from "@/components/enlace/copiar-enlace";
import { ConfigurarInauguracion } from "@/components/inauguracion/configurar-inauguracion";
import { baseUrlPublica } from "@/lib/fichas/cargar";
import { cargarInauguracionPanel } from "@/lib/inauguracion/consultas";
import { requireUsuario } from "@/lib/usuario";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Inauguración" };

type Props = { params: Promise<{ id: string }> };

export default async function InauguracionPanel({ params }: Props) {
  const { id } = await params;
  const usuario = await requireUsuario(`/panel/difusion/${id}/inauguracion`);
  const r = await cargarInauguracionPanel(id, usuario);
  if (!r) notFound();
  const a = r.muestra;
  const conHora = openingHasTime(a.openingAt);
  const estado = rsvpState(a, new Date());
  const publica = `${baseUrlPublica()}/m/${a.slug}/inauguracion`;
  return (
    <main className="max-w-3xl space-y-8">
      <Link href={`/panel/muestras/${a.id}`} className="text-sm underline underline-offset-4">Volver a la muestra</Link>
      <header className="space-y-3">
        <p className="text-sm text-[var(--mf-muted)]">{a.title}</p>
        <h1 className="mf-titulo text-[clamp(2.2rem,4vw,3rem)]">Inauguración</h1>
        {a.openingAt && conHora ? (
          <p className="text-lg">{openingWhenText(a.openingAt, a.openingEndsAt)}</p>
        ) : (
          <p className="text-lg">
            Todavía no tiene {a.openingAt ? "hora" : "día ni hora"} de inauguración.{" "}
            <Link href={`/panel/muestras/${a.id}`} className="underline underline-offset-4">Cargá la hora en la ficha</Link> para poder pedir confirmación y armar la invitación.
          </p>
        )}
      </header>
      {a.isVirtualOnly ? <p className="text-[var(--mf-alerta)]">La invitación es para muestras presenciales.</p> : null}
      <ConfigurarInauguracion
        inicial={{ id: a.id, rsvpStatus: a.rsvpStatus, rsvpCapacity: a.rsvpCapacity, rsvpMaxCompanions: a.rsvpMaxCompanions, openingNote: a.openingNote, conHora }}
      />
      {estado !== "UNAVAILABLE" ? (
        <section className="space-y-2 border-t border-[var(--mf-line)] pt-6">
          <h2 className="text-lg">Enlace de la invitación</h2>
          <p className="text-sm text-[var(--mf-muted)]">Compartilo en redes, por WhatsApp o por mail. <Link href={`/m/${a.slug}/inauguracion`} className="underline underline-offset-4">Ver la invitación</Link></p>
          <CopiarEnlace url={publica} etiqueta="Enlace público de la invitación" />
        </section>
      ) : a.reviewStatus !== "APPROVED" ? (
        <p className="text-sm text-[var(--mf-muted)]">La invitación pública aparece cuando la muestra está publicada.</p>
      ) : null}
    </main>
  );
}
