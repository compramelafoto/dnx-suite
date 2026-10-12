import { formatPurchaseArs } from "@/lib/album-purchase/format-purchase-ars";
import { normalizeEmail } from "@/lib/order-claims";
import { prisma } from "@/lib/prisma";
import { PREFIJO_INVITADO } from "../actor-key";
import { BOT_PLATFORM } from "../config";
import { argentinaMonthPrefix } from "../dia-argentino";

/** Ventana para atribuirle una venta a una conversación del bot. */
const VENTANA_VENTAS_MS = 48 * 60 * 60 * 1000;
/** Topes para que el cron siga acotado aunque haya mucha actividad. */
const MAX_CASOS = 1_000;
const MAX_CONVERSACIONES_VENTAS = 5_000;

export type CategoriaPagina = "album" | "descarga" | "pago" | "preventa" | "mis_pedidos" | "otra";

/** Clasifica el `pagePath` guardado (ya sin tokens, ver `pagePathSeguro`). */
export function categoriaDePagina(pagePath: string | null): CategoriaPagina {
  if (!pagePath) return "otra";
  if (pagePath === "/cliente/recuperar-pack" || pagePath.startsWith("/cliente/pack/")) return "preventa";
  if (/^\/album\/[^/]+\/preventa\/?$/.test(pagePath)) return "preventa";
  if (pagePath.startsWith("/album/") || pagePath.startsWith("/a/")) return "album";
  if (pagePath.startsWith("/descargas/")) return "descarga";
  if (pagePath.startsWith("/pago/")) return "pago";
  if (pagePath === "/cliente/pedidos") return "mis_pedidos";
  return "otra";
}

export type ConvParaVentas = { guestKey: string | null; buyerEmail: string | null; albumId: number | null; createdAt: Date };
export type PedidoParaVentas = { albumId: number; botGuestKey: string | null; buyerEmail: string; totalCents: number; createdAt: Date };

/**
 * Pedidos que llegaron después de una conversación del bot: mismo álbum, conversación creada antes
 * del pedido y a lo sumo `ventanaMs` antes, y el mismo navegador (`botGuestKey`) o el mismo mail
 * verificado. Cada pedido cuenta una sola vez. `totalCents` son pesos enteros.
 */
export function ventasPosteriores(
  convs: ConvParaVentas[],
  pedidos: PedidoParaVentas[],
  ventanaMs: number = VENTANA_VENTAS_MS,
): { pedidos: number; pesos: number } {
  let cantidad = 0;
  let pesos = 0;
  for (const o of pedidos) {
    const mail = normalizeEmail(o.buyerEmail);
    const t = o.createdAt.getTime();
    const vino = convs.some((c) => {
      if (c.albumId == null || c.albumId !== o.albumId) return false;
      const antes = t - c.createdAt.getTime();
      if (antes <= 0 || antes > ventanaMs) return false;
      const mismoNavegador = c.guestKey != null && o.botGuestKey != null && c.guestKey === o.botGuestKey;
      const mismoMail = c.buyerEmail != null && mail !== "" && normalizeEmail(c.buyerEmail) === mail;
      return mismoNavegador || mismoMail;
    });
    if (vino) {
      cantidad++;
      pesos += o.totalCents;
    }
  }
  return { pedidos: cantidad, pesos };
}

/** Gasto del mes argentino del bot de compradores (filas `g:` de `BotUsageDaily`), en micro-dólares. */
export async function gastoCompradoresMes(now: Date): Promise<number> {
  const r = await prisma.botUsageDaily.aggregate({
    where: { platform: BOT_PLATFORM, day: { startsWith: argentinaMonthPrefix(now) }, actorKey: { startsWith: PREFIJO_INVITADO } },
    _sum: { costMicroUsd: true },
  });
  return r._sum.costMicroUsd ?? 0;
}

function plural(n: number, uno: string, varios: string) {
  return `${n} ${n === 1 ? uno : varios}`;
}

type FilaConversaciones = { pagePath: string | null; status: string; _count: { _all: number } };

function lineaConversaciones(filas: FilaConversaciones[]): string {
  const por: Record<CategoriaPagina, number> = { album: 0, descarga: 0, pago: 0, preventa: 0, mis_pedidos: 0, otra: 0 };
  let total = 0;
  let derivadas = 0;
  for (const f of filas) {
    const n = f._count._all;
    total += n;
    por[categoriaDePagina(f.pagePath)] += n;
    if (f.status === "ESCALATED") derivadas += n;
  }
  const otras = por.otra ? `, otras ${por.otra}` : "";
  return (
    `Compradores: ${plural(total, "conversación", "conversaciones")} ` +
    `(álbum ${por.album}, descarga ${por.descarga}, pago ${por.pago}, preventa ${por.preventa}, mis pedidos ${por.mis_pedidos}${otras}), ` +
    `${plural(total - derivadas, "resuelta", "resueltas")} sin caso.`
  );
}

