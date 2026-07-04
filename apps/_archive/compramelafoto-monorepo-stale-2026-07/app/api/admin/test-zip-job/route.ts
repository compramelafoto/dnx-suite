import { NextRequest, NextResponse } from "next/server";
import { queueEmail, renderTemplate } from "@/lib/email-queue";
import { createZipJob, getJobStatus } from "@/lib/zip-job-queue";
import { generateZipForJob } from "@/lib/zip-generation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json().catch(() => ({}));
    const photoIds: number[] = Array.isArray(payload.photoIds)
      ? payload.photoIds
          .map((value: unknown) => Number(value))
          .filter((num: number) => Number.isFinite(num))
      : [];
    const email = typeof payload.email === "string" ? payload.email.trim() : "";

    if (!photoIds.length) {
      return NextResponse.json(
        { error: "Se requieren photoIds válidos para el test" },
        { status: 400 }
      );
    }

    const job = await createZipJob({
      type: "CUSTOM_PHOTOS",
      photoIds,
      requesterUserId: null,
      meta: { automatedTest: true },
    });

    await generateZipForJob(job.id);

    const finalJob = await getJobStatus(job.id);
    if (email && finalJob?.status === "COMPLETED" && finalJob?.zipUrl) {
      const template = await renderTemplate("digital_download", {
        customerName: email.split("@")[0] || "cliente",
        orderId: finalJob.orderId || "N/A",
        downloadUrl: finalJob.zipUrl,
        expiresAt: finalJob.expiresAt?.toLocaleDateString("es-AR") ||
          new Date().toLocaleDateString("es-AR"),
      });
      await queueEmail({
        to: email,
        subject: template.subject,
        body: template.bodyText,
        htmlBody: template.bodyHtml,
        idempotencyKey: `admin-test-zip-${job.id}-${email}`,
      });
    }
    return NextResponse.json({
      success: finalJob?.status === "COMPLETED",
      job: finalJob,
    });
  } catch (error: any) {
    console.error("Error ejecutando test ZIP job:", error);
    return NextResponse.json(
      { error: String(error?.message || error) },
      { status: 500 }
    );
  }
}
