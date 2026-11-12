import "server-only";
import { prisma } from "@repo/db";
import { precioDeLista } from "@/lib/presupuestos/lista-precios";
import type { PagoMp as PagoLeido } from "@/lib/galerias/acreditar";
import {
  decidirAutoComprobante,
  textoAvisoComprobante,
  TEXTO_COMPROBANTE_A_REVISAR,
  type PedidoEsperandoPago,
} from "./auto-decision";
import { escribirNotaComprobante, leerYBuscarComprobante, MENSAJES_COMPROBANTE, type LecturaComprobante } from "./verificar-servidor";
import { textoDelVeredicto } from "./veredicto";

/**
 * El bot cobra por transferencia (no por link de Mercado Pago, que le cuesta comisión al estudio):
 * cuando el cliente manda una imagen o un PDF en un chat con un pedido del bot esperando el pago
 * (creado en los últimos 7 días), se lee como comprobante y se busca en el Mercado Pago del estudio.
 *   - Si no es un comprobante: "SEGUIR" (el bot contesta como siempre).
 *   - Si se cumple todo lo de `decidirAutoComprobante`: se acredita con el camino de siempre (copias:
 *     `acreditarPagoImpresion`, que le confirma al cliente; catálogo: el cobro del pedido y un mensaje
 *     del bot) y queda una nota del sistema con el veredicto: "ACREDITADO".
 *   - Si no: el bot le dice que lo estamos chequeando, el chat pasa a una persona (con aviso por
 *     Telegram) y queda la nota: "A_PERSONA".
 * Lo llama `responder.ts` con el chat ya esperado y antes del turno del modelo, así el bot no
 * contesta dos veces. Nunca lanza.
 */

export type SalidaAutoComprobante = "SEGUIR" | "ACREDITADO" | "A_PERSONA" | "OMITIDO";

export const DIAS_PEDIDO_ESPERANDO = 7;

type ChatDelComprobante = { id: string; workspaceId: string; waId: string; nombre: string | null };
type SalidaEnvio = "enviado" | "simulado" | "fallo" | "omitido";

export type DepsAutoComprobante = {
  pedidos?: (workspaceId: string, chatId: string, desde: Date) => Promise<PedidoEsperandoPago[]>;
  leer?: (workspaceId: string, chatId: string, mensajeId: string) => Promise<LecturaComprobante>;
  yaUsado?: (workspaceId: string, pagoId: string) => Promise<boolean>;
  autoConfirmar?: (workspaceId: string) => Promise<boolean>;
  /** El pago completo (moneda, comisión, fecha de aprobación), leído de nuevo en Mercado Pago por su id. */
  pagoCompleto?: (workspaceId: string, pagoId: string) => Promise<PagoLeido | null>;
  acreditarImpresion?: (workspaceId: string, pedidoId: string, pago: PagoLeido) => Promise<string | null>;
  acreditarCatalogo?: (workspaceId: string, pedidoId: string, pago: PagoLeido) => Promise<string | null>;
  /** Lo que escribe el bot (con la misma condición que su respuesta: si entró otro mensaje, no sale). */
  responder?: (texto: string) => Promise<SalidaEnvio>;
  pasar?: (motivo: string) => Promise<void>;
  telegram?: (workspaceId: string, html: string) => Promise<void>;
  sistema?: (workspaceId: string, chatId: string, texto: string) => Promise<void>;
};

const cents = (v: unknown) => Math.round(Number(String(v ?? 0)) * 100);

