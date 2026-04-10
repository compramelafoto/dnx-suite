/**
 * Seed idempotente para E2E del módulo escolar (ComprameLaFoto).
 *
 * Uso (desde apps/compramelafoto, con DATABASE_URL en .env.local):
 *   pnpm e2e:prepare
 *
 * Efecto:
 * - Elimina y recrea el álbum de prueba del fotógrafo E2E (mismo título) para estado limpio en cada corrida.
 * - Escribe/actualiza apps/compramelafoto/.env.e2e con credenciales e IDs generados.
 */

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient, Role, PreCompraOrderItemStatus, PreCompraOrderStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { config as loadEnv } from "dotenv";

/** Ejecutar desde `apps/compramelafoto` (pnpm e2e:prepare). */
const APP_ROOT = process.cwd();

loadEnv({ path: path.join(APP_ROOT, ".env.local") });
loadEnv({ path: path.join(APP_ROOT, ".env") });

const prisma = new PrismaClient();

/** Título único por usuario: al borrar/recrear no choca con otros álbumes. */
const E2E_ALBUM_TITLE = "E2E School (Playwright)";

const DEFAULT_EMAIL = "e2e-school-photographer@test.local";
const DEFAULT_PASSWORD = "E2E_School_Test_2026!";

const TEMPLATE_IMAGE_URL = "https://placehold.co/1200x800/1a1a1a/d4af37/png?text=E2E+School+Template";

function envOrDefault(name: string, fallback: string): string {
  const v = process.env[name]?.trim();
  return v && v.length > 0 ? v : fallback;
}

