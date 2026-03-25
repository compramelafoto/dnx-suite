import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/emails/send";
import { buildAlbumInterestDigest } from "@/emails/templates/album-interest";

type RunOptions = {
  dryRun?: boolean;
  batchLimit?: number;
};

type DigestAlbum = {
  id: number;
  title: string;
  url: string;
};

type InterestItem = {
  interestId: number;
  albumId: number;
  albumTitle: string;
  albumUrl: string;
  sentField: string;
  nextEmailAt: Date | null;
};

type GroupItem = {
  recipientKey: string;
  email: string;
  userId?: number;
  firstName?: string;
  albums: DigestAlbum[];
  interests: InterestItem[];
};

type RunResult = {
  ok: boolean;
  dryRun: boolean;
  recipientsTotal: number;
  recipientsProcessed: number;
  sent: number;
  failed: number;
  skipped: number;
  interestsDue: number;
};

const schedule = [
  { key: "E01", offsetDays: 0, sentField: "sentE01" },
  { key: "E02", offsetDays: 3, sentField: "sentE02" },
  { key: "E03", offsetDays: 7, sentField: "sentE03" },
  { key: "E04", offsetDays: 12, sentField: "sentE04" },
  { key: "E05", offsetDays: 18, sentField: "sentE05" },
  { key: "E06", offsetDays: 24, sentField: "sentE06" },
  { key: "E07", offsetDays: 28, sentField: "sentE07" },
  { key: "E08", offsetDays: 30, sentField: "sentE08" },
];

function nextScheduleInfo(interest: any, baseDate: Date) {
  const current = schedule.find((item) => !interest[item.sentField]);
  if (!current) return { current: null, nextEmailAt: null };
  const dueAt = new Date(baseDate.getTime() + current.offsetDays * 24 * 60 * 60 * 1000);
  const nextIndex = schedule.findIndex((item) => item.key === current.key) + 1;
  const next = schedule[nextIndex];
  const nextEmailAt = next ? new Date(baseDate.getTime() + next.offsetDays * 24 * 60 * 60 * 1000) : null;
  return { current, dueAt, nextEmailAt };
}

export async function runAlbumInterestDigest(options: RunOptions = {}): Promise<RunResult> {
  const dryRun = Boolean(options.dryRun);
  const batchLimit = options.batchLimit ?? 200;
  const now = new Date();
  const appUrl = process.env.APP_URL || "http://localhost:3000";

  const interests = await prisma.albumInterest.findMany({
    where: {
      hasPurchased: false,
      nextEmailAt: { lte: now },
    },
    include: {
      album: {
        select: {
          id: true,
          title: true,
          publicSlug: true,
        },
      },
    },
  });

  const uniqueEmails = Array.from(new Set(interests.map((interest) => interest.email)));
  const users = await prisma.user.findMany({
    where: { email: { in: uniqueEmails } },
    select: { id: true, email: true, name: true },
  });
  const userByEmail = new Map(users.map((user) => [user.email, user]));

  const groups = new Map<string, GroupItem>();
  let skipped = 0;

  for (const interest of interests) {
    const scheduleInfo = nextScheduleInfo(interest as any, interest.createdAt);
    if (!scheduleInfo.current || !scheduleInfo.dueAt) {
      if (!dryRun) {
        await prisma.albumInterest.update({
          where: { id: interest.id },
          data: { nextEmailAt: null },
        });
      }
      skipped++;
      continue;
    }

    if (now < scheduleInfo.dueAt) {
      if (!dryRun) {
        await prisma.albumInterest.update({
          where: { id: interest.id },
          data: { nextEmailAt: scheduleInfo.dueAt },
        });
      }
      skipped++;
      continue;
    }

    const albumSlug = interest.album.publicSlug || String(interest.album.id);
    const albumUrl = `${appUrl}/a/${albumSlug}`;
    const user = userByEmail.get(interest.email);
    const recipientKey = user?.id ? `user:${user.id}` : `email:${interest.email}`;
    const firstName = interest.firstName || interest.name || user?.name || undefined;

    const group = groups.get(recipientKey) || {
      recipientKey,
      email: interest.email,
      userId: user?.id,
      firstName,
      albums: [],
      interests: [],
    };

    const existingAlbum = group.albums.find((album) => album.id === interest.album.id);
    if (!existingAlbum) {
      group.albums.push({
        id: interest.album.id,
        title: interest.album.title,
        url: albumUrl,
      });
    }

    group.interests.push({
      interestId: interest.id,
      albumId: interest.album.id,
      albumTitle: interest.album.title,
      albumUrl,
      sentField: scheduleInfo.current.sentField,
      nextEmailAt: scheduleInfo.nextEmailAt,
    });

    groups.set(recipientKey, group);
  }

  const allGroups = Array.from(groups.values());
  const targetGroups = allGroups.slice(0, batchLimit);

  let sent = 0;
  let failed = 0;

  for (const group of targetGroups) {
    if (group.albums.length === 0) {
      skipped++;
      continue;
    }

    const { subject, html } = buildAlbumInterestDigest({
      firstName: group.firstName,
      albums: group.albums.map((album) => ({
        title: album.title,
        url: album.url,
      })),
    });

    if (dryRun) {
      console.log(
        `[cron:album-interest] DRY enviar a ${group.email} (${group.albums.length} álbumes)`
      );
      skipped++;
      continue;
    }

    const sendResult = await sendEmail({
      to: group.email,
      subject,
      html,
      templateKey: "ALBUM_INTEREST_DIGEST",
      meta: group.userId ? { userId: group.userId } : undefined,
    });

    if (!sendResult.success) {
      console.error(`[cron:album-interest] Error enviando a ${group.email}`);
      // TODO: si se agrega retryCount en AlbumInterest, incrementarlo aquí.
      failed++;
      continue;
    }

    await prisma.$transaction(
      group.interests.map((interest) =>
        prisma.albumInterest.update({
          where: { id: interest.interestId },
          data: {
            [interest.sentField]: true,
            lastNotifiedAt: now,
            nextEmailAt: interest.nextEmailAt,
          } as any,
        })
      )
    );

    sent++;
  }

  if (allGroups.length > batchLimit) {
    console.log(
      `[cron:album-interest] Batch limitado: ${batchLimit} destinatarios de ${allGroups.length}`
    );
  }

  return {
    ok: true,
    dryRun,
    recipientsTotal: allGroups.length,
    recipientsProcessed: targetGroups.length,
    sent,
    failed,
    skipped,
    interestsDue: interests.length,
  };
}
