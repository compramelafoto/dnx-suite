import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { ID_VALIDO } from "../claves";
import { tituloDeVideo } from "../entrega";
import { cuentasDeTrabajos } from "../cassettes";
import { esNoDigitalizable, textoNoDigitalizable } from "../no-digitalizable";
import { saldoDeVideosMinor } from "./cargos";
import { selectCuentaTrabajo } from "./cassettes";
import { grabacionesDelPedido, resumenDeEntregas, type ResumenEntrega } from "./entregas";

/**
 * Digitalización vista desde el trabajo, el pedido y el Cobrador: qué trabajos son de
 * digitalización, sus grabaciones y el estado de la entrega del pedido (con el saldo que traba los
 * videos, las descargas y la casilla del cliente). Todo filtra por `workspaceId`; los permisos los
 * decide la pantalla que llama (módulo `digitalizacion` encendido y nivel de la persona).
 */

type Tx = Prisma.TransactionClient;

export type TrabajoDeDigitalizacion = {
  id: string;
  numero: string;
  nombre: string;
  pedidoId: string | null;
  grabaciones: number;
  /** Cassettes vendidos (null = no se sabe) y grabados (completos, sin descartar). */
  cassettes: { esperados: number | null; grabados: number };
};

/** Los trabajos del negocio que cumplen `esTrabajoDeDigitalizacion` (grabaciones o nombre de video). */
async function trabajosDeDigitalizacion(workspaceId: string, where: Prisma.FotofficeProyectoWhereInput): Promise<TrabajoDeDigitalizacion[]> {
  const trabajos = await prisma.fotofficeProyecto.findMany({
    where: { ...where, workspaceId },
    orderBy: [{ createdAt: "asc" }],
    take: 50,
    select: { number: true, ...selectCuentaTrabajo(workspaceId) },
  });
  return cuentasDeTrabajos(trabajos).map(({ trabajo: t, cuenta }) => ({
    id: t.id,
    numero: t.number,
    nombre: t.name,
    pedidoId: t.pedidoId,
    grabaciones: t.grabaciones.length,
    cassettes: { esperados: cuenta.esperados, grabados: cuenta.grabados },
  }));
}

/** Los trabajos de digitalización de un pedido (para el pedido y para «Ir a grabar» del Cobrador). */
export async function trabajosDeDigitalizacionDelPedido(workspaceId: string, pedidoId: string): Promise<TrabajoDeDigitalizacion[]> {
  if (!ID_VALIDO.test(pedidoId)) return [];
  return trabajosDeDigitalizacion(workspaceId, { pedidoId });
}

/**
 * El trabajo que llega a la estación con `?proyecto=`: tiene que ser del negocio. Trae el pedido, el
 * cliente y el próximo número de cassette (el mayor de sus VHS más uno). null si no es del negocio.
 */
export async function trabajoParaGrabar(workspaceId: string, proyectoId: string) {
  if (!ID_VALIDO.test(proyectoId)) return null;
  const t = await prisma.fotofficeProyecto.findFirst({
    where: { id: proyectoId, workspaceId },
    select: { id: true, number: true, name: true, pedido: { select: { number: true } } },
  });
  if (!t) return null;
  const mayor = await prisma.digitalizacionGrabacion.aggregate({
    where: { workspaceId, proyectoId: t.id, tipo: "VHS", estado: { not: "DESCARTADA" } },
    _max: { cassetteNumero: true },
  });
  return {
    id: t.id,
    numero: t.number,
    nombre: t.name,
    pedidoNumero: t.pedido?.number ?? null,
    siguienteCassette: Math.min(999, (mayor._max.cassetteNumero ?? 0) + 1),
  };
}

export type EntregaDelPedido = {
  resumen: ResumenEntrega;
  /** El saldo que traba los videos (sin los extras opcionales), en centavos. */
  saldoMinor: number;
  /** Descargas contadas de cada grabación en esta entrega. */
  descargas: Map<string, number>;
  /** Los videos listos del pedido, con sus descargas extra pagadas. */
  videos: { id: string; titulo: string; descargasExtra: number }[];
  /** La casilla del cliente figura dada de baja (rebote, queja o baja) en los correos del negocio. */
  casillaConProblema: boolean;
  /** Los cassettes que no se pudieron digitalizar: «Cassette 7 · No se pudo digitalizar: Cinta cortada». */
  noDigitalizables: { id: string; texto: string }[];
};

