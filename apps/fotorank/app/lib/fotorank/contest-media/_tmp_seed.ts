import sharp from "sharp";
import { prisma } from "@repo/db";
import { saveContestMedia } from "./service";
const CONTEST = "cmtaablix0003xpani743axe6";
async function main() {
  const jpg = await sharp({ create: { width: 1920, height: 1080, channels: 3, background: { r: 10, g: 60, b: 40 } } }).jpeg().toBuffer();
  const r = await saveContestMedia({ contestId: CONTEST, kind: "BANNER", bytes: new Uint8Array(jpg), declaredMime: "image/jpeg", altText: "Banner de prueba del gate", actorUserId: 1 });
  if (!r.ok) { console.error("ERROR:", r.error.message); process.exit(1); }
  console.log(`ASSET_ID=${r.asset.id}`);
  await prisma.$disconnect();
}
main();
