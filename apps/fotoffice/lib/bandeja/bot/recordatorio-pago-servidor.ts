import "server-only";
import { prisma } from "@repo/db";
import { prefijoDelChat } from "@/lib/pedidos/whatsapp";
import { escribirSistema } from "../acciones";
import { atiendeElBot, type EstadoChat } from "../reglas";
import { enviarComoBot, type SalidaEnvioBot } from "./envio-bot";
import {
  marcaDe,
  MARCA_RECORDATORIO,
  PEDIDO_MAXIMO_DIAS,
  RECORDAR_DESDE_HORAS,
  RECORDAR_HASTA_HORAS,
  textoDelRecordatorio,
  tocaRecordar,
  type PendienteDePago,
} from "./recordatorio-pago";
import { decidirSeguimiento, DIAS_ENTRE_SEGUIMIENTOS, horarioDeSeguimiento, MARCA_SEGUIMIENTO_CONSULTA, textoSeguimientoConsulta } from "./seguimiento-consulta";

/**
 * Recordatorio de pago del bot (lo corre el cron cada 15 minutos): a cada chat que atiende el bot,
 * con un pedido del chat sin pagar y cerca del final de la ventana de 24 h, le escribe UNA vez.
 * Sólo si la charla terminó con un mensaje nuestro (si el cliente escribió último, ese mensaje lo
 * contesta el bot o una persona). Queda un SISTEMA en el chat, que también evita repetirlo.
 *
 * Si no hay nada para pagar pero el bot le pasó un precio y el cliente no compró, en el mismo
 * momento sale el seguimiento de la consulta (`seguimiento-consulta.ts`), una vez por semana como mucho,
 * sólo de 9 a 20 h de Argentina y sólo si nadie del estudio atendió el chat después (ver las reglas allá).
 */

const HORA_MS = 3_600_000;

type ChatCandidato = EstadoChat & { id: string; workspaceId: string; nombre: string | null };

export type DepsRecordatorio = {
  ahora?: Date;
  botActivo?: (workspaceId: string) => Promise<boolean>;
  candidatos?: (ahora: Date) => Promise<ChatCandidato[]>;
  pendiente?: (chat: ChatCandidato, ahora: Date) => Promise<PendienteDePago | null>;
  /** Consulta de catálogo con precio y sin compra, todavía sin seguimiento; null si no hay. `tema`: de qué hablaron, si se sabe. */
  consultaSinCompra?: (chat: ChatCandidato, ahora: Date) => Promise<{ desde: Date; tema?: string | null } | null>;
  yaRecordado?: (chat: ChatCandidato, p: PendienteDePago) => Promise<boolean>;
  ultimoMensaje?: (chatId: string) => Promise<{ id: string; direccion: string } | null>;
  enviar?: (workspaceId: string, chatId: string, texto: string, condicion: { ultimoMensajeId: string }) => Promise<SalidaEnvioBot>;
  marcar?: (workspaceId: string, chatId: string, texto: string) => Promise<void>;
  /** ¿El estudio cobra por transferencia (alias o CVU cargado)? Entonces el recordatorio no lleva link. */
  porTransferencia?: (workspaceId: string) => Promise<boolean>;
};