/**
 * La entrega de un pedido con lo que no trae la lista de Digitalización: saldo, descargas por video
 * y si la casilla del cliente rebotó. null si el pedido no tiene grabaciones (todavía no hay qué
 * entregar). No crea la fila de la entrega.
 */
export async function entregaDelPedido(workspaceId: string, pedidoId: string): Promise<EntregaDelPedido | null> {
  if (!ID_VALIDO.test(pedidoId)) return null;
  const [resumen] = await resumenDeEntregas(workspaceId, { pedidoIds: [pedidoId] });
  if (!resumen) return null;
  const entregaId = resumen.entrega?.id ?? null;
  const [saldo, porGrabacion, baja, grabaciones] = await Promise.all([
    saldoDeVideosMinor(prisma as unknown as Tx, workspaceId, pedidoId),
    entregaId
      ? prisma.digitalizacionDescarga.groupBy({ by: ["grabacionId"], where: { workspaceId, entregaId }, _count: { _all: true } })
      : Promise.resolve([]),
    // Un rebote o una queja de un correo masivo da de baja la casilla ("all"); la baja voluntaria
    // también. No se distingue cuál fue: se avisa para que confirmen la dirección.
    resumen.email
      ? prisma.fotofficeEmailOptOut.findFirst({ where: { workspaceId, email: resumen.email.toLowerCase(), topic: "all" }, select: { id: true } })
      : Promise.resolve(null),
    grabacionesDelPedido(workspaceId, pedidoId),
  ]);
  return {
    resumen,
    videos: grabaciones
      .filter((g) => g.estado === "COMPLETA" && g.conversionEstado === "LISTA")
      .map((g) => ({ id: g.id, titulo: tituloDeVideo(g), descargasExtra: g.descargasExtra })),
    saldoMinor: saldo?.saldoMinor ?? 0,
    descargas: new Map(porGrabacion.map((d) => [d.grabacionId, d._count._all])),
    casillaConProblema: baja !== null,
    noDigitalizables: grabaciones
      .filter((g) => g.estado === "COMPLETA" && esNoDigitalizable(g))
      .map((g) => ({ id: g.id, texto: textoNoDigitalizable(g) })),
  };
}

/** Las grabaciones de un trabajo (también las descartadas, para que se vea qué pasó con cada cassette). */
export async function grabacionesDelTrabajo(workspaceId: string, proyectoId: string) {
  if (!ID_VALIDO.test(proyectoId)) return [];
  return prisma.digitalizacionGrabacion.findMany({
    where: { workspaceId, proyectoId },
    orderBy: [{ iniciadaAt: "asc" }],
    take: 100,
    select: {
      id: true, titulo: true, tipo: true, estado: true, cassetteNumero: true, duracionSeg: true, iniciadaAt: true, ultimoLatidoAt: true,
      sinImagen: true, mimeType: true, conversionEstado: true, conversionError: true, videoDuracionSeg: true, partesBorradasAt: true,
      hlsKey: true, videoBorradoAt: true, descargasExtra: true, motivoFin: true,
    },
  });
}

/**
 * Lo de Digitalización de la ficha de un trabajo: null si el trabajo no es de digitalización (ni
 * grabaciones ni nombre de video) o no es del negocio.
 */
export async function digitalizacionDelTrabajo(workspaceId: string, proyectoId: string) {
  if (!ID_VALIDO.test(proyectoId)) return null;
  const [trabajo] = await trabajosDeDigitalizacion(workspaceId, { id: proyectoId });
  if (!trabajo) return null;
  const [grabaciones, entrega, datos] = await Promise.all([
    grabacionesDelTrabajo(workspaceId, proyectoId),
    trabajo.pedidoId ? entregaDelPedido(workspaceId, trabajo.pedidoId) : Promise.resolve(null),
    prisma.fotofficeProyecto.findFirst({
      where: { id: proyectoId, workspaceId },
      select: { pedido: { select: { number: true } }, client: { select: { firstName: true, lastName: true, businessName: true } } },
    }),
  ]);
  return { trabajo, grabaciones, entrega, pedidoNumero: datos?.pedido?.number ?? null, cliente: datos?.client ?? null };
}
