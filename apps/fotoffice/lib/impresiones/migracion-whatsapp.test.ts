import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = join(__dirname, "..", "..", "..", "..");
const CARPETA = "20270102120000_fotoffice_impresion_whatsapp";

describe("migración de pedidos de impresión por WhatsApp", () => {
  it("va después de la anterior, agrega columnas idempotentes y no borra nada", () => {
    const todas = readdirSync(join(RAIZ, "packages/db/prisma/migrations")).filter((d) => /^\d{14}_/.test(d)).sort();
    expect(todas).toContain(CARPETA);
    expect(todas.filter((d) => d < CARPETA).at(-1)).toBe("20270101120000_fotoffice_presupuesto_por_horas");
    const sql = readFileSync(join(RAIZ, "packages/db/prisma/migrations", CARPETA, "migration.sql"), "utf8");
    for (const c of ['"depositArs"', '"paidArs"', '"pagosExtra"', '"waChatId"', '"waId"', '"plazo"', '"sinRecorte"', '"calidadBaja"', '"depositPct"']) {
      expect(sql).toContain(`ADD COLUMN IF NOT EXISTS ${c}`);
    }
    expect(sql).toContain(`ALTER COLUMN "email" DROP NOT NULL`);
    expect(sql).not.toMatch(/DROP TABLE|DELETE FROM|UPDATE "/);
  });
});
