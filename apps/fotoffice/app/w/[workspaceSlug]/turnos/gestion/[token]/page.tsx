import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GestionTurno } from "@/components/turnos/gestion-turno";
import { ETIQUETA_MODALIDAD } from "@/lib/turnos/constantes";
import { fechaLarga } from "@/lib/turnos/disponibilidad";
import { turnoPorToken } from "@/lib/turnos/gestion";
import { horariosPublicos } from "@/lib/turnos/horarios";
import { limiteParaGestionar, puedeGestionarse } from "@/lib/turnos/plazo";
import { leerAjustesTurnos, negocioPorSlug, tipoPublicado } from "@/lib/turnos/publico";
import { lugarDelTurno } from "@/lib/turnos/reservar";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Tu turno", robots: { index: false, follow: false } };

type Props = {
  params: Promise<{ workspaceSlug: string; token: string }>;
  searchParams: Promise<{ nuevo?: string; cancelado?: string; reprogramado?: string }>;
};

/** El turno del cliente, por el enlace del correo: ver, cambiar el horario o cancelar hasta el plazo. */
export default async function GestionTurnoPage({ params, searchParams }: Props) {
  const { workspaceSlug, token } = await params;
  const q = await searchParams;
  const negocio = await negocioPorSlug(workspaceSlug);
  if (!negocio) notFound();
  const turno = await turnoPorToken(token);
  if (!turno || turno.workspaceId !== negocio.workspaceId) notFound();

  const ahora = new Date();
  const [ajustes, tipo] = await Promise.all([leerAjustesTurnos(negocio.workspaceId), tipoPublicado(negocio.workspaceId, turno.typeId)]);
  const pasado = turno.startAt.getTime() < ahora.getTime();
  const enPlazo = puedeGestionarse(turno.startAt, ahora, ajustes.cancelWindowHours);
  const horarios = !turno.cancelado && enPlazo && tipo ? await horariosPublicos(negocio, tipo, ajustes, ahora, turno.citaId) : null;

  const titulo = turno.cancelado ? "Turno cancelado" : q.nuevo ? "¡Listo! Tu turno está confirmado" : q.reprogramado ? "Listo, cambiamos el horario" : "Tu turno";

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-12 md:px-8 md:py-16">
      <h1 className="text-3xl font-semibold tracking-tight">{titulo}</h1>
      {q.nuevo && !turno.cancelado ? (
        <p className="text-sm text-[var(--fo-muted)]">Te mandamos la confirmación a {turno.contactEmail}, con el archivo para agregarlo a tu calendario.</p>
      ) : null}

      <section className={`fo-card space-y-2 p-5 ${turno.cancelado ? "opacity-70" : ""}`}>
        <p className="text-lg font-semibold">{tipo?.name ?? "Turno"}</p>
        <p className="text-sm first-letter:uppercase">{fechaLarga(turno.startAt)}</p>
        {tipo ? <p className="text-sm text-[var(--fo-muted)]">{ETIQUETA_MODALIDAD[tipo.modality]}</p> : null}
        {tipo && !turno.cancelado ? (() => {
          const lugar = lugarDelTurno(tipo, turno.contactPhone ?? "");
          if (!lugar) return null;
          return /^https?:\/\//.test(lugar) ? (
            <a href={lugar} className="text-sm text-[var(--fo-accent)] underline underline-offset-4" target="_blank" rel="noreferrer">
              {lugar}
            </a>
          ) : (
            <p className="text-sm">{lugar}</p>
          );
        })() : null}
        <p className="text-xs text-[var(--fo-muted-soft)]">A nombre de {turno.contactName}</p>
      </section>

      {turno.cancelado ? (
        <Link href={`/w/${workspaceSlug}/turnos`} className="fo-btn fo-btn-primary">
          Reservar otro turno
        </Link>
      ) : pasado ? null : enPlazo ? (
        <div className="space-y-2">
          <p className="text-sm text-[var(--fo-muted)]">Podés cambiarlo o cancelarlo hasta el {fechaLarga(limiteParaGestionar(turno.startAt, ajustes.cancelWindowHours))}.</p>
          <GestionTurno workspaceSlug={workspaceSlug} token={token} dias={horarios && horarios.ok ? horarios.dias : null} />
        </div>
      ) : (
        <p className="text-sm text-[var(--fo-muted)]">Ya pasó el plazo para cambiarlo por acá. Si no podés venir, escribinos.</p>
      )}
    </main>
  );
}
