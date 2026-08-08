import { NextResponse } from "next/server";
import { reconcileApprovedFromProviderPayment } from "@/lib/checkout/refunds/reconcile-approved";
import { reconcileRefundFromProviderPayment } from "@/lib/checkout/refunds/reconcile-refund";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Ops one-shot: reconciliación individual APPROVED/REFUNDED en runtime Production
 * (tiene secrets Sensitive que no se pueden pull-ear localmente).
 *
 * Auth: Authorization: Bearer $DNX_OPS_RECONCILE_TOKEN
 * Body JSON: { paymentId, mode: "approved"|"refund", apply?: boolean }
 *
 * Sin batch. Una inscripción por request.
 */
export async function POST(req: Request) {
  const expected = (process.env.DNX_OPS_RECONCILE_TOKEN ?? "").trim();
  if (!expected || expected.length < 24) {
    return NextResponse.json({ ok: false, error: "ops_token_not_configured" }, { status: 503 });
  }
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token || token !== expected) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  if (process.env.VERCEL_ENV !== "production" && process.env.DNX_ENVIRONMENT !== "production") {
    return NextResponse.json({ ok: false, error: "production_only" }, { status: 403 });
  }

  let body: { paymentId?: string; mode?: string; apply?: boolean };
  try {
    body = (await req.json()) as { paymentId?: string; mode?: string; apply?: boolean };
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const paymentId = String(body.paymentId ?? "").trim();
  const mode = String(body.mode ?? "").trim();
  const apply = body.apply === true;
  if (!/^\d+$/.test(paymentId)) {
    return NextResponse.json({ ok: false, error: "invalid_payment_id" }, { status: 400 });
  }
  if (mode !== "approved" && mode !== "refund") {
    return NextResponse.json({ ok: false, error: "invalid_mode" }, { status: 400 });
  }

  // Warm LIVE bridge inside Production runtime (env already present).
  process.env.CLICKATON_DNX_PAYMENTS_PROVIDER =
    process.env.CLICKATON_DNX_PAYMENTS_PROVIDER?.trim() || "mercado_pago_production";
  process.env.DNX_CLICKATON_MP_LIVE_PAYMENTS_ENABLED =
    process.env.DNX_CLICKATON_MP_LIVE_PAYMENTS_ENABLED?.trim() || "true";

  try {
    if (mode === "approved") {
      const plan = await reconcileApprovedFromProviderPayment({
        providerPaymentId: paymentId,
        dryRun: !apply,
      });
      return NextResponse.json({
        ok: !plan.error,
        wrote: plan.applied === true,
        createdRefundsInMercadoPago: false,
        ...plan,
      });
    }
    const plan = await reconcileRefundFromProviderPayment({
      providerPaymentId: paymentId,
      dryRun: !apply,
    });
    return NextResponse.json({
      ok: !plan.error,
      wrote: plan.applied === true,
      createdRefundsInMercadoPago: false,
      ...plan,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        wrote: false,
        createdRefundsInMercadoPago: false,
        error: err instanceof Error ? err.message.slice(0, 240) : "ops_failed",
      },
      { status: 500 },
    );
  }
}
