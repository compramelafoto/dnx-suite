import "server-only";
import { prisma, type Prisma } from "@repo/db";

/**
 * Historial de la galería (`FotofficeGaleriaEvento`, sólo se agrega). Guarda códigos y números: nunca
 * nombres, correos, teléfonos ni textos (el nombre del cliente se lee de su fila al mostrarlo).
 */
type Cliente = Pick<Prisma.TransactionClient, "fotofficeGaleriaEvento">;

export type DatosEvento = Record<string, string | number | boolean | null>;

export async function registrarEvento(
  cliente: Cliente,
  e: { workspaceId: string; galeriaId: string; tipo: string; galeriaClienteId?: string | null; actorUserId?: number | null; data?: DatosEvento },
): Promise<void> {
  await cliente.fotofficeGaleriaEvento.create({
    data: {
      workspaceId: e.workspaceId,
      galeriaId: e.galeriaId,
      type: e.tipo,
      galeriaClienteId: e.galeriaClienteId ?? null,
      actorUserId: e.actorUserId ?? null,
      ...(e.data ? { data: e.data as Prisma.InputJsonValue } : {}),
    },
    select: { id: true },
  });
}

/** Igual, pero nunca lanza: para lo que se registra después de un hecho que ya ocurrió (correos con `after()`). */
export async function registrarEventoSinFallar(e: Parameters<typeof registrarEvento>[1]): Promise<void> {
  try {
    await registrarEvento(prisma, e);
  } catch (err) {
    console.error("[galerias] no se pudo registrar un evento", { codigo: (err as { code?: unknown } | null)?.code ?? "desconocido" });
  }
}

export type EventoDeGaleria = {
  id: string;
  tipo: string;
  galeriaClienteId: string | null;
  actorUserId: number | null;
  data: unknown;
  createdAt: Date;
};

/** Los eventos de una galería, del más nuevo al más viejo (sin permisos: lo llama código ya autorizado). */
export async function listarEventos(workspaceId: string, galeriaId: string, limite = 200, saltear = 0): Promise<EventoDeGaleria[]> {
  const filas = await prisma.fotofficeGaleriaEvento.findMany({
    where: { workspaceId, galeriaId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limite,
    ...(saltear > 0 ? { skip: saltear } : {}),
    select: { id: true, type: true, galeriaClienteId: true, actorUserId: true, data: true, createdAt: true },
  });
  return filas.map((f) => ({ id: f.id, tipo: f.type, galeriaClienteId: f.galeriaClienteId, actorUserId: f.actorUserId, data: f.data, createdAt: f.createdAt }));
}
