import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = join(__dirname, "..", "..", "..", "..");
const sql = readFileSync(
  join(RAIZ, "packages/db/prisma/migrations/20261020120000_fotoffice_etapa_2_presupuestos/migration.sql"),
  "utf8",
);
const schema = readFileSync(join(RAIZ, "packages/db/prisma/schema.prisma"), "utf8");

const TABLAS = [
  "FotofficeProductoCatalogo",
  "FotofficeComboItem",
  "FotofficeCostoPlantilla",
  "FotofficePresupuesto",
  "FotofficePresupuestoVersion",
  "FotofficePresupuestoVista",
  "FotofficePresupuestoAjustes",
];

function modelo(nombre: string): string {
  const m = schema.match(new RegExp(`\\nmodel ${nombre} \\{[\\s\\S]*?\\n\\}`));
  if (!m) throw new Error(`No está el modelo ${nombre}`);
  return m[0];
}

describe("migración de la etapa 2 (catálogo y presupuestos)", () => {
  // Única excepción (Task 5): el CHECK del tipo de plantilla se amplía con PRESUPUESTO. Es la
  // misma lista de antes más un valor: ninguna columna nueva y nada que borrar.
  const AMPLIAR_TIPO_PLANTILLA = [
    `ALTER TABLE "FotofficeMessageTemplate" DROP CONSTRAINT IF EXISTS "FotofficeMessageTemplate_entityType";`,
    `ALTER TABLE "FotofficeMessageTemplate" ADD CONSTRAINT "FotofficeMessageTemplate_entityType" CHECK ("entityType" IN ('GENERAL', 'CLIENTE', 'SOCIO', 'CONSULTA', 'PRESUPUESTO'));`,
  ];
  const sinExcepcion = AMPLIAR_TIPO_PLANTILLA.reduce((t, linea) => t.replace(linea, ""), sql);

  it("no altera tablas existentes ni borra nada (salvo ampliar el CHECK del tipo de plantilla)", () => {
    for (const linea of AMPLIAR_TIPO_PLANTILLA) expect(sql).toContain(linea);
    expect(sinExcepcion).not.toMatch(new RegExp(`ALTER TABLE "(?!(${TABLAS.join("|")})")`));
    expect(sinExcepcion).not.toMatch(/DROP |DELETE FROM|UPDATE "|ADD COLUMN/);
  });

  it("crea las siete tablas de la Entrega A y nada más (sin la propuesta modelo)", () => {
    for (const t of TABLAS) expect(sql).toMatch(new RegExp(`CREATE TABLE "${t}"`));
    expect(sql.match(/CREATE TABLE/g)).toHaveLength(7);
    expect(sql).not.toContain(`CREATE TABLE "FotofficePropuestaModelo"`);
  });

  it("tiene los únicos", () => {
    for (const u of [
      `"FotofficeProductoCatalogo_productId_key" ON "FotofficeProductoCatalogo"("productId")`,
      `"FotofficeComboItem_comboProductId_componentProductId_key" ON "FotofficeComboItem"("comboProductId", "componentProductId")`,
      `"FotofficePresupuesto_currentVersionId_key" ON "FotofficePresupuesto"("currentVersionId")`,
      `"FotofficePresupuesto_acceptedVersionId_key" ON "FotofficePresupuesto"("acceptedVersionId")`,
      `"FotofficePresupuestoVersion_tokenHash_key" ON "FotofficePresupuestoVersion"("tokenHash")`,
      `"FotofficePresupuestoVersion_presupuestoId_number_key" ON "FotofficePresupuestoVersion"("presupuestoId", "number")`,
      `"FotofficePresupuestoAjustes_workspaceId_key" ON "FotofficePresupuestoAjustes"("workspaceId")`,
    ]) {
      expect(sql).toContain(`CREATE UNIQUE INDEX ${u}`);
    }
  });

  it("tiene los índices de la lista de presupuestos", () => {
    for (const c of ["status", "consultaLeadId", "clientId", "validUntil"]) {
      expect(sql).toContain(`ON "FotofficePresupuesto"("workspaceId", "${c}")`);
    }
  });

  it("tiene índices que empiezan por la FK para borrar producto, consulta o contacto sin recorrer la tabla", () => {
    expect(sql).toContain('ON "FotofficeCostoPlantilla"("productId")');
    expect(sql).toContain('ON "FotofficePresupuesto"("consultaLeadId")');
    expect(sql).toContain('ON "FotofficePresupuesto"("clientId")');
  });

  it("FKs: todo cuelga del workspace; borrar un proveedor no borra el costo", () => {
    const fk = (tabla: string, col: string, destino: string, accion: string) =>
      expect(sql).toMatch(
        new RegExp(`ALTER TABLE "${tabla}" ADD CONSTRAINT "${tabla}_${col}_fkey" FOREIGN KEY \\("${col}"\\) REFERENCES "${destino}"\\("id"\\) ON DELETE ${accion}`),
      );
    for (const t of TABLAS) fk(t, "workspaceId", "Workspace", "CASCADE");
    fk("FotofficeProductoCatalogo", "productId", "Product", "CASCADE");
    fk("FotofficeComboItem", "comboProductId", "Product", "CASCADE");
    fk("FotofficeComboItem", "componentProductId", "Product", "CASCADE");
    fk("FotofficeCostoPlantilla", "productId", "Product", "CASCADE");
    fk("FotofficeCostoPlantilla", "supplierClientId", "Client", "SET NULL");
    fk("FotofficePresupuesto", "consultaLeadId", "ServiceSalesLead", "RESTRICT");
    fk("FotofficePresupuesto", "clientId", "Client", "RESTRICT");
    fk("FotofficePresupuesto", "currentVersionId", "FotofficePresupuestoVersion", "SET NULL");
    fk("FotofficePresupuesto", "acceptedVersionId", "FotofficePresupuestoVersion", "SET NULL");
    fk("FotofficePresupuestoVersion", "presupuestoId", "FotofficePresupuesto", "CASCADE");
    fk("FotofficePresupuestoVista", "versionId", "FotofficePresupuestoVersion", "CASCADE");
  });

  it("tiene los CHECK de estado, combos, importes y ajustes", () => {
    expect(sql).toMatch(
      /ADD CONSTRAINT "FotofficePresupuesto_status" CHECK \("status" IN \('BORRADOR', 'ENVIADO', 'VISTO', 'ACEPTADO', 'RECHAZADO', 'VENCIDO'\)\)/,
    );
    expect(sql).toContain(`CHECK ("comboProductId" <> "componentProductId")`);
    expect(sql).toContain(`CHECK ("quantity" > 0)`);
    expect(sql).toContain(`CHECK ("amountArs" >= 0)`);
    expect(sql).toContain(`CHECK ("number" >= 1)`);
    expect(sql).toContain(`CHECK ("acceptedAt" IS NULL OR "sentAt" IS NOT NULL)`);
    expect(sql).toContain(`CHECK ("validityDays" BETWEEN 1 AND 365)`);
  });

  it("nace en borrador, con 15 días de validez y seguimiento a 3 días apagado", () => {
    expect(sql).toContain(`"status" TEXT NOT NULL DEFAULT 'BORRADOR'`);
    expect(sql).toContain(`"validityDays" INTEGER NOT NULL DEFAULT 15`);
    expect(sql).toContain(`"followUpDays" INTEGER NOT NULL DEFAULT 3`);
    expect(sql).toContain(`"followUpEnabled" BOOLEAN NOT NULL DEFAULT false`);
  });

  it("Product, Client y ServiceSalesLead no reciben columnas, sólo relaciones inversas", () => {
    const producto = modelo("Product");
    expect(producto).toMatch(/fotofficeCatalogo\s+FotofficeProductoCatalogo\?/);
    expect(modelo("Client")).toMatch(/fotofficePresupuestos\s+FotofficePresupuesto\[\]/);
    expect(modelo("ServiceSalesLead")).toMatch(/fotofficePresupuestos\s+FotofficePresupuesto\[\]/);
    for (const m of [producto, modelo("Client"), modelo("ServiceSalesLead")]) {
      expect(m).not.toMatch(/^\s+(inPriceList|incomeLabel|isCombo|validUntil|pedidoPorConfirmar)\s/m);
    }
  });
});
