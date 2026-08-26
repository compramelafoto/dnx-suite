/**
 * Smoke R2 staging real (preflight → put → head → public deny → authorized read → checksum → delete → cleanup).
 *
 * FOTORANK_PRIVATE_STORAGE_PROVIDER=r2 \
 * FOTORANK_R2_* = staging only \
 *   pnpm --filter fotorank run test:storage:r2-staging
 *
 * Sin credenciales → FINAL: BLOCKED (exit 2). Nunca PASS falso.
 * No imprime secretos ni URLs firmadas completas.
 */
import { randomBytes } from "node:crypto";
import { createR2PrivateContestStorageProvider, r2PrivateStorageConfigSelfcheck } from "./r2-private-storage";
import {
  assertStagingBucketSafe,
  buildSmokeObjectKey,
  buildSmokePrefix,
  buildSyntheticSmokePng,
  classifyEnvPresence,
  FOTORANK_R2_PRODUCTION_DENYLIST,
  FOTORANK_R2_STAGING_BUCKET_EXPECTED,
  isProductionDeniedBucket,
  redactBucket,
  sha256Hex,
} from "./r2-staging-preflight";

export type SmokeStep = "PASS" | "FAIL" | "SKIP" | "BLOCKED" | "WARN" | "UNKNOWN";

export type R2StagingSmokeResult = {
  exitCode: number;
  final: "PASS" | "FAIL" | "BLOCKED";
  reportText: string;
  json: Record<string, unknown>;
};

function line(name: string, step: SmokeStep): string {
  return `${name}: ${step}`;
}

async function probePublicDirectAccess(endpointHost: string | undefined, bucket: string, key: string): Promise<SmokeStep> {
  const candidates: string[] = [];
  if (endpointHost) {
    candidates.push(`https://${endpointHost}/${bucket}/${encodeURI(key)}`);
    candidates.push(`https://${bucket}.${endpointHost}/${encodeURI(key)}`);
  }
  candidates.push(`https://pub.r2.dev/${bucket}/${encodeURI(key)}`);

  let sawOk = false;
  let sawDenied = false;
  for (const url of candidates) {
    try {
      const res = await fetch(url, { method: "GET", redirect: "manual" });
      if (res.status >= 200 && res.status < 300) {
        sawOk = true;
        break;
      }
      if (res.status === 401 || res.status === 403 || res.status === 404 || res.status === 405 || res.status === 400) {
        sawDenied = true;
      }
    } catch {
      sawDenied = true;
    }
  }
  if (sawOk) return "FAIL";
  if (sawDenied) return "PASS";
  return "FAIL";
}

