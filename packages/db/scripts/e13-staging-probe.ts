import { PrismaClient } from "@prisma/client";

async function main() {
  const url = process.env.DATABASE_URL!;
  const host = new URL(url).hostname;
  if (/falling-darkness/i.test(host)) throw new Error("refuse prod db");
  const p = new PrismaClient({ datasources: { db: { url } } });
  try {
    const cols = await p.$queryRawUnsafe(
      `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='Event' ORDER BY 1`,
    ) as Array<{ column_name: string }>;
    const names = cols.map((c) => c.column_name);
    const counts = {
      events: await p.event.count(),
      users: await p.user.count(),
      photographers: await p.user.count({ where: { role: { in: ["PHOTOGRAPHER", "LAB_PHOTOGRAPHER"] } } }),
      organizers: await p.user.count({ where: { role: "ORGANIZER" } }),
      stagingTitle: await p.event.count({ where: { title: { contains: "[STAGING]" } } }),
    };
    console.log(JSON.stringify({
      hostPrefix: host.match(/^ep-[a-z0-9-]+/i)?.[0],
      eventCols: names.length,
      hasStatus: names.includes("status"),
      hasJoinPolicy: names.includes("joinPolicy"),
      counts,
    }, null, 2));
  } finally {
    await p.$disconnect();
  }
}
main();
