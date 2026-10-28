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

/**
 * Recordatorio de pago del bot (lo corre el cron cada 15 minutos): a cada chat que atiende el bot,
 * con un pedido del chat sin pagar y cerca del final de la ventana de 24 h, le escribe UNA vez.
 * Sólo si la charla terminó con un mensaje nuestro (si el cliente escribió último, ese mensaje lo
 * contesta el bot o una persona). Queda un SISTEMA en el chat, que también evita repetirlo.
 */

const HORA_MS = 3_600_000;

type ChatCandidato = EstadoChat & { id: string; workspaceId: string; nombre: string | null };

export type DepsRecordatorio = {
  ahora?: Date;
  botActivo?: (workspaceId: string) => Promise<boolean>;
  candidatos?: (ahora: Date) => Promise<ChatCandidato[]>;
  pendiente?: (chat: ChatCandidato, ahora: Date) => Promise<PendienteDePago | null>;
  yaRecordado?: (chat: ChatCandidato, p: PendienteDePago) => Promise<boolean>;
  ultimoMensaje?: (chatId: string) => Promise<{ id: string; direccion: string } | null>;
  enviar?: (workspaceId: string, chatId: string, texto: string, condicion: { ultimoMensajeId: string }) => Promise<SalidaEnvioBot>;
  marcar?: (workspaceId: string, chatId: string, texto: string) => Promise<void>;
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
  yaRecordado: async (chat, p) =>
    (await prisma.fotofficeWaMensaje.count({
      where: { workspaceId: chat.workspaceId, chatId: chat.id, direccion: "SISTEMA", texto: { startsWith: MARCA_RECORDATORIO }, createdAt: { gte: p.creado } },
    })) > 0,
  ultimoMensaje: (chatId) =>
    prisma.fotofficeWaMensaje.findFirst({ where: { chatId, direccion: { not: "SISTEMA" } }, orderBy: { createdAt: "desc" }, select: { id: true, direccion: true } }),
  enviar: (workspaceId, chatId, texto, condicion) => enviarComoBot(workspaceId, chatId, texto, condicion),
  marcar: (workspaceId, chatId, texto) => prisma.$transaction((tx) => escribirSistema(tx, workspaceId, chatId, texto, new Date())),
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
      if (!p || p.aPagar <= 0 || (await d.yaRecordado(chat, p))) continue;
      const ultimo = await d.ultimoMensaje(chat.id);
      if (!ultimo || ultimo.direccion !== "SALIENTE") continue;
      const salida = await d.enviar(chat.workspaceId, chat.id, textoDelRecordatorio(chat.nombre, p), { ultimoMensajeId: ultimo.id });
      if (salida === "omitido") continue;
      // También si falló: queda a la vista en el chat y no se insiste.
      await d.marcar(chat.workspaceId, chat.id, marcaDe(p));
      if (salida !== "fallo") enviados++;
    } catch (e) {
      console.warn("[fotoffice][whatsapp] falló un recordatorio de pago", { codigo: (e as { code?: string } | null)?.code ?? (e instanceof Error ? e.name : "desconocido") });
    }
  }
  return { revisados, enviados };
}
