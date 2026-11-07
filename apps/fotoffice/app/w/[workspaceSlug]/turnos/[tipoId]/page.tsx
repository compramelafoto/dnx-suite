import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FormularioReserva } from "@/components/turnos/formulario-reserva";
import { MENSAJES_TURNOS } from "@/lib/turnos/constantes";
import { horariosPublicos } from "@/lib/turnos/horarios";
import { leerAjustesTurnos, negocioPorSlug, tipoPublicado } from "@/lib/turnos/publico";
import { resumenDelTipo } from "@/lib/turnos/textos";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ workspaceSlug: string; tipoId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { workspaceSlug, tipoId } = await params;
  const negocio = await negocioPorSlug(workspaceSlug);
  const tipo = negocio ? await tipoPublicado(negocio.workspaceId, tipoId) : null;
  return tipo ? { title: `${tipo.name} — reservá tu turno` } : {};
}

/** Reservar un turno: día y hora libres (Agenda + Google) y los datos del cliente. */
export default async function ReservarTurnoPage({ params }: Props) {
  const { workspaceSlug, tipoId } = await params;
  const negocio = await negocioPorSlug(workspaceSlug);
  if (!negocio) notFound();
  const tipo = await tipoPublicado(negocio.workspaceId, tipoId);
  if (!tipo) notFound();
  const ajustes = await leerAjustesTurnos(negocio.workspaceId);
  const horarios = await horariosPublicos(negocio, tipo, ajustes, new Date());

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-12 md:px-8 md:py-16">
      <Link href={`/w/${workspaceSlug}/turnos`} className="text-sm text-[var(--fo-muted)] hover:underline">
        ← Todos los turnos
      </Link>
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">{tipo.name}</h1>
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--fo-muted-soft)]">{resumenDelTipo(tipo)}</p>
        {tipo.publicDescription ? <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--fo-muted)]">{tipo.publicDescription}</p> : null}
      </div>

      {!horarios.ok ? (
        <div className="fo-card p-6 text-center text-sm text-[var(--fo-muted)]">{MENSAJES_TURNOS.sinAgenda}</div>
      ) : horarios.dias.length === 0 ? (
        <div className="fo-card p-6 text-center text-sm text-[var(--fo-muted)]">No quedan horarios libres por ahora. Probá en unos días o escribinos.</div>
      ) : (
        <FormularioReserva workspaceSlug={workspaceSlug} tipoId={tipo.id} dias={horarios.dias} />
      )}
      <p className="text-xs text-[var(--fo-muted-soft)]">Horarios en hora de Argentina.</p>
    </main>
  );
}