const POR_OMISION: Required<Omit<DepsRecordatorio, "ahora">> = {
  botActivo: async (workspaceId) => {
    const [{ leerConfigBot }, { botEncendido }] = await Promise.all([import("@/lib/dnx-bot/config"), import("./interruptor")]);
    const cfg = leerConfigBot();
    return cfg.enabled && Boolean(cfg.anthropicApiKey) && (await botEncendido(workspaceId));
  },
  candidatos: async (ahora) => {
    const chats = await prisma.fotofficeWaChat.findMany({
      where: {
        estado: { in: ["BOT", "HUMANO"] },
        ultimoEntranteEn: { gte: new Date(ahora.getTime() - RECORDAR_HASTA_HORAS * HORA_MS), lte: new Date(ahora.getTime() - RECORDAR_DESDE_HORAS * HORA_MS) },
      },
      select: { id: true, workspaceId: true, nombre: true, estado: true, asignadoUserId: true, botPausadoHasta: true, ultimoEntranteEn: true },
      take: 200,
    });
    return chats.map((c) => ({ ...c, estado: c.estado as EstadoChat["estado"] }));
  },
  pendiente: async (chat, ahora) => {
    const desde = new Date(ahora.getTime() - PEDIDO_MAXIMO_DIAS * 24 * HORA_MS);
    const [impresion, pedidos] = await Promise.all([
      prisma.fotofficePrintOrder.findFirst({
        where: { workspaceId: chat.workspaceId, waChatId: chat.id, status: "PENDIENTE_PAGO", createdAt: { gte: desde } },
        orderBy: { createdAt: "desc" },
        select: { number: true, depositArs: true, totalArs: true, createdAt: true },
      }),
      prisma.fotofficePedido.findMany({
        where: { workspaceId: chat.workspaceId, status: "CONFIRMADO", altaKey: { startsWith: prefijoDelChat(chat.id) }, createdAt: { gte: desde } },
        orderBy: { createdAt: "desc" },
        select: { id: true, number: true, createdAt: true, cobros: { where: { voidedAt: null }, select: { id: true }, take: 1 }, cuotas: { orderBy: { position: "asc" }, take: 1, select: { amountArs: true } } },
      }),
    ]);
    const pedido = pedidos.find((p) => p.cobros.length === 0);
    let deCatalogo: PendienteDePago | null = null;
    if (pedido) {
      const { enlaceDelPedidoDelSistema } = await import("@/lib/pedidos/enlace");
      const enlace = await enlaceDelPedidoDelSistema(chat.workspaceId, pedido.id).catch(() => null);
      deCatalogo = { tipo: "PEDIDO", numero: pedido.number, aPagar: Number(pedido.cuotas[0]?.amountArs ?? 0), url: enlace?.ok ? enlace.url : null, creado: pedido.createdAt };
    }
    const deCopias: PendienteDePago | null = impresion
      ? { tipo: "IMPRESION", numero: impresion.number, aPagar: Number(impresion.depositArs ?? impresion.totalArs), creado: impresion.createdAt }
      : null;
    if (deCatalogo && deCopias) return deCatalogo.creado >= deCopias.creado ? deCatalogo : deCopias;
    return deCatalogo ?? deCopias;
  },
  consultaSinCompra: async (chat, ahora) => {
    const desde = new Date(ahora.getTime() - 24 * HORA_MS);
    // Toda la charla de las últimas 24 h: quién escribió después del precio decide (`decidirSeguimiento`).
    const charla = await prisma.fotofficeWaMensaje.findMany({
      where: { workspaceId: chat.workspaceId, chatId: chat.id, createdAt: { gte: desde } },
      orderBy: { createdAt: "desc" },
      select: { direccion: true, autor: true, texto: true, createdAt: true },
      take: 200,
    });
    const decision = decidirSeguimiento(charla.reverse());
    if (!decision) return null;
    const haceDias = (n: number) => new Date(ahora.getTime() - n * 24 * HORA_MS);
    const chatWa = await prisma.fotofficeWaChat.findUnique({ where: { id: chat.id }, select: { waId: true } });
    const [pedidos, copias, cotizaciones, seguidos] = await Promise.all([
      prisma.fotofficePedido.count({ where: { workspaceId: chat.workspaceId, altaKey: { startsWith: prefijoDelChat(chat.id) }, createdAt: { gte: haceDias(PEDIDO_MAXIMO_DIAS) } } }),
      prisma.fotofficePrintOrder.count({ where: { workspaceId: chat.workspaceId, waChatId: chat.id, createdAt: { gte: haceDias(PEDIDO_MAXIMO_DIAS) } } }),
      chatWa ? prisma.fotofficePresupuestoAprobacion.count({ where: { workspaceId: chat.workspaceId, waId: chatWa.waId, createdAt: { gte: haceDias(30) } } }) : 0,
      prisma.fotofficeWaMensaje.count({
        where: { workspaceId: chat.workspaceId, chatId: chat.id, direccion: "SISTEMA", texto: { startsWith: MARCA_SEGUIMIENTO_CONSULTA }, createdAt: { gte: haceDias(DIAS_ENTRE_SEGUIMIENTOS) } },
      }),
    ]);
    if (pedidos + copias + cotizaciones + seguidos > 0) return null;
    return decision;
  },
  yaRecordado: async (chat, p) =>
    (await prisma.fotofficeWaMensaje.count({
      where: { workspaceId: chat.workspaceId, chatId: chat.id, direccion: "SISTEMA", texto: { startsWith: MARCA_RECORDATORIO }, createdAt: { gte: p.creado } },
    })) > 0,
  ultimoMensaje: (chatId) =>
    prisma.fotofficeWaMensaje.findFirst({ where: { chatId, direccion: { not: "SISTEMA" } }, orderBy: { createdAt: "desc" }, select: { id: true, direccion: true } }),
  enviar: (workspaceId, chatId, texto, condicion) => enviarComoBot(workspaceId, chatId, texto, condicion),
  marcar: (workspaceId, chatId, texto) => prisma.$transaction((tx) => escribirSistema(tx, workspaceId, chatId, texto, new Date())),
  porTransferencia: async (workspaceId) => {
    const { leerAjustesCobro } = await import("@/lib/cobro-ajustes/ajustes");
    const a = await leerAjustesCobro(workspaceId);
    return Boolean(a.alias?.trim() || a.cbuCvu?.trim());
  },
};

