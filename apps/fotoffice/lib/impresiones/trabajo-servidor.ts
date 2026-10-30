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
  /** Pedido armado en el Mostrador: no tiene montos (se cobró en el ticket). */
  deMostrador: boolean;
  costoCents: number;
  gananciaCents: number;
  /** Pedidos del bot (con seña): lo pagado y el saldo. null en los pedidos que se pagan enteros. */
  pagadoCents: number | null;
  saldoCents: number | null;
  /** Lo que el cliente pagó de más (hay que devolverlo). 0 o null si no. */
  deMasCents?: number | null;
  /** null = retiro en el local. Con envío: adónde, cuántos km (ida), cuánto se cobró y el punto en el mapa. */
  entrega: { direccion: string; km: number | null; envioCents: number; mapa: string | null } | null;
};

/** El pedido de impresión del trabajo (de esta organización), o null si el trabajo no viene de uno. */
export async function pedidoDelTrabajo(workspaceId: string, proyectoId: string): Promise<PedidoDelTrabajo | null> {
  const p = await prisma.fotofficePrintOrder.findFirst({
    where: { workspaceId, items: { some: { proyectoId } } },
    select: {
      id: true, number: true, status: true, lastError: true, source: true, paper: true, totalArs: true, costTotalArs: true,
      delivery: true, shippingArs: true, shippingAddress: true, shippingLat: true, shippingLon: true, shippingKm: true,
      depositArs: true, paidArs: true,
      items: { select: { widthCm: true, heightCm: true, quantity: true, paper: true } },
    },
  });
  if (!p) return null;
  const etiqueta = (papel: string | null) => ETIQUETA_PAPEL[(papel ?? p.paper) as Papel] ?? papel ?? p.paper;
  const porTamano = new Map<string, { tamano: string; papel: string; corto: number; largo: number; cantidad: number }>();
  for (const i of p.items) {
    const w = Number(String(i.widthCm));
    const h = Number(String(i.heightCm));
    const tamano = etiquetaTamano(w, h);
    const papel = etiqueta(i.paper);
    const clave = `${tamano}|${papel}`;
    const previo = porTamano.get(clave) ?? { tamano, papel, corto: Math.min(w, h), largo: Math.max(w, h), cantidad: 0 };
    previo.cantidad += i.quantity;
    porTamano.set(clave, previo);
  }
  const copias = [...porTamano.values()]
    .sort((a, b) => a.corto - b.corto || a.largo - b.largo || a.papel.localeCompare(b.papel))
    .map((v) => ({ tamano: v.tamano, papel: v.papel, cantidad: v.cantidad }));
  const conSena = p.depositArs !== null && p.depositArs !== undefined;
  const pagadoCents = conSena ? cents(p.paidArs ?? 0) : null;
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
  return { pedidoId: p.id, numero: p.number, estado: p.status, lastError: p.lastError, copias, totalCents, deMostrador: p.source === "MOSTRADOR", costoCents,
    pagadoCents, saldoCents: pagadoCents === null ? null : Math.max(0, totalCents - pagadoCents),
    deMasCents: pagadoCents === null ? null : Math.max(0, pagadoCents - totalCents),
    // El envío se cobra para pagar el traslado: no es ganancia de las copias.
    gananciaCents: totalCents - (entrega?.envioCents ?? 0) - costoCents, entrega };
}

export type PedidoSinEnviar = { pedidoId: string; numero: number; cliente: string; pagadoEl: Date | null; totalCents: number; deMostrador: boolean; lastError: string | null };

/**
 * Los pedidos pagados que no salieron al laboratorio (Configuración → Impresiones): incluye los que no tienen
 * trabajo, que no se pueden reintentar desde ninguna ficha.
 */
