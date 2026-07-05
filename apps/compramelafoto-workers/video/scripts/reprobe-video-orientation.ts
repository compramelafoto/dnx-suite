/**
 * Recalcula width/height/orientation desde el original en R2 (útil para videos ya procesados).
 *
 * Uso (desde video-worker/):
 *   npx tsx scripts/reprobe-video-orientation.ts --videoId=123
 *   npx tsx scripts/reprobe-video-orientation.ts --albumId=45
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getConfig, loadEnvFiles } from "../src/config.js";
import { probeVideo } from "../src/ffmpeg.js";
import { getPrisma } from "../src/prisma.js";
import { downloadFromR2 } from "../src/r2.js";

function parseArg(name: string): number | null {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  if (!hit) return null;
  const n = Number.parseInt(hit.slice(prefix.length), 10);
  return Number.isFinite(n) ? n : null;
}

async function reprobeOne(videoId: number, config: ReturnType<typeof getConfig>) {
  const prisma = getPrisma();
  const video = await prisma.videoAsset.findUnique({
    where: { id: videoId },
    select: { id: true, albumId: true, originalKey: true, isRemoved: true, processingStatus: true },
  });
  if (!video?.originalKey || video.isRemoved) {
    console.warn("[reprobe] skip", { videoId, reason: "missing or removed" });
    return;
  }

  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), `reprobe-${videoId}-`));
  const localPath = path.join(workDir, "original");

  try {
    await downloadFromR2(config, video.originalKey, localPath);
    const probe = await probeVideo(localPath);

    await prisma.videoAsset.update({
      where: { id: videoId },
      data: {
        width: probe.width,
        height: probe.height,
        orientation: probe.orientation,
        durationSeconds: Math.max(1, Math.round(probe.durationSeconds)),
      },
    });

    console.log("[reprobe] updated", {
      videoId,
      processingStatus: video.processingStatus,
      width: probe.width,
      height: probe.height,
      orientation: probe.orientation,
      rotation: probe.rotationDegrees,
      rawWidth: probe.rawWidth,
      rawHeight: probe.rawHeight,
    });
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function main() {
  loadEnvFiles();
  const config = getConfig();
  const videoId = parseArg("videoId");
  const albumId = parseArg("albumId");

  if (videoId) {
    await reprobeOne(videoId, config);
    return;
  }

  if (albumId) {
    const prisma = getPrisma();
    const rows = await prisma.videoAsset.findMany({
      where: { albumId, isRemoved: false },
      select: { id: true },
      orderBy: { id: "asc" },
    });
    for (const row of rows) {
      await reprobeOne(row.id, config);
    }
    return;
  }

  console.error("Indicá --videoId=<id> o --albumId=<id>");
  process.exit(1);
}

main().catch((err) => {
  console.error("[reprobe] fatal", err);
  process.exit(1);
});
