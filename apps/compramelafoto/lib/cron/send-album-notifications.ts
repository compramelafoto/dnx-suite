import { OrderOrigin, OrderStatus, Prisma, prisma } from "@/lib/prisma";
import { queueEmail } from "@/lib/email-queue";
import { getAlbumsReadiness } from "@/lib/analysis/album-analysis-readiness";
import { computeAlbumHideAt } from "@/lib/album-cleanup/eligibility";
import { getAlbumCleanupConfig } from "@/lib/album-cleanup/config";
import { AVISO_FOTOS_LISTAS_KEY } from "@/lib/preventa-canjeable/aviso-fotos-listas";

type RunOptions = {
  dryRun?: boolean;
  /** Máximo de álbumes/notificaciones a evaluar por sección en cada ejecución. */
  batchLimit?: number;
};

/**
 * Álbumes con preventa paga en los que el fotógrafo todavía no mandó «Avisar a las familias».
 * Ahí las fotos se suben curso por curso: avisar con la primera tanda hace entrar a familias
 * cuyo curso no está (álbum 1075, octubre de 2026). El aviso a los anotados espera al del fotógrafo.
 */
export async function albumesQueEsperanElAvisoDelFotografo(albumIds: number[]): Promise<Set<number>> {
  if (albumIds.length === 0) return new Set();
  const packsPagos = {
    albumId: { in: albumIds },
    origin: OrderOrigin.PREVENTA_PACK,
    status: OrderStatus.PAID,
    isTest: false,
  } satisfies Prisma.OrderWhereInput;
  const [conPacks, avisados] = await Promise.all([
    prisma.order.groupBy({ by: ["albumId"], where: packsPagos }),
    prisma.order.groupBy({
      by: ["albumId"],
      where: { ...packsPagos, redemptionPaymentRefsJson: { path: [AVISO_FOTOS_LISTAS_KEY], not: Prisma.AnyNull } },
    }),
  ]);
  const yaAvisaron = new Set(avisados.map((o) => o.albumId));
  return new Set(conPacks.map((o) => o.albumId).filter((id) => !yaAvisaron.has(id)));
}

type Recordatorio = {
  dias: 21 | 14 | 7;
  /** Campo de AlbumNotification que marca este recordatorio como enviado. */
  campo: "notifiedAt3Weeks" | "notifiedAt2Weeks" | "notifiedAt1Week";
  /** Recordatorios más cercanos al cierre: si ya salió uno de ésos, éste ya no tiene sentido. */
  posteriores: Array<"notifiedAt2Weeks" | "notifiedAt1Week">;
  clave: "3w" | "2w" | "1w";
};

const RECORDATORIOS: Recordatorio[] = [
  { dias: 21, campo: "notifiedAt3Weeks", posteriores: ["notifiedAt2Weeks", "notifiedAt1Week"], clave: "3w" },
  { dias: 14, campo: "notifiedAt2Weeks", posteriores: ["notifiedAt1Week"], clave: "2w" },
  { dias: 7, campo: "notifiedAt1Week", posteriores: [], clave: "1w" },
];

/** "01/11" en hora argentina (UTC−3, sin horario de verano). Sin `Intl`: con `day: "2-digit"`
 * el ICU de Node escribe "1/11" para es-AR. */
export function fechaCorta(d: Date): string {
  const ar = new Date(d.getTime() - 3 * 3_600_000);
  return `${String(ar.getUTCDate()).padStart(2, "0")}/${String(ar.getUTCMonth() + 1).padStart(2, "0")}`;
}

function textoRecordatorio(r: Recordatorio, titulo: string, cierre: Date, albumUrl: string) {
  const fecha = fechaCorta(cierre);
  if (r.dias === 7) {
    return {
      subject: `¡Última semana! El álbum "${titulo}" se eliminará en 7 días`,
      body: `Hola,\n\n¡Última semana! El álbum "${titulo}" se eliminará en 7 días, el ${fecha}.\n\nNo te pierdas la oportunidad de ver y comprar tus fotos:\n${albumUrl}\n\nSaludos,\nComprameLaFoto`,
    };
  }
  const semanas = r.dias === 21 ? "3 semanas" : "2 semanas";
  return {
    subject: `Recordatorio: El álbum "${titulo}" se eliminará en ${r.dias} días`,
    body: `Hola,\n\nTe recordamos que el álbum "${titulo}" se eliminará en ${r.dias} días (${semanas}), el ${fecha}.\n\nNo te pierdas la oportunidad de ver y comprar tus fotos:\n${albumUrl}\n\nSaludos,\nComprameLaFoto`,
  };
}

