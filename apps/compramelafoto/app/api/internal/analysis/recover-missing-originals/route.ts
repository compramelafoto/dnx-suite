import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const isVercelCron = req.headers.get("x-vercel-cron") === "1" && process.env.VERCEL === "1";
  if (!secret) return isVercelCron;
  const authHeader = req.headers.get("authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.replace("Bearer ", "").trim() === secret;
  }
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  return token === secret || isVercelCron;
}

function isMissingOriginalError(error: string | null) {
  const msg = (error || "").toLowerCase();
  return msg.includes("does not exist") || msg.includes("nosuchkey") || msg.includes("missing key");
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const url = new URL(req.url);
  const limit = Math.min(1000, Math.max(1, Number(url.searchParams.get("limit") || 200)));

  const candidates = await prisma.photo.findMany({
    where: {
      isRemoved: false,
      analysisStatus: "ERROR",
      analysisError: { not: null },
      previewUrl: { not: "" },
    },
    select: { id: true, previewUrl: true, analysisError: true },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  let previewOk = 0;
  let reset = 0;
  let jobsCreated = 0;
  let skipped = 0;

  for (const photo of candidates) {
    if (!isMissingOriginalError(photo.analysisError)) {
      skipped += 1;
      continue;
    }

    const previewUrl = photo.previewUrl;
    if (!previewUrl) {
      skipped += 1;
      continue;
    }

    let ok = false;
    try {
      const res = await fetch(previewUrl, { method: "HEAD" });
      ok = res.ok;
    } catch {
      ok = false;
    }

    if (!ok) {
      skipped += 1;
      continue;
    }

    previewOk += 1;

    const job = await prisma.photoAnalysisJob.findUnique({
      where: { photoId: photo.id },
      select: { id: true },
    });

    if (job) {
      await prisma.photoAnalysisJob.update({
        where: { id: job.id },
        data: {
          status: "PENDING",
          attempts: 0,
          lastError: null,
          runAfter: null,
          lockedAt: null,
        },
      });
    } else {
      await prisma.photoAnalysisJob.create({
        data: { photoId: photo.id, status: "PENDING" },
      });
      jobsCreated += 1;
    }

    await prisma.photo.update({
      where: { id: photo.id },
      data: { analysisStatus: "PENDING", analysisError: null },
    });

    reset += 1;
  }

  return NextResponse.json({
    ok: true,
    scanned: candidates.length,
    previewOk,
    reset,
    jobsCreated,
    skipped,
    limit,
  });
}
