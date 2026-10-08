import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = join(__dirname, "..", "..", "..", "..");
const sql = readFileSync(join(RAIZ, "packages/db/prisma/migrations/20261022100000_fotoffice_perfil_precios/migration.sql"), "utf8");
const schema = readFileSync(join(RAIZ, "packages/db/prisma/schema.prisma"), "utf8");

describe("migración del perfil de precios", () => {
  it("crea sólo la tabla del perfil y no toca ninguna otra", () => {
    expect(sql.match(/CREATE TABLE/g)).toHaveLength(1);
    expect(sql).toContain(`CREATE TABLE "FotofficePerfilPrecios"`);
    expect(sql).not.toMatch(/ALTER TABLE "(?!FotofficePerfilPrecios")/);
    expect(sql).not.toMatch(/DROP |DELETE FROM|UPDATE "|ADD COLUMN/);
  });
  it("un perfil por workspace, y se borra con el workspace", () => {
    expect(sql).toContain(`CREATE UNIQUE INDEX "FotofficePerfilPrecios_workspaceId_key" ON "FotofficePerfilPrecios"("workspaceId")`);
    expect(sql).toMatch(/FOREIGN KEY \("workspaceId"\) REFERENCES "Workspace"\("id"\) ON DELETE CASCADE/);
  });
  it("el esquema de Prisma tiene el modelo con las mismas columnas", () => {
    const m = schema.match(/\nmodel FotofficePerfilPrecios \{[\s\S]*?\n\}/)?.[0] ?? "";
    for (const col of ["workspaceId", "schemaVersion", "profileData", "source", "updatedAt", "updatedByUserId"]) expect(m).toContain(col);
    expect(schema).toMatch(/fotofficePerfilPrecios\s+FotofficePerfilPrecios\?/);
  });
});
