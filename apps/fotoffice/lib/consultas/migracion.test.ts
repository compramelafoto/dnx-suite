import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = join(__dirname, "..", "..", "..", "..");
const sql = readFileSync(
  join(RAIZ, "packages/db/prisma/migrations/20261017120000_fotoffice_etapa_1_consultas/migration.sql"),
  "utf8",
);
const schema = readFileSync(join(RAIZ, "packages/db/prisma/schema.prisma"), "utf8");

const TABLAS = [
  "FotofficeConsulta",
  "FotofficeConsultaCategoria",
  "FotofficeOrigen",
  "FotofficeRolParticipante",
  "FotofficeConsultaParticipante",
  "FotofficeContactoPerfil",
  "FotofficeConsultaAjustes",
];

/** Bloque de un modelo del esquema. */
function modelo(nombre: string): string {
  const m = schema.match(new RegExp(`\\nmodel ${nombre} \\{[\\s\\S]*?\\n\\}`));
  if (!m) throw new Error(`No está el modelo ${nombre}`);
  return m[0];
}

describe("migración de la etapa 1 (consultas)", () => {
  it("no altera tablas existentes ni borra nada", () => {
    expect(sql).not.toMatch(new RegExp(`ALTER TABLE "(?!(${TABLAS.join("|")})")`));
    expect(sql).not.toMatch(/DROP |DELETE FROM|UPDATE "|ADD COLUMN/);
  });

  it("crea las siete tablas y nada más", () => {
    for (const t of TABLAS) expect(sql).toMatch(new RegExp(`CREATE TABLE "${t}"`));
    expect(sql.match(/CREATE TABLE/g)).toHaveLength(7);
  });

  it("tiene los únicos del spec", () => {
    for (const u of [
      `"FotofficeConsulta_leadId_key" ON "FotofficeConsulta"("leadId")`,
      `"FotofficeContactoPerfil_clientId_key" ON "FotofficeContactoPerfil"("clientId")`,
      `"FotofficeConsultaAjustes_workspaceId_key" ON "FotofficeConsultaAjustes"("workspaceId")`,
      `"FotofficeConsultaParticipante_consultaId_clientId_roleId_key" ON "FotofficeConsultaParticipante"("consultaId", "clientId", "roleId")`,
      `"FotofficeConsultaCategoria_workspaceId_name_key" ON "FotofficeConsultaCategoria"("workspaceId", "name")`,
      `"FotofficeOrigen_workspaceId_name_key" ON "FotofficeOrigen"("workspaceId", "name")`,
      `"FotofficeRolParticipante_workspaceId_name_key" ON "FotofficeRolParticipante"("workspaceId", "name")`,
    ]) {
      expect(sql).toContain(`CREATE UNIQUE INDEX ${u}`);
    }
  });

  it("tiene los índices de la consulta", () => {
    for (const c of ["clientId", "categoryId", "originId", "eventStartsAt"]) {
      expect(sql).toContain(`ON "FotofficeConsulta"("workspaceId", "${c}")`);
    }
  });

  it("borra en cascada con la consulta y el cliente, y frena el borrado de catálogos usados", () => {
    const fk = (tabla: string, col: string, destino: string, accion: string) =>
      expect(sql).toMatch(
        new RegExp(`ALTER TABLE "${tabla}" ADD CONSTRAINT "${tabla}_${col}_fkey" FOREIGN KEY \\("${col}"\\) REFERENCES "${destino}"\\("id"\\) ON DELETE ${accion}`),
      );
    fk("FotofficeConsulta", "leadId", "ServiceSalesLead", "CASCADE");
    fk("FotofficeConsulta", "clientId", "Client", "CASCADE");
    fk("FotofficeConsulta", "referrerClientId", "Client", "SET NULL");
    fk("FotofficeConsulta", "categoryId", "FotofficeConsultaCategoria", "RESTRICT");
    fk("FotofficeConsulta", "originId", "FotofficeOrigen", "SET NULL");
    fk("FotofficeConsultaParticipante", "consultaId", "FotofficeConsulta", "CASCADE");
    fk("FotofficeConsultaParticipante", "clientId", "Client", "CASCADE");
    fk("FotofficeConsultaParticipante", "roleId", "FotofficeRolParticipante", "RESTRICT");
    fk("FotofficeContactoPerfil", "clientId", "Client", "CASCADE");
    for (const t of TABLAS) fk(t, "workspaceId", "Workspace", "CASCADE");
  });

  it("tiene los CHECK de grupo y de categoría de contacto", () => {
    expect(sql).toMatch(
      /ADD CONSTRAINT "FotofficeConsultaCategoria_group" CHECK \("group" IN \('BODA', 'EVENTO', 'TRABAJO_CON_FECHA', 'TRABAJO_SIN_FECHA'\)\)/,
    );
    expect(sql).toMatch(
      /ADD CONSTRAINT "FotofficeContactoPerfil_category" CHECK \("category" IN \('CONTACTO', 'CLIENTE', 'PROVEEDOR', 'COLABORADOR'\)\)/,
    );
  });

  it("el perfil nace CLIENTE por defecto (los clientes que ya existen)", () => {
    expect(sql).toContain(`"category" TEXT NOT NULL DEFAULT 'CLIENTE'`);
  });

  it("ServiceSalesLead y Client no reciben columnas en el esquema, sólo relaciones inversas", () => {
    const lead = modelo("ServiceSalesLead");
    expect(lead).toMatch(/fotofficeConsulta\s+FotofficeConsulta\?/);
    const cliente = modelo("Client");
    expect(cliente).toMatch(/fotofficePerfil\s+FotofficeContactoPerfil\?/);
    // Ningún escalar nuevo con nombre de la etapa en las dos tablas compartidas.
    for (const m of [lead, cliente]) {
      expect(m).not.toMatch(/^\s+(categoryId|originId|estimatedValue|category|mobile|email2|birthday)\s/m);
    }
  });
});
