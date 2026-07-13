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
    const rows = (await p.$queryRawUnsafe(
      `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='Event'`,
    )) as Array<{ column_name: string }>;
    return { label, names: rows.map((r) => r.column_name).sort() };
  } finally {
    await p.$disconnect();
  }
}
async function main() {
  const preview = load("/tmp/clf-dnx-env/.env.preview");
  const is = load("../../apps/infospot/.env.local");
  const a = await cols("staging-preview", preview.DIRECT_URL || preview.DATABASE_URL);
  const b = await cols("clf-ro-dnxsuite-prod", is.CLF_READONLY_DATABASE_URL);
  const onlyA = a.names.filter((n) => !b.names.includes(n));
  const onlyB = b.names.filter((n) => !a.names.includes(n));
  console.log(JSON.stringify({ stagingCount: a.names.length, prodCount: b.names.length, onlyStaging: onlyA, missingOnStaging: onlyB }, null, 2));
}
main();
