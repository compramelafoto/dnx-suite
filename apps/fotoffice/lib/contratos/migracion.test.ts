import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = join(__dirname, "..", "..", "..", "..");
const sql = readFileSync(join(RAIZ, "packages/db/prisma/migrations/20261027120000_fotoffice_etapa_5_contratos/migration.sql"), "utf8");
const schema = readFileSync(join(RAIZ, "packages/db/prisma/schema.prisma"), "utf8");

const TABLAS = [
  "FotofficeContratoPlantilla", "FotofficePedidoContratante", "FotofficeContrato", "FotofficeContratoVersion",
  "FotofficeContratoFirmante", "FotofficeContratoEvento", "FotofficeContratoAjustes",
];

function modelo(nombre: string): string {
  const m = schema.match(new RegExp(`\\nmodel ${nombre} \\{[\\s\\S]*?\\n\\}`));
  if (!m) throw new Error(`No está el modelo ${nombre}`);
  return m[0];
}

describe("migración de la etapa 5 (contratos)", () => {
  it("sólo tiene SQL y comentarios: nada de la salida de `prisma migrate diff` pegado por error", () => {
    const sueltas = sql.split("\n").filter((l) => /^(warn|info|error)\b|pris\.ly/i.test(l.trim()));
    expect(sueltas).toEqual([]);
    const noSql = sql
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("--") && !/^(CREATE|ALTER|\)|"|CONSTRAINT)/i.test(l));
    expect(noSql).toEqual([]);
  });

  it("crea las siete tablas nuevas y nada más; no suma columnas ni borra ni actualiza filas", () => {
    for (const t of TABLAS) expect(sql).toMatch(new RegExp(`CREATE TABLE "${t}"`));
    expect(sql.match(/CREATE TABLE/g)).toHaveLength(7);
    expect(sql).not.toMatch(/ADD COLUMN/);
    const alteradas = new Set([...sql.matchAll(/ALTER TABLE "([^"]+)"/g)].map((m) => m[1]));
    for (const t of alteradas) expect([...TABLAS, "FotofficeMessageTemplate"]).toContain(t);
    expect(sql).not.toMatch(/DROP TABLE|DROP COLUMN|DELETE FROM|UPDATE "|INSERT INTO/);
  });

  it("tiene los únicos", () => {
    for (const u of [
      `"FotofficeContratoPlantilla_workspaceId_name_key" ON "FotofficeContratoPlantilla"("workspaceId", "name")`,
      `"FotofficePedidoContratante_pedidoId_orden_key" ON "FotofficePedidoContratante"("pedidoId", "orden")`,
      `"FotofficeContrato_workspaceId_number_key" ON "FotofficeContrato"("workspaceId", "number")`,
      `"FotofficeContrato_currentVersionId_key" ON "FotofficeContrato"("currentVersionId")`,
      `"FotofficeContratoVersion_contratoId_number_key" ON "FotofficeContratoVersion"("contratoId", "number")`,
      `"FotofficeContratoFirmante_tokenHash_key" ON "FotofficeContratoFirmante"("tokenHash")`,
      `"FotofficeContratoAjustes_workspaceId_key" ON "FotofficeContratoAjustes"("workspaceId")`,
    ]) expect(sql).toContain(`CREATE UNIQUE INDEX ${u}`);
  });

  it("cada FK de las tablas nuevas tiene un índice que empieza por su columna", () => {
    const fks = [...sql.matchAll(/ALTER TABLE "(\w+)" ADD CONSTRAINT "\w+" FOREIGN KEY \("(\w+)"\)/g)].map((m) => [m[1]!, m[2]!]);
    expect(fks).toHaveLength(18);
    for (const [tabla, col] of fks) {
      const re = new RegExp(`INDEX "[^"]+" ON "${tabla}"\\("${col}"[,)]`);
      expect(sql, `${tabla}.${col}`).toMatch(re);
    }
  });

  it("FKs: el contrato nunca pierde el pedido ni el contacto; lo propio del contrato se borra con él", () => {
    const fk = (tabla: string, col: string, destino: string, accion: string) =>
      expect(sql).toMatch(
        new RegExp(`ALTER TABLE "${tabla}" ADD CONSTRAINT "${tabla}_${col}_fkey" FOREIGN KEY \\("${col}"\\) REFERENCES "${destino}"\\("id"\\) ON DELETE ${accion}`),
      );
    fk("FotofficePedidoContratante", "pedidoId", "FotofficePedido", "CASCADE");
    fk("FotofficePedidoContratante", "clientId", "Client", "RESTRICT");
    fk("FotofficeContrato", "pedidoId", "FotofficePedido", "RESTRICT");
    fk("FotofficeContrato", "clientId", "Client", "RESTRICT");
    fk("FotofficeContrato", "templateId", "FotofficeContratoPlantilla", "SET NULL");
    fk("FotofficeContrato", "currentVersionId", "FotofficeContratoVersion", "SET NULL");
    fk("FotofficeContratoVersion", "contratoId", "FotofficeContrato", "CASCADE");
    fk("FotofficeContratoFirmante", "versionId", "FotofficeContratoVersion", "CASCADE");
    fk("FotofficeContratoFirmante", "clientId", "Client", "SET NULL");
    fk("FotofficeContratoEvento", "contratoId", "FotofficeContrato", "CASCADE");
    for (const t of TABLAS) fk(t, "workspaceId", "Workspace", "CASCADE");
  });

  it("tiene los CHECK", () => {
    for (const c of [
      `"FotofficeContrato_status" CHECK ("status" IN ('BORRADOR', 'ENVIADO', 'FIRMADO_PARCIAL', 'FIRMADO', 'RECHAZADO', 'ANULADO'))`,
      `"FotofficePedidoContratante_orden" CHECK ("orden" IN (1, 2))`,
      `"FotofficeContratoFirmante_orden" CHECK ("orden" IN (1, 2))`,
      `"FotofficeContratoAjustes_reminderDays" CHECK ("reminderDays" BETWEEN 1 AND 30)`,
      `"FotofficeContratoFirmante_codeAttempts" CHECK ("codeAttempts" >= 0)`,
      `"FotofficeContratoPlantilla_name" CHECK (length(trim("name")) > 0)`,
      `"FotofficeContratoPlantilla_body" CHECK (length(trim("body")) > 0)`,
      `"FotofficeContrato_name" CHECK (length(trim("name")) > 0)`,
      `"FotofficeContratoVersion_contentHash" CHECK ("contentHash" ~ '^[0-9a-f]{64}$')`,
      `"FotofficeContrato_voidReason" CHECK ("voidedAt" IS NULL OR ("voidReason" IS NOT NULL AND length(trim("voidReason")) > 0))`,
      `"FotofficeContratoFirmante_rejectReason" CHECK ("rejectedAt" IS NULL OR ("rejectReason" IS NOT NULL AND length(trim("rejectReason")) > 0))`,
      `DROP CONSTRAINT IF EXISTS "FotofficeMessageTemplate_entityType"`,
      `CHECK ("entityType" IN ('GENERAL', 'CLIENTE', 'SOCIO', 'CONSULTA', 'PRESUPUESTO', 'PEDIDO', 'PROYECTO', 'CITA', 'CONTRATO'))`,
    ]) expect(sql).toContain(c);
  });

  it("las tablas existentes sólo reciben relaciones inversas", () => {
    expect(modelo("Workspace")).toMatch(/fotofficeContratos\s+FotofficeContrato\[\]/);
    expect(modelo("Client")).toMatch(/fotofficeContratos\s+FotofficeContrato\[\]/);
    expect(modelo("FotofficePedido")).toMatch(/contratos\s+FotofficeContrato\[\]/);
    expect(modelo("FotofficeAttachment")).toMatch(/fotofficeContratosManuales\s+FotofficeContrato\[\]/);
    for (const m of ["Workspace", "Client", "FotofficePedido", "FotofficeAttachment"]) {
      expect(modelo(m)).not.toMatch(/^\s+(bodyText|contentHash|tokenHash|signedAt)\s/m);
    }
  });
});
