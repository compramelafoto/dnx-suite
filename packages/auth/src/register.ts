/**
 * Registro canónico de Cuenta DNX Universal.
 * Las apps NO deben implementar registros independientes de identidad.
 */

import {
  resolveOrCreateUser,
  type DnxApplicationId,
  type DnxIdentityUser,
} from "./identity";
import { requireNormalizedIdentityEmail } from "./identity-email";
import { requirePasswordPolicy } from "./password-policy";
import { requestEmailVerification } from "./email-verification";
import { DNX_AUTH_MESSAGES } from "./messages";
import type { IdentityEmailResult } from "./email";

export type RegisterDnxAccountInput = {
  email: string;
  password: string;
  passwordConfirm?: string;
  firstName?: string;
  lastName?: string;
  /** Nombre completo opcional (si no se usan first/last). */
  name?: string | null;
  sourceApplication: DnxApplicationId;
  appBaseUrl: string;
  appLabel?: string;
  verifyPath?: string;
  createRole?: string;
  acceptedTerms: boolean;
  acceptedPrivacy: boolean;
  /** Si true, envía verificación (default true). */
  sendVerification?: boolean;
};

export type RegisterDnxAccountResult =
  | {
      ok: true;
      created: true;
      user: DnxIdentityUser;
      verification?: { created: boolean; emailResult?: IdentityEmailResult };
      message: string;
    }
  | {
      ok: false;
      reason: "EXISTS" | "VALIDATION" | "BLOCKED" | "CONSENT";
      message: string;
    };

function buildDisplayName(input: RegisterDnxAccountInput): string | null {
  if (input.name?.trim()) return input.name.trim();
  const first = input.firstName?.trim() ?? "";
  const last = input.lastName?.trim() ?? "";
  const full = `${first} ${last}`.trim();
  return full || null;
}

/**
 * Crea una Cuenta DNX (identidad). No asigna roles de producto (jurado, admin, etc.).
 */
export async function registerDnxAccount(
  input: RegisterDnxAccountInput,
): Promise<RegisterDnxAccountResult> {
  if (!input.acceptedTerms || !input.acceptedPrivacy) {
    return {
      ok: false,
      reason: "CONSENT",
      message: "Debés aceptar términos y privacidad para crear tu Cuenta DNX.",
    };
  }

  try {
    requireNormalizedIdentityEmail(input.email);
    requirePasswordPolicy(input.password, {
      confirm: input.passwordConfirm,
    });
  } catch (err) {
    return {
      ok: false,
      reason: "VALIDATION",
      message: err instanceof Error ? err.message : DNX_AUTH_MESSAGES.genericError,
    };
  }

  try {
    const resolved = await resolveOrCreateUser({
      email: input.email,
      password: input.password,
      name: buildDisplayName(input),
      createRole: input.createRole ?? "CUSTOMER",
      sourceApplication: input.sourceApplication,
    });

    if (!resolved.created) {
      return {
        ok: false,
        reason: "EXISTS",
        message: DNX_AUTH_MESSAGES.registerExists,
      };
    }

    let verification: { created: boolean; emailResult?: IdentityEmailResult } | undefined;
    if (input.sendVerification !== false) {
      const v = await requestEmailVerification({
        email: resolved.user.email,
        appBaseUrl: input.appBaseUrl,
        appLabel: input.appLabel,
        verifyPath: input.verifyPath,
        sourceApplication: input.sourceApplication,
      });
      verification = { created: v.created, emailResult: v.emailResult };
    }

    console.info("[dnx.identity] registerDnxAccount.created", {
      userId: resolved.user.id,
      source: input.sourceApplication,
    });

    return {
      ok: true,
      created: true,
      user: resolved.user,
      verification,
      message: DNX_AUTH_MESSAGES.registerSuccess,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("bloqueada")) {
      return { ok: false, reason: "BLOCKED", message: DNX_AUTH_MESSAGES.accountBlocked };
    }
    return {
      ok: false,
      reason: "VALIDATION",
      message: msg || DNX_AUTH_MESSAGES.genericError,
    };
  }
}
