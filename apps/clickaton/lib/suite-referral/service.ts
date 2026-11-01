import { cookies } from "next/headers";
import { after } from "next/server";

import {
  SUITE_REFERRAL_COOKIE,
  normalizeSuiteReferralCode,
  reportSuiteReferralSignup,
} from "@repo/auth/suite-referral";
import { prisma } from "@repo/db";

import {
  SUITE_REFERRAL_AUDIT_ACTION,
  suiteReferralCodeFromAuditMetadata,
  suiteReferralCodeToReport,
} from "./domain";

/**
 * Referidos de DNX Suite: avisar a ComprameLaFoto quién trajo a quien crea su
 * cuenta en Clickatón. Todo es best-effort: nada de esto puede romper ni demorar
 * un alta, una inscripción o un pago.
 */

/** Código guardado en la cookie `dnx_ref` del visitante, o null. */
export async function readSuiteReferralCodeFromCookies(): Promise<string | null> {
  try {
    const jar = await cookies();
    return normalizeSuiteReferralCode(jar.get(SUITE_REFERRAL_COOKIE)?.value);
  } catch {
    // Fuera de un request (scripts) no hay cookies.
    return null;
  }
}

/** Borra la cookie una vez usada. Falla en silencio donde no se puede escribir (render). */
export async function clearSuiteReferralCookie(): Promise<void> {
  try {
    const jar = await cookies();
    if (jar.get(SUITE_REFERRAL_COOKIE)) jar.delete(SUITE_REFERRAL_COOKIE);
  } catch {
    // En un Server Component no se pueden escribir cookies: queda hasta que venza.
  }
}

/** Corre la tarea después de responder; fuera de un request, la corre en el momento. */
function runAfterResponse(task: () => Promise<unknown>): void {
  const safeTask = async () => {
    try {
      await task();
    } catch (error) {
      console.warn("[clickaton.suite-referral] el aviso falló:", error);
    }
  };
  try {
    after(safeTask);
  } catch {
    void safeTask();
  }
}

/**
 * Avisa a CLF un alta referida, sin esperar la respuesta (va después de responder).
 * No hace nada si la cuenta no fue recién creada o si no hay código válido.
 */
export function scheduleSuiteReferralSignupReport(input: {
  created: boolean;
  code: string | null | undefined;
  userId: number | string;
  email: string;
  name?: string | null;
}): boolean {
  const code = suiteReferralCodeToReport({ created: input.created, code: input.code });
  if (!code) return false;
  runAfterResponse(() =>
    reportSuiteReferralSignup({
      platform: "clickaton",
      code,
      externalUserId: input.userId,
      email: input.email,
      name: input.name ?? null,
    }),
  );
  return true;
}

/**
 * Anota el código `dnx_ref` en la inscripción recién creada.
 *
 * Igual que `ck_ref`: la cuenta de quien se inscribe como invitado recién se crea
 * después del pago, muchas veces en el webhook, sin navegador ni cookie. Por eso el
 * código tiene que quedar guardado ahora. El primero gana.
 */
export async function captureSuiteReferralForRegistration(
  registrationId: string,
): Promise<void> {
  try {
    const code = await readSuiteReferralCodeFromCookies();
    if (!code) return;
    const existing = await prisma.clickatonRegistrationAudit.findFirst({
      where: { registrationId, action: SUITE_REFERRAL_AUDIT_ACTION },
      select: { id: true },
    });
    if (existing) return;
    await prisma.clickatonRegistrationAudit.create({
      data: {
        registrationId,
        action: SUITE_REFERRAL_AUDIT_ACTION,
        source: "public_registration",
        metadata: { code },
      },
    });
  } catch (error) {
    console.error("[clickaton.suite-referral] no se pudo guardar el código:", error);
  }
}

/**
 * Tras crear la cuenta de una inscripción: busca el código guardado en la
 * inscripción (o, si no hay, en la cookie del request actual) y avisa a CLF.
 * Sólo llamar cuando la cuenta fue recién creada.
 */
export async function reportSuiteReferralForRegistrationSignup(input: {
  registrationId: string;
  userId: number;
  email: string;
  name?: string | null;
}): Promise<void> {
  try {
    const audit = await prisma.clickatonRegistrationAudit.findFirst({
      where: { registrationId: input.registrationId, action: SUITE_REFERRAL_AUDIT_ACTION },
      orderBy: { createdAt: "asc" },
      select: { metadata: true },
    });
    const code =
      suiteReferralCodeFromAuditMetadata(audit?.metadata) ??
      (await readSuiteReferralCodeFromCookies());
    const scheduled = scheduleSuiteReferralSignupReport({
      created: true,
      code,
      userId: input.userId,
      email: input.email,
      name: input.name,
    });
    if (scheduled) await clearSuiteReferralCookie();
  } catch (error) {
    console.error("[clickaton.suite-referral] no se pudo avisar el alta:", error);
  }
}
