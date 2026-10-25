import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CLASES_HISTORICO, ESTADOS_LOTE, ORIGENES_HISTORICO } from "./tipos";

const RAIZ = join(__dirname, "..", "..", "..", "..");
const sql = readFileSync(join(RAIZ, "packages/db/prisma/migrations/20261214120000_fotoffice_historico_caja/migration.sql"), "utf8");
const schema = readFileSync(join(RAIZ, "packages/db/prisma/schema.prisma"), "utf8");

describe("migración del histórico de Caja (etapa E)", () => {
  it("sólo tiene SQL y comentarios", () => {
    const sueltas = sql.split("\n").filter((l) => /^(warn|info|error)\b|pris\.ly/i.test(l.trim()));
    expect(sueltas).toEqual([]);
  });

  it("es aditiva: crea tres tablas nuevas y no toca otras", () => {
    expect(sql.match(/CREATE TABLE/g)).toHaveLength(3);
    expect(sql).not.toMatch(/ADD COLUMN|DROP |DELETE FROM|UPDATE "|INSERT INTO|"CashMovement"/);
    const alteradas = new Set([...sql.matchAll(/ALTER TABLE "([^"]+)"/g)].map((m) => m[1]));
    expect([...alteradas].sort()).toEqual(["FotofficeHistoricoLote", "FotofficeHistoricoMapeo", "FotofficeHistoricoMovimiento"]);
  });

  it("es idempotente: se puede correr dos veces", () => {
    expect(sql.match(/CREATE TABLE IF NOT EXISTS/g)).toHaveLength(3);
    expect(sql).not.toMatch(/CREATE (UNIQUE )?INDEX "/);
    const constraints = sql.match(/ADD CONSTRAINT/g) ?? [];
    expect(sql.match(/IF NOT EXISTS \(SELECT 1 FROM pg_constraint/g)).toHaveLength(constraints.length);
  });

  it("los CHECK coinciden con las constantes del código", () => {
    for (const c of CLASES_HISTORICO) expect(sql).toContain(`'${c}'`);
    for (const e of ESTADOS_LOTE) expect(sql).toContain(`'${e}'`);
    for (const o of ORIGENES_HISTORICO) expect(sql).toContain(`'${o}'`);
    expect(sql).toContain(`CHECK ("importeArs" <> 0)`);
  });

  it("un lote por workspace y mes; los movimientos caen con su lote", () => {
    expect(sql).toContain(`CREATE UNIQUE INDEX IF NOT EXISTS "FotofficeHistoricoLote_workspaceId_mes_key"`);
    expect(sql).toMatch(/FotofficeHistoricoMovimiento_loteId_fkey.*ON DELETE CASCADE/);
  });

  it("el esquema tiene los tres modelos", () => {
    for (const m of ["FotofficeHistoricoLote", "FotofficeHistoricoMovimiento", "FotofficeHistoricoMapeo"]) {
      expect(schema).toMatch(new RegExp(`\\nmodel ${m} \\{`));
    }
  });
});
