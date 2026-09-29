import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(__dirname, "..", "..", "..", "..", "packages/db/prisma/migrations/20261002120000_fotoffice_ficha_estandar/migration.sql"),
  "utf8",
);

describe("migración de la ficha estándar", () => {
  it("no altera tablas compartidas ni borra nada", () => {
    expect(sql).not.toMatch(/ALTER TABLE "(Workspace|WorkspaceMembership|WorkspaceFeatureModule|User|Member|Client|CashMovement)"/);
    expect(sql).not.toMatch(/DROP |DELETE FROM|UPDATE "(Client|Member)"/);
  });
  it("crea las ocho tablas", () => {
    for (const t of ["FotofficeNoteCategory", "FotofficeNote", "FotofficeTag", "FotofficeTagAssignment", "FotofficeAttachment", "FotofficePersonRelation", "FotofficePersonEvent", "ClientAudit"]) {
      expect(sql).toMatch(new RegExp(`CREATE TABLE "${t}"`));
    }
  });
  it("exige exactamente una persona por fila y convierte observaciones de forma idempotente", () => {
    expect(sql.match(/<> \("memberId" IS NULL\)/g)?.length).toBe(4);
    expect(sql).toMatch(/'obs_c_' \|\| c\."id"/);
    expect(sql).toMatch(/'obs_m_' \|\| m\."id"/);
    expect(sql.match(/ON CONFLICT \("id"\) DO NOTHING/g)?.length).toBe(2);
  });
});
