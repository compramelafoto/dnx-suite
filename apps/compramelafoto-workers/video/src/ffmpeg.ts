import { execa } from "execa";
import fs from "node:fs/promises";
import path from "node:path";
import { createWatermarkOverlayFile } from "./watermark.js";

export type VideoProbe = {
  durationSeconds: number;
  width: number;
  height: number;
  orientation: "portrait" | "landscape" | "square";
  rawWidth: number;
  rawHeight: number;
  rotationDegrees: number;
};

type FfprobeSideData = {
  side_data_type?: string;
  rotation?: number;
};

type FfprobeStream = {
  codec_type?: string;
  width?: number;
  height?: number;
  tags?: { rotate?: string };
  side_data_list?: FfprobeSideData[];
};

type FfprobeJson = {
  format?: { duration?: string };
  streams?: FfprobeStream[];
};

/** Grados de rotación de display matrix / tag rotate (0, 90, 180, 270, -90, etc.). */
export function parseVideoRotationDegrees(stream: FfprobeStream): number {
  for (const sd of stream.side_data_list ?? []) {
    if (typeof sd.rotation === "number" && Number.isFinite(sd.rotation)) {
      return sd.rotation;
    }
  }
  const tagRotate = stream.tags?.rotate;
  if (tagRotate != null && tagRotate !== "") {
    const n = Number.parseInt(String(tagRotate), 10);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

/** Dimensiones visuales tras aplicar rotación 90°/270°. */
export function visualDimensionsFromRaw(
  rawWidth: number,
  rawHeight: number,
  rotationDegrees: number
): { visualWidth: number; visualHeight: number } {
  const rot = ((Math.round(rotationDegrees) % 360) + 360) % 360;
  if (rot === 90 || rot === 270) {
    return { visualWidth: rawHeight, visualHeight: rawWidth };
  }
  return { visualWidth: rawWidth, visualHeight: rawHeight };
}

function orientationFromVisualDimensions(
  visualWidth: number,
  visualHeight: number
): VideoProbe["orientation"] {
  const ratio = visualWidth / visualHeight;
  if (ratio > 1.08) return "landscape";
  if (ratio < 0.92) return "portrait";
  return "square";
}

/** Fuerza dimensiones pares para libx264. */
const EVEN_DIMENSIONS_SCALE = "scale=trunc(iw/2)*2:trunc(ih/2)*2";

export type ScaleFilterOptions = {
  videoId?: number;
  orientation?: VideoProbe["orientation"];
  rotationDegrees?: number;
};

/** Corrige píxeles según metadata de rotación del original (celular). */
export function buildRotationFilter(rotationDegrees: number): string | null {
  const rot = ((Math.round(rotationDegrees) % 360) + 360) % 360;
  if (rot === 90) return "transpose=1";
  if (rot === 270) return "transpose=2";
  if (rot === 180) return "transpose=2,transpose=2";
  return null;
}

/**
 * Filtro de preview/thumbnail según orientación visual (ffprobe + rotación).
 * Sin comillas anidadas: un solo string para `-vf` vía execa.
 */
export function buildPreviewScaleFilter(
  orientation: VideoProbe["orientation"],
  rotationDegrees = 0
): string {
  const rotate = buildRotationFilter(rotationDegrees);
  const primary =
    orientation === "landscape"
      ? "scale=-2:720"
      : orientation === "portrait"
        ? "scale=720:-2"
        : "scale=720:720";
  const parts = [rotate, primary, EVEN_DIMENSIONS_SCALE].filter(Boolean);
  return parts.join(",");
}

function logScaleFilter(
  videoId: number | undefined,
  orientation: VideoProbe["orientation"],
  filter: string
): void {
  console.log("[video-worker] ffmpeg scale filter", { videoId, orientation, filter });
}

async function resolveScaleFilter(
  inputPath: string,
  opts?: ScaleFilterOptions
): Promise<{
  filter: string;
  orientation: VideoProbe["orientation"];
  rotationDegrees: number;
}> {
  const probed = await probeVideo(inputPath);
  const orientation = opts?.orientation ?? probed.orientation;
  const rotationDegrees = opts?.rotationDegrees ?? probed.rotationDegrees;
  const filter = buildPreviewScaleFilter(orientation, rotationDegrees);
  logScaleFilter(opts?.videoId, orientation, filter);
  return { filter, orientation, rotationDegrees };
}

export async function assertFfmpegAvailable(): Promise<void> {
  await execa("ffmpeg", ["-version"]);
  await execa("ffprobe", ["-version"]);
}

export async function probeVideo(inputPath: string): Promise<VideoProbe> {
  const { stdout } = await execa("ffprobe", [
    "-v",
    "quiet",
    "-print_format",
    "json",
    "-show_format",
    "-show_streams",
    inputPath,
  ]);

  const data = JSON.parse(stdout) as FfprobeJson;
  const videoStream = data.streams?.find((s) => s.codec_type === "video");
  if (!videoStream?.width || !videoStream?.height) {
    throw new Error("No se encontró stream de video en el archivo");
  }

  const durationRaw = Number(data.format?.duration ?? 0);
  const durationSeconds = Number.isFinite(durationRaw) && durationRaw > 0 ? durationRaw : 0;
  if (durationSeconds <= 0) {
    throw new Error("Duración de video inválida");
  }

  const rawWidth = videoStream.width;
  const rawHeight = videoStream.height;
  const rotationDegrees = parseVideoRotationDegrees(videoStream);
  const { visualWidth, visualHeight } = visualDimensionsFromRaw(
    rawWidth,
    rawHeight,
    rotationDegrees
  );
  const orientation = orientationFromVisualDimensions(visualWidth, visualHeight);

  console.log("[video-worker] ffprobe orientation", {
    rawWidth,
    rawHeight,
    rotation: rotationDegrees,
    visualWidth,
    visualHeight,
    orientation,
  });

  return {
    durationSeconds: Math.round(durationSeconds * 100) / 100,
    width: visualWidth,
    height: visualHeight,
    orientation,
    rawWidth,
    rawHeight,
    rotationDegrees,
  };
}

export function thumbnailSeekSeconds(duration: number): number {
  if (duration < 2) return 0.5;
  if (duration < 5) return Math.min(1, duration * 0.2);
  return Math.max(0.5, duration * 0.1);
}

export async function generateThumbnail(
  inputPath: string,
  outputPath: string,
  duration: number,
  scaleOpts?: ScaleFilterOptions
): Promise<void> {
  const { filter: scaleFilter } = await resolveScaleFilter(inputPath, scaleOpts);
  const ss = thumbnailSeekSeconds(duration);
  await execa(
    "ffmpeg",
    [
      "-y",
      "-ss",
      String(ss),
      "-i",
      inputPath,
      "-frames:v",
      "1",
      "-vf",
      scaleFilter,
      "-q:v",
      "5",
      outputPath,
    ],
    { stdio: "pipe" }
  );
}

export type FragmentPlan = {
  count: number;
  fragSeconds: number;
  starts: number[];
};

/**
 * Preview fragmentada:
 * - >= 30s: 5 × 3s (~15s)
 * - 12–30s: 3 × 3s (~9s)
 * - < 12s: 3 fragmentos (o menos si no entra), duración acotada al video
 */
export function buildFragmentPlan(duration: number): FragmentPlan {
  const minStart = Math.min(0.5, Math.max(0, duration * 0.05));
  const headroom = Math.max(0, duration - minStart - 0.05);

  let count: number;
  let fragSeconds: number;

  if (duration >= 30) {
    count = 5;
    fragSeconds = 3;
  } else if (duration >= 12) {
    count = 3;
    fragSeconds = 3;
  } else {
    count = 3;
    if (headroom < 1.2) {
      count = headroom >= 0.7 ? 2 : 1;
    }
    fragSeconds =
      count > 0 ? Math.min(2, headroom / count) : Math.min(2, headroom);
    fragSeconds = Math.max(0.35, Math.round(fragSeconds * 100) / 100);

    while (count > 1 && count * fragSeconds > headroom + 0.01) {
      count -= 1;
      fragSeconds = Math.max(0.35, Math.round((headroom / count) * 100) / 100);
    }

    if (fragSeconds > duration - minStart) {
      fragSeconds = Math.max(0.35, Math.round((duration - minStart - 0.05) * 100) / 100);
    }
  }

  const maxStart = Math.max(minStart, duration - fragSeconds);
  const starts: number[] = [];

  for (let i = 0; i < count; i++) {
    const t =
      count === 1 ? minStart : minStart + ((maxStart - minStart) * i) / (count - 1);
    const clamped = Math.min(t, Math.max(minStart, duration - fragSeconds));
    starts.push(Math.round(clamped * 1000) / 1000);
  }

  return { count, fragSeconds, starts };
}

export async function extractFragment(
  inputPath: string,
  outputPath: string,
  startSeconds: number,
  durationSeconds: number,
  scaleFilter: string
): Promise<void> {
  await execa(
    "ffmpeg",
    [
      "-y",
      "-ss",
      String(startSeconds),
      "-i",
      inputPath,
      "-t",
      String(durationSeconds),
      "-vf",
      scaleFilter,
      "-an",
      "-c:v",
      "libx264",
      "-preset",
      "fast",
      "-crf",
      "23",
      "-movflags",
      "+faststart",
      outputPath,
    ],
    { stdio: "pipe" }
  );
}

export async function concatFragments(fragmentPaths: string[], outputPath: string): Promise<void> {
  const listPath = `${outputPath}.concat.txt`;
  const lines = fragmentPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n");
  await fs.writeFile(listPath, lines, "utf8");

  try {
    await execa(
      "ffmpeg",
      [
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        listPath,
        "-an",
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-crf",
        "23",
        "-movflags",
        "+faststart",
        outputPath,
      ],
      { stdio: "pipe" }
    );
  } finally {
    await fs.unlink(listPath).catch(() => undefined);
  }
}

export async function applyWatermarkToPreview(
  inputPath: string,
  outputPath: string,
  videoId: number,
  workDir: string
): Promise<void> {
  const mergedProbe = await probeVideo(inputPath);
  const watermarkPath = path.join(workDir, "watermark.png");

  await createWatermarkOverlayFile({
    videoId,
    width: mergedProbe.width,
    height: mergedProbe.height,
    outputPath: watermarkPath,
  });

  await execa(
    "ffmpeg",
    [
      "-y",
      "-i",
      inputPath,
      "-i",
      watermarkPath,
      "-filter_complex",
      "[0:v][1:v]overlay=0:0:format=auto",
      "-an",
      "-c:v",
      "libx264",
      "-preset",
      "fast",
      "-crf",
      "23",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      outputPath,
    ],
    { stdio: "pipe" }
  );

  const previewProbe = await probeVideo(outputPath);
  console.log("[video-worker] preview dimensions", {
    videoId,
    previewWidth: previewProbe.width,
    previewHeight: previewProbe.height,
    orientation: previewProbe.orientation,
    rawWidth: previewProbe.rawWidth,
    rawHeight: previewProbe.rawHeight,
    rotation: previewProbe.rotationDegrees,
  });

  console.log("[video-worker] watermark overlay applied", { videoId });
}

export async function buildPreviewMp4(
  inputPath: string,
  workDir: string,
  duration: number,
  videoId: number,
  scaleOpts?: ScaleFilterOptions
): Promise<string> {
  const { filter: scaleFilter } = await resolveScaleFilter(inputPath, {
    ...scaleOpts,
    videoId: scaleOpts?.videoId ?? videoId,
  });

  const plan = buildFragmentPlan(duration);
  const fragmentPaths: string[] = [];

  for (let i = 0; i < plan.count; i++) {
    const fragPath = path.join(workDir, `frag-${i}.mp4`);
    await extractFragment(inputPath, fragPath, plan.starts[i]!, plan.fragSeconds, scaleFilter);
    fragmentPaths.push(fragPath);
  }

  const mergedPath = path.join(workDir, "merged.mp4");
  await concatFragments(fragmentPaths, mergedPath);

  const previewPath = path.join(workDir, "preview.mp4");
  await applyWatermarkToPreview(mergedPath, previewPath, videoId, workDir);

  return previewPath;
}
