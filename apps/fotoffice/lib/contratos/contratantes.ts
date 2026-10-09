import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { puedeEnContexto } from "@/lib/access/policy";
import { CLIENTS_MODULE_KEY } from "@/lib/clients/constants";
import { clientDisplayName } from "@/lib/clients/display";
import { MENSAJES_CONTRATO as M, puedeGestionarContratos, puedeVerContratos, type CtxContratos } from "./acceso";
import type { ContratanteParaContrato } from "./variables";

/**
 * Contratantes de un pedido (`FotofficePedidoContratante`).
 *
 * DECISIÓN: la fila del contratante 1 es opcional. Sin fila, el contratante 1 es el contacto del
 * pedido (`FotofficePedido.clientId`) y la pantalla lo marca "por omisión"; sólo se guarda una fila
 * cuando alguien elige a otra persona. Así un pedido nuevo (y todos los viejos) ya tiene contratante
 * sin escribir nada, y volver al contacto del pedido borra la fila. El contratante 2 es opcional: sin
 * fila, no hay. `resolverContratantes` es la única forma de leerlos (la usa también la generación del
 * contrato): siempre devuelve el 1 y, si hay, el 2.
 */
export type Contratante = {
  orden: 1 | 2;
  clientId: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  /** Sólo el contratante 1: es el contacto del pedido, sin fila propia. */
  porOmision: boolean;
  /** Los datos que usan las variables del contrato. */
  datos: ContratanteParaContrato;
};

const SELECT_CLIENTE = {
  id: true, kind: true, firstName: true, lastName: true, businessName: true, docType: true, docNumber: true,
  address: true, city: true, email: true, phone: true,
} as const;

type FilaCliente = {
  id: string; kind: string; firstName: string | null; lastName: string | null; businessName: string | null;
  docType: string | null; docNumber: string | null; address: string | null; city: string | null;
  email: string | null; phone: string | null;
};

function idValido(v: unknown): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= 64;
}

function aContratante(orden: 1 | 2, c: FilaCliente, porOmision: boolean): Contratante {
  const nombre = clientDisplayName(c);
  return {
    orden, clientId: c.id, nombre, email: c.email?.trim() || null, telefono: c.phone?.trim() || null, porOmision,
    datos: { nombre, docType: c.docType, docNumber: c.docNumber, address: c.address, city: c.city, email: c.email, phone: c.phone },
  };
}

/** Los contratantes del pedido (sin permisos: lo usa el servidor ya autorizado). null si el pedido no existe en el workspace. */
export async function resolverContratantes(
  workspaceId: string,
  pedidoId: string,
  db: Pick<Prisma.TransactionClient, "fotofficePedido" | "fotofficePedidoContratante" | "client"> = prisma,
): Promise<Contratante[] | null> {
  const pedido = await db.fotofficePedido.findFirst({ where: { id: pedidoId, workspaceId }, select: { id: true, clientId: true } });
  if (!pedido) return null;
  const filas = await db.fotofficePedidoContratante.findMany({
    where: { workspaceId, pedidoId },
    select: { orden: true, clientId: true },
    orderBy: [{ orden: "asc" }],
  });
  const fila1 = filas.find((f) => f.orden === 1)?.clientId as string | undefined;
  const fila2 = filas.find((f) => f.orden === 2)?.clientId as string | undefined;
  const id1 = fila1 ?? (pedido.clientId as string);
  const ids = [id1, ...(fila2 ? [fila2] : [])];
  const clientes = await db.client.findMany({ where: { workspaceId, id: { in: ids } }, select: SELECT_CLIENTE });
  const por = new Map((clientes as FilaCliente[]).map((c) => [c.id, c]));
  const c1 = por.get(id1);
  if (!c1) return null;
  const salida: Contratante[] = [aContratante(1, c1, fila1 === undefined)];
  const c2 = fila2 ? por.get(fila2) : undefined;
  if (c2) salida.push(aContratante(2, c2, false));
  return salida;
}

