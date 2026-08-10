/** Auditoría read-only 16A/16B flags comerciales (sin mutar edición real). */
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(
  join(dirname(fileURLToPath(import.meta.url)), "../../../packages/db/package.json"),
);
const { PrismaClient } = require("@prisma/client") as typeof import("@prisma/client");

const COMMERCIAL = "cmslf0ny10005i7nlqe7xqbea";

async function main() {
  const p = new PrismaClient();
  const open = await p.fotorankJuryScoringSession.count({
    where: { contestId: COMMERCIAL, status: "OPEN", scoringEnabled: true },
  });
  const cfg = await p.fotorankCompetitionJuryConfig.findUnique({ where: { contestId: COMMERCIAL } });
  const finalists = await p.fotorankFinalistSnapshot.count({ where: { contestId: COMMERCIAL } });
  const mig = await p.$queryRawUnsafe<Array<{ migration_name: string; finished_at: Date | null }>>(
    `SELECT migration_name, finished_at FROM "_prisma_migrations"
     WHERE migration_name LIKE '%16a%' OR migration_name LIKE '%16b%'
     ORDER BY finished_at`,
  );
  console.log(
    JSON.stringify(
      {
        openSessions: open,
        finalistSnapshots: finalists,
        cfg: cfg
          ? {
              publicVoteMode: cfg.publicVoteMode,
              publicVoteEnabled: cfg.publicVoteEnabled,
              publicVoteStatus: cfg.publicVoteStatus,
              requiredEvaluationsPerEntry: cfg.requiredEvaluationsPerEntry,
              finalistsPerUnit: cfg.finalistsPerUnit,
            }
          : null,
        migrations: mig,
      },
      null,
      2,
    ),
  );
  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
