import "server-only";
import { prisma } from "@repo/db";
import { checkRateLimit } from "@/lib/geocode/rate-limit";
import { STORE_NOTE_REGRET, STORE_REGRET_REASON_MAX } from "./constants";
import { sendRegretNotice } from "./emails";

/**
 * El botón de arrepentimiento (Res. SCI 424/2020): quien compró avisa que se arrepiente con el
 * número de pedido y su email, sin cuenta. Queda una constancia en el historial del pedido (sin
 * cambiar su estado: la devolución la resuelve el personal) y un aviso a la institución.
 *
 * **No revela qué dato falla.** Pedido inexistente, de otra institución o con otro email: la
 * misma respuesta. Si no, el formulario serviría para averiguar qué email compró qué pedido.
 *
 * El freno es de memoria, por IP (el de `lib/geocode/rate-limit.ts`): en Vercel cuenta por
 * instancia. Alcanza para que nadie pruebe números de pedido en bucle.
 */

export const REGRET_GENERIC_ERROR =
  "No encontramos un pedido con ese número y ese email. Revisá los datos y probá de nuevo.";
export const REGRET_RATE_LIMITED = "Probá de nuevo en unos minutos.";
export const MAX_REGRET_REASON = STORE_REGRET_REASON_MAX;

const LIMITE_INTENTOS = 5;
const VENTANA_MS = 15 * 60 * 1000;
const REPETICION_MS = 24 * 60 * 60 * 1000;
/** El mayor `Int` de Postgres: más grande no es un número de pedido (y Prisma lo rechazaría). */
const MAX_NUMERO = 2_147_483_647;

export type RegretResult = { ok: true; code: string } | { ok: false; error: string };

export type RegretInput = {
  workspaceId: string;
  orderNumber: string;
  email: string;
  reason?: string | null;
  /** La IP de quien envía (`clientIp`), sólo para el freno. No se guarda. */
  ip: string;
  now?: Date;
};

function numeroDePedido(raw: string): number | null {
  const limpio = raw.trim().replace(/^#\s*/, "");
  if (!/^\d{1,10}$/.test(limpio)) return null;
  const n = Number(limpio);
  return n >= 1 && n <= MAX_NUMERO ? n : null;
}

export async function submitRegret(input: RegretInput): Promise<RegretResult> {
  const freno = checkRateLimit({ key: `tienda-arrepentimiento:${input.ip}`, limit: LIMITE_INTENTOS, windowMs: VENTANA_MS });
  if (!freno.allowed) return { ok: false, error: REGRET_RATE_LIMITED };

  const orderNumber = numeroDePedido(input.orderNumber);
  const email = input.email.trim().toLowerCase();
  if (orderNumber === null || !email) return { ok: false, error: REGRET_GENERIC_ERROR };

  const order = await prisma.storeOrder.findFirst({
    where: { workspaceId: input.workspaceId, orderNumber },
    select: { id: true, publicId: true, status: true, buyerEmail: true },
  });
  if (!order || order.buyerEmail.trim().toLowerCase() !== email) return { ok: false, error: REGRET_GENERIC_ERROR };

  const code = order.publicId.toUpperCase();
  const now = input.now ?? new Date();

  // Otro envío del mismo pedido en las últimas 24 h: el mismo trámite, sin otro aviso.
  const reciente = await prisma.storeOrderEvent.findFirst({
    where: {
      orderId: order.id,
      note: { startsWith: STORE_NOTE_REGRET },
      createdAt: { gte: new Date(now.getTime() - REPETICION_MS) },
    },
    select: { id: true },
  });
  if (reciente) return { ok: true, code };

  const reason = input.reason?.trim().slice(0, MAX_REGRET_REASON) || null;
  await prisma.storeOrderEvent.create({
    data: {
      orderId: order.id,
      fromStatus: order.status,
      toStatus: order.status,
      actorUserId: null,
      note: reason ? `${STORE_NOTE_REGRET}: ${reason}` : STORE_NOTE_REGRET,
    },
  });

  // La constancia ya quedó: un aviso que no sale no la deshace.
  try {
    await sendRegretNotice({ workspaceId: input.workspaceId, orderId: order.id, reason });
  } catch {
    console.error("[fotoffice][tienda] no se pudo avisar un arrepentimiento", { storeOrderId: order.id });
  }

  return { ok: true, code };
}
