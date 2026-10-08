import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = join(__dirname, "..", "..", "..", "..");
const sql = readFileSync(
  join(RAIZ, "packages/db/prisma/migrations/20261024120000_fotoffice_etapa_3_cuentas_a_pagar/migration.sql"),
  "utf8",
);
const schema = readFileSync(join(RAIZ, "packages/db/prisma/schema.prisma"), "utf8");

const TABLAS = ["FotofficeCuentaPagar", "FotofficeCuotaRecordatorio", "FotofficePedidoAjustes", "FotofficePedidoTarea"];

const MEDIOS = `('EFECTIVO', 'TRANSFERENCIA', 'MERCADO_PAGO', 'TARJETA', 'OTRO')`;

function modelo(nombre: string): string {
  const m = schema.match(new RegExp(`\\nmodel ${nombre} \\{[\\s\\S]*?\\n\\}`));
  if (!m) throw new Error(`No está el modelo ${nombre}`);
  return m[0];
}

describe("migración de la etapa 3, Entrega B1 (cuentas a pagar, recordatorios, ajustes y checklist)", () => {
  it("crea las cuatro tablas nuevas y nada más", () => {
    for (const t of TABLAS) expect(sql).toMatch(new RegExp(`CREATE TABLE "${t}"`));
    expect(sql.match(/CREATE TABLE/g)).toHaveLength(4);
  });

  it("no suma columnas ni toca tablas existentes, y no borra ni actualiza nada", () => {
    expect(sql).not.toMatch(/ADD COLUMN/);
    const alteradas = new Set([...sql.matchAll(/ALTER TABLE "([^"]+)"/g)].map((m) => m[1]));
    for (const t of alteradas) expect(TABLAS).toContain(t);
    expect(sql).not.toMatch(/DROP |DELETE FROM|UPDATE "|INSERT INTO/);
  });

  it("guarda el dinero en DECIMAL(12,2) y los vencimientos en DATE", () => {
    expect(sql).toContain(`"amountArs" DECIMAL(12,2) NOT NULL`);
    expect(sql).toContain(`"dueDate" DATE,`);
    expect(sql).toContain(`"dueDate" DATE NOT NULL`);
    expect(sql).not.toMatch(/DOUBLE PRECISION|REAL/);
  });

  it("los ajustes nacen con aviso un día antes y apagado", () => {
    expect(sql).toContain(`"reminderDays" INTEGER NOT NULL DEFAULT 1`);
    expect(sql).toContain(`"reminderEnabled" BOOLEAN NOT NULL DEFAULT false`);
    expect(sql).toContain(`"checklistTemplates" JSONB,`);
  });

  it("tiene los únicos", () => {
    for (const u of [
      `"FotofficeCuentaPagar_paidCashMovementId_key" ON "FotofficeCuentaPagar"("paidCashMovementId")`,
      `"FotofficeCuentaPagar_voidCashMovementId_key" ON "FotofficeCuentaPagar"("voidCashMovementId")`,
      `"FotofficeCuentaPagar_workspaceId_idempotencyKey_key" ON "FotofficeCuentaPagar"("workspaceId", "idempotencyKey")`,
      `"FotofficeCuotaRecordatorio_cuotaId_dueDate_key" ON "FotofficeCuotaRecordatorio"("cuotaId", "dueDate")`,
      `"FotofficePedidoAjustes_workspaceId_key" ON "FotofficePedidoAjustes"("workspaceId")`,
    ]) {
      expect(sql).toContain(`CREATE UNIQUE INDEX ${u}`);
    }
  });

  it("tiene los índices de las búsquedas y de cada FK", () => {
    for (const c of ["dueDate", "supplierClientId", "pedidoId"]) {
      expect(sql).toContain(`ON "FotofficeCuentaPagar"("workspaceId", "${c}")`);
    }
    for (const [tabla, col] of [
      ["FotofficeCuentaPagar", "pedidoId"],
      ["FotofficeCuentaPagar", "supplierClientId"],
      ["FotofficeCuentaPagar", "costoPlantillaId"],
      ["FotofficeCuentaPagar", "costCategoryId"],
      ["FotofficeCuentaPagar", "attachmentId"],
      ["FotofficeCuotaRecordatorio", "workspaceId"],
      ["FotofficePedidoAjustes", "incomeCategoryId"],
      ["FotofficePedidoTarea", "workspaceId"],
    ]) {
      expect(sql).toContain(`ON "${tabla}"("${col}")`);
    }
    expect(sql).toContain(`ON "FotofficePedidoTarea"("pedidoId", "position")`);
  });

  it("FKs: todo cuelga del workspace; un pedido con cuentas a pagar no se borra", () => {
    const fk = (tabla: string, col: string, destino: string, accion: string) =>
      expect(sql).toMatch(
        new RegExp(`ALTER TABLE "${tabla}" ADD CONSTRAINT "${tabla}_${col}_fkey" FOREIGN KEY \\("${col}"\\) REFERENCES "${destino}"\\("id"\\) ON DELETE ${accion}`),
      );
    for (const t of TABLAS) fk(t, "workspaceId", "Workspace", "CASCADE");
    fk("FotofficeCuentaPagar", "pedidoId", "FotofficePedido", "RESTRICT");
    fk("FotofficeCuentaPagar", "supplierClientId", "Client", "SET NULL");
    fk("FotofficeCuentaPagar", "costoPlantillaId", "FotofficeCostoPlantilla", "SET NULL");
    fk("FotofficeCuentaPagar", "costCategoryId", "CashCategory", "SET NULL");
    fk("FotofficeCuentaPagar", "paidCashMovementId", "CashMovement", "SET NULL");
    fk("FotofficeCuentaPagar", "voidCashMovementId", "CashMovement", "SET NULL");
    fk("FotofficeCuentaPagar", "attachmentId", "FotofficeAttachment", "SET NULL");
    fk("FotofficeCuotaRecordatorio", "cuotaId", "FotofficePedidoCuota", "CASCADE");
    fk("FotofficePedidoAjustes", "incomeCategoryId", "CashCategory", "SET NULL");
    fk("FotofficePedidoTarea", "pedidoId", "FotofficePedido", "CASCADE");
    expect(sql.match(/FOREIGN KEY/g)).toHaveLength(14);
  });

  it("el comprobante del pago es una columna de la tabla nueva (no toca FotofficeAttachment)", () => {
    expect(sql).toContain(`"attachmentId" TEXT,`);
    expect(modelo("FotofficeCuentaPagar")).toMatch(/attachmentId\s+String\?/);
    expect(modelo("FotofficeAttachment")).toMatch(/fotofficeCuentasPagar\s+FotofficeCuentaPagar\[\]/);
    expect(modelo("FotofficeAttachment")).not.toMatch(/^\s+attachmentId\s/m);
  });

  it("tiene los CHECK de importe, medio, pago, motivo, días y tareas", () => {
    expect(sql).toContain(`"FotofficeCuentaPagar_amountArs" CHECK ("amountArs" > 0)`);
    expect(sql).toContain(`"FotofficeCuentaPagar_paidMethod" CHECK ("paidMethod" IS NULL OR "paidMethod" IN ${MEDIOS})`);
    expect(sql).toContain(`"FotofficeCuentaPagar_paid" CHECK (("paidAt" IS NULL) = ("paidMethod" IS NULL))`);
    expect(sql).toContain(`"FotofficeCuentaPagar_voidReason" CHECK ("voidedAt" IS NULL OR "voidReason" IS NOT NULL)`);
    expect(sql).toContain(`"FotofficePedidoAjustes_reminderDays" CHECK ("reminderDays" BETWEEN 0 AND 30)`);
    expect(sql).toContain(`"FotofficePedidoTarea_position" CHECK ("position" >= 1)`);
    expect(sql).toContain(`"FotofficePedidoTarea_title" CHECK (length(trim("title")) > 0)`);
  });

  it("las tablas existentes no reciben columnas, sólo relaciones inversas", () => {
    expect(modelo("Workspace")).toMatch(/fotofficeCuentasPagar\s+FotofficeCuentaPagar\[\]/);
    expect(modelo("Workspace")).toMatch(/fotofficePedidoAjustes\s+FotofficePedidoAjustes\?/);
    expect(modelo("Client")).toMatch(/fotofficeCuentasPagar\s+FotofficeCuentaPagar\[\]/);
    expect(modelo("CashMovement")).toMatch(/fotofficeCuentaPagada\s+FotofficeCuentaPagar\?/);
    expect(modelo("CashMovement")).toMatch(/fotofficeCuentaPagoAnulado\s+FotofficeCuentaPagar\?/);
    expect(modelo("FotofficePedido")).toMatch(/cuentasPagar\s+FotofficeCuentaPagar\[\]/);
    expect(modelo("FotofficePedido")).toMatch(/tareas\s+FotofficePedidoTarea\[\]/);
    expect(modelo("FotofficePedidoCuota")).toMatch(/recordatorios\s+FotofficeCuotaRecordatorio\[\]/);
    expect(modelo("FotofficeCostoPlantilla")).toMatch(/cuentasPagar\s+FotofficeCuentaPagar\[\]/);
    for (const m of ["CashCategory", "CashMovement", "Client", "Workspace", "FotofficePedido", "FotofficePedidoCuota", "FotofficeCostoPlantilla"]) {
      expect(modelo(m)).not.toMatch(/^\s+(paidCashMovementId|voidCashMovementId|reminderDays|reminderEnabled|checklistTemplates|costoPlantillaId|costCategoryId|doneAt)\s/m);
    }
  });
});
