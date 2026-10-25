import "server-only";
import { prisma } from "@repo/db";
import { enlaceDeMapa } from "@/lib/geocode/lugar";
import { etiquetaTamano } from "./carpeta-lab";
import { ETIQUETA_PAPEL, type Papel } from "./constantes";

/**
 * Lo que muestra la ficha de un trabajo que nació de un pedido de copias impresas: el resumen del pedido y,
 * si quedó pagado sin salir al laboratorio, el motivo y «Reintentar envío».
 */

const ID_VALIDO = /^[A-Za-z0-9_-]{1,64}$/;
const cents = (v: { toString(): string }) => Math.round(Number(String(v)) * 100);

export type PedidoDelTrabajo = {
  pedidoId: string;
  numero: number;
  estado: string;
  lastError: string | null;
  copias: { tamano: string; papel: string; cantidad: number }[];
  totalCents: number;
  costoCents: number;
  gananciaCents: number;
  /** null = retiro en el local. Con envío: adónde, cuántos km (ida), cuánto se cobró y el punto en el mapa. */
  entrega: { direccion: string; km: number | null; envioCents: number; mapa: string | null } | null;
};

/** El pedido de impresión del trabajo (de esta organización), o null si el trabajo no viene de uno. */
export async function pedidoDelTrabajo(workspaceId: string, proyectoId: string): Promise<PedidoDelTrabajo | null> {
  const p = await prisma.fotofficePrintOrder.findFirst({
    where: { workspaceId, items: { some: { proyectoId } } },
    select: {
      id: true, number: true, status: true, lastError: true, paper: true, totalArs: true, costTotalArs: true,
      delivery: true, shippingArs: true, shippingAddress: true, shippingLat: true, shippingLon: true, shippingKm: true,
      items: { select: { widthCm: true, heightCm: true, quantity: true } },
    },
  });
  if (!p) return null;
  const papel = ETIQUETA_PAPEL[p.paper as Papel] ?? p.paper;
  const porTamano = new Map<string, { corto: number; largo: number; cantidad: number }>();
  for (const i of p.items) {
    const w = Number(String(i.widthCm));
    const h = Number(String(i.heightCm));
    const clave = etiquetaTamano(w, h);
    const previo = porTamano.get(clave) ?? { corto: Math.min(w, h), largo: Math.max(w, h), cantidad: 0 };
    previo.cantidad += i.quantity;
    porTamano.set(clave, previo);
  }
  const copias = [...porTamano.entries()]
    .sort(([, a], [, b]) => a.corto - b.corto || a.largo - b.largo)
    .map(([tamano, v]) => ({ tamano, papel, cantidad: v.cantidad }));
  const totalCents = cents(p.totalArs);
  const costoCents = cents(p.costTotalArs);
  const entrega =
    p.delivery === "ENVIO" && p.shippingAddress
      ? {
          direccion: p.shippingAddress,
          km: p.shippingKm ?? null,
          envioCents: cents(p.shippingArs ?? 0),
          mapa: p.shippingLat != null && p.shippingLon != null ? enlaceDeMapa(p.shippingLat, p.shippingLon) : null,
        }
      : null;
  return { pedidoId: p.id, numero: p.number, estado: p.status, lastError: p.lastError, copias, totalCents, costoCents,
    // El envío se cobra para pagar el traslado: no es ganancia de las copias.
    gananciaCents: totalCents - (entrega?.envioCents ?? 0) - costoCents, entrega };
}

export type PedidoSinEnviar = { pedidoId: string; numero: number; cliente: string; pagadoEl: Date | null; totalCents: number; lastError: string | null };

/**
 * Los pedidos pagados que no salieron al laboratorio (Configuración → Impresiones): incluye los que no tienen
 * trabajo, que no se pueden reintentar desde ninguna ficha.
 */
export async function pedidosPagadosSinEnviar(workspaceId: string): Promise<PedidoSinEnviar[]> {
  const filas = await prisma.fotofficePrintOrder.findMany({
    where: { workspaceId, status: "PAGADO_SIN_ENVIAR" },
    orderBy: [{ paidAt: "asc" }, { number: "asc" }],
    take: 50,
    select: { id: true, number: true, nombre: true, paidAt: true, totalArs: true, lastError: true },
  });
  return filas.map((p) => ({ pedidoId: p.id, numero: p.number, cliente: p.nombre, pagadoEl: p.paidAt, totalCents: cents(p.totalArs), lastError: p.lastError }));
}

/**
 * «Reintentar envío»: un pedido PAGADO_SIN_ENVIAR de esta organización vuelve a PAGADO (con los intentos en
 * cero) y el próximo cron lo prepara (si le faltan los trabajos, los crea primero). Quien llama ya exigió
 * "Gestionar" en Proyectos.
 */
export async function reintentarEnvio(ctx: { workspaceId: string }, pedidoId: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  if (typeof pedidoId !== "string" || !ID_VALIDO.test(pedidoId)) return { ok: false, error: "Pedido inválido." };
  const r = await prisma.fotofficePrintOrder.updateMany({
    where: { id: pedidoId, workspaceId: ctx.workspaceId, status: "PAGADO_SIN_ENVIAR" },
    data: { status: "PAGADO", lastError: null, lockedAt: null, attempts: 0 },
  });
  return r.count === 1 ? { ok: true } : { ok: false, error: "Este pedido ya no está esperando un reintento." };
}
