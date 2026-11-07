import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { findOrCreateClient } from "@/lib/clients/find-or-create";
import { rejectionMessage } from "@/lib/bookings/availability";
import type { Interval } from "@/lib/bookings/time";
import { ETIQUETA_MODALIDAD, MAX_ACTIVOS_POR_CORREO, MENSAJES_TURNOS, type AjustesTurnos } from "./constantes";
import { verificarHorario, ventanaDeBusqueda } from "./disponibilidad";
import { partirNombre, type DatosDeReserva } from "./formulario";
import { ocupadoEnAgenda, type TipoPublicado } from "./publico";
import { generarTokenDeGestion } from "./token";

/**
 * Reserva de un turno sin cobro (etapa 1). En UNA transacción, con un bloqueo por negocio
 * (`pg_advisory_xact_lock`): dos clientes que eligen el mismo horario a la vez se ordenan, y el segundo
 * vuelve a mirar la Agenda y recibe "se acaba de ocupar". Lo ocupado en Google se consulta ANTES (es
 * red) y viaja como `ocupadoGoogle`.
 *
 * Crea (o reusa por correo/teléfono) el cliente, la cita CONFIRMADA en la Agenda y el turno.
 */

export type EntradaReserva = {
  workspaceId: string;
  hostUserId: number | null;
  tipo: TipoPublicado;
  ajustes: AjustesTurnos;
  inicio: Date;
  datos: DatosDeReserva;
  ocupadoGoogle: Interval[];
  ahora: Date;
};

export type ResultadoReserva = { ok: true; turnoId: string; citaId: string; token: string } | { ok: false; error: string };

export function tituloDeCita(tipo: string, contacto: string): string {
  return `${tipo} — ${contacto}`.slice(0, 200);
}

export function notasDeCita(datos: DatosDeReserva, modalidad: TipoPublicado["modality"]): string {
  return [
    "Turno reservado por el cliente desde el sitio.",
    `Modalidad: ${ETIQUETA_MODALIDAD[modalidad]}`,
    `Nombre: ${datos.nombre}`,
    `Correo: ${datos.correo}`,
    `Teléfono: ${datos.telefono}`,
    ...(datos.mensaje ? ["", "Mensaje:", datos.mensaje] : []),
  ].join("\n");
}

/** Lo que se muestra como lugar: la dirección, el enlace o, para una llamada, el teléfono del cliente. */
export function lugarDelTurno(tipo: Pick<TipoPublicado, "modality" | "address">, telefonoCliente: string): string | null {
  if (tipo.modality === "TELEFONO") return tipo.address?.trim() || `Te llamamos al ${telefonoCliente}`;
  return tipo.address?.trim() || null;
}

class Rechazo extends Error {
  constructor(readonly mensaje: string) {
    super(mensaje);
  }
}

export async function reservarTurno(e: EntradaReserva): Promise<ResultadoReserva> {
  const { token, hash } = generarTokenDeGestion();
  const fin = new Date(e.inicio.getTime() + e.tipo.durationMinutes * 60_000);
  try {
    const r = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`fotoffice-turnos:${e.workspaceId}`}))`;

      const activos = await tx.fotofficeTurno.count({
        where: { workspaceId: e.workspaceId, contactEmail: e.datos.correo, status: "CONFIRMADO", startAt: { gt: e.ahora } },
      });
      if (activos >= MAX_ACTIVOS_POR_CORREO) throw new Rechazo(MENSAJES_TURNOS.demasiados);

      const ventana = ventanaDeBusqueda(e.ahora, e.ajustes.maxAdvanceDays);
      const agenda = await ocupadoEnAgenda(tx, { workspaceId: e.workspaceId, hostUserId: e.hostUserId, desde: ventana.startAt, hasta: ventana.endAt });
      const check = verificarHorario(e.inicio, {
        reglas: { durationMinutes: e.tipo.durationMinutes, bufferMinutes: e.ajustes.bufferMinutes, minAdvanceHours: e.ajustes.minAdvanceHours, maxAdvanceDays: e.ajustes.maxAdvanceDays },
        franjas: e.tipo.franjas,
        ocupado: [...agenda, ...e.ocupadoGoogle],
        ahora: e.ahora,
      });
      if (!check.ok) throw new Rechazo(check.reason === "OCUPADO" ? MENSAJES_TURNOS.ocupado : rejectionMessage(check.reason).replace("el espacio", "este turno").replace("este espacio", "este turno"));

      const nombre = partirNombre(e.datos.nombre);
      const cliente = await findOrCreateClient(tx, {
        workspaceId: e.workspaceId,
        email: e.datos.correo,
        phone: e.datos.telefono,
        firstName: nombre.firstName,
        lastName: nombre.lastName,
      });

      const cita = await tx.fotofficeCita.create({
        data: {
          workspaceId: e.workspaceId,
          title: tituloDeCita(e.tipo.name, e.datos.nombre),
          typeId: e.tipo.id,
          status: "CONFIRMADA",
          startAt: e.inicio,
          endAt: fin,
          allDay: false,
          location: lugarDelTurno(e.tipo, e.datos.telefono),
          notes: notasDeCita(e.datos, e.tipo.modality),
          ownerUserId: e.hostUserId,
          clientId: cliente.id,
        },
        select: { id: true },
      });

      const turno = await tx.fotofficeTurno.create({
        data: {
          workspaceId: e.workspaceId,
          typeId: e.tipo.id,
          startAt: e.inicio,
          endAt: fin,
          hostUserId: e.hostUserId,
          status: "CONFIRMADO",
          contactName: e.datos.nombre,
          contactEmail: e.datos.correo,
          contactPhone: e.datos.telefono,
          answers: e.datos.mensaje ? { mensaje: e.datos.mensaje } : undefined,
          manageTokenHash: hash,
          citaId: cita.id as string,
          clientId: cliente.id,
        },
        select: { id: true },
      });
      return { turnoId: turno.id as string, citaId: cita.id as string };
    });
    return { ok: true, ...r, token };
  } catch (error) {
    if (error instanceof Rechazo) return { ok: false, error: error.mensaje };
    console.error("[turnos] reservar falló", { error: (error as { name?: string; code?: string } | null)?.name ?? "desconocido", codigo: (error as { code?: string } | null)?.code ?? null });
    return { ok: false, error: MENSAJES_TURNOS.falla };
  }
}
