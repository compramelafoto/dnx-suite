"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import {
  registerDnxAccount,
  createUserSession,
  DNX_SESSION_COOKIE,
  DNX_SESSION_MAX_AGE_SECONDS,
} from "@repo/auth";
import { safeNextPath } from "../lib/safe-next-path";

export type FotorankRegisterFormState = { error: string | null };

function resolveAppBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_FOTORANK_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "";
  if (!raw) return "http://localhost:3000";
  return raw.replace(/\/$/, "");
}

export async function registerFotorankAccountAction(
  _prev: FotorankRegisterFormState | undefined,
  formData: FormData,
): Promise<FotorankRegisterFormState> {
  const firstName = formData.get("firstName")?.toString() ?? "";
  const lastName = formData.get("lastName")?.toString() ?? "";
  const email = formData.get("email")?.toString() ?? "";
  const password = formData.get("password")?.toString() ?? "";
  const passwordConfirm = formData.get("passwordConfirm")?.toString() ?? "";
  const termsRaw = formData.get("acceptedTerms") ?? formData.get("acceptTerms");
  const acceptedTerms =
    termsRaw === "on" || termsRaw === "1" || termsRaw === "true";
  const privacyRaw = formData.get("acceptedPrivacy");
  const acceptedPrivacy =
    privacyRaw === "on" ||
    privacyRaw === "1" ||
    privacyRaw === "true" ||
    acceptedTerms;
  const next = safeNextPath(formData.get("next")?.toString());

  const result = await registerDnxAccount({
    email,
    password,
    passwordConfirm,
    firstName,
    lastName,
    sourceApplication: "fotorank",
    appBaseUrl: resolveAppBaseUrl(),
    appLabel: "FotoRank",
    verifyPath: "/verificar-email",
    createRole: "CUSTOMER",
    acceptedTerms,
    acceptedPrivacy,
  });

  if (!result.ok) {
    return { error: result.message };
  }

  const session = await createUserSession(result.user.id);
  const cookieStore = await cookies();
  cookieStore.set(DNX_SESSION_COOKIE, session.rawToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DNX_SESSION_MAX_AGE_SECONDS,
  });

  // Nuevas cuentas: sin orgs/jurado → participaciones (o next de inscripción).
  redirect(next ?? "/participaciones");
}
