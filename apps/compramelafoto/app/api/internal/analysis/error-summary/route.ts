import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { classifyAnalysisError, type ErrorCategory } from "@/lib/analysis/error-classifier";

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

type ErrorBucket = {
  category: ErrorCategory;
  count: number;
  samples: Array<{ photoId?: number; jobId?: number; message: string | null }>;
};

function initBuckets(): Record<ErrorCategory, ErrorBucket> {
  return {
    missing_original_r2: { category: "missing_original_r2", count: 0, samples: [] },
    rekognition_bytes_too_large_legacy: {
      category: "rekognition_bytes_too_large_legacy",
      count: 0,
      samples: [],
    },
    invalid_image: { category: "invalid_image", count: 0, samples: [] },
    no_original_key: { category: "no_original_key", count: 0, samples: [] },
    other: { category: "other", count: 0, samples: [] },
  };
}

function addSample(
  buckets: Record<ErrorCategory, ErrorBucket>,
  category: ErrorCategory,
  sample: { photoId?: number; jobId?: number; message: string | null },
  sampleLimit: number
) {
  buckets[category].count += 1;
  if (buckets[category].samples.length < sampleLimit) {
    buckets[category].samples.push(sample);
  }
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const url = new URL(req.url);
  const sampleLimit = Math.min(10, Math.max(0, Number(url.searchParams.get("sampleLimit") || 3)));
  const photoLimit = Math.min(2000, Math.max(1, Number(url.searchParams.get("photoLimit") || 800)));
  const jobLimit = Math.min(2000, Math.max(1, Number(url.searchParams.get("jobLimit") || 800)));

  const [photoErrors, jobErrors] = await Promise.all([
    prisma.photo.findMany({
      where: { analysisStatus: "ERROR" },
      select: { id: true, analysisError: true },
      orderBy: { createdAt: "desc" },
      take: photoLimit,
    }),
    prisma.photoAnalysisJob.findMany({
      where: { status: "ERROR" },
      select: { id: true, photoId: true, lastError: true },
      orderBy: { updatedAt: "desc" },
      take: jobLimit,
    }),
  ]);

  const photoBuckets = initBuckets();
  for (const photo of photoErrors) {
    const category = classifyAnalysisError(photo.analysisError);
    addSample(photoBuckets, category, { photoId: photo.id, message: photo.analysisError }, sampleLimit);
  }

  const jobBuckets = initBuckets();
  for (const job of jobErrors) {
    const category = classifyAnalysisError(job.lastError);
    addSample(jobBuckets, category, { jobId: job.id, photoId: job.photoId, message: job.lastError }, sampleLimit);
  }

  return NextResponse.json({
    ok: true,
    photoErrors: Object.values(photoBuckets),
    jobErrors: Object.values(jobBuckets),
    limits: { photoLimit, jobLimit, sampleLimit },
  });
}