export async function pedidosPagadosSinEnviar(workspaceId: string): Promise<PedidoSinEnviar[]> {
  const filas = await prisma.fotofficePrintOrder.findMany({
    where: { workspaceId, status: "PAGADO_SIN_ENVIAR" },
    orderBy: [{ paidAt: "asc" }, { number: "asc" }],
    take: 50,
    select: { id: true, number: true, nombre: true, paidAt: true, totalArs: true, lastError: true, source: true },
  });
  return filas.map((p) => ({ pedidoId: p.id, numero: p.number, cliente: p.nombre, pagadoEl: p.paidAt, totalCents: cents(p.totalArs), deMostrador: p.source === "MOSTRADOR", lastError: p.lastError }));
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

const MEDIOS = new Set(["EFECTIVO", "TRANSFERENCIA", "MERCADO_PAGO", "TARJETA", "OTRO"]);

/**
 * «Cobrar el saldo» de un pedido de impresión del bot (spec 2026-10-28): lo pagado pasa a ser el total
 * y, con Caja encendida, se registra el ingreso con el medio elegido. Escritura condicional sobre lo
 * pagado que se leyó: dos cobros a la vez no suman dos veces.
 */
export async function cobrarSaldoImpresion(
  ctx: { workspaceId: string; userId: number | null },
  pedidoId: unknown,
  medio: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (typeof pedidoId !== "string" || !ID_VALIDO.test(pedidoId)) return { ok: false, error: "Pedido inválido." };
  if (typeof medio !== "string" || !MEDIOS.has(medio)) return { ok: false, error: "Elegí cómo pagó." };
  const p = (await prisma.fotofficePrintOrder.findUnique({
    where: { id: pedidoId },
    select: { id: true, workspaceId: true, number: true, nombre: true, clientId: true, totalArs: true, paidArs: true, depositArs: true },
  })) as { id: string; workspaceId: string; number: number; nombre: string; clientId: string | null; totalArs: unknown; paidArs: unknown; depositArs: unknown } | null;
  if (!p || p.workspaceId !== ctx.workspaceId || p.depositArs === null || p.depositArs === undefined) return { ok: false, error: "Pedido inválido." };
  const saldo = cents(String(p.totalArs)) - cents(String(p.paidArs ?? 0));
  if (saldo <= 0) return { ok: false, error: "Este pedido no tiene saldo." };

  const [{ isModuleEnabledForWorkspace }, { CASH_MODULE_KEY }, { resolveDepositTarget }, { recordCashMovement }] = await Promise.all([
    import("@/lib/modules/gating"),
    import("@/lib/cash/constants"),
    import("@/lib/cash/auto-deposit"),
    import("@/lib/cash/record-movement"),
  ]);
  const cajaEncendida = await isModuleEnabledForWorkspace(ctx.workspaceId, CASH_MODULE_KEY);
  return prisma.$transaction(async (tx) => {
    const c = await tx.fotofficePrintOrder.updateMany({
      where: { id: p.id, workspaceId: ctx.workspaceId, paidArs: String(p.paidArs) },
      data: { paidArs: (cents(String(p.totalArs)) / 100).toFixed(2) },
    });
    if (c.count === 0) return { ok: false as const, error: "El pedido cambió: actualizá la página." };
    if (cajaEncendida) {
      const cuentas = await tx.cashAccount.findMany({
        where: { workspaceId: ctx.workspaceId, isActive: true },
        select: { id: true, name: true, kind: true, isDefault: true, isVault: true },
        orderBy: { order: "asc" },
      });
      const destino = resolveDepositTarget({ cashEnabled: true, paymentMethod: medio, accounts: cuentas, categories: [], categoryName: "" });
      if (destino.ok) {
        await recordCashMovement(tx, {
          workspaceId: ctx.workspaceId,
          accountId: destino.accountId,
          kind: "INGRESO",
          amountMinor: saldo,
          occurredAt: new Date(),
          description: `Saldo · copias impresas · pedido ${p.number} · ${p.nombre}`,
          sourceModule: "impresiones",
          sourceRef: `${p.id}:saldo`,
          clientId: p.clientId,
          paymentMethod: medio as "EFECTIVO",
          createdByUserId: ctx.userId,
        });
      }
    }
    return { ok: true as const };
  });
}
