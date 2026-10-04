import "server-only";

import { prisma } from "@repo/db";
import { alertasDeLosDatos, type Alerta } from "./alertas";
import { CADENCIAS, estadoDeUnCron, semaforoGeneral, type Diagnostico } from "./estado";
import { revisarConfiguracion, type EstadoDeConfiguracion } from "./configuracion";

/**
 * Cómo va la noche.
 *
 * Todas las consultas van juntas y ninguna trae filas: sólo cuenta. La pantalla se
 * recarga cada medio minuto durante un evento, y una consulta que trae doscientas fotos
 * para contarlas es una consulta que va a molestar justo cuando el sistema está ocupado.
 */

/** Cuánto puede tardar una foto en decidirse antes de que sea raro. */
const MINUTOS_TRABADA = 10;

export type Salud = {
  semaforo: ReturnType<typeof semaforoGeneral>;
  configuracion: EstadoDeConfiguracion;
  crones: { nombre: string; cadencia: number; diagnostico: Diagnostico; ultimoResultado: unknown }[];
  alertas: Alerta[];
  ahora: Date;
  eventosActivos: { code: string; name: string; cierra: Date | null; fotos: number }[];
  fotosUltimaHora: number;
};

export async function mirarLaSalud(): Promise<Salud> {
  const ahora = new Date();
  const haceDiezMinutos = new Date(ahora.getTime() - MINUTOS_TRABADA * 60_000);
  const haceUnaHora = new Date(ahora.getTime() - 60 * 60_000);
  const haceUnDia = new Date(ahora.getTime() - 24 * 60 * 60_000);

  const [
    corridas,
    fotosTrabadas,
    fotosSinVariante,
    paquetesFallados,
    correosFallados,
    pagosSinEvento,
    eventosSinCerrar,
    fotosUltimaHora,
    activos,
    arrepentimientosVencidos,
    arrepentimientosPendientes,
  ] = await Promise.all([
    prisma.subilafotoCronRun.findMany(),
    prisma.subilafotoMedia.count({
      where: { status: "PROCESSING", updatedAt: { lt: haceDiezMinutos } },
    }),
    prisma.subilafotoMedia.count({
      where: { status: "APPROVED", variants: { none: {} } },
    }),
    prisma.subilafotoPackage.count({ where: { status: "FAILED" } }),
    prisma.subilafotoEmailSent.count({
      where: { status: "FAILED", createdAt: { gte: haceUnDia } },
    }),
    /*
      Sólo las de evento: el adicional de descarga se compra sobre un evento que ya existe
      y por definición no crea ninguno. Contarlo acá daría una alarma permanente.
    */
    prisma.subilafotoOrder.count({
      where: { status: "PAID", kind: "EVENT", eventId: null },
    }),
    prisma.subilafotoEvent.count({
      where: { status: { in: ["ACTIVE", "SCHEDULED"] }, deactivationAt: { not: null, lt: ahora } },
    }),
    prisma.subilafotoMedia.count({ where: { createdAt: { gte: haceUnaHora } } }),
    prisma.subilafotoEvent.findMany({
      where: { status: "ACTIVE" },
      orderBy: { deactivationAt: "asc" },
      take: 20,
      select: {
        code: true,
        name: true,
        deactivationAt: true,
        _count: { select: { media: true } },
      },
    }),
    prisma.subilafotoRetractionRequest.count({
      where: { status: "RECEIVED", createdAt: { lt: new Date(ahora.getTime() - 24 * 60 * 60_000) } },
    }),
    prisma.subilafotoRetractionRequest.count({ where: { status: "RECEIVED" } }),
  ]);

  const porNombre = new Map(corridas.map((c) => [c.nombre, c]));

  // Se recorre la lista de cadencias y no la de filas: un cron que nunca corrió no tiene
  // fila, y es justamente el que hay que mostrar en rojo.
  const crones = Object.entries(CADENCIAS).map(([nombre, cadencia]) => {
    const fila = porNombre.get(nombre);
    return {
      nombre,
      cadencia,
      diagnostico: estadoDeUnCron({
        nombre,
        ultimaCorrida: fila?.lastRunAt ?? null,
        ultimoError: fila?.lastError ?? null,
        ahora,
      }),
      ultimoResultado: fila?.lastResult ?? null,
    };
  });

  return {
    semaforo: semaforoGeneral(crones.map((c) => c.diagnostico)),
    // Sólo nombres y para qué era cada una. Nunca un valor.
    configuracion: revisarConfiguracion(),
    crones,
    alertas: alertasDeLosDatos({
      fotosTrabadas,
      fotosSinVariante,
      paquetesFallados,
      correosFallados,
      pagosSinEvento,
      eventosSinCerrar,
      arrepentimientosVencidos,
      // Los vencidos ya se cuentan aparte: acá van los que todavía están en plazo.
      arrepentimientosPendientes: arrepentimientosPendientes - arrepentimientosVencidos,
    }),
    ahora,
    fotosUltimaHora,
    eventosActivos: activos.map((e) => ({
      code: e.code,
      name: e.name,
      cierra: e.deactivationAt,
      fotos: e._count.media,
    })),
  };
}
