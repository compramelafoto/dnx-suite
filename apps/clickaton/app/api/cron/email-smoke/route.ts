/**
 * Resend smoke Production (10D.3).
 * Envía 2 emails a destinatario controlado:
 * 1) payment_confirmed
 * 2) activación Cuenta DNX (set-password canónico)
 *
 * Auth: Bearer CRON_SECRET | CLICKATON_CRON_SECRET.
 * No abre inscripciones. No toca pagos.
 */
import { NextResponse } from "next/server";
import { requestPasswordReset } from "@repo/auth";
import { sendParticipantFunnelEmail } from "@/lib/registration/notifications/participant-email";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

function authorized(request: Request): boolean {
  const secret =
    process.env.CRON_SECRET?.trim() || process.env.CLICKATON_CRON_SECRET?.trim();
  const auth = request.headers.get("authorization");
  return Boolean(secret) && auth === `Bearer ${secret}`;
}

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

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: { confirm?: string; to?: string };
  try {
    body = (await request.json()) as { confirm?: string; to?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
  }
  if (body.confirm !== "RESEND_SMOKE_10D3") {
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

  const confirmed = await sendParticipantFunnelEmail({
    kind: "payment_confirmed",
    to,
    participantName: "Smoke 10D.3",
    editionName: "Clickatón Argentina 2026",
    editionSlug: "clickaton-argentina-2026",
    registrationId: "smoke-10d3-registration",
    amountLabel: "$25.000",
    visibleCode: "CKA26-SMOKE",
    instagramHandle: "@clickaton_smoke",
    paymentStatus: "APPROVED",
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
    /staging|vercel\.app/i.test(confirmed.html) ||
    /staging|vercel\.app/i.test(confirmed.text);

  return NextResponse.json({
    ok: confirmed.sent && Boolean(activation.emailResult?.sent ?? activation.created),
    envPresence,
    publicBase: base,
    isProdHost,
    fromHint,
    stagingLeak,
    paymentConfirmed: {
      sent: confirmed.sent,
      skipped: confirmed.skipped,
      reason: confirmed.reason ?? null,
      messageId: confirmed.messageId ?? null,
      deliveredTo: confirmed.deliveredTo,
      subject: confirmed.subject,
      hasMaratonHost: confirmed.html.includes("maratonfotografica.com"),
      hasActivarPath: confirmed.html.includes("/activar"),
      hasMiCuenta: confirmed.html.includes("/mi-cuenta"),
    },
    activation: {
      created: activation.created,
      emailSent: activation.emailResult?.sent ?? null,
      emailSkipped: activation.emailResult?.skipped ?? null,
      emailReason: activation.emailResult?.reason ?? null,
      messageId: activation.emailResult?.messageId ?? null,
      resetPath: "/recuperar",
      note:
        "Set-password DNX usa /recuperar. Página de activación post-pago: /maratones/.../inscripcion/activar/[id].",
      activarExample: `${base}/maratones/clickaton-argentina-2026/inscripcion/activar/smoke-10d3-registration`,
    },
    verdict:
      !confirmed.sent || envPresence.RESEND_API_KEY === "MISSING"
        ? "PRODUCTION EMAIL BLOCKED"
        : stagingLeak || !isProdHost
          ? "PRODUCTION EMAIL BLOCKED"
          : "PRODUCTION EMAIL SMOKE PASS",
  });
}