function mergeManagedEnvFile(filePath: string, managed: Record<string, string>): void {
  const keys = new Set(Object.keys(managed));
  let preserved: string[] = [];
  if (fs.existsSync(filePath)) {
    preserved = fs
      .readFileSync(filePath, "utf8")
      .split("\n")
      .filter((line) => {
        const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
        return !(m && keys.has(m[1]!));
      });
  }
  const body = preserved.join("\n").replace(/\n+$/, "");
  const block = [
    "# --- E2E school fixtures (auto: scripts/e2e-school-setup.ts) ---",
    "# Regenerar: pnpm e2e:prepare",
    ...Object.entries(managed).map(([k, v]) => `${k}=${v}`),
    "",
  ].join("\n");
  fs.writeFileSync(filePath, (body ? `${body}\n\n` : "") + block, "utf8");
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error("[e2e-school-setup] Falta DATABASE_URL. Configuralo en .env.local (misma DB que la app).");
    process.exit(1);
  }

  const photographerEmail = envOrDefault("E2E_SEED_PHOTOGRAPHER_EMAIL", DEFAULT_EMAIL);
  const photographerPassword = envOrDefault("E2E_SEED_PHOTOGRAPHER_PASSWORD", DEFAULT_PASSWORD);
  const baseURL = envOrDefault("PLAYWRIGHT_BASE_URL", envOrDefault("E2E_BASE_URL", "http://127.0.0.1:3002"));

  const passwordHash = await bcrypt.hash(photographerPassword, 10);

  const user = await prisma.user.upsert({
    where: { email: photographerEmail },
    update: {
      password: passwordHash,
      role: Role.PHOTOGRAPHER,
      name: "E2E School Photographer",
      emailVerifiedAt: new Date(),
    },
    create: {
      email: photographerEmail,
      password: passwordHash,
      role: Role.PHOTOGRAPHER,
      name: "E2E School Photographer",
      emailVerifiedAt: new Date(),
    },
  });

  const existingAlbum = await prisma.album.findFirst({
    where: { userId: user.id, title: E2E_ALBUM_TITLE, deletedAt: null },
    select: { id: true },
  });
  if (existingAlbum) {
    await prisma.album.delete({ where: { id: existingAlbum.id } });
    console.log("[e2e-school-setup] Álbum E2E anterior eliminado (recreación limpia).");
  }

  const publicSlug = `e2e-school-${user.id}-${createHash("sha256").update(photographerEmail).digest("hex").slice(0, 8)}`;
  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);

  const album = await prisma.album.create({
    data: {
      userId: user.id,
      creatorId: user.id,
      title: E2E_ALBUM_TITLE,
      location: "E2E",
      publicSlug,
      isPublic: true,
      isHidden: false,
      expiresAt,
      enableDigitalPhotos: true,
      enablePrintedPhotos: true,
    },
  });

  const template = await prisma.template.create({
    data: {
      albumId: album.id,
      albumProductId: null,
      name: "E2E School Template",
      imageUrl: TEMPLATE_IMAGE_URL,
      widthCm: 30,
      heightCm: 20,
      slots: {
        create: [
          {
            pageIndex: 0,
            index: 0,
            role: null,
            bbox: { x: 0.08, y: 0.1, width: 0.4, height: 0.8 },
          },
          {
            pageIndex: 0,
            index: 1,
            role: null,
            bbox: { x: 0.52, y: 0.1, width: 0.4, height: 0.8 },
          },
        ],
      },
    },
  });

  const albumProduct = await prisma.albumProduct.create({
    data: {
      albumId: album.id,
      name: "E2E Pack escolar (diseño)",
      description: "Producto generado por e2e-school-setup",
      price: 100,
      minFotos: 2,
      maxFotos: 2,
      requiresDesign: true,
      defaultTemplateId: template.id,
    },
  });

  await prisma.template.update({
    where: { id: template.id },
    data: { albumProductId: albumProduct.id },
  });

  const preOrder = await prisma.preCompraOrder.create({
    data: {
      albumId: album.id,
      buyerEmail: "e2e-school-buyer@test.local",
      buyerName: "E2E Buyer",
      status: PreCompraOrderStatus.PAID_HELD,
      totalCents: 100,
    },
  });

  const orderItem = await prisma.preCompraOrderItem.create({
    data: {
      orderId: preOrder.id,
      albumProductId: albumProduct.id,
      status: PreCompraOrderItemStatus.WAITING_SELECTION,
      priceCents: 100,
    },
  });

  const photoIds: number[] = [];
  for (const i of [1, 2]) {
    const p = await prisma.photo.create({
      data: {
        albumId: album.id,
        userId: user.id,
        previewUrl: `https://placehold.co/400x600/png?text=E2E+${i}`,
        originalKey: `e2e/albums/${album.id}/original_e2e_${i}.jpg`,
        sellDigital: true,
        sellPrint: true,
      },
    });
    photoIds.push(p.id);
  }

  const envPath = path.join(APP_ROOT, ".env.e2e");
  mergeManagedEnvFile(envPath, {
    PLAYWRIGHT_BASE_URL: baseURL.replace(/\/$/, ""),
    E2E_PHOTOGRAPHER_EMAIL: photographerEmail,
    E2E_PHOTOGRAPHER_PASSWORD: photographerPassword,
    E2E_SCHOOL_ALBUM_ID: String(album.id),
    E2E_SCHOOL_ORDER_ITEM_ID: String(orderItem.id),
    E2E_SCHOOL_PHOTO_IDS: photoIds.join(","),
  });

  console.log("[e2e-school-setup] OK");
  console.log(`  Usuario: ${photographerEmail}`);
  console.log(`  Álbum id: ${album.id}, slug: ${publicSlug}`);
  console.log(`  Order item id: ${orderItem.id}`);
  console.log(`  Foto ids: ${photoIds.join(",")}`);
  console.log(`  Escrito: ${envPath}`);
}

main()
  .catch((e) => {
    console.error("[e2e-school-setup] Error:", e);
    const code = typeof e === "object" && e && "code" in e ? String((e as { code?: string }).code) : "";
    if (code === "P2022") {
      console.error(
        "[e2e-school-setup] La base no coincide con el schema Prisma del repo. Aplicá migraciones: `pnpm prisma:migrate:local-only` (desde apps/compramelafoto) o `pnpm --filter @repo/db exec prisma migrate deploy` con DATABASE_URL."
      );
    }
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
