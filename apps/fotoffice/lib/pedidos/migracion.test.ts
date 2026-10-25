import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = join(__dirname, "..", "..", "..", "..");
const sql = readFileSync(
  join(RAIZ, "packages/db/prisma/migrations/20261022120000_fotoffice_etapa_3_pedidos/migration.sql"),
  "utf8",
);
const schema = readFileSync(join(RAIZ, "packages/db/prisma/schema.prisma"), "utf8");

const TABLAS = [
  "FotofficePedido",
  "FotofficePedidoCuota",
  "FotofficeCobro",
  "FotofficeCobroImputacion",
  "FotofficeRubro",
];

/** Las únicas columnas nuevas en tablas existentes: todas propias de FOTOFFICE y que admiten nulo. */
const COLUMNAS_NUEVAS = [
  `ALTER TABLE "FotofficeProductoCatalogo" ADD COLUMN     "incomeCategoryId" TEXT;`,
  `ALTER TABLE "FotofficePresupuestoVersion" ADD COLUMN     "chosenPaymentOptionId" TEXT,\nADD COLUMN     "paymentOptions" JSONB;`,
  `ALTER TABLE "FotofficePresupuestoAjustes" ADD COLUMN     "paymentOptions" JSONB;`,
];

const MEDIOS = `('EFECTIVO', 'TRANSFERENCIA', 'MERCADO_PAGO', 'TARJETA', 'OTRO')`;

/** El único cambio en una tabla existente: el CHECK del tipo de plantilla suma 'PEDIDO' (Task 5). */
const CHECK_PLANTILLA = [
  `ALTER TABLE "FotofficeMessageTemplate" DROP CONSTRAINT IF EXISTS "FotofficeMessageTemplate_entityType";`,
  `ALTER TABLE "FotofficeMessageTemplate" ADD CONSTRAINT "FotofficeMessageTemplate_entityType" CHECK ("entityType" IN ('GENERAL', 'CLIENTE', 'SOCIO', 'CONSULTA', 'PRESUPUESTO', 'PEDIDO'));`,
];

function modelo(nombre: string): string {
  const m = schema.match(new RegExp(`\\nmodel ${nombre} \\{[\\s\\S]*?\\n\\}`));
  if (!m) throw new Error(`No está el modelo ${nombre}`);
  return m[0];
}