/** Lo mismo con el permiso "Ver" en Contratos (para la ficha del pedido). */
export async function leerContratantes(ctx: CtxContratos, pedidoId: unknown): Promise<Contratante[] | null> {
  if (!puedeVerContratos(ctx) || !idValido(pedidoId)) return null;
  return resolverContratantes(ctx.workspaceId, pedidoId);
}

export type ResultadoContratante = { ok: true } | { ok: false; error: string };

/**
 * Elige quién es el contratante 1 o el 2. Exige "Gestionar" en Contratos; el pedido y el contacto tienen
 * que ser del workspace. Las dos personas no pueden ser la misma. Elegir como contratante 1 al contacto
 * del pedido borra la fila (vuelve a ser "por omisión").
 */
export async function fijarContratante(ctx: CtxContratos, datos: unknown): Promise<ResultadoContratante> {
  if (!puedeGestionarContratos(ctx)) return { ok: false, error: M.sinPermiso };
  // R10: el padrón de clientes se elige sólo con "Ver" en Clientes (no alcanza con conocer el id).
  if (!puedeEnContexto(ctx, "ver", CLIENTS_MODULE_KEY)) return { ok: false, error: M.buscarClientes };
  if (!datos || typeof datos !== "object") return { ok: false, error: M.datosInvalidos };
  const d = datos as Record<string, unknown>;
  if (!idValido(d.pedidoId) || !idValido(d.clientId)) return { ok: false, error: M.datosInvalidos };
  if (d.orden !== 1 && d.orden !== 2) return { ok: false, error: M.orden };
  const { workspaceId } = ctx;
  const pedidoId = d.pedidoId;
  const clientId = d.clientId;
  const orden = d.orden;
  const pedido = await prisma.fotofficePedido.findFirst({ where: { id: pedidoId, workspaceId }, select: { id: true, clientId: true } });
  if (!pedido) return { ok: false, error: M.pedido };
  const cliente = await prisma.client.findFirst({ where: { id: clientId, workspaceId }, select: { id: true } });
  if (!cliente) return { ok: false, error: M.contacto };
  const actuales = await resolverContratantes(workspaceId, pedidoId);
  if (!actuales) return { ok: false, error: M.pedido };
  const otro = actuales.find((c) => c.orden !== orden);
  if (otro && otro.clientId === clientId) return { ok: false, error: M.contratanteRepetido };
  try {
    if (orden === 1 && clientId === pedido.clientId) {
      await prisma.fotofficePedidoContratante.deleteMany({ where: { workspaceId, pedidoId, orden: 1 } });
      return { ok: true };
    }
    await prisma.fotofficePedidoContratante.upsert({
      where: { pedidoId_orden: { pedidoId, orden } },
      create: { workspaceId, pedidoId, orden, clientId },
      update: { clientId },
      select: { id: true },
    });
    return { ok: true };
  } catch (e) {
    if ((e as { code?: unknown } | null)?.code === "P2002") {
      // Dos pestañas crearon la fila a la vez: gana la última.
      await prisma.fotofficePedidoContratante.updateMany({ where: { workspaceId, pedidoId, orden }, data: { clientId } });
      return { ok: true };
    }
    return { ok: false, error: M.guardar };
  }
}

/** Quita al contratante 2. El 1 no se quita (se reemplaza). Exige "Gestionar" en Contratos. */
export async function quitarContratante2(ctx: CtxContratos, pedidoId: unknown): Promise<ResultadoContratante> {
  if (!puedeGestionarContratos(ctx)) return { ok: false, error: M.sinPermiso };
  if (!idValido(pedidoId)) return { ok: false, error: M.datosInvalidos };
  const pedido = await prisma.fotofficePedido.findFirst({ where: { id: pedidoId, workspaceId: ctx.workspaceId }, select: { id: true } });
  if (!pedido) return { ok: false, error: M.pedido };
  const r = await prisma.fotofficePedidoContratante.deleteMany({ where: { workspaceId: ctx.workspaceId, pedidoId, orden: 2 } });
  return r.count > 0 ? { ok: true } : { ok: false, error: M.sinContratante2 };
}