async function pedidosEsperando(workspaceId: string, chatId: string, desde: Date): Promise<PedidoEsperandoPago[]> {
  const { prefijoDelChat, senaDe } = await import("@/lib/pedidos/whatsapp");
  const [copias, catalogo] = await Promise.all([
    prisma.fotofficePrintOrder.findMany({
      where: { workspaceId, waChatId: chatId, source: "WHATSAPP", status: "PENDIENTE_PAGO", createdAt: { gte: desde } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, number: true, createdAt: true, totalArs: true, depositArs: true },
    }),
    prisma.fotofficePedido.findMany({
      where: { workspaceId, status: "CONFIRMADO", altaKey: { startsWith: prefijoDelChat(chatId) }, createdAt: { gte: desde } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, number: true, createdAt: true, totalArs: true, paymentOption: true },
    }),
  ]);
  // Un pedido de catálogo con algún cobro vigente ya no espera la seña.
  const conCobro = catalogo.length
    ? new Set((await prisma.fotofficeCobro.findMany({ where: { workspaceId, pedidoId: { in: catalogo.map((p) => p.id) }, voidedAt: null }, select: { pedidoId: true } })).map((c) => c.pedidoId))
    : new Set<string>();
  const lista: PedidoEsperandoPago[] = [
    ...copias.map((p) => ({
      tipo: "IMPRESION" as const, id: p.id, numero: String(p.number), creadoEn: p.createdAt,
      totalCents: cents(p.totalArs), senaCents: p.depositArs === null ? null : cents(p.depositArs),
    })),
    ...catalogo
      .filter((p) => !conCobro.has(p.id))
      .map((p) => {
        const total = Number(String(p.totalArs));
        // Al contado (el cliente eligió pagar el total) no hay seña.
        const contado = (p.paymentOption as { tipo?: unknown } | null)?.tipo === "CONTADO";
        return {
          tipo: "CATALOGO" as const, id: p.id, numero: p.number, creadoEn: p.createdAt,
          totalCents: cents(total), senaCents: contado ? null : Math.round(senaDe(total).sena * 100),
        };
      }),
  ];
  return lista.sort((a, b) => b.creadoEn.getTime() - a.creadoEn.getTime());
}

const POR_OMISION: Required<Omit<DepsAutoComprobante, "responder" | "pasar">> = {
  pedidos: pedidosEsperando,
  leer: (workspaceId, chatId, mensajeId) => leerYBuscarComprobante(workspaceId, chatId, mensajeId),
  yaUsado: async (workspaceId, pagoId) => {
    const { pagoMpYaUsado } = await import("@/lib/impresiones/pago-unico");
    return pagoMpYaUsado(prisma, workspaceId, pagoId);
  },
  autoConfirmar: async (workspaceId) => {
    const { leerAjustesCobro } = await import("@/lib/cobro-ajustes/ajustes");
    return (await leerAjustesCobro(workspaceId)).autoConfirmarPedido;
  },
  pagoCompleto: async (workspaceId, pagoId) => {
    const { resolveWorkspaceCollector } = await import("@/lib/payments/connect/collector");
    const { createMercadoPagoCheckoutProLiveAdapter } = await import("@repo/payments/mercado-pago");
    const c = await resolveWorkspaceCollector(workspaceId);
    if (!c.ok) return null;
    return createMercadoPagoCheckoutProLiveAdapter({ accessToken: c.collector.accessToken }).getPayment(pagoId);
  },
  acreditarImpresion: async (workspaceId, pedidoId, pago) => {
    const { acreditarPagoImpresion } = await import("@/lib/impresiones/acreditar-servidor");
    const r = await acreditarPagoImpresion(workspaceId, pago, { porComprobante: { pedidoId } });
    if (!r.ok) return r.error === "PAGO_YA_USADO" ? "ese pago de Mercado Pago ya se usó para otro pedido" : `no se pudo acreditar (${r.error})`;
    return r.yaEstaba ? "el pedido ya figuraba pagado" : null;
  },
  acreditarCatalogo: async (workspaceId, pedidoId, pago) => {
    const { acreditarPagoPedidoPorComprobante } = await import("@/lib/pedidos/mp");
    const r = await acreditarPagoPedidoPorComprobante(workspaceId, pedidoId, pago);
    if (r.resultado === "acreditado") return null;
    if (r.resultado === "pago_ya_usado") return "ese pago de Mercado Pago ya se usó para otro pedido";
    if (r.resultado === "ya_acreditado") return "el pedido ya figuraba pagado";
    return `no se pudo acreditar (${r.resultado === "sin_aplicar" ? r.motivo : r.resultado})`;
  },
  telegram: async (workspaceId, html) => {
    const { avisarAlDuenoPorTelegram } = await import("../bot/aviso-no-cliente-servidor");
    await avisarAlDuenoPorTelegram(workspaceId, html);
  },
  sistema: (workspaceId, chatId, texto) => escribirNotaComprobante(workspaceId, chatId, texto),
};

export async function atenderComprobanteDelBot(
  chat: ChatDelComprobante,
  archivos: readonly string[],
  ahora: Date,
  deps: DepsAutoComprobante & Required<Pick<DepsAutoComprobante, "responder" | "pasar">>,
): Promise<SalidaAutoComprobante> {
  try {
    return await atender(chat, archivos, ahora, { ...POR_OMISION, ...deps });
  } catch (e) {
    console.warn("[fotoffice][comprobante] falló la verificación automática", { codigo: e instanceof Error ? e.name : "desconocido" });
    return "SEGUIR";
  }
}

