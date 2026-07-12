import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "./prisma";

export const DNX_GOOGLE_OAUTH_COOKIE = "dnx_google_oauth";
export const DNX_GOOGLE_OAUTH_COOKIE_MAX_AGE = 60 * 10; // 10 min
export const DNX_GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const DNX_GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const DNX_GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

export type GoogleOAuthCredentials = {
  clientId: string;
  clientSecret: string;
};

export type GoogleUserInfo = {
  id: string;
  email: string;
  name: string | null;
  verifiedEmail: boolean;
  picture: string | null;
};

export type GoogleOAuthTransitPayload = {
  /** Identificador de app (p. ej. "infospot"). */
  app: string;
  /** Path relativo seguro post-login (opcional). */
  next?: string;
  rememberMe?: boolean;
};

type TransitInner = GoogleOAuthTransitPayload & { nonce: string };

export function getGoogleOAuthCredentials(): GoogleOAuthCredentials | null {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

/** Base URL pública de la app (sin slash final). */
export function resolveAppBaseUrl(params: {
  originFromRequest: string;
  envKeys?: string[];
  fallback?: string;
}): string {
  const keys = params.envKeys ?? [
    "NEXT_PUBLIC_INFOSPOT_URL",
    "APP_URL",
    "NEXT_PUBLIC_APP_URL",
    "AUTH_URL",
  ];
  for (const key of keys) {
    const v = process.env[key]?.trim();
    if (v) return v.replace(/\/$/, "");
  }
  if (params.originFromRequest) return params.originFromRequest.replace(/\/$/, "");
  return (params.fallback ?? "http://localhost:3000").replace(/\/$/, "");
}

/**
 * Redirect URI registrado en Google Cloud Console.
 * Preferir `GOOGLE_REDIRECT_URI` explícito; si no, `{baseUrl}/api/auth/google/callback`.
 */
export function resolveGoogleRedirectUri(baseUrl: string): string {
  const explicit = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (explicit) return explicit;
  return `${baseUrl.replace(/\/$/, "")}/api/auth/google/callback`;
}

function b64urlEncode(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function b64urlDecode(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

/** Crea `state` OAuth + valor de cookie HttpOnly (CSRF). */
export function createGoogleOAuthTransit(payload: GoogleOAuthTransitPayload): {
  state: string;
  cookieValue: string;
  maxAge: number;
} {
  const nonce = randomBytes(24).toString("hex");
  const inner: TransitInner = {
    app: payload.app,
    nonce,
    ...(payload.next ? { next: payload.next } : {}),
    ...(payload.rememberMe ? { rememberMe: true } : {}),
  };
  return {
    state: b64urlEncode(JSON.stringify(inner)),
    cookieValue: nonce,
    maxAge: DNX_GOOGLE_OAUTH_COOKIE_MAX_AGE,
  };
}

export function parseAndVerifyGoogleOAuthTransit(params: {
  state: string | null | undefined;
  cookieValue: string | null | undefined;
  expectedApp: string;
}): TransitInner | null {
  if (!params.state || !params.cookieValue) return null;
  let inner: TransitInner;
  try {
    inner = JSON.parse(b64urlDecode(params.state)) as TransitInner;
  } catch {
    return null;
  }
  if (!inner || typeof inner !== "object") return null;
  if (inner.app !== params.expectedApp) return null;
  if (typeof inner.nonce !== "string" || inner.nonce.length < 16) return null;

  const a = Buffer.from(inner.nonce);
  const b = Buffer.from(params.cookieValue);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  if (inner.next !== undefined) {
    if (typeof inner.next !== "string") return null;
    if (!inner.next.startsWith("/") || inner.next.startsWith("//")) {
      delete inner.next;
    }
  }

  return inner;
}

export function buildGoogleAuthorizationUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  scopes?: string[];
}): string {
  const q = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    response_type: "code",
    scope: (params.scopes ?? ["openid", "email", "profile"]).join(" "),
    access_type: "online",
    prompt: "select_account",
    include_granted_scopes: "true",
    state: params.state,
  });
  return `${DNX_GOOGLE_AUTH_URL}?${q.toString()}`;
}

