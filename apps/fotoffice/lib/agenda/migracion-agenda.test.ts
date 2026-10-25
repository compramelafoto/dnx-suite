import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = join(__dirname, "..", "..", "..", "..");
const sql = readFileSync(join(RAIZ, "packages/db/prisma/migrations/20261026120000_fotoffice_etapa_4_agenda/migration.sql"), "utf8");
const schema = readFileSync(join(RAIZ, "packages/db/prisma/schema.prisma"), "utf8");

const TABLAS = [
  "FotofficeCitaTipo", "FotofficeCita", "FotofficeCitaParticipante", "FotofficeProductoCita",
  "FotofficeAgendaAjustes", "FotofficeCitaRecordatorio",
];

function modelo(nombre: string): string {
  const m = schema.match(new RegExp(`\\nmodel ${nombre} \\{[\\s\\S]*?\\n\\}`));
  if (!m) throw new Error(`No está el modelo ${nombre}`);
  return m[0];
}

describe("migración de la etapa 4, Entrega B (agenda)", () => {
  it("sólo tiene SQL y comentarios: nada de la salida de `prisma migrate diff` pegado por error", () => {
    const sueltas = sql.split("\n").filter((l) => /^(warn|info|error)\b|pris\.ly/i.test(l.trim()));
    expect(sueltas).toEqual([]);
  });

  it("crea las seis tablas nuevas y nada más; no suma columnas ni borra ni actualiza filas", () => {
    for (const t of TABLAS) expect(sql).toMatch(new RegExp(`CREATE TABLE "${t}"`));
    expect(sql.match(/CREATE TABLE/g)).toHaveLength(6);
    expect(sql).not.toMatch(/ADD COLUMN/);
    const alteradas = new Set([...sql.matchAll(/ALTER TABLE "([^"]+)"/g)].map((m) => m[1]));
    for (const t of alteradas) expect([...TABLAS, "FotofficeMessageTemplate"]).toContain(t);
    expect(sql).not.toMatch(/DROP TABLE|DROP COLUMN|DELETE FROM|UPDATE "|INSERT INTO/);
  });

  it("tiene los únicos", () => {
    for (const u of [
      `"FotofficeCitaTipo_workspaceId_name_key" ON "FotofficeCitaTipo"("workspaceId", "name")`,
      `"FotofficeCita_workspaceId_googleEventId_key" ON "FotofficeCita"("workspaceId", "googleEventId")`,
      `"FotofficeCita_pedidoId_pedidoItemIndex_reglaId_key" ON "FotofficeCita"("pedidoId", "pedidoItemIndex", "reglaId")`,
      `"FotofficeAgendaAjustes_workspaceId_key" ON "FotofficeAgendaAjustes"("workspaceId")`,
      `"FotofficeCitaRecordatorio_citaId_startAt_key" ON "FotofficeCitaRecordatorio"("citaId", "startAt")`,
    ]) expect(sql).toContain(`CREATE UNIQUE INDEX ${u}`);
  });

  it("indexa las búsquedas de la vista y cada FK de la cita", () => {
    expect(sql).toContain(`ON "FotofficeCita"("workspaceId", "startAt")`);
    expect(sql).toContain(`ON "FotofficeCita"("workspaceId", "ownerUserId", "startAt")`);
    for (const c of ["typeId", "clientId", "proyectoId", "pedidoId", "consultaLeadId", "reglaId"]) {
      expect(sql).toContain(`ON "FotofficeCita"("${c}")`);
    }
    for (const c of ["citaId", "clientId", "roleId"]) expect(sql).toContain(`ON "FotofficeCitaParticipante"("${c}")`);
    for (const c of ["productId", "typeId"]) expect(sql).toContain(`ON "FotofficeProductoCita"("${c}")`);
  });

  it("FKs: la cita nunca bloquea el borrado de lo que referencia", () => {
    const fk = (tabla: string, col: string, destino: string, accion: string) =>
      expect(sql).toMatch(
        new RegExp(`ALTER TABLE "${tabla}" ADD CONSTRAINT "${tabla}_${col}_fkey" FOREIGN KEY \\("${col}"\\) REFERENCES "${destino}"\\("id"\\) ON DELETE ${accion}`),
      );
    for (const t of ["FotofficeCitaTipo", "FotofficeCita", "FotofficeProductoCita", "FotofficeAgendaAjustes"]) fk(t, "workspaceId", "Workspace", "CASCADE");
    fk("FotofficeCita", "typeId", "FotofficeCitaTipo", "SET NULL");
    fk("FotofficeCita", "clientId", "Client", "SET NULL");
    fk("FotofficeCita", "proyectoId", "FotofficeProyecto", "SET NULL");
    fk("FotofficeCita", "pedidoId", "FotofficePedido", "SET NULL");
    fk("FotofficeCita", "consultaLeadId", "ServiceSalesLead", "SET NULL");
    fk("FotofficeCita", "reglaId", "FotofficeProductoCita", "SET NULL");
    fk("FotofficeCitaParticipante", "citaId", "FotofficeCita", "CASCADE");
    fk("FotofficeCitaParticipante", "clientId", "Client", "CASCADE");
    fk("FotofficeCitaParticipante", "roleId", "FotofficeProyectoRol", "SET NULL");
    fk("FotofficeProductoCita", "productId", "Product", "CASCADE");
    fk("FotofficeProductoCita", "typeId", "FotofficeCitaTipo", "SET NULL");
    fk("FotofficeCitaRecordatorio", "citaId", "FotofficeCita", "CASCADE");
    expect(sql.match(/FOREIGN KEY/g)).toHaveLength(16);
  });

  it("tiene los CHECK", () => {
    for (const c of [
      `"FotofficeCita_status" CHECK ("status" IN ('AGENDADA', 'CONFIRMADA', 'REALIZADA', 'ANULADA'))`,
      `"FotofficeCita_rango" CHECK ("endAt" > "startAt")`,
      `"FotofficeCita_title" CHECK (length(trim("title")) > 0)`,
      `"FotofficeCitaParticipante_persona" CHECK (("userId" IS NULL) <> ("clientId" IS NULL))`,
      `"FotofficeProductoCita_daysFromEvent" CHECK ("daysFromEvent" BETWEEN -365 AND 365)`,
      `"FotofficeProductoCita_durationMinutes" CHECK ("durationMinutes" BETWEEN 15 AND 1440)`,
      `"FotofficeProductoCita_startTime" CHECK ("startTime" IS NULL OR "startTime" ~ '^[0-2][0-9]:[0-5][0-9]$')`,
      `"FotofficeAgendaAjustes_reminderHours" CHECK ("reminderHours" BETWEEN 1 AND 168)`,
      `"FotofficeCitaTipo_color" CHECK ("color" ~ '^#[0-9a-fA-F]{6}$')`,
      `CHECK ("entityType" IN ('GENERAL', 'CLIENTE', 'SOCIO', 'CONSULTA', 'PRESUPUESTO', 'PEDIDO', 'PROYECTO', 'CITA'))`,
    ]) expect(sql).toContain(c);
  });

  it("las tablas existentes sólo reciben relaciones inversas", () => {
    expect(modelo("Workspace")).toMatch(/fotofficeCitas\s+FotofficeCita\[\]/);
    expect(modelo("Client")).toMatch(/fotofficeCitas\s+FotofficeCita\[\]/);
    expect(modelo("Product")).toMatch(/fotofficeCitaReglas\s+FotofficeProductoCita\[\]/);
    expect(modelo("FotofficePedido")).toMatch(/citas\s+FotofficeCita\[\]/);
    expect(modelo("FotofficeProyecto")).toMatch(/citas\s+FotofficeCita\[\]/);
    expect(modelo("ServiceSalesLead")).toMatch(/fotofficeCitas\s+FotofficeCita\[\]/);
    for (const m of ["Workspace", "Client", "Product", "FotofficePedido", "FotofficeProyecto", "ServiceSalesLead"]) {
      expect(modelo(m)).not.toMatch(/^\s+(googleEventId|allDay|startAt|durationMinutes)\s/m);
    }
  });
});
