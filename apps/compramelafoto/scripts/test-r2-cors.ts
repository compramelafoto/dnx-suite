/**
 * Prueba CORS del bucket R2 para subida directa de fotos (PUT desde el navegador).
 *
 * Simula lo que hace el dashboard en el paso 2 de la subida:
 *   OPTIONS (preflight) + PUT con header Origin
 *
 * Uso:
 *   npm run test:r2-cors
 *   npm run test:r2-cors -- --origin https://compramelafoto.com
 *   npm run test:r2-cors -- --origin https://compramelafoto.com --origin http://localhost:3000
 *
 * Requiere variables R2 en .env.local (mismas que test:r2).
 */

import { config } from "dotenv";
import crypto from "crypto";
import fs from "fs";
import path from "path";

config({ path: ".env.local" });
config({ path: ".env" });

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
} as const;

function log(message: string, color: keyof typeof colors = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function parseOrigins(argv: string[]): string[] {
  const origins: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--origin" && argv[i + 1]) {
      origins.push(argv[i + 1]);
      i += 1;
    }
  }
  return origins;
}

function loadDefaultOrigins(): string[] {
  const policyPath = path.join(process.cwd(), "config", "r2-cors-policy.json");
  try {
    const raw = fs.readFileSync(policyPath, "utf8");
    const parsed = JSON.parse(raw) as Array<{ AllowedOrigins?: string[] }>;
    const fromPolicy = parsed.flatMap((rule) => rule.AllowedOrigins ?? []);
    if (fromPolicy.length > 0) return [...new Set(fromPolicy)];
  } catch {
    /* usar fallback */
  }
  return [
    "https://compramelafoto.com",
    "https://www.compramelafoto.com",
    "http://localhost:3000",
  ];
}

function headerValue(headers: Headers, name: string): string | null {
  return headers.get(name) ?? headers.get(name.toLowerCase());
}

function allowsMethod(allowMethods: string | null, method: string): boolean {
  if (!allowMethods) return false;
  return allowMethods
    .split(",")
    .map((m) => m.trim().toUpperCase())
    .includes(method.toUpperCase());
}

function allowsOrigin(allowOrigin: string | null, origin: string): boolean {
  if (!allowOrigin) return false;
  if (allowOrigin === "*") return true;
  return allowOrigin === origin;
}

/** JPEG mínimo válido (~160 bytes) */
const MINI_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxISEhUQEhIVFhUVFRUVFRUVFRUWFxUXFhUYHSggGBolGxUVITEhJSkrLi4uFx8zODMtNygtLisBCgoKDg0OGxAQGy0lHyUtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAAEAAQMBIgACEQEDEQH/xAAbAAACAwEBAQAAAAAAAAAAAAADBAECBQYAB//EADAQAAIBAwMCBQMDBAMAAAAAAAECAwAEERIhMQVBBhMiUWFxMoGRobHB0fDx/8QAGQEAAwEBAQAAAAAAAAAAAAAAAAECAwQF/8QAIhEBAQACAgMBAQEBAQAAAAAAAAERAgMhMRIEQVEiMmFx/9oADAMBAAIRAxEAPwD9KKKKKAP/2Q==",
  "base64"
);

type OriginResult = {
  origin: string;
  preflightOk: boolean;
  putOk: boolean;
  preflightStatus: number;
  putStatus: number;
  allowOrigin: string | null;
  allowMethods: string | null;
  issues: string[];
};

