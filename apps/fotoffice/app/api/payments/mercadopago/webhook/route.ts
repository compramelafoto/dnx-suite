import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { approveCourseEnrollment } from "@/lib/presential-courses/enrollment-workflow";
import { getMercadoPagoPayment, verifyMercadoPagoWebhookSignature } from "@/lib/presential-courses/mercadopago";
import { logCourseEvent } from "@/lib/presential-courses/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const url = req.nextUrl;
    const body = await req.json().catch(() => null);
    const type =
      url.searchParams.get("type") ||
      url.searchParams.get("topic") ||
      body?.type ||
      body?.topic ||
      body?.action;
    const paymentId =
      url.searchParams.get("data.id") ||
      url.searchParams.get("id") ||
      body?.data?.id ||
      body?.id;
    const isPaymentEvent = typeof type === "string" && type.startsWith("payment");
    if (!isPaymentEvent || !paymentId) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const webhookSecret = process.env.MP_WEBHOOK_SECRET?.trim() || null;
    if (!webhookSecret) {
      if (process.env.NODE_ENV === "production") {
        logCourseEvent("webhook_signature_rejected_missing_secret", {
          paymentId: String(paymentId),
        });
        return NextResponse.json({ ok: false, error: "Webhook signature secret missing" }, { status: 401 });
      }
      console.warn("[fotoffice_courses] MP_WEBHOOK_SECRET no configurado; se omite verificación de firma en desarrollo.");
    } else {
      const signatureResult = verifyMercadoPagoWebhookSignature({
        signatureHeader: req.headers.get("x-signature"),
        requestIdHeader: req.headers.get("x-request-id"),
        dataId: String(paymentId),
        secret: webhookSecret,
      });
      if (!signatureResult.ok) {
        logCourseEvent("webhook_signature_invalid", {
          paymentId: String(paymentId),
          reason: signatureResult.reason,
        });
        return NextResponse.json({ ok: false, error: "Invalid webhook signature" }, { status: 401 });
      }
    }

    const payment = await getMercadoPagoPayment(paymentId);
    const metadataEnrollmentId =
      typeof payment.metadata?.enrollmentId === "string" ? payment.metadata.enrollmentId : null;
    const enrollmentId =
      payment.external_reference ||
      metadataEnrollmentId ||
      url.searchParams.get("enrollmentId");
    const metadataType = typeof payment.metadata?.type === "string" ? payment.metadata.type : null;

    if (!enrollmentId) {
      logCourseEvent("webhook_payment_missing_enrollment_id", {
        paymentId: String(payment.id),
      });
      return NextResponse.json({ ok: true, ignored: true });
    }
    if (metadataType && metadataType !== "COURSE_ENROLLMENT") {
      return NextResponse.json({ ok: true, ignored: true });
    }

    if (payment.status === "approved") {
      await approveCourseEnrollment({
        enrollmentId,
        paymentRef: String(payment.id),
        amountArs: payment.transaction_amount ?? undefined,
        paymentMethodId: payment.payment_method_id ?? undefined,
      });
      return NextResponse.json({ ok: true, status: "approved_processed" });
    }

    if (payment.status === "rejected" || payment.status === "cancelled") {
      await prisma.courseEnrollment.updateMany({
        where: {
          id: enrollmentId,
          paymentStatus: "PENDING",
        },
        data: {
          paymentStatus: payment.status === "rejected" ? "REJECTED" : "CANCELLED",
          paymentRef: String(payment.id),
        },
      });
      logCourseEvent("payment_not_approved", {
        enrollmentId,
        paymentId: String(payment.id),
        status: payment.status,
      });
      return NextResponse.json({ ok: true, status: payment.status });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[fotoffice_courses] mp_webhook_error", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