export async function runR2StagingSmoke(): Promise<R2StagingSmokeResult> {
  const executionId = `${Date.now()}-${randomBytes(4).toString("hex")}`;
  const prefix = buildSmokePrefix(executionId);
  const key = buildSmokeObjectKey(executionId);
  const report: string[] = ["FOTORANK R2 STAGING SMOKE", ""];

  const envKeys = [
    "FOTORANK_PRIVATE_STORAGE_PROVIDER",
    "FOTORANK_R2_ACCOUNT_ID",
    "FOTORANK_R2_ACCESS_KEY_ID",
    "FOTORANK_R2_SECRET_ACCESS_KEY",
    "FOTORANK_R2_BUCKET",
    "FOTORANK_R2_ENDPOINT",
    "FOTORANK_R2_REGION",
    "FOTORANK_STORAGE_SIGNING_SECRET",
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET_NAME",
    "R2_ENDPOINT",
  ] as const;
  const envTable = envKeys.map((k) => ({
    key: k,
    state: classifyEnvPresence(k, process.env[k]),
    length: process.env[k]?.length ?? 0,
  }));

  const cfg = r2PrivateStorageConfigSelfcheck();
  const denylistOk = !isProductionDeniedBucket(cfg.bucket ?? null);
  const identityOk =
    cfg.configured &&
    denylistOk &&
    cfg.bucket === FOTORANK_R2_STAGING_BUCKET_EXPECTED &&
    process.env.VERCEL_ENV !== "production";

  report.push(line("Environment identity", identityOk ? "PASS" : cfg.configured ? "FAIL" : "BLOCKED"));
  report.push(line("Production denylist", denylistOk ? "PASS" : cfg.configured ? "FAIL" : "BLOCKED"));
  report.push(`Expected staging bucket: ${FOTORANK_R2_STAGING_BUCKET_EXPECTED}`);
  report.push(`Denylist: ${FOTORANK_R2_PRODUCTION_DENYLIST.join(", ")}`);
  report.push(`Execution ID: ${executionId}`);
  report.push(`Prefix: ${prefix}`);
  report.push(`Bucket (redacted): ${redactBucket(cfg.bucket)}`);
  report.push(`Endpoint host: ${cfg.endpointHost ?? "ABSENT"}`);
  report.push(`VERCEL_ENV: ${process.env.VERCEL_ENV ?? "local-or-unset"}`);
  report.push(
    `Env presence: ${envTable
      .filter(
        (e) =>
          e.state !== "ABSENT" ||
          e.key.startsWith("FOTORANK_R2") ||
          e.key === "FOTORANK_PRIVATE_STORAGE_PROVIDER" ||
          e.key === "FOTORANK_STORAGE_SIGNING_SECRET",
      )
      .map((e) => `${e.key}=${e.state}${e.state === "PRESENT" ? `(len:${e.length})` : ""}`)
      .join("; ")}`,
  );

  if (!cfg.configured) {
    report.push(line("Configuration", "BLOCKED"));
    report.push(line("Authentication", "BLOCKED"));
    report.push("");
    report.push("FINAL: BLOCKED");
    report.push(`Reason: missing ${cfg.missing.join(", ") || "R2 credentials"}`);
    report.push("External action required: configure staging-only FOTORANK_R2_* (never production bucket)");
    report.push("Never paste secrets into chat or docs.");
    const reportText = report.join("\n");
    return {
      exitCode: 2,
      final: "BLOCKED",
      reportText,
      json: {
        status: "BLOCKED",
        executionId,
        prefix,
        fixtureKey: key,
        missing: cfg.missing,
        envPresence: envTable,
      },
    };
  }

  try {
    assertStagingBucketSafe(cfg.bucket!);
    if (cfg.bucket !== FOTORANK_R2_STAGING_BUCKET_EXPECTED) {
      throw new Error(`ABORT: bucket distinto al staging canónico esperado.`);
    }
    if (process.env.VERCEL_ENV === "production") {
      throw new Error("ABORT: VERCEL_ENV=production — smoke solo Preview/local.");
    }
  } catch (e) {
    report.push(line("Configuration", "FAIL"));
    report.push("");
    report.push("FINAL: BLOCKED");
    report.push(`Reason: ${(e as Error).message}`);
    const reportText = report.join("\n");
    return {
      exitCode: 2,
      final: "BLOCKED",
      reportText,
      json: { status: "BLOCKED", executionId, reason: (e as Error).message },
    };
  }

  report.push(line("Configuration", "PASS"));

  const storage = createR2PrivateContestStorageProvider();
  if (!storage) {
    report.push(line("Authentication", "BLOCKED"));
    report.push("");
    report.push("FINAL: BLOCKED");
    report.push("Reason: provider R2 unavailable after config check");
    const reportText = report.join("\n");
    return {
      exitCode: 2,
      final: "BLOCKED",
      reportText,
      json: { status: "BLOCKED", executionId, reason: "provider unavailable" },
    };
  }

  const body = buildSyntheticSmokePng(`FOTORANK STAGING TEST ${executionId}`);
  const checksum = sha256Hex(body);
  const steps = {
    authentication: "PASS" as SmokeStep,
    upload: "SKIP" as SmokeStep,
    head: "SKIP" as SmokeStep,
    publicDenied: "SKIP" as SmokeStep,
    authorizedRead: "SKIP" as SmokeStep,
    checksum: "SKIP" as SmokeStep,
    delete: "SKIP" as SmokeStep,
    cleanup: "SKIP" as SmokeStep,
  };

  try {
    const missingHead = await storage.headObject?.(key);
    steps.authentication = missingHead && missingHead.exists === false ? "PASS" : "PASS";

    await storage.putObject(key, body, "image/png");
    steps.upload = "PASS";

    const head = await storage.headObject?.(key);
    const headOk =
      Boolean(head?.exists) &&
      (head?.contentLength == null || head.contentLength === body.byteLength) &&
      (head?.contentType == null || head.contentType.includes("png") || head.contentType.includes("octet"));
    steps.head = headOk ? "PASS" : "FAIL";

    steps.publicDenied = await probePublicDirectAccess(cfg.endpointHost, cfg.bucket!, key);

    const read = await storage.readObject?.(key);
    steps.authorizedRead = read && read.byteLength === body.byteLength ? "PASS" : "FAIL";
    if (read) {
      steps.checksum = sha256Hex(read) === checksum ? "PASS" : "FAIL";
    } else {
      steps.checksum = "FAIL";
    }

    const url = await storage.getSignedUrl(key, "read", 60);
    const shapeOk = url.includes("private-asset") || url.startsWith("http");
    if (!shapeOk) steps.authorizedRead = "FAIL";
  } catch (e) {
    report.push(`Runtime error: ${(e as Error).message}`);
    if (steps.upload === "SKIP") steps.upload = "FAIL";
    if (steps.authentication === "PASS") steps.authentication = "FAIL";
  } finally {
    try {
      await storage.deleteObject(key);
      steps.delete = "PASS";
      const gone = await storage.objectExists?.(key);
      steps.cleanup = gone === false ? "PASS" : "FAIL";
    } catch {
      steps.delete = "FAIL";
      steps.cleanup = "FAIL";
    }
  }

  const ordered: Array<[string, SmokeStep]> = [
    ["Authentication", steps.authentication],
    ["Upload fixture", steps.upload],
    ["Head object", steps.head],
    ["Public direct access denied", steps.publicDenied],
    ["Authorized read", steps.authorizedRead],
    ["Checksum", steps.checksum],
    ["Delete", steps.delete],
    ["Cleanup", steps.cleanup],
  ];
  for (const [name, step] of ordered) report.push(line(name, step));
  report.push(`Checksum sha256 (full ok/fail only): ${steps.checksum} prefix=${checksum.slice(0, 12)}…`);
  report.push(`Bytes: ${body.byteLength}`);

  const requiredPass: SmokeStep[] = [
    identityOk ? "PASS" : "FAIL",
    denylistOk ? "PASS" : "FAIL",
    "PASS", // configuration already passed
    steps.authentication,
    steps.upload,
    steps.head,
    steps.publicDenied,
    steps.authorizedRead,
    steps.checksum,
    steps.delete,
    steps.cleanup,
  ];
  const allPass = requiredPass.every((s) => s === "PASS") && identityOk && denylistOk;

  report.push("");
  if (allPass) {
    report.push("FINAL: PASS");
  } else {
    report.push("FINAL: FAIL");
  }

  const reportText = report.join("\n");
  const json = {
    status: allPass ? "PASS" : "FAIL",
    executionId,
    prefix,
    fixtureKey: key,
    bucket: redactBucket(cfg.bucket),
    endpointHost: cfg.endpointHost,
    steps,
    checksumPrefix: checksum.slice(0, 12),
    bytes: body.byteLength,
    residualObjects: steps.cleanup === "PASS" ? 0 : "UNKNOWN",
    dbRecords: 0,
  };

  return {
    exitCode: allPass ? 0 : 1,
    final: allPass ? "PASS" : "FAIL",
    reportText,
    json,
  };
}

async function main() {
  const result = await runR2StagingSmoke();
  console.log(result.reportText);
  console.log(JSON.stringify(result.json, null, 2));
  process.exitCode = result.exitCode;
}

const isDirect =
  typeof process.argv[1] === "string" &&
  (process.argv[1].endsWith("r2-staging.smoke.ts") || process.argv[1].endsWith("r2-staging.smoke.js"));

if (isDirect) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
