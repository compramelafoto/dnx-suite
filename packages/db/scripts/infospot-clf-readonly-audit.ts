/**
 * Auditoría CLF vía CLF_READONLY_DATABASE_URL (solo lectura).
 *
 * Uso:
 *   export CLF_READONLY_DATABASE_URL='postgresql://…'
 *   pnpm --filter @repo/db exec tsx scripts/infospot-clf-readonly-audit.ts
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  getClfReadonlyClient,
  getClfReadonlyConnectionInfo,
  probeClfReadonlyConnection,
  resolveClfAlbumCommercialAvailability,
} from "../src/client";

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = t.indexOf("=");
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!(k in process.env) || !process.env[k]) process.env[k] = v;
  }
}

loadEnvFile(resolve(process.cwd(), ".env"));
loadEnvFile(resolve(process.cwd(), "../../apps/infospot/.env.local"));
loadEnvFile(resolve(process.cwd(), "../../apps/infospot/.env"));

type Priority = "PRIORIDAD_ALTA" | "PRIORIDAD_MEDIA" | "DESCARTAR";

function classify(input: {
  photoCount: number;
  city: string | null;
  photographers: string[];
  commercialStatus: string;
  occurred: boolean;
  daysAgo: number;
  title: string;
}): { priority: Priority; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  if (input.photoCount >= 20) {
    score += 3;
    reasons.push("buen volumen de fotos");
  } else if (input.photoCount >= 5) {
    score += 2;
    reasons.push("fotos suficientes");
  } else if (input.photoCount >= 1) {
    score += 1;
  }
  if (input.city?.trim()) {
    score += 2;
    reasons.push("ciudad");
  }
  if (input.photographers.length) {
    score += 2;
    reasons.push("fotógrafo");
  }
  if (input.commercialStatus === "AVAILABLE") score += 2;
  else if (input.commercialStatus === "REACTIVATABLE") score += 1;
  if (input.occurred && input.daysAgo <= 120) score += 2;
  else if (input.occurred && input.daysAgo <= 365) score += 1;
  if (input.photoCount === 0 || input.title.trim().length < 4) {
    return { priority: "DESCARTAR", reasons: ["datos insuficientes"] };
  }
  if (score >= 8) return { priority: "PRIORIDAD_ALTA", reasons };
  if (score >= 5) return { priority: "PRIORIDAD_MEDIA", reasons };
  return { priority: "DESCARTAR", reasons };
}

async function main() {
  const info = getClfReadonlyConnectionInfo();
  console.error("[probe]", JSON.stringify(info));
  const connection = await probeClfReadonlyConnection();

  if (!connection.ok) {
    console.log(
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          connection: {
            ok: false,
            hostMasked: info.hostMasked,
            databaseName: info.databaseName,
            counts: connection.counts ?? null,
            error: connection.error ?? info.reason,
          },
          summary: { total: 0, PRIORIDAD_ALTA: 0, PRIORIDAD_MEDIA: 0, DESCARTAR: 0 },
          candidates: [],
        },
        null,
        2,
      ),
    );
    process.exit(0);
  }

  const client = getClfReadonlyClient();
  const now = new Date();
  const events = await client.event.findMany({
    where: {
      archivedAt: null,
      mergedIntoId: null,
      title: { not: "" },
      albums: { some: { deletedAt: null, photos: { some: { isRemoved: false } } } },
    },
    select: {
      id: true,
      title: true,
      startsAt: true,
      city: true,
      locationName: true,
      type: true,
      visibility: true,
      creator: { select: { name: true, email: true } },
      albums: {
        where: { deletedAt: null },
        select: {
          id: true,
          title: true,
          publicSlug: true,
          isHidden: true,
          isPublic: true,
          deletedAt: true,
          firstPhotoDate: true,
          createdAt: true,
          expirationExtensionDays: true,
          cleanupStatus: true,
          user: { select: { name: true, email: true } },
          _count: { select: { photos: { where: { isRemoved: false } } } },
        },
      },
    },
    orderBy: { startsAt: "desc" },
    take: 120,
  });

  const candidates = events
    .map((e) => {
      const albums = e.albums.filter((a) => a._count.photos > 0);
      const photoCount = albums.reduce((n, a) => n + a._count.photos, 0);
      const top = [...albums].sort((a, b) => b._count.photos - a._count.photos)[0];
      const photographers = [
        ...new Map(
          albums.map((a) => [a.user.email, a.user.name?.trim() || a.user.email]),
        ).values(),
      ];
      let commercialStatus = "UNKNOWN";
      let publicUrl: string | null = null;
      if (top) {
        const avail = resolveClfAlbumCommercialAvailability({
          publicSlug: top.publicSlug,
          isHidden: top.isHidden,
          isPublic: top.isPublic,
          deletedAt: top.deletedAt,
          firstPhotoDate: top.firstPhotoDate,
          createdAt: top.createdAt,
          expirationExtensionDays: top.expirationExtensionDays,
          cleanupStatus: top.cleanupStatus,
        });
        commercialStatus = avail.status;
        publicUrl = avail.publicUrl;
      }
      const occurred = e.startsAt < now;
      const daysAgo = Math.max(
        0,
        Math.floor((now.getTime() - e.startsAt.getTime()) / 86_400_000),
      );
      const { priority, reasons } = classify({
        photoCount,
        city: e.city,
        photographers,
        commercialStatus,
        occurred,
        daysAgo,
        title: e.title,
      });
      const missing: string[] = [];
      if (!e.city?.trim()) missing.push("ciudad");
      if (!e.locationName?.trim()) missing.push("lugar");
      if (!photographers.length) missing.push("fotógrafo");

      return {
        eventId: e.id,
        nombre: e.title,
        fecha: e.startsAt.toISOString(),
        ciudad: e.city || null,
        lugar: e.locationName || null,
        organizador: e.creator.name?.trim() || e.creator.email,
        albumCount: albums.length,
        photoCount,
        photographers,
        topAlbumId: top?.id ?? null,
        topAlbumTitle: top?.title ?? null,
        topAlbumPublicUrl: publicUrl,
        commercialStatus,
        priority,
        priorityReasons: reasons,
        missing,
        tipo: e.type,
        occurred,
      };
    })
    .filter((c) => c.photoCount > 0)
    .sort((a, b) => {
      const o = { PRIORIDAD_ALTA: 0, PRIORIDAD_MEDIA: 1, DESCARTAR: 2 } as const;
      if (o[a.priority] !== o[b.priority]) return o[a.priority] - o[b.priority];
      return b.photoCount - a.photoCount;
    })
    .slice(0, 50);

  // Write guard check
  let writeBlocked = false;
  try {
    await (
      client as unknown as { event: { create: (a: unknown) => Promise<unknown> } }
    ).event.create({ data: { title: "SHOULD_FAIL" } });
  } catch {
    writeBlocked = true;
  }
  console.error("[write-guard]", writeBlocked ? "OK blocked" : "FAIL not blocked");

  console.log(
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        connection: {
          ok: true,
          hostMasked: connection.info.hostMasked,
          databaseName: connection.info.databaseName,
          counts: connection.counts,
        },
        summary: {
          total: candidates.length,
          PRIORIDAD_ALTA: candidates.filter((c) => c.priority === "PRIORIDAD_ALTA").length,
          PRIORIDAD_MEDIA: candidates.filter((c) => c.priority === "PRIORIDAD_MEDIA").length,
          DESCARTAR: candidates.filter((c) => c.priority === "DESCARTAR").length,
        },
        candidates,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
