import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(__dirname, "..", "..", "..", "..", "packages/db/prisma/migrations/20261003120000_fotoffice_motor_de_etapas/migration.sql"),
  "utf8",
);

describe("migración del motor de etapas", () => {
  it("no altera tablas existentes ni borra nada", () => {
    expect(sql).not.toMatch(/ALTER TABLE "(ServiceSalesLead|Workspace|Client|Member|User)"/);
    expect(sql).not.toMatch(/DROP |DELETE FROM|UPDATE "/);
  });
  it("crea las nueve tablas", () => {
    for (const t of ["FotofficeCircuit", "FotofficeStage", "FotofficeStageTaskTemplate", "FotofficeStageRule", "FotofficeLossReason", "FotofficeJourney", "FotofficeJourneyStep", "FotofficeTask", "FotofficeProcessedEvent"]) {
      expect(sql).toMatch(new RegExp(`CREATE TABLE "${t}"`));
    }
  });
  it("tiene los dos índices únicos parciales y los tres CHECK", () => {
    expect(sql).toMatch(/CREATE UNIQUE INDEX "FotofficeCircuit_predeterminado"[^;]*WHERE "isDefault"/);
    expect(sql).toMatch(/CREATE UNIQUE INDEX "FotofficeJourney_abierto"[^;]*WHERE "closedAt" IS NULL/);
    for (const c of ["FotofficeCircuit_kind", "FotofficeJourney_outcome", "FotofficeJourney_estado"]) {
      expect(sql).toMatch(new RegExp(`ADD CONSTRAINT "${c}" CHECK`));
    }
  });
});
