import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrderDownloadTokens } from "@/lib/download-tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mapStep(step: string | null | undefined): string | null {
  if (!step) return null;
  switch (step) {
    case "PENDING":
      return "Pendiente";
    case "PROCESSING":
      return "Procesando fotos";
    case "ZIPPING":
      return "Comprimiendo";
    case "UPLOADING":
      return "Subiendo";
    case "COMPLETED":
      return "Completado";
    case "FAILED":
      return "Error";
    default:
      return step;
  }
}

export async function GET(
  req: NextRequest,
  ctx: { params: { id: string } } | { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await Promise.resolve(ctx.params);
    const orderId = parseInt(id, 10);
    if (!Number.isFinite(orderId) || orderId <= 0) {
      return NextResponse.json({ error: "ID de pedido inválido" }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true },
    });
    if (!order) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }

    if (order.status !== "PAID") {
      return NextResponse.json({ error: "El pedido no está aprobado" }, { status: 400 });
    }

    const job = await prisma.zipGenerationJob.findFirst({
      where: {
        orderId,
        type: "ORDER_DOWNLOAD",
        status: { in: ["PENDING", "PROCESSING", "COMPLETED", "FAILED"] },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!job) {
      return NextResponse.json({
        success: true,
        orderId: order.id,
        zip: {
          status: "not_found",
          progressPercent: null,
          currentStep: null,
          downloadUrl: null,
        },
      });
    }

    const meta = (job.meta ?? {}) as Record<string, unknown>;
    const currentStepRaw = typeof meta.currentStep === "string" ? meta.currentStep : null;
    const currentStep = mapStep(currentStepRaw);
    const progressPercent = typeof job.progress === "number" ? job.progress : null;

    let downloadUrl: string | null = null;
    if (job.status === "COMPLETED") {
      const tokens = await getOrderDownloadTokens(order.id);
      const clientToken = tokens.find((t) => t.type === "CLIENT_DIGITAL" && !t.photoId);
      if (clientToken?.token) {
        const baseUrl =
          process.env.APP_URL ||
          (typeof req.url === "string" ? req.url.split("/api")[0] : "") ||
          "";
        downloadUrl = `${baseUrl}/api/downloads/${clientToken.token}`;
      }
    }

    const status =
      job.status === "PENDING"
        ? "pending"
        : job.status === "PROCESSING"
          ? currentStepRaw === "UPLOADING"
            ? "uploading"
            : currentStepRaw === "ZIPPING"
              ? "processing"
              : "processing"
          : job.status === "COMPLETED"
            ? "completed"
            : job.status === "FAILED"
              ? "error"
              : "not_found";

    return NextResponse.json({
      success: true,
      orderId: order.id,
      zip: {
        status,
        progressPercent,
        currentStep,
        downloadUrl,
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: "Error obteniendo estado del ZIP", detail: String((err as Error)?.message ?? err) },
      { status: 500 }
    );
  }
}
