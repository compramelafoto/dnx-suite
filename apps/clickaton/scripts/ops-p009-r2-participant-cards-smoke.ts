/**
 * Smoke R2 staging para placas (put → head → get → checksum → delete).
 *
 *   CLICKATON_PARTICIPANT_CARDS_R2_SMOKE=1 pnpm --filter clickaton exec tsx scripts/ops-p009-r2-participant-cards-smoke.ts
 *
 * Requiere R2_* y prefijo clickaton-staging/participant-cards.
 * Key: clickaton-staging/participant-cards/smoke/<ts>.png
 */
import { createHash } from "node:crypto";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { assertClickatonStagingEnvironment } from "./lib/assert-clickaton-staging-environment";

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`${name} requerido`);
  return v;
}

async function main() {
  if (process.env.CLICKATON_PARTICIPANT_CARDS_R2_SMOKE !== "1") {
    console.error("Set CLICKATON_PARTICIPANT_CARDS_R2_SMOKE=1 to run.");
    process.exit(1);
  }

  // Solo exige DB staging si hay DATABASE_URL; smoke R2 puede correr solo con R2_*.
  if (process.env.DATABASE_URL || process.env.COMMUNICATIONS_STAGING_DATABASE_URL) {
    assertClickatonStagingEnvironment({ throwOnFail: true });
  }

  const prefix =
    process.env.CLICKATON_PARTICIPANT_CARDS_KEY_PREFIX?.trim() ||
    "clickaton-staging/participant-cards";
  if (!prefix.startsWith("clickaton-staging/participant-cards")) {
    throw new Error(
      `Prefijo inválido para smoke staging: ${prefix}. Esperado clickaton-staging/participant-cards`
    );
  }
  if (prefix.includes("clickaton/participant-cards") && !prefix.includes("staging")) {
    throw new Error("Prefijo productivo prohibido en smoke staging");
  }

  const bucket = process.env.R2_BUCKET_NAME?.trim() || process.env.R2_BUCKET?.trim();
  if (!bucket) throw new Error("R2_BUCKET_NAME / R2_BUCKET requerido");
  if (/prod|production|live/i.test(bucket) && !/staging/i.test(bucket)) {
    throw new Error(`Bucket parece productivo: ${bucket}`);
  }

  const endpoint = requireEnv("R2_ENDPOINT");
  const accessKeyId = requireEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = requireEnv("R2_SECRET_ACCESS_KEY");

  const client = new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });

  const key = `${prefix.replace(/\/+$/, "")}/smoke/${Date.now()}.png`;
  if (!key.startsWith("clickaton-staging/participant-cards/smoke/")) {
    throw new Error(`Key smoke inválida: ${key}`);
  }

  const body = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64"
  );
  const expected = createHash("sha256").update(body).digest("hex");
  const metadata = {
    "card-type": "welcome",
    "template-key": "smoke",
    "template-version": "1",
    "render-hash-prefix": "smoke",
    width: "1",
    height: "1",
    "mime-type": "image/png",
    "generated-at": new Date().toISOString(),
  };

  const forbiddenMeta = ["name", "instagram", "email", "city", "payment", "consent"];
  for (const k of Object.keys(metadata)) {
    if (forbiddenMeta.some((f) => k.includes(f))) {
      throw new Error(`Metadata prohibida: ${k}`);
    }
  }

  const result: Record<string, string> = {};

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: "image/png",
      Metadata: metadata,
    })
  );
  result.PUT = "PASS";

  const head = await client.send(
    new HeadObjectCommand({ Bucket: bucket, Key: key })
  );
  if ((head.ContentType ?? "").includes("image/png") === false) {
    throw new Error(`HEAD Content-Type inválido: ${head.ContentType}`);
  }
  if (Number(head.ContentLength ?? 0) !== body.length) {
    throw new Error("HEAD byteSize mismatch");
  }
  result.HEAD = "PASS";

  const got = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key })
  );
  if (!got.Body) throw new Error("GET sin body");
  const bytes = Buffer.from(await got.Body.transformToByteArray());
  const actual = createHash("sha256").update(bytes).digest("hex");
  if (actual !== expected) throw new Error("CHECKSUM mismatch");
  if (!bytes.equals(body)) throw new Error("GET bytes mismatch");
  result.GET = "PASS";
  result.CHECKSUM = "PASS";

  const metaKeys = Object.keys(got.Metadata ?? head.Metadata ?? {});
  const metaJoined = metaKeys.join("|").toLowerCase();
  if (
    metaJoined.includes("email") ||
    metaJoined.includes("instagram") ||
    metaJoined.includes("consent")
  ) {
    throw new Error("METADATA contiene campos prohibidos");
  }
  result.METADATA = "PASS";

  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    throw new Error("DELETE: objeto aún existe");
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    if (name && !/NotFound|NoSuchKey|404/i.test(name + String(err))) {
      // AWS SDK often throws 404 NotFound — treat as success if message mentions NotFound
      if (!/NotFound|NoSuchKey|404|does not exist/i.test(String(err))) {
        throw err;
      }
    }
  }
  result.DELETE = "PASS";

  console.log(
    JSON.stringify(
      {
        ok: true,
        bucket,
        keyPrefix: prefix,
        keyEndsWithSmoke: key.includes("/smoke/"),
        ...result,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
