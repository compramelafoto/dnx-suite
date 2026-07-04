import { prisma } from "@/lib/prisma";
import { queueEmail } from "@/lib/email-queue";

type RunOptions = {
  dryRun?: boolean;
};

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

  // 1. NOTIFICAR CUANDO SE SUBEN LAS PRIMERAS FOTOS
  const albumsWithNewPhotos = await prisma.album.findMany({
    where: {
      photos: { some: {} },
      isHidden: false,
    },
    select: {
      id: true,
      title: true,
      firstPhotoDate: true,
      photos: { select: { createdAt: true } },
      notifications: {
        where: { notifiedWhenReady: false },
        select: { id: true, email: true },
      },
    },
  });

  for (const album of albumsWithNewPhotos) {
    const firstPhotoDate = album.firstPhotoDate
      ? new Date(album.firstPhotoDate).getTime()
      : album.photos.length > 0
      ? Math.min(...album.photos.map((p) => new Date(p.createdAt).getTime()))
      : null;

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

  // 2. RECORDATORIOS ANTES DE ELIMINACIÓN
  const day9Cutoff = new Date(now - 9 * dayMs);
  const day9Start = new Date(day9Cutoff.getTime() - dayMs);

  const albumsAt3Weeks = await prisma.album.findMany({
    where: {
      createdAt: { gte: day9Start, lt: day9Cutoff },
      isHidden: false,
      notifications: {
        some: {
          notifiedAt3Weeks: false,
        },
      },
    },
    include: {
      notifications: {
        where: { notifiedAt3Weeks: false },
        select: { id: true, email: true },
      },
    },
  });

  for (const album of albumsAt3Weeks) {
    for (const notif of album.notifications) {
      if (dryRun) {
        console.log(`[cron:album-notifications] DRY enviar 3w ${notif.email} (album ${album.id})`);
        skipped++;
        continue;
      }

      try {
        const albumUrl = `${appUrl}/a/${album.id}`;
        const subject = `Recordatorio: El álbum "${album.title}" se eliminará en 21 días`;
        const body = `Hola,\n\nTe recordamos que el álbum "${album.title}" se eliminará en 21 días (3 semanas).\n\nNo te pierdas la oportunidad de ver y comprar tus fotos:\n${albumUrl}\n\nSaludos,\nComprameLaFoto`;

        await queueEmail({
          to: notif.email,
          subject,
          body,
          idempotencyKey: `album_reminder_3w_${album.id}_${notif.id}`,
        });

        await prisma.albumNotification.update({
          where: { id: notif.id },
          data: { notifiedAt3Weeks: true },
        });
        notifiedAt3Weeks++;
      } catch (error) {
        console.error(`[cron:album-notifications] Error 3w ${notif.email}`, error);
        failed++;
      }
    }
  }

  // Día 16 (2 semanas antes)
  const day16Cutoff = new Date(now - 16 * dayMs);
  const day16Start = new Date(day16Cutoff.getTime() - dayMs);

  const albumsAt2Weeks = await prisma.album.findMany({
    where: {
      createdAt: { gte: day16Start, lt: day16Cutoff },
      isHidden: false,
      notifications: {
        some: {
          notifiedAt2Weeks: false,
        },
      },
    },
    include: {
      notifications: {
        where: { notifiedAt2Weeks: false },
        select: { id: true, email: true },
      },
    },
  });

  for (const album of albumsAt2Weeks) {
    for (const notif of album.notifications) {
      if (dryRun) {
        console.log(`[cron:album-notifications] DRY enviar 2w ${notif.email} (album ${album.id})`);
        skipped++;
        continue;
      }

      try {
        const albumUrl = `${appUrl}/a/${album.id}`;
        const subject = `Recordatorio: El álbum "${album.title}" se eliminará en 14 días`;
        const body = `Hola,\n\nTe recordamos que el álbum "${album.title}" se eliminará en 14 días (2 semanas).\n\nNo te pierdas la oportunidad de ver y comprar tus fotos:\n${albumUrl}\n\nSaludos,\nComprameLaFoto`;

        await queueEmail({
          to: notif.email,
          subject,
          body,
          idempotencyKey: `album_reminder_2w_${album.id}_${notif.id}`,
        });

        await prisma.albumNotification.update({
          where: { id: notif.id },
          data: { notifiedAt2Weeks: true },
        });
        notifiedAt2Weeks++;
      } catch (error) {
        console.error(`[cron:album-notifications] Error 2w ${notif.email}`, error);
        failed++;
      }
    }
  }

  // Día 23 (1 semana antes)
  const day23Cutoff = new Date(now - 23 * dayMs);
  const day23Start = new Date(day23Cutoff.getTime() - dayMs);

  const albumsAt1Week = await prisma.album.findMany({
    where: {
      createdAt: { gte: day23Start, lt: day23Cutoff },
      isHidden: false,
      notifications: {
        some: {
          notifiedAt1Week: false,
        },
      },
    },
    include: {
      notifications: {
        where: { notifiedAt1Week: false },
        select: { id: true, email: true },
      },
    },
  });

  for (const album of albumsAt1Week) {
    for (const notif of album.notifications) {
      if (dryRun) {
        console.log(`[cron:album-notifications] DRY enviar 1w ${notif.email} (album ${album.id})`);
        skipped++;
        continue;
      }

      try {
        const albumUrl = `${appUrl}/a/${album.id}`;
        const subject = `¡Última semana! El álbum "${album.title}" se eliminará en 7 días`;
        const body = `Hola,\n\n¡Última semana! El álbum "${album.title}" se eliminará en 7 días.\n\nNo te pierdas la oportunidad de ver y comprar tus fotos:\n${albumUrl}\n\nSaludos,\nComprameLaFoto`;

        await queueEmail({
          to: notif.email,
          subject,
          body,
          idempotencyKey: `album_reminder_1w_${album.id}_${notif.id}`,
        });

        await prisma.albumNotification.update({
          where: { id: notif.id },
          data: { notifiedAt1Week: true },
        });
        notifiedAt1Week++;
      } catch (error) {
        console.error(`[cron:album-notifications] Error 1w ${notif.email}`, error);
        failed++;
      }
    }
  }

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

 
