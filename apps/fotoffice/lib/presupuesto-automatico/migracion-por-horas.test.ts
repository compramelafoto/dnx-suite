import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = join(__dirname, "..", "..", "..", "..");
const CARPETA = "20270101120000_fotoffice_presupuesto_por_horas";
const sql = readFileSync(join(RAIZ, "packages/db/prisma/migrations", CARPETA, "migration.sql"), "utf8");

describe("migración del presupuesto por horas", () => {
  it("es la última y sólo agrega una columna JSON opcional, idempotente", () => {
    const todas = readdirSync(join(RAIZ, "packages/db/prisma/migrations")).filter((d) => /^\d{14}_/.test(d)).sort();
    expect(todas.at(-1)).toBe(CARPETA);
    expect(sql).toContain(`ALTER TABLE "FotofficePresupuestoAutoAjustes" ADD COLUMN IF NOT EXISTS "porHoras" JSONB;`);
    expect(sql).not.toMatch(/DROP |DELETE FROM|UPDATE "|NOT NULL/);
  });
});