async function atender(chat: ChatDelComprobante, archivos: readonly string[], ahora: Date, d: Required<DepsAutoComprobante>): Promise<SalidaAutoComprobante> {
  if (archivos.length === 0) return "SEGUIR";
  const { workspaceId } = chat;
  const pedidos = await d.pedidos(workspaceId, chat.id, new Date(ahora.getTime() - DIAS_PEDIDO_ESPERANDO * 86_400_000));
  if (pedidos.length === 0) return "SEGUIR";

  // El primer archivo de la tanda que sea un comprobante (del más nuevo al más viejo).
  let lectura: Extract<LecturaComprobante, { ok: true }> | null = null;
  let sinMp = false;
  for (const id of archivos) {
    const r = await d.leer(workspaceId, chat.id, id);
    if (!r.ok) {
      // Sólo se consulta Mercado Pago si la imagen es un comprobante: entonces hay uno, sin verificar.
      if (r.error === MENSAJES_COMPROBANTE.sinMp) {
        sinMp = true;
        break;
      }
      continue;
    }
    if (r.veredicto.estado !== "NO_ES_COMPROBANTE") {
      lectura = r;
      break;
    }
  }
  if (!lectura && !sinMp) return "SEGUIR";

  if (!lectura) return aPersona(chat, d, "no se pudo consultar Mercado Pago", pedidos[0] ?? null, "Llegó un comprobante, pero no se pudo consultar Mercado Pago.");

  const { veredicto, leido, candidatos } = lectura;
  const texto = textoDelVeredicto(veredicto, leido);
  const pagoYaUsado = "pago" in veredicto ? await d.yaUsado(workspaceId, veredicto.pago.id) : false;
  const decision = decidirAutoComprobante({ veredicto, leido, candidatos, pedidos, pagoYaUsado, autoConfirmar: await d.autoConfirmar(workspaceId) });
  if (decision.accion === "SEGUIR") return "SEGUIR";
  if (decision.accion === "A_PERSONA") return aPersona(chat, d, decision.motivo, decision.pedido, texto);

  const { pedido, cubre } = decision;
  const completo = await d.pagoCompleto(workspaceId, decision.pago.id).catch(() => null);
  if (!completo) return aPersona(chat, d, "no se pudo leer el pago en Mercado Pago para acreditarlo", pedido, texto);
  const fallo = pedido.tipo === "IMPRESION" ? await d.acreditarImpresion(workspaceId, pedido.id, completo) : await d.acreditarCatalogo(workspaceId, pedido.id, completo);
  if (fallo) return aPersona(chat, d, fallo, pedido, texto);

  const queCubre = cubre === "TOTAL" ? "el total" : "la seña";
  await d.sistema(workspaceId, chat.id, `El bot verificó un comprobante y acreditó ${queCubre} del pedido ${pedido.numero}: ${texto}`);
  // Las copias ya le avisan al cliente al acreditarse; el pedido de catálogo, con un mensaje del bot.
  if (pedido.tipo === "CATALOGO") {
    const saldo = cubre === "TOTAL" ? 0 : pedido.totalCents - Math.round(decision.pago.monto * 100);
    await d.responder(
      `¡Recibimos tu pago! 🙌 Tu pedido ${pedido.numero} ya quedó confirmado.${saldo > 0 ? ` Te queda un saldo de ${precioDeLista(saldo / 100)} para pagar al retirar.` : ""}`,
    );
  }
  return "ACREDITADO";
}

async function aPersona(
  chat: ChatDelComprobante,
  d: Required<DepsAutoComprobante>,
  motivo: string,
  pedido: PedidoEsperandoPago | null,
  veredicto: string,
): Promise<SalidaAutoComprobante> {
  const salida = await d.responder(TEXTO_COMPROBANTE_A_REVISAR);
  // Entró otro mensaje mientras se verificaba: lo atiende la ejecución de ese mensaje.
  if (salida === "omitido") return "OMITIDO";
  const delPedido = pedido ? ` (pedido ${pedido.numero})` : "";
  await d.sistema(chat.workspaceId, chat.id, `Comprobante para revisar${delPedido}: ${motivo}. ${veredicto}`);
  await d.pasar(`comprobante para revisar${delPedido}: ${motivo}`);
  await d.telegram(chat.workspaceId, textoAvisoComprobante({ nombre: chat.nombre, waId: chat.waId, pedido: pedido?.numero ?? null, motivo, veredicto }));
  return "A_PERSONA";
}
