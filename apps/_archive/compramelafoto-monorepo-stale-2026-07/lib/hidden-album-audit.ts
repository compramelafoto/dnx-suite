import crypto from "crypto";
import { NextRequest } from "next/server";
import { HiddenAlbumDeviceType } from "@prisma/client";

const IP_HASH_SALT = process.env.HIDDEN_ALBUM_IP_SALT || process.env.CRON_SECRET || "hidden-album-ip-salt";

/**
 * Hash de IP para auditoría (no guardar IP en crudo).
 * sha256(ip + salt)
 */
export function hashIp(ip: string): string {
  return crypto.createHash("sha256").update(ip + IP_HASH_SALT).digest("hex");
}

const GUEST_ID_COOKIE = "hidden_album_guest_id";
const GUEST_ID_MAX_AGE = 60 * 60 * 24 * 365; // 1 año

/**
 * Obtiene o genera guestId para usuario no autenticado (cookie).
 */
export function getOrCreateGuestId(req: NextRequest): string {
  const cookie = req.cookies.get(GUEST_ID_COOKIE)?.value;
  if (cookie && /^[0-9a-f-]{36}$/i.test(cookie)) {
    return cookie;
  }
  const newId = crypto.randomUUID();
  return newId;
}

/**
 * Headers para setear la cookie guestId en la respuesta (opcional).
 */
export function guestIdCookieHeader(guestId: string): { "Set-Cookie": string } {
  return {
    "Set-Cookie": `${GUEST_ID_COOKIE}=${guestId}; Path=/; Max-Age=${GUEST_ID_MAX_AGE}; SameSite=Lax; HttpOnly`,
  };
}

/**
 * Detecta tipo de dispositivo desde User-Agent (para auditoría).
 */
export function getDeviceType(userAgent: string | null): HiddenAlbumDeviceType {
  if (!userAgent || typeof userAgent !== "string") return "UNKNOWN";
  const ua = userAgent.toLowerCase();
  if (/mobile|android|iphone|ipod|webos|blackberry|iemobile|opera mini/i.test(ua)) {
    return "MOBILE";
  }
  if (/tablet|ipad|playbook|silk/i.test(ua)) {
    return "MOBILE";
  }
  return "DESKTOP";
}

/**
 * Obtiene IP del cliente desde headers (para hashear).
 */
export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

/**
 * User-Agent truncado para guardar (máx 1024).
 */
export function truncateUserAgent(ua: string | null): string | null {
  if (!ua) return null;
  return ua.length > 1024 ? ua.slice(0, 1024) : ua;
}

export const HIDDEN_ALBUM_GRANT_COOKIE = "hidden_album_grant";

/**
 * Parsea y valida el token de la cookie de grant (el valor de la cookie).
 * Devuelve { grantId, albumId, expiresAt } o null si inválido.
 */
export function parseGrantCookie(cookieValue: string | null): { grantId: string; albumId: number; expiresAt: number } | null {
  if (!cookieValue?.trim()) return null;
  try {
    const decoded = Buffer.from(cookieValue.trim(), "base64url").toString("utf-8");
    const parts = decoded.split(":");
    if (parts.length !== 4) return null;
    const [grantId, albumIdStr, expiresAtStr, sig] = parts;
    const albumId = parseInt(albumIdStr, 10);
    const expiresAt = parseInt(expiresAtStr, 10);
    if (!Number.isFinite(albumId) || !Number.isFinite(expiresAt)) return null;
    if (Date.now() > expiresAt) return null;
    const secret = process.env.HIDDEN_ALBUM_GRANT_SECRET || process.env.CRON_SECRET || "grant-secret";
    const payload = `${grantId}:${albumId}:${expiresAt}`;
    const expectedSig = crypto.createHmac("sha256", secret).update(payload).digest("hex");
    if (sig !== expectedSig) return null;
    return { grantId, albumId, expiresAt };
  } catch {
    return null;
  }
}

/**
 * Verifica si la request tiene un grant vigente que autoriza ver la foto en el álbum oculto.
 * Debe usarse cuando album.hiddenPhotosEnabled y el usuario no es dueño/admin.
 */
export async function validateHiddenAlbumPhotoAccess(
  albumId: number,
  photoId: number,
  grantCookieValue: string | null,
  prisma: { hiddenAlbumGrant: { findUnique: (args: { where: { id: string }; select: { albumId: true; expiresAt: true; isRevoked: true; allowedPhotoIds: true } }) => Promise<{ albumId: number; expiresAt: Date; isRevoked: boolean; allowedPhotoIds: unknown } | null> } }
): Promise<boolean> {
  const parsed = parseGrantCookie(grantCookieValue);
  if (!parsed) return false;
  if (parsed.albumId !== albumId) return false;
  const grant = await prisma.hiddenAlbumGrant.findUnique({
    where: { id: parsed.grantId },
    select: { albumId: true, expiresAt: true, isRevoked: true, allowedPhotoIds: true },
  });
  if (!grant || grant.albumId !== albumId || grant.isRevoked || grant.expiresAt < new Date()) return false;
  const allowed = grant.allowedPhotoIds as number[] | null;
  if (!Array.isArray(allowed) || !allowed.includes(photoId)) return false;
  return true;
}
