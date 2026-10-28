import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = join(__dirname, "..", "..", "..", "..");
const CARPETA = "20270101120000_fotoffice_presupuesto_por_horas";
const sql = readFileSync(join(RAIZ, "packages/db/prisma/migrations", CARPETA, "migration.sql"), "utf8");

describe("migración del presupuesto por horas", () => {
  it("va después de la que existía y sólo agrega una columna JSON opcional, idempotente", () => {
    const todas = readdirSync(join(RAIZ, "packages/db/prisma/migrations")).filter((d) => /^\d{14}_/.test(d)).sort();
    expect(todas).toContain(CARPETA);
    expect(todas.filter((d) => d < CARPETA).at(-1)).toBe("20261231120000_fotoffice_sitio_visitas_documentos");
    expect(sql).toContain(`ALTER TABLE "FotofficePresupuestoAutoAjustes" ADD COLUMN IF NOT EXISTS "porHoras" JSONB;`);
    expect(sql).not.toMatch(/DROP |DELETE FROM|UPDATE "|NOT NULL/);
  });
});
