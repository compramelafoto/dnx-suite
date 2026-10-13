import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = join(__dirname, "..", "..", "..", "..");
const sql = readFileSync(join(RAIZ, "packages/db/prisma/migrations/20261104120000_fotoffice_etapa_7_galeria_album/migration.sql"), "utf8");
const schema = readFileSync(join(RAIZ, "packages/db/prisma/schema.prisma"), "utf8");
const sqlA1 = readFileSync(join(RAIZ, "packages/db/prisma/migrations/20261101120000_fotoffice_etapa_7_galeria/migration.sql"), "utf8");

function modelo(nombre: string): string {
  const m = schema.match(new RegExp(`\\nmodel ${nombre} \\{[\\s\\S]*?\\n\\}`));
  if (!m) throw new Error(`No está el modelo ${nombre}`);
  return m[0];
}

describe("migración de la etapa 7, Entrega C (álbum por rondas)", () => {
  it("sólo tiene SQL y comentarios", () => {
    const sueltas = sql.split("\n").filter((l) => /^(warn|info|error)\b|pris\.ly|^For more information/i.test(l.trim()));
    expect(sueltas).toEqual([]);
    const raras = sql.split("\n").map((l) => l.trim()).filter((l) => l !== "" && !l.startsWith("--") && !/^[A-Z"(),;\s]|^[A-Za-z]/.test(l));
    expect(raras).toEqual([]);
  });

  it("crea sólo las dos tablas nuevas y toca sólo tablas FotofficeGaleria*", () => {
    expect([...sql.matchAll(/CREATE TABLE "([^"]+)"/g)].map((m) => m[1]).sort()).toEqual(["FotofficeGaleriaDecision", "FotofficeGaleriaRonda"]);
    const tocadas = new Set([...sql.matchAll(/(?:ALTER TABLE|CREATE TABLE|ON) "([^"]+)"/g)].map((m) => m[1]));
    for (const t of tocadas) {
      if (t === "Workspace") continue;
      expect(t, t).toMatch(/^FotofficeGaleria/);
    }
    expect(sql).not.toMatch(/DELETE FROM|UPDATE "|INSERT INTO|DROP TABLE|DROP COLUMN|CulturalActivityWork|PhotographerProfile/);
  });

  it("cambia el CHECK de kind con el mismo nombre que le puso la Entrega A1", () => {
    expect(sqlA1).toContain(`ADD CONSTRAINT "FotofficeGaleria_kind" CHECK ("kind" IN ('SELECCION', 'ENTREGA'))`);
    expect(sql).toContain(`ALTER TABLE "FotofficeGaleria" DROP CONSTRAINT "FotofficeGaleria_kind";`);
    expect(sql).toContain(`ALTER TABLE "FotofficeGaleria" ADD CONSTRAINT "FotofficeGaleria_kind" CHECK ("kind" IN ('SELECCION', 'ENTREGA', 'ALBUM'));`);
    // El DROP es el único del archivo y va antes del ADD.
    expect(sql.match(/DROP /g)).toHaveLength(1);
    expect(sql.indexOf("DROP CONSTRAINT")).toBeLessThan(sql.indexOf(`ADD CONSTRAINT "FotofficeGaleria_kind"`));
  });

  it("FotofficeGaleriaRonda: columnas, único por galería, una sola abierta, CHECK y claves en cascada", () => {
    for (const c of [
      `"number" INTEGER NOT NULL`, `"status" TEXT NOT NULL DEFAULT 'ABIERTA'`, `"note" TEXT,`, `"createdByUserId" INTEGER`, `"closedAt" TIMESTAMP(3)`,
      `CREATE UNIQUE INDEX "FotofficeGaleriaRonda_galeriaId_number_key" ON "FotofficeGaleriaRonda"("galeriaId", "number")`,
      `CREATE UNIQUE INDEX "FotofficeGaleriaRonda_galeriaId_abierta_key" ON "FotofficeGaleriaRonda"("galeriaId") WHERE "status" = 'ABIERTA'`,
      `CHECK ("number" >= 1)`, `CHECK ("status" IN ('ABIERTA', 'CERRADA'))`, `char_length("note") <= 2000`,
    ]) expect(sql, c).toContain(c);
    expect(sql).toMatch(/\("status" = 'ABIERTA' AND "closedAt" IS NULL\) OR \("status" = 'CERRADA' AND "closedAt" IS NOT NULL\)/);
    expect(sql).toMatch(/"FotofficeGaleriaRonda_workspaceId_fkey" FOREIGN KEY \("workspaceId"\) REFERENCES "Workspace"\("id"\) ON DELETE CASCADE/);
    expect(sql).toMatch(/"FotofficeGaleriaRonda_galeriaId_fkey" FOREIGN KEY \("galeriaId"\) REFERENCES "FotofficeGaleria"\("id"\) ON DELETE CASCADE/);
  });

  it("FotofficeGaleriaFoto suma rondaId (nulo, cascada) con su índice", () => {
    expect(sql).toContain(`ALTER TABLE "FotofficeGaleriaFoto" ADD COLUMN "rondaId" TEXT;`);
    expect(sql).toContain(`CREATE INDEX "FotofficeGaleriaFoto_rondaId_order_idx" ON "FotofficeGaleriaFoto"("rondaId", "order")`);
    expect(sql).toMatch(/"FotofficeGaleriaFoto_rondaId_fkey" FOREIGN KEY \("rondaId"\) REFERENCES "FotofficeGaleriaRonda"\("id"\) ON DELETE CASCADE/);
  });

  it("FotofficeGaleriaComentario suma rondaId (SET NULL) y el pin con su CHECK de 0 a 1", () => {
    for (const c of [`ADD COLUMN "rondaId" TEXT,`, `ADD COLUMN "pinX" DOUBLE PRECISION`, `ADD COLUMN "pinY" DOUBLE PRECISION`, `ADD COLUMN "pinNumber" INTEGER;`]) expect(sql, c).toContain(c);
    expect(sql).toMatch(/"FotofficeGaleriaComentario_rondaId_fkey" FOREIGN KEY \("rondaId"\) REFERENCES "FotofficeGaleriaRonda"\("id"\) ON DELETE SET NULL/);
    expect(sql).toContain(`"FotofficeGaleriaComentario_pin" CHECK (`);
    expect(sql).toContain(`("pinX" IS NULL AND "pinY" IS NULL AND "pinNumber" IS NULL)`);
    expect(sql).toContain(`"pinX" >= 0 AND "pinX" <= 1 AND "pinY" >= 0 AND "pinY" <= 1`);
  });

  it("FotofficeGaleriaDecision: única por cliente y ronda, decisión acotada y mensaje de hasta 2000", () => {
    for (const c of [
      `"decision" TEXT NOT NULL`, `"message" TEXT,`,
      `CREATE UNIQUE INDEX "FotofficeGaleriaDecision_galeriaClienteId_rondaId_key" ON "FotofficeGaleriaDecision"("galeriaClienteId", "rondaId")`,
      `CHECK ("decision" IN ('APROBADO', 'CAMBIOS'))`, `char_length("message") <= 2000`,
    ]) expect(sql, c).toContain(c);
    for (const [col, destino] of [["workspaceId", "Workspace"], ["galeriaClienteId", "FotofficeGaleriaCliente"], ["rondaId", "FotofficeGaleriaRonda"]]) {
      expect(sql).toMatch(new RegExp(`"FotofficeGaleriaDecision_${col}_fkey" FOREIGN KEY \\("${col}"\\) REFERENCES "${destino}"\\("id"\\) ON DELETE CASCADE`));
    }
  });

  it("el schema tiene los modelos, las columnas y las relaciones inversas", () => {
    expect(modelo("FotofficeGaleriaRonda")).toMatch(/@@unique\(\[galeriaId, number\]\)/);
    expect(modelo("FotofficeGaleriaRonda")).toMatch(/status\s+String\s+@default\("ABIERTA"\)/);
    expect(modelo("FotofficeGaleriaDecision")).toMatch(/@@unique\(\[galeriaClienteId, rondaId\]\)/);
    expect(modelo("FotofficeGaleriaFoto")).toMatch(/rondaId\s+String\?/);
    expect(modelo("FotofficeGaleriaFoto")).toMatch(/@@index\(\[rondaId, order\]\)/);
    expect(modelo("FotofficeGaleriaFoto")).toMatch(/ronda\s+FotofficeGaleriaRonda\?\s+@relation\(fields: \[rondaId\], references: \[id\], onDelete: Cascade\)/);
    expect(modelo("FotofficeGaleriaComentario")).toMatch(/rondaId\s+String\?/);
    expect(modelo("FotofficeGaleriaComentario")).toMatch(/pinX\s+Float\?/);
    expect(modelo("FotofficeGaleriaComentario")).toMatch(/pinY\s+Float\?/);
    expect(modelo("FotofficeGaleriaComentario")).toMatch(/pinNumber\s+Int\?/);
    expect(modelo("FotofficeGaleriaComentario")).toMatch(/ronda\s+FotofficeGaleriaRonda\?\s+@relation\(fields: \[rondaId\], references: \[id\], onDelete: SetNull\)/);
    expect(modelo("Workspace")).toMatch(/fotofficeGaleriaRondas\s+FotofficeGaleriaRonda\[\]/);
    expect(modelo("Workspace")).toMatch(/fotofficeGaleriaDecisiones\s+FotofficeGaleriaDecision\[\]/);
    expect(modelo("FotofficeGaleria")).toMatch(/rondas\s+FotofficeGaleriaRonda\[\]/);
    expect(modelo("FotofficeGaleriaCliente")).toMatch(/decisiones\s+FotofficeGaleriaDecision\[\]/);
  });
});
