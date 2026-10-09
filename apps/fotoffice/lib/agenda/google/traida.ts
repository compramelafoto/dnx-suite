import "server-only";
import { prisma } from "@repo/db";
import { decideRemote, esEventoDeEntrega, type CitaLocal, type DatosDeCita, type EventoGoogle } from "../sync-decisiones";
import { codigoDeError, codigoHttp, type ClienteAgenda } from "./cliente";
import type { ContextoGoogle } from "./contexto-google";

/**
 * TRAÍDA desde Google Calendar (Etapa 4, Entrega B): lo que cambió en el calendario propio de la
 * organización se refleja en las citas. Pensada para el cron (cada 10 minutos).
 *
 * - `events.list` con `syncToken`; sin token (primera vez) o con 410 Gone (venció) se hace una
 *   sincronización COMPLETA de ±90 días y se guarda el token nuevo.
 * - Qué hacer con cada evento lo decide `decideRemote` (puro): crear la cita (sin tipo ni responsable),
 *   actualizarla si Google es más nuevo que `googleUpdatedAt`, anularla si se borró, ignorar las entregas
 *   de proyectos (sólo ida) y los ecos de lo que empujamos nosotros.
 * - Acotada: hasta 10 páginas de 250 por corrida. Los errores se informan como CÓDIGOS (sin títulos ni cuentas).
 * - Sólo toca `FotofficeCita` y `FotofficeAgendaAjustes`: nunca Reservas.
 */

export type ReporteTraida = { creadas: number; actualizadas: number; anuladas: number; enlazadas: number; ignorados: number; recargaCompleta: boolean };

const VENTANA_DIAS = 90;
const TOPE_PAGINAS = 10;
const DIA_MS = 86_400_000;

const SELECT_CITA = {
  id: true, status: true, title: true, startAt: true, endAt: true, allDay: true, location: true, notes: true,
  googleEventId: true, googleUpdatedAt: true,
} as const;

function datosParaGuardar(d: DatosDeCita) {
  return {
    title: d.title, startAt: d.startAt, endAt: d.endAt, allDay: d.allDay, location: d.location, notes: d.notes,
    googleEventId: d.googleEventId, googleEtag: d.googleEtag, googleUpdatedAt: d.googleUpdatedAt,
  };
}

async function aplicarEvento(workspaceId: string, evento: EventoGoogle, r: ReporteTraida): Promise<void> {
  if (esEventoDeEntrega(evento)) {
    r.ignorados += 1;
    return;
  }
  const cita = (await prisma.fotofficeCita.findFirst({ where: { workspaceId, googleEventId: evento.id }, select: SELECT_CITA })) as CitaLocal | null;
  const decision = decideRemote(evento, cita);

  switch (decision.accion) {
    case "ignorar":
      r.ignorados += 1;
      return;
    case "anular":
      if (cita) {
        await prisma.fotofficeCita.updateMany({
          where: { id: cita.id, workspaceId },
          data: { status: "ANULADA", ...(decision.googleUpdatedAt ? { googleUpdatedAt: decision.googleUpdatedAt } : {}) },
        });
        r.anuladas += 1;
      }
      return;
    case "actualizar":
      if (cita) {
        await prisma.fotofficeCita.updateMany({ where: { id: cita.id, workspaceId }, data: datosParaGuardar(decision.datos) });
        r.actualizadas += 1;
      }
      return;
    case "crear": {
      // Un evento NUESTRO cuyo empuje todavía no guardó el id (la traída corrió justo en el medio): se enlaza
      // con la cita que lo originó en vez de crear un duplicado.
      const origen = evento.extendedProperties?.private?.foCitaId;
      if (typeof origen === "string" && origen.length > 0) {
        const propia = await prisma.fotofficeCita.findFirst({ where: { id: origen, workspaceId, googleEventId: null }, select: { id: true } });
        if (propia) {
          await prisma.fotofficeCita.updateMany({
            where: { id: propia.id as string, workspaceId },
            data: { googleEventId: decision.datos.googleEventId, googleEtag: decision.datos.googleEtag, googleUpdatedAt: decision.datos.googleUpdatedAt },
          });
          r.enlazadas += 1;
          return;
        }
      }
      await prisma.fotofficeCita.create({
        data: { workspaceId, status: "AGENDADA", typeId: null, ownerUserId: null, ...datosParaGuardar(decision.datos) },
        select: { id: true },
      });
      r.creadas += 1;
      return;
    }
  }
}

export async function traerCambios(workspaceId: string, g: ContextoGoogle, ahora: Date = new Date()): Promise<ReporteTraida> {
  const reporte: ReporteTraida = { creadas: 0, actualizadas: 0, anuladas: 0, enlazadas: 0, ignorados: 0, recargaCompleta: false };
  const ajustes = await prisma.fotofficeAgendaAjustes.findUnique({ where: { workspaceId }, select: { googleSyncToken: true } });
  let syncToken: string | null = ajustes?.googleSyncToken ?? null;
  const cliente: ClienteAgenda = g.cliente;

  let pageToken: string | null = null;
  let nuevoToken: string | null = null;
  let terminada = false;
  let reintentoPor410 = false;
  let fallos = 0;

  for (let vuelta = 0; vuelta < TOPE_PAGINAS; vuelta += 1) {
    let pagina;
    try {
      pagina = await cliente.listarEventos({
        calendarId: g.calendarId,
        syncToken,
        timeMin: new Date(ahora.getTime() - VENTANA_DIAS * DIA_MS),
        timeMax: new Date(ahora.getTime() + VENTANA_DIAS * DIA_MS),
        pageToken,
      });
    } catch (error) {
      // 410 Gone: el token venció. Se descarta y se recarga la ventana completa (una sola vez).
      if (codigoHttp(error) === 410 && syncToken && !reintentoPor410) {
        reintentoPor410 = true;
        reporte.recargaCompleta = true;
        syncToken = null;
        pageToken = null;
        await prisma.fotofficeAgendaAjustes.updateMany({ where: { workspaceId }, data: { googleSyncToken: null } });
        continue;
      }
      throw error;
    }

    for (const evento of pagina.events) {
      try {
        await aplicarEvento(workspaceId, evento, reporte);
      } catch (error) {
        // Un evento que falla no frena a los demás, pero el token no avanza: la próxima corrida lo reintenta.
        console.error("[agenda][google] no se pudo aplicar un evento", { codigo: codigoDeError(error) });
        fallos += 1;
      }
    }
    if (pagina.nextSyncToken) nuevoToken = pagina.nextSyncToken;
    if (!pagina.nextPageToken) {
      terminada = true;
      break;
    }
    pageToken = pagina.nextPageToken;
  }

  // Sólo se guarda el token si se leyó todo y se aplicó todo; si no, la próxima corrida repite (es idempotente).
  await prisma.fotofficeAgendaAjustes.updateMany({
    where: { workspaceId },
    data: { googleLastSyncAt: ahora, ...(terminada && nuevoToken && fallos === 0 ? { googleSyncToken: nuevoToken } : {}) },
  });
  return reporte;
}
