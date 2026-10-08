import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = join(__dirname, "..", "..", "..", "..");
const sql = readFileSync(join(RAIZ, "packages/db/prisma/migrations/20261025120000_fotoffice_etapa_4_proyectos/migration.sql"), "utf8");
const schema = readFileSync(join(RAIZ, "packages/db/prisma/schema.prisma"), "utf8");

const TABLAS = [
  "FotofficeProyecto", "FotofficeProductoProyecto", "FotofficeProyectoRol", "FotofficeProyectoParticipante",
  "FotofficeProyectoNota", "FotofficeProyectoAdjunto", "FotofficeProyectoEtapaPlan",
];

function modelo(nombre: string): string {
  const m = schema.match(new RegExp(`\\nmodel ${nombre} \\{[\\s\\S]*?\\n\\}`));
  if (!m) throw new Error(`No está el modelo ${nombre}`);
  return m[0];
}

describe("migración de la etapa 4, Entrega A (proyectos)", () => {
  it("sólo tiene SQL y comentarios: nada de la salida de `prisma migrate diff` pegado por error", () => {
    const sueltas = sql.split("\n").filter((l) => /^(warn|info|error)\b|pris\.ly/i.test(l.trim()));
    expect(sueltas).toEqual([]);
  });

  it("crea las siete tablas nuevas y nada más", () => {
    for (const t of TABLAS) expect(sql).toMatch(new RegExp(`CREATE TABLE "${t}"`));
    expect(sql.match(/CREATE TABLE/g)).toHaveLength(7);
  });

  it("no suma columnas ni toca tablas existentes salvo el CHECK de plantillas, y no borra ni actualiza filas", () => {
    expect(sql).not.toMatch(/ADD COLUMN/);
    const alteradas = new Set([...sql.matchAll(/ALTER TABLE "([^"]+)"/g)].map((m) => m[1]));
    for (const t of alteradas) expect([...TABLAS, "FotofficeMessageTemplate"]).toContain(t);
    expect(sql).not.toMatch(/DROP TABLE|DROP COLUMN|DELETE FROM|UPDATE "|INSERT INTO/);
  });

  it("las fechas son DATE", () => {
    for (const c of ["eventDate", "finalDueDate"]) expect(sql).toContain(`"${c}" DATE,`);
    expect(sql).toContain(`"baseDate" DATE NOT NULL`);
    expect(sql).toContain(`"plannedDueDate" DATE NOT NULL`);
  });

  it("tiene los únicos", () => {
    for (const u of [
      `"FotofficeProyecto_workspaceId_number_key" ON "FotofficeProyecto"("workspaceId", "number")`,
      `"FotofficeProyecto_pedidoId_pedidoItemIndex_circuitId_key" ON "FotofficeProyecto"("pedidoId", "pedidoItemIndex", "circuitId")`,
      `"FotofficeProyectoRol_workspaceId_name_key" ON "FotofficeProyectoRol"("workspaceId", "name")`,
      `"FotofficeProyectoEtapaPlan_proyectoId_stageId_key" ON "FotofficeProyectoEtapaPlan"("proyectoId", "stageId")`,
      `"FotofficeProyectoAdjunto_storageKey_key" ON "FotofficeProyectoAdjunto"("storageKey")`,
    ]) expect(sql).toContain(`CREATE UNIQUE INDEX ${u}`);
  });

  it("tiene los índices de las búsquedas", () => {
    for (const c of ["finalDueDate", "clientId", "pedidoId", "ownerUserId"]) {
      expect(sql).toContain(`ON "FotofficeProyecto"("workspaceId", "${c}")`);
    }
    expect(sql).toContain(`ON "FotofficeProductoProyecto"("workspaceId", "productId", "order")`);
  });

  it("FKs: todo cuelga del workspace; contacto, pedido y flujo con proyectos no se borran", () => {
    const fk = (tabla: string, col: string, destino: string, accion: string) =>
      expect(sql).toMatch(
        new RegExp(`ALTER TABLE "${tabla}" ADD CONSTRAINT "${tabla}_${col}_fkey" FOREIGN KEY \\("${col}"\\) REFERENCES "${destino}"\\("id"\\) ON DELETE ${accion}`),
      );
    for (const t of TABLAS) fk(t, "workspaceId", "Workspace", "CASCADE");
    fk("FotofficeProyecto", "clientId", "Client", "RESTRICT");
    fk("FotofficeProyecto", "pedidoId", "FotofficePedido", "RESTRICT");
    fk("FotofficeProyecto", "productId", "Product", "SET NULL");
    fk("FotofficeProyecto", "circuitId", "FotofficeCircuit", "RESTRICT");
    fk("FotofficeProductoProyecto", "productId", "Product", "CASCADE");
    fk("FotofficeProductoProyecto", "circuitId", "FotofficeCircuit", "CASCADE");
    fk("FotofficeProyectoParticipante", "proyectoId", "FotofficeProyecto", "CASCADE");
    fk("FotofficeProyectoParticipante", "clientId", "Client", "CASCADE");
    fk("FotofficeProyectoParticipante", "roleId", "FotofficeProyectoRol", "SET NULL");
    fk("FotofficeProyectoNota", "proyectoId", "FotofficeProyecto", "CASCADE");
    fk("FotofficeProyectoAdjunto", "proyectoId", "FotofficeProyecto", "CASCADE");
    fk("FotofficeProyectoEtapaPlan", "proyectoId", "FotofficeProyecto", "CASCADE");
    fk("FotofficeProyectoEtapaPlan", "stageId", "FotofficeStage", "CASCADE");
    expect(sql.match(/FOREIGN KEY/g)).toHaveLength(7 + 4 + 2 + 3 + 1 + 1 + 2);
  });

  it("el adjunto tiene la misma forma de almacenamiento que el de la ficha", () => {
    const adj = modelo("FotofficeProyectoAdjunto");
    for (const c of ["storageKey", "fileName", "contentType", "sizeBytes", "status", "uploadedByUserId", "uploadedByLabel", "deletedAt", "purgeAfter"]) {
      expect(adj).toMatch(new RegExp(`\\n\\s+${c}\\s`));
      expect(modelo("FotofficeAttachment")).toMatch(new RegExp(`\\n\\s+${c}\\s`));
    }
    expect(adj).not.toMatch(/\n\s+(clientId|memberId)\s/);
  });

  it("tiene los CHECK de suspensión, días, participante exacto, nota y tipo de plantilla", () => {
    expect(sql).toContain(`"FotofficeProyecto_suspendReason" CHECK ("suspendedAt" IS NULL OR "suspendReason" IS NOT NULL)`);
    expect(sql).toContain(`"FotofficeProductoProyecto_daysFromEvent" CHECK ("daysFromEvent" BETWEEN -365 AND 365)`);
    expect(sql).toContain(`"FotofficeProyectoParticipante_persona" CHECK (("userId" IS NULL) <> ("clientId" IS NULL))`);
    expect(sql).toContain(`"FotofficeProyectoNota_body" CHECK (length(trim("body")) > 0)`);
    expect(sql).toContain(
      `CHECK ("entityType" IN ('GENERAL', 'CLIENTE', 'SOCIO', 'CONSULTA', 'PRESUPUESTO', 'PEDIDO', 'PROYECTO'))`,
    );
  });

  it("las tablas existentes sólo reciben relaciones inversas", () => {
    expect(modelo("Workspace")).toMatch(/fotofficeProyectos\s+FotofficeProyecto\[\]/);
    expect(modelo("Client")).toMatch(/fotofficeProyectos\s+FotofficeProyecto\[\]/);
    expect(modelo("Product")).toMatch(/fotofficeProyectoReglas\s+FotofficeProductoProyecto\[\]/);
    expect(modelo("FotofficePedido")).toMatch(/proyectos\s+FotofficeProyecto\[\]/);
    expect(modelo("FotofficeCircuit")).toMatch(/proyectos\s+FotofficeProyecto\[\]/);
    expect(modelo("FotofficeStage")).toMatch(/planesProyecto\s+FotofficeProyectoEtapaPlan\[\]/);
    for (const m of ["Workspace", "Client", "Product", "FotofficePedido", "FotofficeCircuit", "FotofficeStage"]) {
      expect(modelo(m)).not.toMatch(/^\s+(pedidoItemIndex|baseDate|finalDueDate|suspendedAt|plannedDueDate)\s/m);
    }
  });
});