async function testOrigin(uploadUrl: string, origin: string): Promise<OriginResult> {
  const issues: string[] = [];
  let preflightStatus = 0;
  let putStatus = 0;
  let allowOrigin: string | null = null;
  let allowMethods: string | null = null;

  try {
    const preflightRes = await fetch(uploadUrl, {
      method: "OPTIONS",
      headers: {
        Origin: origin,
        "Access-Control-Request-Method": "PUT",
        "Access-Control-Request-Headers": "content-type",
      },
    });
    preflightStatus = preflightRes.status;
    allowOrigin = headerValue(preflightRes.headers, "access-control-allow-origin");
    allowMethods = headerValue(preflightRes.headers, "access-control-allow-methods");

    if (preflightStatus >= 400) {
      issues.push(`Preflight OPTIONS respondió ${preflightStatus}`);
    }
    if (!allowsOrigin(allowOrigin, origin)) {
      issues.push(
        `Access-Control-Allow-Origin no incluye este origen (recibido: ${allowOrigin ?? "ausente"})`
      );
    }
    if (!allowsMethod(allowMethods, "PUT")) {
      issues.push(
        `Access-Control-Allow-Methods no incluye PUT (recibido: ${allowMethods ?? "ausente"})`
      );
    }
  } catch (err: unknown) {
    issues.push(
      `Preflight falló: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  const preflightOk =
    preflightStatus < 400 &&
    allowsOrigin(allowOrigin, origin) &&
    allowsMethod(allowMethods, "PUT");

  try {
    const putRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        Origin: origin,
        "Content-Type": "image/jpeg",
      },
      body: MINI_JPEG,
    });
    putStatus = putRes.status;
    if (!putRes.ok) {
      issues.push(`PUT respondió ${putStatus} ${putRes.statusText}`);
    }
  } catch (err: unknown) {
    issues.push(`PUT falló: ${err instanceof Error ? err.message : String(err)}`);
  }

  const putOk = putStatus >= 200 && putStatus < 300;

  return {
    origin,
    preflightOk,
    putOk,
    preflightStatus,
    putStatus,
    allowOrigin,
    allowMethods,
    issues,
  };
}

async function main() {
  const argvOrigins = parseOrigins(process.argv.slice(2));
  const origins = argvOrigins.length > 0 ? argvOrigins : loadDefaultOrigins();

  log("\n🔍 Prueba de CORS R2 (subida directa PUT desde navegador)\n", "cyan");

  const bucketName = process.env.R2_BUCKET_NAME || process.env.R2_BUCKET;
  if (!process.env.R2_ENDPOINT || !bucketName || !process.env.R2_ACCESS_KEY_ID) {
    log("❌ Faltan variables R2. Configurá .env.local (ver R2_SETUP.md).", "red");
    process.exit(1);
  }

  log(`Bucket: ${bucketName}`, "blue");
  log(`Orígenes a probar: ${origins.join(", ")}\n`, "blue");

  const { generateR2Key, getSignedPutUrl, deleteFromR2 } = await import("../lib/r2-client");

  const testKey = generateR2Key("cors-test.jpg", "test/cors");
  const uploadUrl = await getSignedPutUrl(testKey, "image/jpeg", 600);

  log(`URL firmada de prueba: ${uploadUrl.slice(0, 80)}…`, "dim");
  log(`Key de prueba: ${testKey}\n`, "dim");

  const results: OriginResult[] = [];
  for (const origin of origins) {
    log(`── Origen: ${origin}`, "cyan");
    const result = await testOrigin(uploadUrl, origin);
    results.push(result);

    if (result.preflightOk) {
      log("  ✅ Preflight OPTIONS (PUT + content-type)", "green");
    } else {
      log("  ❌ Preflight OPTIONS", "red");
      for (const issue of result.issues.filter((i) => i.includes("Preflight") || i.includes("Allow"))) {
        log(`     • ${issue}`, "yellow");
      }
    }

    if (result.putOk) {
      log(`  ✅ PUT de prueba (${result.putStatus})`, "green");
    } else {
      log(`  ❌ PUT de prueba (${result.putStatus || "sin respuesta"})`, "red");
      for (const issue of result.issues.filter((i) => i.startsWith("PUT"))) {
        log(`     • ${issue}`, "yellow");
      }
    }

    log(
      `     Allow-Origin: ${result.allowOrigin ?? "—"} | Allow-Methods: ${result.allowMethods ?? "—"}`,
      "dim"
    );
    console.log();
  }

  try {
    await deleteFromR2(testKey);
    log("🧹 Archivo de prueba eliminado de R2.\n", "dim");
  } catch {
    log(`⚠️  No se pudo borrar ${testKey} (borralo manualmente si quedó).\n`, "yellow");
  }

  const allOk = results.every((r) => r.preflightOk && r.putOk);

  log("=".repeat(60), "cyan");
  if (allOk) {
    log("✅ CORS OK para todos los orígenes probados.", "green");
    log("   El dashboard debería poder subir fotos directo a R2.\n", "green");
    process.exit(0);
  }

  log("❌ CORS incompleto o incorrecto.", "red");
  log("\nCómo corregirlo:", "yellow");
  log("  1. Cloudflare → R2 → tu bucket → Settings → CORS Policy");
  log("  2. Pegá config/r2-cors-policy.json (debe incluir PUT y tus dominios)");
  log("  3. Volvé a ejecutar: npm run test:r2-cors\n");
  process.exit(1);
}

main().catch((err) => {
  log(`❌ Error fatal: ${err instanceof Error ? err.message : String(err)}`, "red");
  console.error(err);
  process.exit(1);
});