export async function exchangeGoogleAuthCode(params: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<{ accessToken: string }> {
  const res = await fetch(DNX_GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: params.code,
      client_id: params.clientId,
      client_secret: params.clientSecret,
      redirect_uri: params.redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error("No se pudo intercambiar el código de Google.");
  }
  const accessToken =
    typeof data === "object" &&
    data !== null &&
    "access_token" in data &&
    typeof (data as { access_token: unknown }).access_token === "string"
      ? (data as { access_token: string }).access_token
      : null;
  if (!accessToken) throw new Error("Respuesta de token de Google inválida.");
  return { accessToken };
}

export async function fetchGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const res = await fetch(DNX_GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok || typeof data !== "object" || data === null) {
    throw new Error("No se pudo obtener el perfil de Google.");
  }
  const row = data as Record<string, unknown>;
  const email = typeof row.email === "string" ? row.email.trim().toLowerCase() : "";
  const id = typeof row.id === "string" ? row.id : "";
  const verifiedEmail = row.verified_email === true;
  if (!email || !email.includes("@")) {
    throw new Error("La cuenta de Google no expuso un email.");
  }
  if (!verifiedEmail) {
    throw new Error("El email de Google no está verificado.");
  }
  if (!id) {
    throw new Error("La cuenta de Google no expuso un identificador.");
  }
  return {
    id,
    email,
    name: typeof row.name === "string" && row.name.trim() ? row.name.trim() : null,
    verifiedEmail: true,
    picture: typeof row.picture === "string" ? row.picture : null,
  };
}

export type ResolveGoogleUserResult = {
  userId: number;
  email: string;
  created: boolean;
  linkedGoogleId: boolean;
  suiteRole: string;
};

/**
 * Resuelve User por email (identidad DNX compartida).
 * - No duplica por email.
 * - Vincula `googleId` si faltaba; rechaza mismatch.
 * - Marca `emailVerifiedAt` (Google verificó el email).
 * - `onCreate`: si se omite y no hay User, lanza (apps invite-only).
 */
export async function resolveOrLinkGoogleUser(params: {
  google: GoogleUserInfo;
  onCreate?: (data: {
    email: string;
    name: string | null;
    googleId: string;
  }) => Promise<{ id: number; role: string }>;
}): Promise<ResolveGoogleUserResult> {
  const email = params.google.email;
  const googleId = params.google.id;

  let user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      role: true,
      googleId: true,
      isBlocked: true,
      emailVerifiedAt: true,
      name: true,
    },
  });

  if (user?.isBlocked) {
    throw new Error("Esta cuenta está bloqueada.");
  }

  let created = false;
  let linkedGoogleId = false;

  if (!user) {
    if (!params.onCreate) {
      throw new Error("NO_USER_AND_NO_CREATE");
    }
    const createdUser = await params.onCreate({
      email,
      name: params.google.name,
      googleId,
    });
    user = await prisma.user.findUniqueOrThrow({
      where: { id: createdUser.id },
      select: {
        id: true,
        email: true,
        role: true,
        googleId: true,
        isBlocked: true,
        emailVerifiedAt: true,
        name: true,
      },
    });
    created = true;
    linkedGoogleId = true;
  } else {
    if (user.googleId && user.googleId !== googleId) {
      throw new Error("Esta cuenta ya está vinculada a otra identidad de Google.");
    }

    const data: {
      googleId?: string;
      emailVerifiedAt?: Date;
      name?: string;
    } = {};

    if (!user.googleId) {
      // Evitar colisión unique de googleId
      const taken = await prisma.user.findFirst({
        where: { googleId, NOT: { id: user.id } },
        select: { id: true },
      });
      if (taken) {
        throw new Error("Esa identidad de Google ya está vinculada a otra cuenta.");
      }
      data.googleId = googleId;
      linkedGoogleId = true;
    }
    if (!user.emailVerifiedAt) {
      data.emailVerifiedAt = new Date();
    }
    if ((!user.name || !user.name.trim()) && params.google.name) {
      data.name = params.google.name;
    }

    if (Object.keys(data).length > 0) {
      user = await prisma.user.update({
        where: { id: user.id },
        data,
        select: {
          id: true,
          email: true,
          role: true,
          googleId: true,
          isBlocked: true,
          emailVerifiedAt: true,
          name: true,
        },
      });
    }
  }

  return {
    userId: user.id,
    email: user.email,
    created,
    linkedGoogleId,
    suiteRole: String(user.role),
  };
}

/** Hash estable para logs (no PII completo). */
export function hashEmailForLog(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 12);
}
