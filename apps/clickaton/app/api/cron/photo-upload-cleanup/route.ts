import { NextResponse } from "next/server";
import { prisma } from "@/lib/admin/db";

export const dynamic = "force-dynamic";

/**
 * Cleanup seguro: marca drafts abandonados; no borra físicos con valor probatorio.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const abandoned = await prisma.clickatonPhotoSubmission.updateMany({
    where: {
      status: { in: ["UPLOAD_PENDING", "UPLOADING", "FAILED"] },
      updatedAt: { lt: cutoff },
      confirmedAt: null,
    },
    data: {
      status: "WITHDRAWN",
      withdrawnAt: new Date(),
      failureCode: "CLEANUP_ABANDONED",
      failureMessage: "Draft abandonado — retención soft.",
    },
  });

  return NextResponse.json({
    ok: true,
    abandoned: abandoned.count,
    note: "No se eliminan objetos de storage en este cron (retención probatoria).",
  });
}
