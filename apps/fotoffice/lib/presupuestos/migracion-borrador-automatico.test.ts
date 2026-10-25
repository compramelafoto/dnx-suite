import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = join(__dirname, "..", "..", "..", "..");
const sql = readFileSync(
  join(RAIZ, "packages/db/prisma/migrations/20261023100000_fotoffice_propuesta_borrador_auto/migration.sql"),
  "utf8",
);
const schema = readFileSync(join(RAIZ, "packages/db/prisma/schema.prisma"), "utf8");

function modelo(nombre: string): string {
  const m = schema.match(new RegExp(`\\nmodel ${nombre} \\{[\\s\\S]*?\\n\\}`));
  if (!m) throw new Error(`No está el modelo ${nombre}`);
  return m[0];
}

describe("migración del borrador automático", () => {
  it("crea sólo la tabla del interruptor y no toca ninguna otra", () => {
    expect(sql.match(/CREATE TABLE/g)).toHaveLength(1);
    expect(sql).toContain(`CREATE TABLE "FotofficePropuestaBorradorAuto"`);
    expect(sql).not.toMatch(/ALTER TABLE "(?!FotofficePropuestaBorradorAuto")/);
    expect(sql).not.toMatch(/DROP |DELETE FROM|UPDATE "|ADD COLUMN/);
  });

  it("una fila por categoría y workspace, con índice por la FK de la categoría", () => {
    expect(sql).toContain(
      `CREATE UNIQUE INDEX "FotofficePropuestaBorradorAuto_workspaceId_categoryId_key" ON "FotofficePropuestaBorradorAuto"("workspaceId", "categoryId")`,
    );
    expect(sql).toContain(`ON "FotofficePropuestaBorradorAuto"("categoryId")`);
  });

  it("FKs en cascada hacia workspace y categoría", () => {
    for (const [col, destino] of [["workspaceId", "Workspace"], ["categoryId", "FotofficeConsultaCategoria"]]) {
      expect(sql).toMatch(
        new RegExp(
          `ALTER TABLE "FotofficePropuestaBorradorAuto" ADD CONSTRAINT "FotofficePropuestaBorradorAuto_${col}_fkey" FOREIGN KEY \\("${col}"\\) REFERENCES "${destino}"\\("id"\\) ON DELETE CASCADE`,
        ),
      );
    }
  });

  it("el esquema coincide y las tablas existentes sólo reciben relaciones inversas", () => {
    const m = modelo("FotofficePropuestaBorradorAuto");
    for (const c of ["workspaceId", "categoryId", "createdAt", "createdByUserId"]) {
      expect(m).toMatch(new RegExp(`^\\s+${c}\\s`, "m"));
    }
    expect(m).toContain("@@unique([workspaceId, categoryId])");
    expect(m).toContain("@@index([categoryId])");
    expect(modelo("FotofficeConsultaCategoria")).toMatch(/borradoresAuto\s+FotofficePropuestaBorradorAuto\[\]/);
    expect(modelo("Workspace")).toMatch(/fotofficeBorradoresAuto\s+FotofficePropuestaBorradorAuto\[\]/);
  });
});
