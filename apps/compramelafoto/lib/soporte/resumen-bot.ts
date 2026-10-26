import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Números y lectura de las conversaciones del DNX Bot para el centro de reclamos.
 * "Texto de la persona" = mensaje role=user cuyo contenido es un string que no es un aviso
 * "[Sistema] …". Los tool_result también se guardan con role=user (como arrays) y no cuentan.
 * El bot borra conversaciones de más de 90 días (cron bot-resumen).
 */

const SISTEMA = "[Sistema]";
const POR_PAGINA = 30;
const DIA_MS = 86_400_000;
const DIAS_POR_DEFECTO = 15;

export type TipoConversacion = "UN_TOQUE" | "CHARLA" | "TICKET";

export function clasificarConversacion(c: { textosDelUsuario: number; status: string }): TipoConversacion {
  if (c.status === "ESCALATED") return "TICKET";
  return c.textosDelUsuario <= 1 ? "UN_TOQUE" : "CHARLA";
}

/** Medianoche argentina (UTC-3, sin horario de verano) del día YYYY-MM-DD. */
function medianocheAR(dia: string): Date {
  return new Date(`${dia}T00:00:00-03:00`);
}

function diaAR(d: Date): string {
  return new Date(d.getTime() - 3 * 3_600_000).toISOString().slice(0, 10);
}

/** Período [desde, hasta) en días argentinos; `hasta` es inclusive en la entrada. */
export function periodoDeResumen(desde: string | null, hasta: string | null, now: Date): { desde: Date; hasta: Date } {
  const valido = (s: string | null) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null);
  const h = medianocheAR(valido(hasta) ?? diaAR(now));
  const fin = new Date(h.getTime() + DIA_MS);
  const d = valido(desde) ? medianocheAR(desde!) : new Date(fin.getTime() - DIAS_POR_DEFECTO * DIA_MS);
  return { desde: d, hasta: fin };
}

const textosDeLaPersona = Prisma.sql`m.role = 'user' AND jsonb_typeof(m.content) = 'string' AND left(m.content #>> '{}', ${SISTEMA.length}) <> ${SISTEMA}`;

export type ResumenBot = {
  total: number;
  unToque: number;
  charlas: number;
  tickets: number;
  resueltasPorBot: number;
  porAudiencia: Record<"BUYER" | "PHOTOGRAPHER", number>;
};

export async function resumenBot(desde: Date, hasta: Date): Promise<ResumenBot> {
  const filas = await prisma.$queryRaw<{ audience: string; status: string; textos: number }[]>`
    SELECT bc.audience::text AS audience, bc.status::text AS status,
      (SELECT count(*) FROM "BotMessage" m WHERE m."conversationId" = bc.id AND ${textosDeLaPersona})::int AS textos
    FROM "BotConversation" bc
    WHERE bc."createdAt" >= ${desde} AND bc."createdAt" < ${hasta}`;
  const r: ResumenBot = { total: 0, unToque: 0, charlas: 0, tickets: 0, resueltasPorBot: 0, porAudiencia: { BUYER: 0, PHOTOGRAPHER: 0 } };
  for (const f of filas) {
    r.total++;
    const tipo = clasificarConversacion({ textosDelUsuario: Number(f.textos), status: f.status });
    if (tipo === "UN_TOQUE") r.unToque++;
    else if (tipo === "CHARLA") r.charlas++;
    else r.tickets++;
    if (f.audience === "BUYER" || f.audience === "PHOTOGRAPHER") r.porAudiencia[f.audience]++;
  }
  r.resueltasPorBot = r.total - r.tickets;
  return r;
}

export type ConversacionResuelta = {
  id: string;
  audience: string;
  createdAt: Date;
  primerTexto: string;
  textosDelUsuario: number;
  acciones: number;
};

/** Charlas (2+ textos de la persona) que no terminaron en ticket, de la más nueva a la más vieja. */
export async function listarConversacionesResueltas(page: number): Promise<{ items: ConversacionResuelta[]; hayMas: boolean }> {
  const pagina = Math.max(0, Math.floor(page) || 0);
  const filas = await prisma.$queryRaw<{ id: string; audience: string; createdAt: Date; primer: string | null; textos: number; acciones: number }[]>`
    SELECT bc.id, bc.audience::text AS audience, bc."createdAt", t.primer, t.textos,
      (SELECT count(*) FROM "BotAction" a WHERE a."conversationId" = bc.id)::int AS acciones
    FROM "BotConversation" bc
    JOIN LATERAL (
      SELECT count(*)::int AS textos, (array_agg(m.content #>> '{}' ORDER BY m.seq))[1] AS primer
      FROM "BotMessage" m WHERE m."conversationId" = bc.id AND ${textosDeLaPersona}
    ) t ON true
    WHERE bc.status::text <> 'ESCALATED' AND t.textos >= 2
    ORDER BY bc."createdAt" DESC
    LIMIT ${POR_PAGINA + 1} OFFSET ${pagina * POR_PAGINA}`;
  return {
    items: filas.slice(0, POR_PAGINA).map((f) => ({
      id: f.id,
      audience: f.audience,
      createdAt: f.createdAt,
      primerTexto: f.primer ?? "",
      textosDelUsuario: Number(f.textos),
      acciones: Number(f.acciones),
    })),
    hayMas: filas.length > POR_PAGINA,
  };
}

export type ItemConversacion = { rol: "usuario" | "bot" | "sistema"; texto: string; fecha: Date };

/** Texto legible de un mensaje guardado tal cual se mandó a la API (string o bloques). */
export function textoDeMensaje(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return (content as { type?: string; text?: string }[])
    .filter((b) => b?.type === "text" && typeof b.text === "string")
    .map((b) => b.text)
    .join(" ")
    .trim();
}

export function itemsDeMensajes(msgs: { role: string; content: unknown; createdAt: Date }[]): ItemConversacion[] {
  const items: ItemConversacion[] = [];
  for (const msg of msgs) {
    // Los tool_result van como arrays con role=user: no son algo que escribió la persona.
    if (msg.role === "user" && typeof msg.content !== "string") continue;
    const texto = textoDeMensaje(msg.content);
    if (!texto) continue;
    const rol = msg.role !== "user" ? "bot" : texto.startsWith(SISTEMA) ? "sistema" : "usuario";
    items.push({ rol, texto, fecha: msg.createdAt });
  }
  return items;
}

export async function leerConversacion(id: string): Promise<{
  id: string;
  audience: string;
  items: ItemConversacion[];
  acciones: { toolName: string; summary: string; status: string }[];
} | null> {
  const conv = await prisma.botConversation.findUnique({
    where: { id },
    select: {
      id: true,
      audience: true,
      messages: { orderBy: { seq: "asc" }, select: { role: true, content: true, createdAt: true } },
      actions: { orderBy: { createdAt: "asc" }, select: { toolName: true, summary: true, status: true } },
    },
  });
  if (!conv) return null;
  return {
    id: conv.id,
    audience: String(conv.audience),
    items: itemsDeMensajes(conv.messages),
    acciones: conv.actions.map((a) => ({ toolName: a.toolName, summary: a.summary, status: String(a.status) })),
  };
}
