/**
 * GET /api/cron/cleanup-preventa-mockups
 *
 * Elimina imágenes mockup de productos de pre-venta 30 días después del cierre
 * de la pre-venta del álbum. Las imágenes están en R2 bajo preventa-mockups/{albumId}/.
 *
 * Protegido: Authorization: Bearer <CRON_SECRET>
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deleteFromR2, urlToR2Key } from "@/lib/r2-client";
import { assertCronAuth } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const RETENTION_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  const unauthorized = assertCronAuth(req);
  if (unauthorized) return unauthorized;

  const now = new Date();
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * MS_PER_DAY);

  // Álbumes cuya pre-venta cerró hace más de 30 días
  const albums = await prisma.album.findMany({
    where: {
      preCompraCloseAt: { not: null, lt: cutoff },
    },
    select: {
      id: true,
      preCompraCloseAt: true,
      preCompraProducts: {
        where: { mockupUrl: { not: null } },
        select: { id: true, mockupUrl: true },
      },
    },
  });

  let deleted = 0;
  let errors = 0;

  for (const album of albums) {
    for (const product of album.preCompraProducts) {
      const mockupUrl = product.mockupUrl;
      if (!mockupUrl) continue;
      try {
        const key = urlToR2Key(mockupUrl);
        if (key) {
          await deleteFromR2(key);
          deleted++;
        }
      } catch (e) {
        console.error("[cleanup-preventa-mockups] delete R2 error:", e);
        errors++;
      }
      await prisma.albumProduct.update({
        where: { id: product.id },
        data: { mockupUrl: null },
      });
    }
  }

  return NextResponse.json({
    ok: true,
    albumsChecked: albums.length,
    mockupsDeleted: deleted,
    dbCleared: albums.reduce((acc, a) => acc + a.preCompraProducts.length, 0),
    errors,
  });
}