export async function recordarPagosPendientes(deps: DepsRecordatorio = {}): Promise<{ revisados: number; enviados: number }> {
  const d = { ...POR_OMISION, ...deps };
  const ahora = deps.ahora ?? new Date();
  const activo = new Map<string, boolean>();
  let revisados = 0;
  let enviados = 0;
  for (const chat of await d.candidatos(ahora)) {
    revisados++;
    try {
      if (!atiendeElBot(chat, ahora) || !tocaRecordar(chat.ultimoEntranteEn, ahora)) continue;
      if (!activo.has(chat.workspaceId)) activo.set(chat.workspaceId, await d.botActivo(chat.workspaceId));
      if (!activo.get(chat.workspaceId)) continue;
      const p = await d.pendiente(chat, ahora);
      let texto: string;
      let marca: string;
      if (p && p.aPagar > 0) {
        if (await d.yaRecordado(chat, p)) continue;
        texto = textoDelRecordatorio(chat.nombre, p, await d.porTransferencia(chat.workspaceId).catch(() => false));
        marca = marcaDe(p);
      } else if (!p && horarioDeSeguimiento(ahora)) {
        // Fuera de 9 a 20 h no sale: espera a la próxima vuelta del cron (si la ventana de 24 h se cierra antes, no sale).
        const consulta = await d.consultaSinCompra(chat, ahora);
        if (!consulta) continue;
        texto = textoSeguimientoConsulta(chat.nombre, consulta.tema ?? null);
        marca = MARCA_SEGUIMIENTO_CONSULTA;
      } else continue;
      const ultimo = await d.ultimoMensaje(chat.id);
      if (!ultimo || ultimo.direccion !== "SALIENTE") continue;
      const salida = await d.enviar(chat.workspaceId, chat.id, texto, { ultimoMensajeId: ultimo.id });
      if (salida === "omitido") continue;
      // También si falló: queda a la vista en el chat y no se insiste.
      await d.marcar(chat.workspaceId, chat.id, marca);
      if (salida !== "fallo") enviados++;
    } catch (e) {
      console.warn("[fotoffice][whatsapp] falló un recordatorio de pago", { codigo: (e as { code?: string } | null)?.code ?? (e instanceof Error ? e.name : "desconocido") });
    }
  }
  return { revisados, enviados };
}
