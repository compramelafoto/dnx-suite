import { Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  getOrganizerWithdrawalReceiptSignedUrl,
  uploadOrganizerWithdrawalReceipt,
} from "@/lib/organizer-payout-receipt";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/organizer-commission-withdrawals/[id]/receipt
 * multipart/form-data: file
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.ADMIN]);
    if (error || !user) {
      return NextResponse.json(
        { error: error || "No autorizado. Se requiere rol ADMIN." },
        { status: 401 }
      );
    }

    const { id: idParam } = await ctx.params;
    const withdrawalId = Number(idParam);
    if (!Number.isFinite(withdrawalId) || withdrawalId <= 0) {
      return NextResponse.json({ error: "id inválido" }, { status: 400 });
    }

    const row = await prisma.organizerCommissionWithdrawalRequest.findUnique({
      where: { id: withdrawalId },
      select: { id: true, status: true },
    });
    if (!row) {
      return NextResponse.json({ error: "No encontrada" }, { status: 404 });
    }
    if (
      row.status !== "REQUESTED" &&
      row.status !== "APPROVED" &&
      row.status !== "PAID"
    ) {
      return NextResponse.json(
        { error: "No se puede subir comprobante en el estado actual de la solicitud." },
        { status: 400 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No se envió ningún archivo" }, { status: 400 });
    }

    let uploaded;
    try {
      uploaded = await uploadOrganizerWithdrawalReceipt({ withdrawalId, file });
    } catch (e: unknown) {
      return NextResponse.json(
        { error: String((e as Error)?.message ?? e) },
        { status: 400 }
      );
    }

    const updated = await prisma.organizerCommissionWithdrawalRequest.update({
      where: { id: withdrawalId },
      data: {
        payoutReceiptUrl: uploaded.r2Key,
        payoutReceiptFileName: uploaded.fileName,
        payoutReceiptMimeType: uploaded.mimeType,
        payoutReceiptUploadedAt: uploaded.uploadedAt,
      },
      select: {
        payoutReceiptUrl: true,
        payoutReceiptFileName: true,
        payoutReceiptMimeType: true,
        payoutReceiptUploadedAt: true,
      },
    });

    const viewUrl = await getOrganizerWithdrawalReceiptSignedUrl(updated.payoutReceiptUrl);

    return NextResponse.json({
      ok: true,
      payoutReceiptFileName: updated.payoutReceiptFileName,
      payoutReceiptMimeType: updated.payoutReceiptMimeType,
      payoutReceiptUploadedAt: updated.payoutReceiptUploadedAt?.toISOString() ?? null,
      receiptViewUrl: viewUrl,
    });
  } catch (err: unknown) {
    console.error("POST .../receipt ERROR >>>", err);
    return NextResponse.json(
      { error: "Error subiendo comprobante", detail: String((err as Error)?.message ?? err) },
      { status: 500 }
    );
  }
}

/**
 * GET — URL firmada para ver/descargar comprobante (admin).
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requireAuth([Role.ADMIN]);
    if (error) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const { id: idParam } = await ctx.params;
    const withdrawalId = Number(idParam);
    if (!Number.isFinite(withdrawalId) || withdrawalId <= 0) {
      return NextResponse.json({ error: "id inválido" }, { status: 400 });
    }

    const row = await prisma.organizerCommissionWithdrawalRequest.findUnique({
      where: { id: withdrawalId },
      select: {
        payoutReceiptUrl: true,
        payoutReceiptFileName: true,
        payoutReceiptMimeType: true,
        payoutReceiptUploadedAt: true,
      },
    });
    if (!row?.payoutReceiptUrl) {
      return NextResponse.json({ error: "Sin comprobante" }, { status: 404 });
    }

    const viewUrl = await getOrganizerWithdrawalReceiptSignedUrl(row.payoutReceiptUrl);
    if (!viewUrl) {
      return NextResponse.json({ error: "No se pudo generar el enlace" }, { status: 500 });
    }

    return NextResponse.json({
      receiptViewUrl: viewUrl,
      payoutReceiptFileName: row.payoutReceiptFileName,
      payoutReceiptMimeType: row.payoutReceiptMimeType,
      payoutReceiptUploadedAt: row.payoutReceiptUploadedAt?.toISOString() ?? null,
    });
  } catch (err: unknown) {
    console.error("GET .../receipt ERROR >>>", err);
    return NextResponse.json(
      { error: "Error obteniendo comprobante", detail: String((err as Error)?.message ?? err) },
      { status: 500 }
    );
  }
}
