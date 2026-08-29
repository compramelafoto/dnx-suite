/**
 * CLF-MP-OAUTH-REFRESH-100 — renovación del access token OAuth de Mercado Pago.
 *
 * Los access token que Mercado Pago entrega por OAuth vencen (~180 días). La app
 * guardaba `mpRefreshToken` desde el callback de OAuth pero nunca lo usaba, así que
 * cuando el token del vendedor vencía Mercado Pago respondía `401 invalid access token`
 * y el checkout terminaba en "Pedido creado pero error al generar link de pago".
 */
import { refreshAccessToken } from "@/lib/mercadopago-oauth";

export type MercadoPagoTokenOwnerType = "USER" | "LAB";

export type MercadoPagoTokenOwner = {
  ownerType: MercadoPagoTokenOwnerType;
  ownerId: number;
};

export type MercadoPagoTokenRefreshResult =
  | { ok: true; accessToken: string; rotatedRefreshToken: boolean }
  | {
      ok: false;
      code: "OWNER_NOT_FOUND" | "NO_REFRESH_TOKEN" | "REFRESH_REJECTED";
      error: string;
    };

/** Mensaje para el comprador cuando el vendedor tiene que reconectar Mercado Pago. */
export const MP_TOKEN_EXPIRED_BUYER_ERROR =
  "La cuenta de Mercado Pago del vendedor venció y hay que reconectarla. Avisale al fotógrafo para que vuelva a conectar Mercado Pago en Configuración / Datos para cobro.";

export const MP_TOKEN_EXPIRED_CODE = "MP_TOKEN_EXPIRED";

/** Access token vencido o revocado (respuesta 401 de Mercado Pago). */
export function isMercadoPagoUnauthorizedError(err: unknown): boolean {
  if (err && typeof err === "object" && "status" in err) {
    const status = Number((err as { status?: unknown }).status);
    if (status === 401) return true;
  }
  const message =
    err instanceof Error ? err.message : typeof err === "string" ? err : "";
  if (!message) return false;
  return (
    /invalid[_ ]access[_ ]token/i.test(message) ||
    /"status"\s*:\s*401/.test(message) ||
    /\bunauthorized\b/i.test(message)
  );
}

export type MercadoPagoTokenRecord = {
  accessToken: string | null;
  refreshToken: string | null;
};

export type MercadoPagoTokenStore = {
  read(owner: MercadoPagoTokenOwner): Promise<MercadoPagoTokenRecord | null>;
  save(
    owner: MercadoPagoTokenOwner,
    tokens: { accessToken: string; refreshToken: string | null; mpUserId: string | null }
  ): Promise<void>;
};

export type RefreshMercadoPagoTokenDeps = {
  store: MercadoPagoTokenStore;
  refresh?: typeof refreshAccessToken;
};

/**
 * Pide un access token nuevo con el refresh token guardado y lo persiste.
 * Mercado Pago rota el refresh token en cada renovación: si viene uno nuevo hay que
 * guardarlo, porque el anterior deja de servir.
 */
export async function refreshMercadoPagoOwnerAccessTokenWithDeps(
  owner: MercadoPagoTokenOwner,
  deps: RefreshMercadoPagoTokenDeps
): Promise<MercadoPagoTokenRefreshResult> {
  const record = await deps.store.read(owner);
  if (!record) {
    return {
      ok: false,
      code: "OWNER_NOT_FOUND",
      error: `No existe ${owner.ownerType} ${owner.ownerId}`,
    };
  }

  const refreshToken = record.refreshToken?.trim();
  if (!refreshToken) {
    return {
      ok: false,
      code: "NO_REFRESH_TOKEN",
      error: "No hay refresh token guardado: el vendedor tiene que reconectar Mercado Pago",
    };
  }

  const doRefresh = deps.refresh ?? refreshAccessToken;
  let tokenData;
  try {
    tokenData = await doRefresh(refreshToken);
  } catch (err: any) {
    return {
      ok: false,
      code: "REFRESH_REJECTED",
      error: String(err?.message ?? err),
    };
  }

  const newAccessToken = tokenData?.access_token?.trim();
  if (!newAccessToken) {
    return {
      ok: false,
      code: "REFRESH_REJECTED",
      error: "Mercado Pago no devolvió access_token al renovar",
    };
  }

  const rotated = Boolean(tokenData.refresh_token && tokenData.refresh_token !== refreshToken);
  await deps.store.save(owner, {
    accessToken: newAccessToken,
    refreshToken: tokenData.refresh_token?.trim() || refreshToken,
    mpUserId:
      tokenData.user_id !== undefined && tokenData.user_id !== null
        ? String(tokenData.user_id)
        : null,
  });

  return { ok: true, accessToken: newAccessToken, rotatedRefreshToken: rotated };
}

