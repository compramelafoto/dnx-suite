/**
 * Resend smoke Production (10D.3 / 10E.2).
 * Envía 2 emails a destinatario controlado:
 * 1) payment_confirmed (fecha 19/09/2026, links Production)
 * 2) activación Cuenta DNX (set-password canónico)
 *
 * Auth:
 * - Bearer CRON_SECRET | CLICKATON_CRON_SECRET
 * - o body.opsToken === CLICKATON_EMAIL_SMOKE_TOKEN (ops, no-sensitive)
 *
 * No abre inscripciones. No toca pagos.
 */
import { NextResponse } from "next/server";
import { requestPasswordReset } from "@repo/auth";
import { sendParticipantFunnelEmail } from "@/lib/registration/notifications/participant-email";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

type SmokeBody = {
  confirm?: string;
  to?: string;
  opsToken?: string;
};

function presence(name: string): "PRESENT" | "MISSING" {
  return process.env[name]?.trim() ? "PRESENT" : "MISSING";
}

function publicBase(): string {
  return (
    process.env.CLICKATON_PUBLIC_URL?.replace(/\/$/, "") ||
    process.env.CLICKATON_PUBLIC_WEB_BASE_URL?.replace(/\/$/, "") ||
    process.env.APP_URL?.replace(/\/$/, "") ||
    "https://maratonfotografica.com"
  );
}

function authorized(request: Request, body: SmokeBody): boolean {
  const secret =
    process.env.CRON_SECRET?.trim() || process.env.CLICKATON_CRON_SECRET?.trim();
  const auth = request.headers.get("authorization");
  if (secret && auth === `Bearer ${secret}`) return true;

  const ops = process.env.CLICKATON_EMAIL_SMOKE_TOKEN?.trim();
  if (
    ops &&
    body.opsToken === ops &&
    (body.confirm === "RESEND_SMOKE_10E2" || body.confirm === "RESEND_SMOKE_10D3")
  ) {
    return true;
  }
  return false;
}

