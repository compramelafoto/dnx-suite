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

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const [photoCounts, jobCounts, missingJobs, recentErrors] = await Promise.all([
    prisma.photo.groupBy({
      by: ["analysisStatus"],
      _count: { _all: true },
    }),
    prisma.photoAnalysisJob.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.photo.count({
      where: { analysisJob: null, isRemoved: false },
    }),
    prisma.photoAnalysisJob.findMany({
      where: { status: "ERROR" },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, photoId: true, lastError: true, updatedAt: true },
    }),
  ]);

  return NextResponse.json({
    photos: photoCounts.map((p) => ({ status: p.analysisStatus, count: p._count._all })),
    jobs: jobCounts.map((j) => ({ status: j.status, count: j._count._all })),
    missingJobs,
    recentErrors,
  });
}
