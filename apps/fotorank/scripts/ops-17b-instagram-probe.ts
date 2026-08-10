/**
 * ETAPA 17B — Probe manual Instagram (NO auto-run; NO writes salvo flag explícito).
 *
 *   FOTORANK_ALLOW_INSTAGRAM_PROBE=1 INSTAGRAM_PROBE_ACCOUNT_ID=... \
 *     DATABASE_URL=... pnpm --filter fotorank exec tsx scripts/ops-17b-instagram-probe.ts
 */
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(
  join(dirname(fileURLToPath(import.meta.url)), "../../../packages/db/package.json"),
);
const { PrismaClient } = require("@prisma/client") as typeof import("@prisma/client");

async function main() {
  if (process.env.FOTORANK_ALLOW_INSTAGRAM_PROBE !== "1") {
    throw new Error("ABORT: FOTORANK_ALLOW_INSTAGRAM_PROBE=1 requerido");
  }
  const accountId = process.env.INSTAGRAM_PROBE_ACCOUNT_ID?.trim();
  if (!accountId) {
    throw new Error("ABORT: INSTAGRAM_PROBE_ACCOUNT_ID requerido");
  }

  console.log("ETAPA 17B Instagram Probe — read-only diagnostics");
  console.log("Account:", accountId);
  console.log("Real Meta writes:", process.env.FOTORANK_ALLOW_INSTAGRAM_PUBLISH === "1" ? "ENABLED" : "DISABLED (expected)");

  const prisma = new PrismaClient();
  try {
    const conn = await prisma.fotorankSocialConnection.findFirst({
      where: { accountId, provider: "INSTAGRAM" },
    });
    if (!conn) {
      console.log("No SocialConnection in DB for account — create via OAuth mock first.");
      return;
    }
    const { getSocialConnectionDiagnostics } = await import(
      "../app/lib/fotorank/public-vote/instagram/instagram-readiness"
    );
    const diag = await getSocialConnectionDiagnostics(conn.id);
    console.log(JSON.stringify(diag, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main();