async function resendDeliveryHint(messageId: string | null | undefined): Promise<{
  lookedUp: boolean;
  lastEvent: string | null;
}> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey || !messageId) return { lookedUp: false, lastEvent: null };
  try {
    const res = await fetch(`https://api.resend.com/emails/${messageId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return { lookedUp: true, lastEvent: `http_${res.status}` };
    const data = (await res.json().catch(() => ({}))) as {
      last_event?: string;
    };
    return { lookedUp: true, lastEvent: data.last_event ?? null };
  } catch {
    return { lookedUp: true, lastEvent: "lookup_error" };
  }
}

export async function POST(request: Request) {
  let body: SmokeBody = {};
  try {
    body = (await request.json()) as SmokeBody;
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
  }

  if (!authorized(request, body)) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  if (body.confirm !== "RESEND_SMOKE_10D3" && body.confirm !== "RESEND_SMOKE_10E2") {
    return NextResponse.json({ ok: false, error: "CONFIRM_REQUIRED" }, { status: 400 });
  }

  const to =
    body.to?.trim() ||
    process.env.CLICKATON_EMAIL_TEST_TO?.trim() ||
    "cuart.daniel@gmail.com";
  const base = publicBase();
  const isProdHost =
    base.includes("maratonfotografica.com") && !base.includes("staging");

  const envPresence = {
    RESEND_API_KEY: presence("RESEND_API_KEY"),
    EMAIL_FROM: presence("EMAIL_FROM"),
    DNX_EMAIL_FROM: presence("DNX_EMAIL_FROM"),
    CLICKATON_PUBLIC_URL: presence("CLICKATON_PUBLIC_URL"),
    CLICKATON_PUBLIC_WEB_BASE_URL: presence("CLICKATON_PUBLIC_WEB_BASE_URL"),
  };

  // Force allow controlled recipient for this smoke only (process-local).
  process.env.CLICKATON_EMAIL_ALLOW_ANY = "true";

  const eventDate = new Date("2026-09-19T12:00:00.000-03:00");

  const confirmed = await sendParticipantFunnelEmail({
    kind: "payment_confirmed",
    to,
    participantName: "Smoke 10E.2",
    editionName: "Clickatón Argentina 2026",
    editionSlug: "clickaton-argentina-2026",
    registrationId: "smoke-10e2-registration",
    amountLabel: "$25.000",
    visibleCode: "CKA26-SMOKE",
    instagramHandle: "@clickaton_smoke",
    paymentStatus: "APPROVED",
    startAt: eventDate,
    includedItemLabels: ["Remera Clickatón (beneficio first-100 / 30-08)"],
  });

  // Activación: set-password DNX (ruta actual del sistema = /recuperar).
  // UX post-pago también ofrece /activar/[registrationId].
  const activation = await requestPasswordReset({
    email: to,
    appBaseUrl: base,
    appLabel: "Clickatón",
    resetPath: "/recuperar",
  });

  const fromHint =
    process.env.EMAIL_FROM?.trim() ||
    process.env.DNX_EMAIL_FROM?.trim() ||
    "DNX Suite <noreply@dnxsuite.com>";

  const stagingLeak =
    /staging|vercel\.app|localhost|127\.0\.0\.1/i.test(confirmed.html) ||
    /staging|vercel\.app|localhost|127\.0\.0\.1/i.test(confirmed.text);

  const hasEventDate =
    confirmed.html.includes("19/09/2026") ||
    confirmed.text.includes("19/09/2026") ||
    confirmed.html.includes("19/9/2026") ||
    confirmed.text.includes("19/9/2026");

  const confirmedDelivery = await resendDeliveryHint(confirmed.messageId);
  const activationDelivery = await resendDeliveryHint(
    activation.emailResult?.messageId ?? null,
  );

  const activationOk = Boolean(activation.emailResult?.sent);

  const ok =
    confirmed.sent &&
    envPresence.RESEND_API_KEY === "PRESENT" &&
    isProdHost &&
    !stagingLeak &&
    hasEventDate;

  return NextResponse.json({
    ok,
    envPresence,
    publicBase: base,
    isProdHost,
    fromHint,
    stagingLeak,
    hasEventDate,
    paymentConfirmed: {
      sent: confirmed.sent,
      skipped: confirmed.skipped,
      reason: confirmed.reason ?? null,
      messageId: confirmed.messageId ?? null,
      deliveredTo: confirmed.deliveredTo,
      subject: confirmed.subject,
      hasMaratonHost: confirmed.html.includes("maratonfotografica.com"),
      hasMiCuenta: confirmed.html.includes("/mi-cuenta"),
      hasTestPrefix: confirmed.subject.startsWith("[TEST]"),
      delivery: confirmedDelivery,
    },
    activation: {
      created: activation.created,
      emailSent: activation.emailResult?.sent ?? null,
      emailSkipped: activation.emailResult?.skipped ?? null,
      emailReason: activation.emailResult?.reason ?? null,
      messageId: activation.emailResult?.messageId ?? null,
      resetPath: "/recuperar",
      note:
        "Set-password DNX usa /recuperar. Página de activación post-pago: /maratones/.../inscripcion/activar/[id]. Sin password automática.",
      activarExample: `${base}/maratones/clickaton-argentina-2026/inscripcion/activar/smoke-10e2-registration`,
      loginExample: `${base}/login`,
      panelExample: `${base}/mi-cuenta`,
      delivery: activationDelivery,
      ok: activationOk,
    },
    errorTemplatesAudit: {
      reservation_created: "EXISTS (pending payment / hold)",
      payment_confirmed: "EXISTS",
      free_confirmed: "EXISTS",
      hold_expired: "EXISTS",
      payment_rejected_failed: "MISSING (no dedicated template)",
      refund_cancel: "MISSING (no dedicated template)",
    },
    verdict:
      !ok
        ? "PRODUCTION EMAIL BLOCKED"
        : activation.emailResult?.sent
          ? "PRODUCTION EMAIL SMOKE PASS"
          : "PRODUCTION EMAIL SMOKE PASS — ACTIVATION PARTIAL",
  });
}
