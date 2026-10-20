import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** La migración de la etapa B: sólo tablas nuevas (nada que rompa las lecturas de lo que ya existe). */
const SQL = readFileSync(join(process.cwd(), "../../packages/db/prisma/migrations/20261117120000_fotoffice_etapa_b_cobro_al_aceptar/migration.sql"), "utf8");
const SCHEMA = readFileSync(join(process.cwd(), "../../packages/db/prisma/schema.prisma"), "utf8");
const sinComentarios = SQL.replace(/^\s*--.*$/gm, "");

describe("migración de la etapa B", () => {
  it("crea las dos tablas y no toca columnas de tablas existentes", () => {
    expect(sinComentarios).toContain('CREATE TABLE "FotofficeCobroAjustes"');
    expect(sinComentarios).toContain('CREATE TABLE "FotofficeEsperaPago"');
    // Los únicos ALTER son las FKs de las tablas nuevas.
    for (const m of sinComentarios.matchAll(/ALTER TABLE "([^"]+)" (\w+)/g)) {
      expect(["FotofficeCobroAjustes", "FotofficeEsperaPago"]).toContain(m[1]);
      expect(m[2]).toBe("ADD");
    }
    expect(sinComentarios).not.toMatch(/\bDROP\b|^\s*UPDATE\b|DELETE FROM|ADD COLUMN/im);
  });

  it("una espera abierta por cuota, monto único sin repetir, estados y montos con CHECK", () => {
    expect(sinComentarios).toMatch(/UNIQUE INDEX "FotofficeEsperaPago_cuota_abierta_key" ON "FotofficeEsperaPago"\("cuotaId"\) WHERE "estado" = 'ESPERANDO'/);
    expect(sinComentarios).toMatch(/UNIQUE INDEX "FotofficeEsperaPago_monto_unico_key"[\s\S]*WHERE "estado" = 'ESPERANDO' AND "importeUnicoArs" IS NOT NULL/);
    expect(sinComentarios).toContain("CHECK (\"estado\" IN ('ESPERANDO', 'CONCILIADA', 'ANULADA'))");
    expect(sinComentarios).toMatch(/"importeUnicoArs" <= "importeEsperadoArs" \+ 99/);
  });

  it("el esquema de Prisma tiene los mismos modelos y el interruptor nace apagado", () => {
    expect(SCHEMA).toMatch(/model FotofficeCobroAjustes \{[\s\S]*autoConfirmarPedido Boolean\s+@default\(false\)/);
    expect(SCHEMA).toMatch(/model FotofficeEsperaPago \{/);
    expect(sinComentarios).toContain('"autoConfirmarPedido" BOOLEAN NOT NULL DEFAULT false');
  });
});
