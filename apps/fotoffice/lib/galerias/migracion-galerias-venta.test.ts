import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = join(__dirname, "..", "..", "..", "..");
const sql = readFileSync(join(RAIZ, "packages/db/prisma/migrations/20261102120000_fotoffice_etapa_7_galeria_venta/migration.sql"), "utf8");
const schema = readFileSync(join(RAIZ, "packages/db/prisma/schema.prisma"), "utf8");

function modelo(nombre: string): string {
  const m = schema.match(new RegExp(`\\nmodel ${nombre} \\{[\\s\\S]*?\\n\\}`));
  if (!m) throw new Error(`No está el modelo ${nombre}`);
  return m[0];
}

describe("migración de la etapa 7, Entrega A2 (venta de fotos extra)", () => {
  it("sólo tiene SQL y comentarios", () => {
    const sueltas = sql.split("\n").filter((l) => /^(warn|info|error)\b|pris\.ly|^For more information/i.test(l.trim()));
    expect(sueltas).toEqual([]);
    const raras = sql.split("\n").map((l) => l.trim()).filter((l) => l !== "" && !l.startsWith("--") && !/^[A-Z"(),;\s]|^[A-Za-z]/.test(l));
    expect(raras).toEqual([]);
  });

  it("crea sólo las dos tablas nuevas y altera sólo las dos de la Entrega A1", () => {
    expect([...sql.matchAll(/CREATE TABLE "([^"]+)"/g)].map((m) => m[1]).sort()).toEqual(["FotofficeGaleriaCompra", "FotofficeGaleriaCompraFoto"]);
    const alteradas = new Set([...sql.matchAll(/ALTER TABLE "([^"]+)"/g)].map((m) => m[1]));
    for (const t of alteradas) expect(["FotofficeGaleria", "FotofficeGaleriaAjustes", "FotofficeGaleriaCompra", "FotofficeGaleriaCompraFoto"]).toContain(t);
    expect(sql).not.toMatch(/DROP |DELETE FROM|UPDATE "|INSERT INTO|CulturalActivityWork|PhotographerProfile/);
  });

  it("suma las columnas de FotofficeGaleria con sus valores por omisión", () => {
    for (const c of [
      `"includedCount" INTEGER NOT NULL DEFAULT 0`, `"pricingMode" TEXT`, `"unitPriceArs" DECIMAL(14,2)`, `"packageSize" INTEGER`,
      `"packagePriceArs" DECIMAL(14,2)`, `"discountMode" TEXT NOT NULL DEFAULT 'NINGUNO'`, `"discountPct" INTEGER`,
      `"discountRules" JSONB`, `"incomeCategoryId" TEXT`, `"defaultIncomeCategoryId" TEXT`,
    ]) expect(sql, c).toContain(c);
  });

  it("las tablas nuevas tienen columnas, únicos e índices", () => {
    for (const c of [
      `"extraCount" INTEGER NOT NULL`, `"subtotalArs" DECIMAL(14,2) NOT NULL`, `"totalArs" DECIMAL(14,2) NOT NULL`,
      `"pricingSnapshot" JSONB NOT NULL`, `"feeArs" DECIMAL(14,2)`, `"netArs" DECIMAL(14,2)`,
      `CREATE UNIQUE INDEX "FotofficeGaleriaCompra_providerPaymentRef_key" ON "FotofficeGaleriaCompra"("providerPaymentRef")`,
      `CREATE UNIQUE INDEX "FotofficeGaleriaCompra_cashMovementId_key" ON "FotofficeGaleriaCompra"("cashMovementId")`,
      `ON "FotofficeGaleriaCompra"("galeriaClienteId", "status")`,
      `CREATE UNIQUE INDEX "FotofficeGaleriaCompraFoto_compraId_fotoId_key" ON "FotofficeGaleriaCompraFoto"("compraId", "fotoId")`,
      `ON "FotofficeGaleriaCompraFoto"("fotoId")`,
    ]) expect(sql, c).toContain(c);
  });

  it("FKs: rubros y movimiento se sueltan; compras cuelgan en cascada", () => {
    const fk = (tabla: string, col: string, destino: string, accion: string) =>
      expect(sql).toMatch(new RegExp(`ALTER TABLE "${tabla}" ADD CONSTRAINT "${tabla}_${col}_fkey" FOREIGN KEY \\("${col}"\\) REFERENCES "${destino}"\\("id"\\) ON DELETE ${accion}`));
    fk("FotofficeGaleria", "incomeCategoryId", "CashCategory", "SET NULL");
    fk("FotofficeGaleriaAjustes", "defaultIncomeCategoryId", "CashCategory", "SET NULL");
    fk("FotofficeGaleriaCompra", "workspaceId", "Workspace", "CASCADE");
    fk("FotofficeGaleriaCompra", "galeriaId", "FotofficeGaleria", "CASCADE");
    fk("FotofficeGaleriaCompra", "galeriaClienteId", "FotofficeGaleriaCliente", "CASCADE");
    fk("FotofficeGaleriaCompra", "cashMovementId", "CashMovement", "SET NULL");
    fk("FotofficeGaleriaCompraFoto", "compraId", "FotofficeGaleriaCompra", "CASCADE");
    fk("FotofficeGaleriaCompraFoto", "fotoId", "FotofficeGaleriaFoto", "CASCADE");
    expect(sql.match(/FOREIGN KEY/g)).toHaveLength(8);
  });

  it("tiene los CHECK de rangos, modos, estados y coherencia", () => {
    for (const c of [
      `"FotofficeGaleria_includedCount" CHECK ("includedCount" >= 0)`,
      `CHECK ("pricingMode" IS NULL OR "pricingMode" IN ('POR_FOTO', 'PAQUETE'))`,
      `CHECK ("unitPriceArs" IS NULL OR "unitPriceArs" > 0)`,
      `CHECK ("packageSize" IS NULL OR "packageSize" >= 2)`,
      `CHECK ("packagePriceArs" IS NULL OR "packagePriceArs" > 0)`,
      `CHECK ("discountMode" IN ('NINGUNO', 'UNICO', 'PROGRESIVO'))`,
      `CHECK ("discountPct" IS NULL OR ("discountPct" >= 1 AND "discountPct" <= 90))`,
      `jsonb_array_length("discountRules") <= 4`,
      `"FotofficeGaleriaCompra_status" CHECK ("status" IN ('PENDIENTE', 'PAGADA', 'CANCELADA'))`,
      `"totalArs" > 0`,
    ]) expect(sql, c).toContain(c);
    const venta = sql.slice(sql.indexOf(`"FotofficeGaleria_ventaCompleta"`), sql.indexOf(`"FotofficeGaleria_descuentoCompleto"`));
    expect(venta).toContain(`"saleMode" = 'SELECCION'`);
    expect(venta).toContain(`"pricingMode" IS NOT NULL`);
    const desc = sql.slice(sql.indexOf(`"FotofficeGaleria_descuentoCompleto"`), sql.indexOf(`"FotofficeGaleriaCompra_status"`));
    expect(desc).not.toContain("saleMode");
    expect(desc).toContain(`"discountMode" = 'UNICO' AND "discountPct" IS NOT NULL`);
    expect(venta).toContain(`"pricingMode" = 'POR_FOTO' AND "unitPriceArs" IS NOT NULL`);
    expect(venta).toContain(`"pricingMode" = 'PAQUETE' AND "packageSize" IS NOT NULL AND "packagePriceArs" IS NOT NULL`);
  });

  it("el schema tiene los modelos, columnas y relaciones inversas", () => {
    expect(modelo("FotofficeGaleria")).toMatch(/includedCount\s+Int\s+@default\(0\)/);
    expect(modelo("FotofficeGaleria")).toMatch(/discountMode\s+String\s+@default\("NINGUNO"\)/);
    expect(modelo("FotofficeGaleriaAjustes")).toMatch(/defaultIncomeCategoryId\s+String\?/);
    expect(modelo("FotofficeGaleriaCompra")).toMatch(/providerPaymentRef\s+String\?\s+@unique/);
    expect(modelo("FotofficeGaleriaCompra")).toMatch(/cashMovementId\s+String\?\s+@unique/);
    expect(modelo("FotofficeGaleriaCompraFoto")).toMatch(/@@unique\(\[compraId, fotoId\]\)/);
    expect(modelo("Workspace")).toMatch(/fotofficeGaleriaCompras\s+FotofficeGaleriaCompra\[\]/);
    expect(modelo("CashMovement")).toMatch(/fotofficeGaleriaCompra\s+FotofficeGaleriaCompra\?/);
    expect(modelo("CashCategory")).toMatch(/fotofficeGaleriasIngreso\s+FotofficeGaleria\[\]/);
  });
});