/** Store real contra la base: `User.mp*` o `Lab.mp*`. */
export function createPrismaMercadoPagoTokenStore(): MercadoPagoTokenStore {
  return {
    async read(owner) {
      const { prisma } = await import("@/lib/prisma");
      if (owner.ownerType === "USER") {
        const row = await prisma.user.findUnique({
          where: { id: owner.ownerId },
          select: { mpAccessToken: true, mpRefreshToken: true },
        });
        if (!row) return null;
        return { accessToken: row.mpAccessToken, refreshToken: row.mpRefreshToken };
      }
      const row = await prisma.lab.findUnique({
        where: { id: owner.ownerId },
        select: { mpAccessToken: true, mpRefreshToken: true },
      });
      if (!row) return null;
      return { accessToken: row.mpAccessToken, refreshToken: row.mpRefreshToken };
    },
    async save(owner, tokens) {
      const { prisma } = await import("@/lib/prisma");
      const data: Record<string, unknown> = {
        mpAccessToken: tokens.accessToken,
        mpRefreshToken: tokens.refreshToken,
      };
      // `mpUserId` solo se pisa si Mercado Pago lo devuelve: no perder el que ya estaba.
      if (tokens.mpUserId) data.mpUserId = tokens.mpUserId;
      if (owner.ownerType === "USER") {
        await prisma.user.update({ where: { id: owner.ownerId }, data: data as never });
        return;
      }
      await prisma.lab.update({ where: { id: owner.ownerId }, data: data as never });
    },
  };
}

/**
 * Renovaciones en vuelo por dueño: dos checkouts simultáneos con el token vencido
 * dispararían dos refresh y el segundo usaría un refresh token ya rotado (y fallaría).
 */
const inFlightRefreshes = new Map<string, Promise<MercadoPagoTokenRefreshResult>>();

/** Renueva (y persiste) el access token OAuth del vendedor. Deduplica llamadas concurrentes. */
export async function refreshMercadoPagoOwnerAccessToken(
  owner: MercadoPagoTokenOwner
): Promise<MercadoPagoTokenRefreshResult> {
  const key = `${owner.ownerType}:${owner.ownerId}`;
  const pending = inFlightRefreshes.get(key);
  if (pending) return pending;

  const promise = refreshMercadoPagoOwnerAccessTokenWithDeps(owner, {
    store: createPrismaMercadoPagoTokenStore(),
  }).finally(() => {
    inFlightRefreshes.delete(key);
  });
  inFlightRefreshes.set(key, promise);
  return promise;
}

/**
 * Callback para `createPreference({ refreshAccessTokenOnUnauthorized })`:
 * devuelve el token nuevo, o `null` si el vendedor tiene que reconectar Mercado Pago.
 */
export function buildMercadoPagoUnauthorizedRefresher(
  owner: MercadoPagoTokenOwner
): () => Promise<string | null> {
  return async () => {
    const result = await refreshMercadoPagoOwnerAccessToken(owner);
    if (result.ok) {
      console.log("[MP OAuth] access token renovado", {
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        rotatedRefreshToken: result.rotatedRefreshToken,
      });
      return result.accessToken;
    }
    console.error("[MP OAuth] no se pudo renovar el access token", {
      ownerType: owner.ownerType,
      ownerId: owner.ownerId,
      code: result.code,
      error: result.error,
    });
    return null;
  };
}
