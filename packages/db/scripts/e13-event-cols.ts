import { prisma } from "../src/client";
import { PrismaClient } from "@prisma/client";
import fs from "fs";

function load(p: string) {
  const m: Record<string, string> = {};
  if (!fs.existsSync(p)) return m;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = t.indexOf("=");
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    m[k] = v;
  }
  return m;
}

async function cols(label: string, url: string) {
  const p = new PrismaClient({ datasources: { db: { url } } });
  try {
    const rows = await p.$queryRawUnsafe(
      `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='Event' ORDER BY ordinal_position`,
    );
    const names = (rows as Array<{ column_name: string }>).map((r) => r.column_name);
    console.log(JSON.stringify({ label, count: names.length, hasStatus: names.includes("status"), hasJoinPolicy: names.includes("joinPolicy"), sample: names.slice(0, 15) }));
  } finally {
    await p.$disconnect();
  }
}

async function main() {
  const is = load("../../apps/infospot/.env.local");
  await cols("IS_DATABASE", is.DATABASE_URL);
  await cols("CLF_READONLY", is.CLF_READONLY_DATABASE_URL);
  // also default prisma
  const rows = await prisma.$queryRawUnsafe(
    `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='Event' AND column_name='status'`,
  );
  console.log("default prisma status cols", rows);
  await prisma.$disconnect();
}
main();