type RunResult = {
  ok: boolean;
  dryRun: boolean;
  notifiedWhenReady: number;
  notifiedAt3Weeks: number;
  notifiedAt2Weeks: number;
  notifiedAt1Week: number;
  notifiedAtExtension15: number;
  notifiedAtExtension29: number;
  skipped: number;
  failed: number;
  total: number;
};

export async function runSendAlbumNotifications(options: RunOptions = {}): Promise<RunResult> {
  const dryRun = Boolean(options.dryRun);
  const batchLimit = options.batchLimit ?? 200;
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const appUrl =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    "http://localhost:3000";

  let notifiedWhenReady = 0;
  let notifiedAt3Weeks = 0;
  let notifiedAt2Weeks = 0;
  let notifiedAt1Week = 0;
  let notifiedAtExtension15 = 0;
  let notifiedAtExtension29 = 0;
  let skipped = 0;
  let failed = 0;

  // 1. NOTIFICAR CUANDO SE SUBEN LAS PRIMERAS FOTOS (solo álbumes con suscriptores pendientes)
  const albumsWithNewPhotos = await prisma.album.findMany({
    where: {
      isHidden: false,
      photos: { some: {} },
      notifications: {
        some: { notifiedWhenReady: false },
      },
    },
    select: {
      id: true,
      title: true,
      firstPhotoDate: true,
      photos: {
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
      notifications: {
        where: { notifiedWhenReady: false },
        select: { id: true, email: true },
      },
    },
    take: batchLimit,
  });

  // El aviso lleva al cliente al álbum, así que espera a que el reconocimiento facial
  // y el OCR estén listos. Si no, llega y solo ve "las fotos se están procesando".
  const readinessByAlbum = await getAlbumsReadiness(
    albumsWithNewPhotos.map((album) => album.id)
  );

  const esperanAviso = await albumesQueEsperanElAvisoDelFotografo(
    albumsWithNewPhotos.map((album) => album.id)
  );

  for (const album of albumsWithNewPhotos) {
    if (esperanAviso.has(album.id)) {
      // Tampoco se marca: sale en la primera corrida después de que el fotógrafo avise.
      skipped += album.notifications.length;
      continue;
    }

    const firstPhotoDate = album.firstPhotoDate
      ? new Date(album.firstPhotoDate).getTime()
      : album.photos[0]
        ? new Date(album.photos[0].createdAt).getTime()
        : null;

    const readiness = readinessByAlbum.get(album.id);
    if (!readiness?.ready) {
      // No marcamos notifiedWhenReady: queda pendiente y se reintenta la hora siguiente.
      console.log("[cron:album-notifications] ready_pospuesto", {
        albumId: album.id,
        motivo: readiness?.reason ?? "sin_datos",
        pendientes: (readiness?.pending ?? 0) + (readiness?.processing ?? 0),
        suscriptores: album.notifications.length,
      });
      skipped += album.notifications.length;
      continue;
    }

    if (firstPhotoDate && album.notifications.length > 0) {
      for (const notif of album.notifications) {
        if (dryRun) {
          console.log(`[cron:album-notifications] DRY enviar ready a ${notif.email} (album ${album.id})`);
          skipped++;
          continue;
        }

        try {
          const albumUrl = `${appUrl}/a/${album.id}`;
          const subject = `¡Las fotos de "${album.title}" ya están disponibles!`;
          const body = `Hola,\n\nLas fotos del álbum "${album.title}" ya están disponibles para ver y comprar.\n\nVer álbum: ${albumUrl}\n\nSaludos,\nComprameLaFoto`;

          await queueEmail({
            to: notif.email,
            subject,
            body,
            idempotencyKey: `album_ready_${album.id}_${notif.id}`,
          });

          await prisma.albumNotification.update({
            where: { id: notif.id },
            data: { notifiedWhenReady: true },
          });
          notifiedWhenReady++;
        } catch (error) {
          console.error(`[cron:album-notifications] Error ready ${notif.email}`, error);
          failed++;
        }
      }
    }
  }

  // 2. RECORDATORIOS ANTES DE QUE SE OCULTE EL ÁLBUM
  // La cuenta sale de la primera foto, igual que la galería y la limpieza (`computeAlbumHideAt`).
  // Antes salía de `createdAt`: un álbum creado semanas antes de subir fotos avisaba
  // "última semana" con un mes por delante (álbum 1075: aviso el 24/10, se ocultaba el 22/11).
  const { hideAfterDays } = getAlbumCleanupConfig();
  const contadores: Record<Recordatorio["clave"], number> = { "3w": 0, "2w": 0, "1w": 0 };

  for (const r of RECORDATORIOS) {
    const desde = now + r.dias * dayMs;
    const hasta = desde + dayMs;
    const pendientes = {
      [r.campo]: false,
      ...Object.fromEntries(r.posteriores.map((campo) => [campo, false])),
    } as Prisma.AlbumNotificationWhereInput;

    const candidatos = await prisma.album.findMany({
      where: {
        isHidden: false,
        deletedAt: null,
        notifications: { some: pendientes },
        OR: [
          // Sin extensión: la primera foto cae en una ventana fija.
          {
            expirationExtensionDays: 0,
            firstPhotoDate: {
              gte: new Date(desde - hideAfterDays * dayMs),
              lt: new Date(hasta - hideAfterDays * dayMs),
            },
          },
          // Con extensión: pocos; se filtran abajo con la fecha exacta.
          { expirationExtensionDays: { gt: 0 }, firstPhotoDate: { not: null } },
        ],
      },
      select: {
        id: true,
        title: true,
        firstPhotoDate: true,
        expirationExtensionDays: true,
        isHidden: true,
        deletedAt: true,
        cleanupStatus: true,
        notifications: { where: pendientes, select: { id: true, email: true } },
      },
      take: batchLimit,
    });

    for (const album of candidatos) {
      const cierre = computeAlbumHideAt(album);
      if (!cierre || cierre.getTime() < desde || cierre.getTime() >= hasta) continue;

      for (const notif of album.notifications) {
        if (dryRun) {
          console.log(`[cron:album-notifications] DRY enviar ${r.clave} ${notif.email} (album ${album.id})`);
          skipped++;
          continue;
        }

        try {
          const albumUrl = `${appUrl}/a/${album.id}`;
          const { subject, body } = textoRecordatorio(r, album.title, cierre, albumUrl);

          await queueEmail({
            to: notif.email,
            subject,
            body,
            idempotencyKey: `album_reminder_${r.clave}_${album.id}_${notif.id}`,
          });

          await prisma.albumNotification.update({
            where: { id: notif.id },
            data: { [r.campo]: true },
          });
          contadores[r.clave]++;
        } catch (error) {
          console.error(`[cron:album-notifications] Error ${r.clave} ${notif.email}`, error);
          failed++;
        }
      }
    }
  }
  notifiedAt3Weeks = contadores["3w"];
  notifiedAt2Weeks = contadores["2w"];
  notifiedAt1Week = contadores["1w"];

  // 3. RECORDATORIOS POST-EXTENSIÓN (15 y 29 días desde la extensión)
  const day15Cutoff = new Date(now - 15 * dayMs);
  const day15Start = new Date(day15Cutoff.getTime() - dayMs);

  const prismaAny = prisma as any;
  const extensionsAt15Days = prismaAny.albumExtension?.findMany
    ? await prismaAny.albumExtension.findMany({
        where: {
          createdAt: { gte: day15Start, lt: day15Cutoff },
          notifiedAt15Days: false,
        },
        include: {
          album: {
            select: {
              id: true,
              title: true,
              publicSlug: true,
              notifications: { select: { id: true, email: true } },
            },
          },
        },
        take: batchLimit,
      })
    : [];

  for (const extension of extensionsAt15Days) {
    const album = extension.album;
    if (!album) continue;
    const albumUrl = `${appUrl}/a/${album.publicSlug || album.id}`;

    for (const notif of album.notifications) {
      if (dryRun) {
        console.log(`[cron:album-notifications] DRY enviar ext15 ${notif.email} (album ${album.id})`);
        skipped++;
        continue;
      }

      try {
        const subject = "¡Tu álbum extendido sigue disponible! Aprovechá antes de que suba el precio";
        const body = `Hola,\n\nSe extendió el tiempo de expiración del álbum "${album.title}" como excepción.\n\nYa pasaron 15 días desde la extensión y quedan pocos días para comprar al precio habitual.\n\nRecordá: si se cumple el plazo de la extensión, las fotos seguirán disponibles, pero el precio será mayor.\n\nAprovechá ahora y comprá tus fotos:\n${albumUrl}\n\nSaludos,\nComprameLaFoto`;

        await queueEmail({
          to: notif.email,
          subject,
          body,
          idempotencyKey: `album_extension_15_${album.id}_${notif.id}`,
        });
        notifiedAtExtension15++;
      } catch (error) {
        console.error(`[cron:album-notifications] Error ext15 ${notif.email}`, error);
        failed++;
      }
    }

    if (!dryRun && prismaAny.albumExtension?.update) {
      await prismaAny.albumExtension.update({
        where: { id: extension.id },
        data: { notifiedAt15Days: true },
      });
    }
  }

  const day29Cutoff = new Date(now - 29 * dayMs);
  const day29Start = new Date(day29Cutoff.getTime() - dayMs);

  const extensionsAt29Days = prismaAny.albumExtension?.findMany
    ? await prismaAny.albumExtension.findMany({
        where: {
          createdAt: { gte: day29Start, lt: day29Cutoff },
          notifiedAt29Days: false,
        },
        include: {
          album: {
            select: {
              id: true,
              title: true,
              publicSlug: true,
              notifications: { select: { id: true, email: true } },
            },
          },
        },
        take: batchLimit,
      })
    : [];

  for (const extension of extensionsAt29Days) {
    const album = extension.album;
    if (!album) continue;
    const albumUrl = `${appUrl}/a/${album.publicSlug || album.id}`;

    for (const notif of album.notifications) {
      if (dryRun) {
        console.log(`[cron:album-notifications] DRY enviar ext29 ${notif.email} (album ${album.id})`);
        skipped++;
        continue;
      }

      try {
        const subject = "Últimos días del álbum extendido: comprá hoy para mantener el precio";
        const body = `Hola,\n\nEsta es la recta final del período extendido del álbum "${album.title}".\n\nQuedan muy pocos días para comprar al precio habitual. Después de esta fecha, las fotos seguirán disponibles, pero el precio será mayor.\n\nNo lo dejes para después:\n${albumUrl}\n\nSaludos,\nComprameLaFoto`;

        await queueEmail({
          to: notif.email,
          subject,
          body,
          idempotencyKey: `album_extension_29_${album.id}_${notif.id}`,
        });
        notifiedAtExtension29++;
      } catch (error) {
        console.error(`[cron:album-notifications] Error ext29 ${notif.email}`, error);
        failed++;
      }
    }

    if (!dryRun && prismaAny.albumExtension?.update) {
      await prismaAny.albumExtension.update({
        where: { id: extension.id },
        data: { notifiedAt29Days: true },
      });
    }
  }

  return {
    ok: true,
    dryRun,
    notifiedWhenReady,
    notifiedAt3Weeks,
    notifiedAt2Weeks,
    notifiedAt1Week,
    notifiedAtExtension15,
    notifiedAtExtension29,
    skipped,
    failed,
    total:
      notifiedWhenReady +
      notifiedAt3Weeks +
      notifiedAt2Weeks +
      notifiedAt1Week +
      notifiedAtExtension15 +
      notifiedAtExtension29,
  };
}

 