function lineaCasos(filas: { input: unknown }[]): string {
  if (filas.length === 0) return "Casos de compradores: 0.";
  const por = new Map<string, number>();
  for (const f of filas) {
    const motivo = (f.input as { motivo?: unknown } | null)?.motivo;
    const clave = typeof motivo === "string" && motivo ? motivo : "otro";
    por.set(clave, (por.get(clave) ?? 0) + 1);
  }
  const detalle = [...por.entries()]
    .sort(([a, x], [b, y]) => y - x || a.localeCompare(b))
    .map(([motivo, n]) => `${motivo.replace(/_/g, " ")}: ${n}`)
    .join(", ");
  return `Casos de compradores: ${filas.length} (${detalle}).`;
}

async function lineaVentas(since: Date): Promise<string> {
  const convs = await prisma.botConversation.findMany({
    where: {
      platform: BOT_PLATFORM,
      audience: "BUYER",
      albumId: { not: null },
      createdAt: { gt: new Date(since.getTime() - VENTANA_VENTAS_MS) },
    },
    select: { guestKey: true, buyerEmail: true, albumId: true, createdAt: true },
    take: MAX_CONVERSACIONES_VENTAS,
  });
  const albumes = [...new Set(convs.map((c) => c.albumId).filter((id): id is number => id != null))];
  let r = { pedidos: 0, pesos: 0 };
  if (albumes.length > 0) {
    const pedidos = await prisma.order.findMany({
      // Misma regla de venta que el resto del resumen: pagada, no de prueba y con monto.
      where: { status: "PAID", isTest: false, totalCents: { gt: 0 }, createdAt: { gt: since }, albumId: { in: albumes } },
      select: { albumId: true, botGuestKey: true, buyerEmail: true, totalCents: true, createdAt: true },
    });
    r = ventasPosteriores(convs, pedidos);
  }
  return `Ventas después del bot (48 h): ${plural(r.pedidos, "pedido", "pedidos")}, ${formatPurchaseArs(r.pesos)}.`;
}

/** Sección de compradores del resumen diario: todo se cuenta desde `since` (`_now` queda por contrato). */
export async function lineasCompradores(since: Date, _now: Date): Promise<string[]> {
  const desde = { gt: since };
  const deCompradores = { platform: BOT_PLATFORM, userId: null };
  const [conversaciones, casos, codigos, verificados, reenvios, quitar, ventas] = await Promise.all([
    prisma.botConversation.groupBy({
      by: ["pagePath", "status"],
      where: { platform: BOT_PLATFORM, audience: "BUYER", createdAt: desde },
      _count: { _all: true },
    }),
    prisma.botAction.findMany({
      where: { ...deCompradores, toolName: "abrir_caso", createdAt: desde },
      select: { input: true },
      take: MAX_CASOS,
    }),
    prisma.botEmailCode.count({ where: { createdAt: desde } }),
    prisma.botEmailCode.count({ where: { createdAt: desde, usedAt: { not: null } } }),
    prisma.botAction.groupBy({
      by: ["toolName"],
      // Sólo los que mandaron algo: "enviados:0" es un mail sin compras (o sin packs), no un reenvío.
      where: {
        ...deCompradores,
        toolName: { in: ["reenviar_descarga", "reenviar_link_pack"] },
        createdAt: desde,
        resultMessage: { startsWith: "enviados:", not: "enviados:0" },
      },
      _count: { _all: true },
    }),
    // Se crea al confirmar la tarjeta: cuenta por la fecha de ejecución, no por la de la propuesta.
    prisma.botAction.count({ where: { ...deCompradores, toolName: "solicitar_quitar_foto", status: "EXECUTED", decidedAt: desde } }),
    lineaVentas(since),
  ]);
  const reenviosDe = (tool: string) => reenvios.find((r) => r.toolName === tool)?._count._all ?? 0;
  return [
    lineaConversaciones(conversaciones as FilaConversaciones[]),
    lineaCasos(casos),
    `Códigos: ${codigos} pedidos, ${verificados} verificados.`,
    `Reenvíos: ${reenviosDe("reenviar_descarga")} de descargas, ${reenviosDe("reenviar_link_pack")} de packs.`,
    `Pedidos para quitar fotos: ${quitar}.`,
    ventas,
  ];
}
