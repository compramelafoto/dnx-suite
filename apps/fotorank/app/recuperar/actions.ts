"use server";

import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import {
  requestPasswordReset,
  resetPasswordWithToken,
  normalizeIdentityEmail,
  createUserSession,
  DNX_SESSION_COOKIE,
  DNX_SESSION_MAX_AGE_SECONDS,
} from "@repo/auth";
import { ipDelPedido } from "../lib/fotorank/judges/signupRateLimit";
import {
  createInMemoryRateLimitStore,
  hashRateLimitSubject,
} from "../lib/fotorank/upcoming/rate-limit";

export type FotorankResetFormState = {
  error: string | null;
  info: string | null;
  /** El email no tiene cuenta: la pantalla ofrece crear una. */
  noAccount?: boolean;
};

/**
 * Esta pantalla dice si el email tiene cuenta o no. No revela nada nuevo: el
 * registro ya responde "Ya existe una cuenta con ese email". Antes respondía
 * siempre con un mensaje neutro y quien no tenía cuenta esperaba un correo que
 * nunca llegaba. El tope por IP frena a quien quiera probar correos en serie.
 */
const RECUPERAR_POR_IP = { limit: 10, windowMs: 15 * 60_000 } as const;
const recuperarRateLimitStore = createInMemoryRateLimitStore();

function resolveAppBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_FOTORANK_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "";
  if (!raw) return "http://localhost:3000";
  return raw.replace(/\/$/, "");
}

export async function requestFotorankPasswordResetAction(
  _prev: FotorankResetFormState | undefined,
  formData: FormData,
): Promise<FotorankResetFormState> {
  const raw = formData.get("email")?.toString() ?? "";
  const normalized = normalizeIdentityEmail(raw);
  if (!normalized.ok) {
    return {
      error:
        normalized.error === "EMPTY"
          ? "El email es obligatorio."
          : "Ese email no parece válido. Revisá que esté bien escrito.",
      info: null,
    };
  }
  const email = normalized.email;

  const ip = ipDelPedido(await headers());
  if (ip) {
    const rl = await recuperarRateLimitStore.consume(
      hashRateLimitSubject(`recuperar:${ip}`),
      RECUPERAR_POR_IP.limit,
      RECUPERAR_POR_IP.windowMs,
    );
    if (!rl.allowed) {
      return {
        error: "Hiciste muchos intentos seguidos. Esperá unos minutos y probá de nuevo.",
        info: null,
      };
    }
  }

  const result = await requestPasswordReset({
    email,
    appBaseUrl: resolveAppBaseUrl(),
    appLabel: "FotoRank",
    resetPath: "/recuperar",
  });

  switch (result.outcome) {
    case "sent":
      return {
        error: null,
        info: `Te enviamos un enlace a ${email}. Revisá también la carpeta de spam o promociones. El enlace vence en 1 hora.`,
      };
    case "no_account":
      return {
        error: `No encontramos ninguna cuenta con ${email}. Revisá que esté bien escrito o probá con otro email que hayas usado. Si nunca te registraste, creá tu cuenta.`,
        info: null,
        noAccount: true,
      };
    case "blocked":
      return {
        error: "Esta cuenta está suspendida. Escribinos para revisarla.",
        info: null,
      };
    case "invalid_email":
      return { error: "Ese email no parece válido. Revisá que esté bien escrito.", info: null };
    case "send_failed":
    default:
      return {
        error: "No pudimos enviar el correo. Probá de nuevo en unos minutos.",
        info: null,
      };
  }
}

export async function resetFotorankPasswordAction(
  _prev: FotorankResetFormState | undefined,
  formData: FormData,
): Promise<FotorankResetFormState> {
  const rawToken = formData.get("token")?.toString() ?? "";
  const password = formData.get("password")?.toString() ?? "";
  const passwordConfirm = formData.get("passwordConfirm")?.toString() ?? "";

  try {
    const { userId } = await resetPasswordWithToken({
      rawToken,
      newPassword: password,
      passwordConfirm,
    });
    const session = await createUserSession(userId);
    const cookieStore = await cookies();
    cookieStore.set(DNX_SESSION_COOKIE, session.rawToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: DNX_SESSION_MAX_AGE_SECONDS,
    });
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "No se pudo restablecer la contraseña.",
      info: null,
    };
  }

  redirect("/participaciones");
}
