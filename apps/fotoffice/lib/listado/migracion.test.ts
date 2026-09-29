import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const raiz = join(__dirname, "..", "..", "..", "..");
const sql = readFileSync(join(raiz, "packages/db/prisma/migrations/20261001120000_fotoffice_listado_estandar/migration.sql"), "utf8");

describe("migración del listado estándar", () => {
  it("sólo crea tablas nuevas: no altera tablas compartidas", () => {
    expect(sql).not.toMatch(/ALTER TABLE "(Workspace|WorkspaceMembership|WorkspaceFeatureModule|User|Member|Client|CashMovement)"/);
    expect(sql).not.toMatch(/DROP /);
  });
  it("crea las dos tablas y la ULTIMA única", () => {
    expect(sql).toMatch(/CREATE TABLE "FotofficeListView"/);
    expect(sql).toMatch(/CREATE TABLE "FotofficeListActivity"/);
    expect(sql).toMatch(/WHERE "kind" = 'ULTIMA'/);
  });
});