describe("migración de la etapa 3 (pedidos y cobros)", () => {
  const sinColumnas = [...COLUMNAS_NUEVAS, ...CHECK_PLANTILLA].reduce((t, linea) => t.replace(linea, ""), sql);

  it("sólo suma columnas que admiten nulo en tablas propias de la etapa 2", () => {
    for (const linea of COLUMNAS_NUEVAS) expect(sql).toContain(linea);
    expect(sinColumnas).not.toMatch(/ADD COLUMN/);
  });

  it("no altera tablas compartidas ni borra o actualiza nada", () => {
    // Los ALTER que quedan son de FKs y CHECKs de tablas Fotoffice*.
    const alteradas = new Set([...sinColumnas.matchAll(/ALTER TABLE "([^"]+)"/g)].map((m) => m[1]));
    for (const t of alteradas) expect([...TABLAS, "FotofficeProductoCatalogo"]).toContain(t);
    for (const t of ["CashCategory", "CashMovement", "Product", "Client", "Workspace", "ServiceSalesLead"]) {
      expect(sql).not.toMatch(new RegExp(`ALTER TABLE "${t}"`));
    }
    expect(sinColumnas).not.toMatch(/DROP |DELETE FROM|UPDATE "|INSERT INTO/);
  });

  it("sólo amplía el CHECK del tipo de plantilla con PEDIDO (la misma lista de la etapa 2 más PEDIDO)", () => {
    for (const linea of CHECK_PLANTILLA) expect(sql).toContain(linea);
    // El DROP va antes que el ADD, y es el único DROP del archivo.
    expect(sql.indexOf(CHECK_PLANTILLA[0]!)).toBeLessThan(sql.indexOf(CHECK_PLANTILLA[1]!));
    expect(sql.match(/DROP /g)).toHaveLength(1);
  });

  it("crea las cinco tablas nuevas y nada más", () => {
    for (const t of TABLAS) expect(sql).toMatch(new RegExp(`CREATE TABLE "${t}"`));
    expect(sql.match(/CREATE TABLE/g)).toHaveLength(5);
  });

  it("guarda el dinero en DECIMAL(12,2) y los vencimientos y el evento en DATE", () => {
    expect(sql).toContain(`"totalArs" DECIMAL(12,2) NOT NULL`);
    expect(sql.match(/"amountArs" DECIMAL\(12,2\) NOT NULL/g)).toHaveLength(3);
    expect(sql).toContain(`"feeArs" DECIMAL(12,2),`);
    expect(sql).toContain(`"netArs" DECIMAL(12,2),`);
    expect(sql).toContain(`"dueDate" DATE NOT NULL`);
    expect(sql).toContain(`"eventDate" DATE,`);
    expect(sql).not.toMatch(/DOUBLE PRECISION|REAL/);
  });

  it("tiene los únicos", () => {
    for (const u of [
      `"FotofficePedido_workspaceId_number_key" ON "FotofficePedido"("workspaceId", "number")`,
      `"FotofficePedido_presupuestoId_key" ON "FotofficePedido"("presupuestoId")`,
      `"FotofficePedido_accessTokenHash_key" ON "FotofficePedido"("accessTokenHash")`,
      `"FotofficeCobro_cashMovementId_key" ON "FotofficeCobro"("cashMovementId")`,
      `"FotofficeCobro_voidCashMovementId_key" ON "FotofficeCobro"("voidCashMovementId")`,
      `"FotofficeCobro_providerPaymentRef_key" ON "FotofficeCobro"("providerPaymentRef")`,
      `"FotofficeCobro_receiptTokenHash_key" ON "FotofficeCobro"("receiptTokenHash")`,
      `"FotofficeCobro_workspaceId_receiptNumber_key" ON "FotofficeCobro"("workspaceId", "receiptNumber")`,
      `"FotofficeCobro_workspaceId_idempotencyKey_key" ON "FotofficeCobro"("workspaceId", "idempotencyKey")`,
      `"FotofficeCobroImputacion_cobroId_cuotaId_key" ON "FotofficeCobroImputacion"("cobroId", "cuotaId")`,
      `"FotofficeRubro_categoryId_key" ON "FotofficeRubro"("categoryId")`,
    ]) {
      expect(sql).toContain(`CREATE UNIQUE INDEX ${u}`);
    }
  });

  it("tiene los índices de la lista de pedidos y de las búsquedas por FK", () => {
    for (const c of ["status", "clientId", "consultaLeadId", "eventDate"]) {
      expect(sql).toContain(`ON "FotofficePedido"("workspaceId", "${c}")`);
    }
    for (const [tabla, col] of [
      ["FotofficePedido", "consultaLeadId"],
      ["FotofficePedido", "clientId"],
      ["FotofficePedido", "acceptedVersionId"],
      ["FotofficePedido", "incomeCategoryId"],
      ["FotofficeCobro", "pedidoId"],
      ["FotofficeCobro", "clientId"],
      ["FotofficeCobro", "attachmentId"],
      ["FotofficeCobroImputacion", "cuotaId"],
      ["FotofficeRubro", "parentCategoryId"],
      ["FotofficeProductoCatalogo", "incomeCategoryId"],
    ]) {
      expect(sql).toContain(`ON "${tabla}"("${col}")`);
    }
    expect(sql).toContain(`ON "FotofficePedidoCuota"("pedidoId", "position")`);
    expect(sql).toContain(`ON "FotofficePedidoCuota"("workspaceId", "dueDate")`);
    expect(sql).toContain(`ON "FotofficeCobro"("workspaceId", "paidAt")`);
  });

  it("FKs: todo cuelga del workspace; los cobros nunca se borran solos", () => {
    const fk = (tabla: string, col: string, destino: string, accion: string) =>
      expect(sql).toMatch(
        new RegExp(`ALTER TABLE "${tabla}" ADD CONSTRAINT "${tabla}_${col}_fkey" FOREIGN KEY \\("${col}"\\) REFERENCES "${destino}"\\("id"\\) ON DELETE ${accion}`),
      );
    for (const t of TABLAS) fk(t, "workspaceId", "Workspace", "CASCADE");
    fk("FotofficePedido", "presupuestoId", "FotofficePresupuesto", "RESTRICT");
    fk("FotofficePedido", "acceptedVersionId", "FotofficePresupuestoVersion", "SET NULL");
    fk("FotofficePedido", "consultaLeadId", "ServiceSalesLead", "RESTRICT");
    fk("FotofficePedido", "clientId", "Client", "RESTRICT");
    fk("FotofficePedido", "incomeCategoryId", "CashCategory", "SET NULL");
    fk("FotofficePedidoCuota", "pedidoId", "FotofficePedido", "CASCADE");
    fk("FotofficeCobro", "pedidoId", "FotofficePedido", "RESTRICT");
    fk("FotofficeCobro", "clientId", "Client", "RESTRICT");
    fk("FotofficeCobro", "cashMovementId", "CashMovement", "SET NULL");
    fk("FotofficeCobro", "voidCashMovementId", "CashMovement", "SET NULL");
    fk("FotofficeCobro", "attachmentId", "FotofficeAttachment", "SET NULL");
    fk("FotofficeCobroImputacion", "cobroId", "FotofficeCobro", "CASCADE");
    fk("FotofficeCobroImputacion", "cuotaId", "FotofficePedidoCuota", "RESTRICT");
    fk("FotofficeRubro", "categoryId", "CashCategory", "CASCADE");
    fk("FotofficeRubro", "parentCategoryId", "CashCategory", "SET NULL");
    fk("FotofficeProductoCatalogo", "incomeCategoryId", "CashCategory", "SET NULL");
  });

  it("tiene los CHECK de estados, medios, importes, motivos y rubro padre", () => {
    expect(sql).toContain(
      `ADD CONSTRAINT "FotofficePedido_status" CHECK ("status" IN ('CONFIRMADO', 'EN_CURSO', 'COMPLETADO', 'CANCELADO'))`,
    );
    expect(sql).toContain(`CHECK ("status" <> 'CANCELADO' OR "cancelReason" IS NOT NULL)`);
    expect(sql).toContain(`"FotofficePedido_totalArs" CHECK ("totalArs" >= 0)`);
    expect(sql).toContain(`"FotofficePedidoCuota_amountArs" CHECK ("amountArs" > 0)`);
    expect(sql).toContain(`"FotofficePedidoCuota_position" CHECK ("position" >= 1)`);
    expect(sql).toContain(`CHECK ("suggestedMethod" IS NULL OR "suggestedMethod" IN ${MEDIOS})`);
    expect(sql).toContain(`"FotofficeCobro_method" CHECK ("method" IN ${MEDIOS})`);
    expect(sql).toContain(`"FotofficeCobro_amountArs" CHECK ("amountArs" > 0)`);
    expect(sql).toContain(`CHECK ("feeArs" IS NULL OR "feeArs" >= 0)`);
    expect(sql).toContain(`CHECK ("netArs" IS NULL OR "netArs" >= 0)`);
    expect(sql).toContain(`CHECK ("voidedAt" IS NULL OR "voidReason" IS NOT NULL)`);
    expect(sql).toContain(`"FotofficeCobroImputacion_amountArs" CHECK ("amountArs" > 0)`);
    expect(sql).toContain(`CHECK ("parentCategoryId" IS NULL OR "parentCategoryId" <> "categoryId")`);
  });

  it("el pedido nace CONFIRMADO", () => {
    expect(sql).toContain(`"status" TEXT NOT NULL DEFAULT 'CONFIRMADO'`);
  });

  it("CashCategory, CashMovement, Client, ServiceSalesLead y Workspace no reciben columnas, sólo relaciones inversas", () => {
    expect(modelo("CashCategory")).toMatch(/fotofficeRubro\s+FotofficeRubro\?/);
    expect(modelo("CashMovement")).toMatch(/fotofficeCobro\s+FotofficeCobro\?/);
    expect(modelo("Client")).toMatch(/fotofficePedidos\s+FotofficePedido\[\]/);
    expect(modelo("ServiceSalesLead")).toMatch(/fotofficePedidos\s+FotofficePedido\[\]/);
    expect(modelo("Workspace")).toMatch(/fotofficePedidos\s+FotofficePedido\[\]/);
    for (const m of ["CashCategory", "CashMovement", "Client", "ServiceSalesLead", "Workspace", "Product"]) {
      expect(modelo(m)).not.toMatch(/^\s+(parentCategoryId|code|incomeCategoryId|paymentOptions|pedidoId|cobroId)\s/m);
    }
  });
});
