/**
 * CLF-MP-OAUTH-REFRESH-100 — estado real de la conexión con Mercado Pago.
 *
 * Tener un `mpAccessToken` guardado no significa que sirva: los token vencen a los ~180 días.
 * Hasta ahora el panel mostraba "✅ Conectado" con un token muerto, así que el vendedor no
 * tenía forma de enterarse de que había dejado de poder cobrar.
 *
 * Este módulo pregunta a Mercado Pago si el token sigue vivo y, si venció, intenta renovarlo
 * en el momento. Solo cuando la renovación también falla el estado pasa a `EXPIRED`, que es
 * el único caso en que la persona tiene que volver a autorizar a mano.
 */
import {
  refreshMercadoPagoOwnerAccessToken,
  type MercadoPagoTokenOwner,
} from "@/lib/mercadopago/mp-oauth-token-refresh";

export type MercadoPagoConnectionStatus =
  /** Nunca conectó (o desconectó). */
  | "NOT_CONNECTED"
  /** Token vivo (o revivido recién con el refresh token). */
  | "CONNECTED"
  /** Token muerto y sin poder renovarlo: tiene que volver a autorizar. */
  | "EXPIRED"
  /** No se pudo confirmar (Mercado Pago no respondió). No se alarma al vendedor. */
  | "UNKNOWN";

export type MercadoPagoConnectionHealth = {
  status: MercadoPagoConnectionStatus;
  /** `true` si el token estaba vencido y se renovó solo en esta consulta. */
  selfHealed: boolean;
};

/** El vendedor tiene que volver a conectar Mercado Pago desde su panel. */
export function needsMercadoPagoReconnect(status: MercadoPagoConnectionStatus): boolean {
  return status === "EXPIRED";
}

/** Puede cobrar: conectado, o sin confirmación (no se lo bloquea por una falla nuestra). */
export function canChargeWithMercadoPago(status: MercadoPagoConnectionStatus): boolean {
  return status === "CONNECTED" || status === "UNKNOWN";
}

export type ProbeResult = "ALIVE" | "UNAUTHORIZED" | "UNREACHABLE";

export type ConnectionHealthDeps = {
  /** Token guardado hoy (`null` = nunca conectó). */
  readAccessToken: () => Promise<string | null>;
  probe: (accessToken: string) => Promise<ProbeResult>;
  refresh: () => Promise<{ ok: boolean }>;
};

export async function resolveMercadoPagoConnectionHealthWithDeps(
  deps: ConnectionHealthDeps
): Promise<MercadoPagoConnectionHealth> {
  const token = (await deps.readAccessToken())?.trim();
  if (!token) return { status: "NOT_CONNECTED", selfHealed: false };

  const probe = await deps.probe(token);
  if (probe === "ALIVE") return { status: "CONNECTED", selfHealed: false };
  if (probe === "UNREACHABLE") return { status: "UNKNOWN", selfHealed: false };

  const refreshed = await deps.refresh();
  return refreshed.ok
    ? { status: "CONNECTED", selfHealed: true }
    : { status: "EXPIRED", selfHealed: false };
}

async function probeMercadoPagoToken(accessToken: string): Promise<ProbeResult> {
  try {
    const res = await fetch("https://api.mercadopago.com/users/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (res.ok) return "ALIVE";
    if (res.status === 401) return "UNAUTHORIZED";
    return "UNREACHABLE";
  } catch {
    return "UNREACHABLE";
  }
}

/**
 * Consultar Mercado Pago en cada carga del panel sería un ida y vuelta de más por pantalla.
 * Se cachea por proceso: el estado no cambia de un minuto para el otro.
 */
const HEALTH_CACHE_TTL_MS = 10 * 60 * 1000;
const healthCache = new Map<string, { at: number; health: MercadoPagoConnectionHealth }>();

/** Invalida el cache (por ejemplo cuando alguien acaba de conectar o desconectar). */
export function clearMercadoPagoConnectionHealthCache(owner?: MercadoPagoTokenOwner): void {
  if (!owner) {
    healthCache.clear();
    return;
  }
  healthCache.delete(`${owner.ownerType}:${owner.ownerId}`);
}

export async function getMercadoPagoConnectionHealth(
  owner: MercadoPagoTokenOwner
): Promise<MercadoPagoConnectionHealth> {
  const key = `${owner.ownerType}:${owner.ownerId}`;
  const cached = healthCache.get(key);
  if (cached && Date.now() - cached.at < HEALTH_CACHE_TTL_MS) {
    return cached.health;
  }

  const health = await resolveMercadoPagoConnectionHealthWithDeps({
    readAccessToken: async () => {
      const { prisma } = await import("@/lib/prisma");
      if (owner.ownerType === "USER") {
        const row = await prisma.user.findUnique({
          where: { id: owner.ownerId },
          select: { mpAccessToken: true },
        });
        return row?.mpAccessToken ?? null;
      }
      const row = await prisma.lab.findUnique({
        where: { id: owner.ownerId },
        select: { mpAccessToken: true },
      });
      return row?.mpAccessToken ?? null;
    },
    probe: probeMercadoPagoToken,
    refresh: async () => {
      const result = await refreshMercadoPagoOwnerAccessToken(owner);
      return { ok: result.ok };
    },
  });

  // `UNKNOWN` no se cachea: es una falla transitoria, conviene reintentar en la próxima carga.
  if (health.status !== "UNKNOWN") {
    healthCache.set(key, { at: Date.now(), health });
  }
  return health;
}
