import { randomBytes } from "node:crypto";
import { getAuthUser } from "@/lib/auth";
import { normalizeEmail } from "@/lib/order-claims";
import type { PaginaComprador } from "./pagina";
import type { EnlaceComprador } from "./pagina-datos";

/** Cookie propia del bot de compradores: identifica al navegador del invitado. */
export const GUEST_COOKIE = "dnxbot_guest";
const GUEST_KEY_RE = /^[0-9a-f]{32}$/;
const UN_ANIO_S = 60 * 60 * 24 * 365;

/** Clave del invitado desde el header Cookie; sólo 32 hex en minúscula (cualquier otra cosa → null). */
export function leerGuestKey(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  for (const parte of cookieHeader.split(";")) {
    const igual = parte.indexOf("=");
    if (igual < 0) continue;
    if (parte.slice(0, igual).trim() !== GUEST_COOKIE) continue;
    const valor = parte.slice(igual + 1).trim();
    return GUEST_KEY_RE.test(valor) ? valor : null;
  }
  return null;
}

export function nuevaGuestKey(): string {
  return randomBytes(16).toString("hex");
}

/** Valor del header Set-Cookie para la clave del invitado. */
export function cookieInvitado(guestKey: string): string {
  const seguro = process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
  return `${GUEST_COOKIE}=${guestKey}; Path=/; Max-Age=${UN_ANIO_S}; SameSite=Lax; HttpOnly${seguro ? "; Secure" : ""}`;
}

/** IP del cliente (sin hashear): primera de x-forwarded-for, si no x-real-ip, si no "unknown". */
export function ipDe(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return (forwarded.split(",")[0] ?? forwarded).trim();
  return req.headers.get("x-real-ip") || "unknown";
}

export type NivelComprador = "visitante" | "con_enlace" | "verificado";

export type CompradorActor = {
  guestKey: string;
  ipHash: string;
  conversationId: string;
  pagina: PaginaComprador | null;
  pagePath: string | null;
  albumId: number | null;
  enlace: EnlaceComprador | null;
  /** Mail verificado (código vigente o sesión), normalizado. Se actualiza en el mismo turno al verificar. */
  emailVerificado: string | null;
  userId: number | null;
};

export function nivelDe(a: Pick<CompradorActor, "enlace" | "emailVerificado">): NivelComprador {
  if (a.emailVerificado) return "verificado";
  if (a.enlace) return "con_enlace";
  return "visitante";
}

/** Sesión de cliente con mail verificado (mismo criterio que `buyerCanAccessAlbumOrder`). Cualquier error → null. */
export async function sesionVerificada(): Promise<{ email: string; userId: number } | null> {
  try {
    const user = await getAuthUser();
    if (!user || !user.emailVerifiedAt || !user.email) return null;
    const email = normalizeEmail(user.email);
    return email ? { email, userId: user.id } : null;
  } catch {
    return null;
  }
}

/** Mail verificado del comprador: la sesión gana; si no, el código vigente de la conversación. */
export function emailVerificadoDe(
  conv: { buyerEmail: string | null; verifiedUntil: Date | null },
  sesion: { email: string } | null,
  now: Date = new Date(),
): string | null {
  if (sesion) return sesion.email;
  if (conv.buyerEmail && conv.verifiedUntil && conv.verifiedUntil.getTime() > now.getTime()) return conv.buyerEmail;
  return null;
}

/** Actor que recibe el motor en los turnos de compradores (no hay usuario de CLF detrás). */
export const ACTOR_MOTOR_COMPRADOR = { userId: 0, role: "BUYER", email: "", name: null } as const;
