"use server";

import { redirect } from "next/navigation";
import {
  registerDnxAccount,
  createUserSession,
  DNX_SESSION_COOKIE,
  DNX_SESSION_MAX_AGE_SECONDS,
} from "@repo/auth";
import { cookies } from "next/headers";
import { sanitizeClickatonReturnPath } from "@/lib/auth/return-path";
import { siteConfig } from "@/config/site";
import {
  clearSuiteReferralCookie,
  readSuiteReferralCodeFromCookies,
  scheduleSuiteReferralSignupReport,
} from "@/lib/suite-referral/service";

export type ClickatonRegisterFormState = { error: string | null; info: string | null };

function isAcceptedFlag(value: FormDataEntryValue | null): boolean {
  if (value == null) return false;
  const v = String(value).toLowerCase();
  return v === "on" || v === "1" || v === "true" || v === "yes";
}

function resolveAppBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_CLICKATON_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "";
  if (!raw) return "http://localhost:3005";
  return raw.replace(/\/$/, "");
}

export async function registerClickatonAccountAction(
  _prev: ClickatonRegisterFormState | undefined,
  formData: FormData,
): Promise<ClickatonRegisterFormState> {
  const firstName = formData.get("firstName")?.toString() ?? "";
  const lastName = formData.get("lastName")?.toString() ?? "";
  const email = formData.get("email")?.toString() ?? "";
  const password = formData.get("password")?.toString() ?? "";
  const passwordConfirm = formData.get("passwordConfirm")?.toString() ?? "";
  const acceptedTerms = isAcceptedFlag(formData.get("acceptedTerms") ?? formData.get("acceptTerms"));
  const acceptedPrivacy =
    isAcceptedFlag(formData.get("acceptedPrivacy")) || acceptedTerms;
  const nextRaw = formData.get("next")?.toString();

  const result = await registerDnxAccount({
    email,
    password,
    passwordConfirm,
    firstName,
    lastName,
    sourceApplication: "clickaton",
    appBaseUrl: resolveAppBaseUrl(),
    appLabel: siteConfig.name,
    verifyPath: "/verificar-email",
    createRole: "CUSTOMER",
    acceptedTerms,
    acceptedPrivacy,
  });

  if (!result.ok) {
    return { error: result.message, info: null };
  }

  // Referidos DNX Suite: la cuenta es nueva (registerDnxAccount rechaza las existentes).
  // El aviso a CLF va después de responder y nunca tira.
  const suiteReferralScheduled = scheduleSuiteReferralSignupReport({
    created: result.created,
    code: await readSuiteReferralCodeFromCookies(),
    userId: result.user.id,
    email: result.user.email,
    name: result.user.name,
  });
  if (suiteReferralScheduled) await clearSuiteReferralCookie();

  // Sesión local post-registro (misma identidad DNX). Inscripciones siguen gated por feature flag.
  const session = await createUserSession(result.user.id);
  const cookieStore = await cookies();
  cookieStore.set(DNX_SESSION_COOKIE, session.rawToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DNX_SESSION_MAX_AGE_SECONDS,
  });

  const next = sanitizeClickatonReturnPath(nextRaw, "/mi-cuenta");
  redirect(next);
}
