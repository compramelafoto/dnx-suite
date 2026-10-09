import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = join(__dirname, "..", "..", "..", "..");
const sql = readFileSync(join(RAIZ, "packages/db/prisma/migrations/20261028120000_fotoffice_etapa_6_informes/migration.sql"), "utf8");
const schema = readFileSync(join(RAIZ, "packages/db/prisma/schema.prisma"), "utf8");

function modelo(nombre: string): string {
  const m = schema.match(new RegExp(`\\nmodel ${nombre} \\{[\\s\\S]*?\\n\\}`));
  if (!m) throw new Error(`No está el modelo ${nombre}`);
  return m[0];
}

describe("migración de la etapa 6, Entrega A (informes)", () => {
  it("sólo tiene SQL y comentarios: nada de la salida de `prisma migrate diff` pegado por error", () => {
    const sueltas = sql.split("\n").filter((l) => /^(warn|info|error)\b|pris\.ly/i.test(l.trim()));
    expect(sueltas).toEqual([]);
  });

  it("crea una sola tabla y no toca otras", () => {
    expect(sql.match(/CREATE TABLE/g)).toHaveLength(1);
    expect(sql).toMatch(/CREATE TABLE "FotofficeInformesAjustes"/);
    expect(sql).not.toMatch(/ADD COLUMN|DROP TABLE|DROP COLUMN|DELETE FROM|UPDATE "|INSERT INTO/);
    const alteradas = new Set([...sql.matchAll(/ALTER TABLE "([^"]+)"/g)].map((m) => m[1]));
    expect([...alteradas]).toEqual(["FotofficeInformesAjustes"]);
  });

  it("tiene las columnas pedidas", () => {
    for (const c of [
      `"id" TEXT NOT NULL`,
      `"workspaceId" TEXT NOT NULL`,
      `"minBalanceArs" DECIMAL(14,2),`,
      `"monotributoCategory" TEXT,`,
      `"monotributoCapArs" DECIMAL(14,2),`,
      `"monotributoWarnPct" INTEGER NOT NULL DEFAULT 80`,
      `"updatedAt" TIMESTAMP(3) NOT NULL`,
    ]) expect(sql).toContain(c);
  });

  it("workspaceId es único y cuelga del workspace con CASCADE", () => {
    expect(sql).toContain(`CREATE UNIQUE INDEX "FotofficeInformesAjustes_workspaceId_key" ON "FotofficeInformesAjustes"("workspaceId")`);
    expect(sql).toMatch(
      /ALTER TABLE "FotofficeInformesAjustes" ADD CONSTRAINT "FotofficeInformesAjustes_workspaceId_fkey" FOREIGN KEY \("workspaceId"\) REFERENCES "Workspace"\("id"\) ON DELETE CASCADE ON UPDATE CASCADE/,
    );
    expect(sql.match(/FOREIGN KEY/g)).toHaveLength(1);
  });

  it("tiene los CHECK", () => {
    expect(sql).toContain(`CHECK ("monotributoWarnPct" BETWEEN 50 AND 99)`);
    expect(sql).toContain(`CHECK ("minBalanceArs" IS NULL OR "minBalanceArs" >= 0)`);
    expect(sql).toContain(`CHECK ("monotributoCapArs" IS NULL OR "monotributoCapArs" > 0)`);
    expect(sql).toContain(`CHECK ("monotributoCategory" IS NULL OR length("monotributoCategory") <= 20)`);
  });

  it("el modelo coincide con el SQL y Workspace sólo recibe la relación inversa", () => {
    const m = modelo("FotofficeInformesAjustes");
    expect(m).toMatch(/workspaceId\s+String\s+@unique/);
    expect(m).toMatch(/monotributoWarnPct\s+Int\s+@default\(80\)/);
    expect(m).toMatch(/onDelete: Cascade/);
    expect(modelo("Workspace")).toMatch(/fotofficeInformesAjustes\s+FotofficeInformesAjustes\?/);
  });
});
