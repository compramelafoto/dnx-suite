/**
 * Smoke R2 Production (10D.1.1B) — solo runtime Vercel (vars Sensitive no pullables).
 * Auth: Bearer CRON_SECRET | CLICKATON_CRON_SECRET, o header x-vercel-cron (mismo patrón que otros crons).
 * No imprime secretos. No abre inscripciones. No publica redes.
 */
import { randomUUID } from "node:crypto";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { CLICKATON_WELCOME_STORY_V1, renderComposition } from "@repo/media-composition";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { getWelcomeCardStorage } from "@/lib/welcome-card/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const secret =
    process.env.CRON_SECRET?.trim() || process.env.CLICKATON_CRON_SECRET?.trim();
  const auth = request.headers.get("authorization");
  const vercelCron = request.headers.get("x-vercel-cron");
  return (
    (Boolean(secret) && auth === `Bearer ${secret}`) ||
    (process.env.VERCEL === "1" && vercelCron === "1")
  );
}

function presence(name: string): "PRESENT" | "MISSING" {
  return process.env[name]?.trim() ? "PRESENT" : "MISSING";
}

async function syntheticJpegFixture(): Promise<Buffer> {
  // Fixture sintético (no foto real).
  return sharp({
    create: {
      width: 320,
      height: 320,
      channels: 3,
      background: { r: 212, g: 175, b: 55 },
    },
  })
    .jpeg({ quality: 80 })
    .toBuffer();
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const social = process.env.DNX_SOCIAL_PUBLISHER_LIVE?.trim() ?? "";
  const envReport = {
    R2_ACCOUNT_ID: presence("R2_ACCOUNT_ID"),
    R2_ACCESS_KEY_ID: presence("R2_ACCESS_KEY_ID"),
    R2_SECRET_ACCESS_KEY: presence("R2_SECRET_ACCESS_KEY"),
    R2_ENDPOINT: presence("R2_ENDPOINT"),
    R2_BUCKET: presence("R2_BUCKET"),
    R2_BUCKET_NAME: presence("R2_BUCKET_NAME"),
    R2_REGION: presence("R2_REGION"),
    R2_PUBLIC_URL: presence("R2_PUBLIC_URL"),
  };

  const bucket =
    process.env.R2_BUCKET_NAME?.trim() || process.env.R2_BUCKET?.trim() || "";
  const endpoint = process.env.R2_ENDPOINT?.trim() || "";
  const region = process.env.R2_REGION?.trim() || "";
  const accountId = process.env.R2_ACCOUNT_ID?.trim() || "";
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim() || "";
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim() || "";

  const checks = {
    bucketEqClickatonMedia: bucket === "clickaton-media",
    bucketNameEqClickatonMedia:
      (process.env.R2_BUCKET_NAME?.trim() || "") === "clickaton-media",
    bucketAliasEqClickatonMedia: (process.env.R2_BUCKET?.trim() || "") === "clickaton-media",
    regionEqAuto: region === "auto",
    endpointFormatValid:
      endpoint.startsWith("https://") && endpoint.includes("r2.cloudflarestorage.com"),
    endpointSanitized: endpoint
      ? `https://${endpoint.replace(/^https?:\/\//, "").slice(0, 8)}….r2.cloudflarestorage.com`
      : null,
    accountSanitized: accountId ? `${accountId.slice(0, 8)}…` : null,
    socialPublisherLive: social === "" ? "MISSING" : social,
  };

  const missing = Object.entries(envReport)
    .filter(([k, v]) => k !== "R2_PUBLIC_URL" && v === "MISSING")
    .map(([k]) => k);

  if (missing.length > 0) {
    return NextResponse.json({
      ok: false,
      verdict: "R2_PRODUCTION_ENV_MISSING",
      env: envReport,
      checks,
      missing,
    });
  }

  if (
    !checks.bucketEqClickatonMedia ||
    !checks.regionEqAuto ||
    !checks.endpointFormatValid
  ) {
    return NextResponse.json({
      ok: false,
      verdict: "R2_PRODUCTION_CONFIG_MISMATCH",
      env: envReport,
      checks,
    });
  }

  const client = new S3Client({
    region: region || "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });

  const key = `clickaton/production/smoke/${randomUUID()}.txt`;
  const body = Buffer.from(
    `clickaton-r2-prod-smoke ${new Date().toISOString()}\n`,
    "utf8",
  );

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: "text/plain; charset=utf-8",
      }),
    );
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    const got = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const bytes = Buffer.from(await got.Body!.transformToByteArray());
    if (!bytes.equals(body)) {
      throw new Error("GET_BODY_MISMATCH");
    }
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    let gone = false;
    try {
      await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      gone =
        name === "NotFound" ||
        name === "NoSuchKey" ||
        /not\s*found|404|NoSuchKey/i.test(String(error));
    }
    if (!gone) throw new Error("DELETE_NOT_CONFIRMED");

    // Welcome path: render fixture + put/get/delete via app storage adapter
    const storage = getWelcomeCardStorage();
    const backend =
      "backend" in storage && typeof (storage as { backend?: unknown }).backend === "string"
        ? String((storage as { backend: string }).backend)
        : "UNKNOWN";
    if (backend !== "R2") {
      return NextResponse.json({
        ok: false,
        verdict: "R2_PRODUCTION_CREDENTIALS_INVALID",
        env: envReport,
        checks,
        smoke: { putHeadGetDelete: "PASS", deleted: true },
        welcome: {
          ok: false,
          reason: `STORAGE_NOT_R2:${backend}`,
        },
      });
    }

    const photo = await syntheticJpegFixture();
    const output = await renderComposition({
      template: CLICKATON_WELCOME_STORY_V1,
      variables: {
        participantName: "Participante TEST",
        instagram: "clickaton_test",
        participantNumber: "CKA26-SMOKE",
        city: "Córdoba",
        province: "Córdoba",
        editionName: "Clickatón Argentina 2026",
        editionDate: "19/09/2026",
      },
      assets: { photo },
      crop: {
        cropX: 0,
        cropY: 0,
        zoom: 1,
        rotation: 0,
        boundingBox: null,
        strategy: "CENTER",
      },
    });

    const stored = await storage.put({
      namespace: "welcome",
      extension: "png",
      body: output.png,
      contentType: "image/png",
    });
    if (!stored.key.startsWith("clickaton/welcome/")) {
      throw new Error("WELCOME_KEY_PREFIX_INVALID");
    }
    const readBack = await storage.get(stored.key);
    if (readBack.length !== stored.bytes) {
      throw new Error("WELCOME_READ_SIZE_MISMATCH");
    }
    await client.send(
      new DeleteObjectCommand({ Bucket: bucket, Key: stored.key }),
    );

    return NextResponse.json({
      ok: true,
      verdict: "CLICKATON_PRODUCTION_STORAGE_READY",
      deployHint: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ?? null,
      env: envReport,
      checks,
      smoke: {
        putHeadGetDelete: "PASS",
        deleted: true,
        keyPrefix: "clickaton/production/smoke/",
      },
      welcome: {
        ok: true,
        storageBackend: backend,
        renderedBytes: output.png.length,
        uploadedKeyPrefix: "clickaton/welcome/",
        readBytes: readBack.length,
        deleted: true,
        socialPublisherLive: checks.socialPublisherLive,
      },
      note: "No Instagram publish. No registration open. No secrets in response.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code =
      /AccessDenied|InvalidAccessKeyId|SignatureDoesNotMatch|credentials/i.test(
        message,
      )
        ? "R2_PRODUCTION_CREDENTIALS_INVALID"
        : "PRODUCTION_STORAGE_BLOCKED";
    return NextResponse.json(
      {
        ok: false,
        verdict: code,
        env: envReport,
        checks,
        error: message.slice(0, 200),
      },
      { status: 500 },
    );
  }
}
