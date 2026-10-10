import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = join(__dirname, "..", "..", "..", "..");
const sql = readFileSync(join(RAIZ, "packages/db/prisma/migrations/20261101120000_fotoffice_etapa_7_galeria/migration.sql"), "utf8");
const schema = readFileSync(join(RAIZ, "packages/db/prisma/schema.prisma"), "utf8");

const TABLAS = [
  "FotofficeGaleria", "FotofficeGaleriaFoto", "FotofficeGaleriaCliente", "FotofficeGaleriaSeleccion",
  "FotofficeGaleriaComentario", "FotofficeGaleriaEvento", "FotofficeGaleriaAjustes",
];

function modelo(nombre: string): string {
  const m = schema.match(new RegExp(`\\nmodel ${nombre} \\{[\\s\\S]*?\\n\\}`));
  if (!m) throw new Error(`No está el modelo ${nombre}`);
  return m[0];
}

describe("migración de la etapa 7, Entrega A1 (galería)", () => {
  it("sólo tiene SQL y comentarios: nada de la salida de `prisma migrate diff` pegado por error", () => {
    const sueltas = sql.split("\n").filter((l) => /^(warn|info|error)\b|pris\.ly|^For more information/i.test(l.trim()));
    expect(sueltas).toEqual([]);
    const raras = sql
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l !== "" && !l.startsWith("--") && !/^[A-Z"(),;\s]|^[A-Za-z]/.test(l));
    expect(raras).toEqual([]);
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
    // Lo único que se borra es el CHECK viejo que se reemplaza.
    expect(sql.match(/DROP /g)).toHaveLength(1);
    expect(sql).toContain(`DROP CONSTRAINT IF EXISTS "FotofficeMessageTemplate_entityType"`);
  });

  it("no arrastra deriva de otras tablas (Muestras, perfiles) que no son de esta etapa", () => {
    expect(sql).not.toMatch(/CulturalActivityWork|PhotographerProfile/);
  });

  it("tiene los únicos, el parcial del cliente por contacto incluido", () => {
    for (const u of [
      `"FotofficeGaleria_workspaceId_number_key" ON "FotofficeGaleria"("workspaceId", "number")`,
      `"FotofficeGaleria_coverFotoId_key" ON "FotofficeGaleria"("coverFotoId")`,
      `"FotofficeGaleriaFoto_originalKey_key" ON "FotofficeGaleriaFoto"("originalKey")`,
      `"FotofficeGaleriaCliente_tokenHash_key" ON "FotofficeGaleriaCliente"("tokenHash")`,
      `"FotofficeGaleriaSeleccion_galeriaClienteId_fotoId_key" ON "FotofficeGaleriaSeleccion"("galeriaClienteId", "fotoId")`,
      `"FotofficeGaleriaAjustes_workspaceId_key" ON "FotofficeGaleriaAjustes"("workspaceId")`,
    ]) expect(sql).toContain(`CREATE UNIQUE INDEX ${u}`);
    expect(sql).toContain(
      `CREATE UNIQUE INDEX "FotofficeGaleriaCliente_galeriaId_clientId_key" ON "FotofficeGaleriaCliente"("galeriaId", "clientId") WHERE "clientId" IS NOT NULL;`,
    );
  });

  it("tiene los índices de las búsquedas", () => {
    expect(sql).toContain(`ON "FotofficeGaleriaFoto"("galeriaId", "status")`);
    expect(sql).toContain(`ON "FotofficeGaleriaFoto"("galeriaId", "order")`);
    expect(sql).toContain(`ON "FotofficeGaleriaEvento"("galeriaId", "createdAt")`);
    expect(sql).toContain(`ON "FotofficeGaleria"("workspaceId", "status")`);
  });

  it("FKs: todo cuelga del workspace; el proyecto no se borra con galerías; contacto y portada se sueltan", () => {
    const fk = (tabla: string, col: string, destino: string, accion: string) =>
      expect(sql).toMatch(
        new RegExp(`ALTER TABLE "${tabla}" ADD CONSTRAINT "${tabla}_${col}_fkey" FOREIGN KEY \\("${col}"\\) REFERENCES "${destino}"\\("id"\\) ON DELETE ${accion}`),
      );
    for (const t of TABLAS) fk(t, "workspaceId", "Workspace", "CASCADE");
    fk("FotofficeGaleria", "proyectoId", "FotofficeProyecto", "RESTRICT");
    fk("FotofficeGaleria", "coverFotoId", "FotofficeGaleriaFoto", "SET NULL");
    fk("FotofficeGaleriaFoto", "galeriaId", "FotofficeGaleria", "CASCADE");
    fk("FotofficeGaleriaCliente", "galeriaId", "FotofficeGaleria", "CASCADE");
    fk("FotofficeGaleriaCliente", "clientId", "Client", "SET NULL");
    fk("FotofficeGaleriaSeleccion", "galeriaClienteId", "FotofficeGaleriaCliente", "CASCADE");
    fk("FotofficeGaleriaSeleccion", "fotoId", "FotofficeGaleriaFoto", "CASCADE");
    fk("FotofficeGaleriaComentario", "galeriaClienteId", "FotofficeGaleriaCliente", "CASCADE");
    fk("FotofficeGaleriaComentario", "fotoId", "FotofficeGaleriaFoto", "CASCADE");
    fk("FotofficeGaleriaEvento", "galeriaId", "FotofficeGaleria", "CASCADE");
    fk("FotofficeGaleriaEvento", "galeriaClienteId", "FotofficeGaleriaCliente", "SET NULL");
    expect(sql.match(/FOREIGN KEY/g)).toHaveLength(7 + 2 + 1 + 2 + 2 + 2 + 2);
  });

  it("los valores por omisión del SQL son los de las Global Constraints", () => {
    for (const c of [
      `"saleMode" TEXT NOT NULL DEFAULT 'SELECCION'`,
      `"kind" TEXT NOT NULL DEFAULT 'SELECCION'`,
      `"selectionMode" TEXT NOT NULL DEFAULT 'LIBRE'`,
      `"allowComments" BOOLEAN NOT NULL DEFAULT true`,
      `"downloadMode" TEXT NOT NULL DEFAULT 'VISTA'`,
      `"status" TEXT NOT NULL DEFAULT 'BORRADOR'`,
      `"orderMode" TEXT NOT NULL DEFAULT 'NOMBRE'`,
      `"sizeBytes" BIGINT`,
      `"attempts" INTEGER NOT NULL DEFAULT 0`,
      `"status" TEXT NOT NULL DEFAULT 'PENDIENTE'`,
      `"status" TEXT NOT NULL DEFAULT 'EN_PROGRESO'`,
      `"data" JSONB`,
    ]) expect(sql, c).toContain(c);
  });

  it("tiene los CHECK de modos, estados, límites y comentarios", () => {
    for (const c of [
      `"FotofficeGaleria_saleMode" CHECK ("saleMode" IN ('SELECCION', 'SELECCION_Y_VENTA', 'VENTA'))`,
      `"FotofficeGaleria_kind" CHECK ("kind" IN ('SELECCION', 'ENTREGA'))`,
      `"FotofficeGaleria_selectionMode" CHECK ("selectionMode" IN ('LIBRE', 'CANTIDAD'))`,
      `"FotofficeGaleria_downloadMode" CHECK ("downloadMode" IN ('NINGUNA', 'VISTA', 'SELECCIONADAS'))`,
      `"FotofficeGaleria_status" CHECK ("status" IN ('BORRADOR', 'PUBLICADA', 'ARCHIVADA'))`,
      `"FotofficeGaleria_orderMode" CHECK ("orderMode" IN ('NOMBRE', 'MANUAL'))`,
      `"FotofficeGaleriaFoto_status" CHECK ("status" IN ('PENDIENTE', 'LISTA', 'ERROR'))`,
      `"FotofficeGaleriaCliente_status" CHECK ("status" IN ('EN_PROGRESO', 'EN_REVISION', 'FINALIZADO'))`,
      `"FotofficeGaleriaComentario_author" CHECK ("author" IN ('CLIENTE', 'ESTUDIO'))`,
      `"FotofficeGaleriaComentario_body" CHECK (length(trim("body")) > 0 AND length("body") <= 2000)`,
      `"FotofficeGaleria_minMax" CHECK (`,
    ]) expect(sql, c).toContain(c);
    const minMax = sql.slice(sql.indexOf(`"FotofficeGaleria_minMax"`), sql.indexOf(`"FotofficeGaleria_downloadMode"`));
    expect(minMax).toContain(`"selectionMode" = 'LIBRE' AND "minSelect" IS NULL AND "maxSelect" IS NULL`);
    expect(minMax).toContain(`"minSelect" <= "maxSelect"`);
  });

  it("el CHECK de plantillas conserva los tipos de la Etapa 5 y suma GALERIA", () => {
    expect(sql).toContain(
      `CHECK ("entityType" IN ('GENERAL', 'CLIENTE', 'SOCIO', 'CONSULTA', 'PRESUPUESTO', 'PEDIDO', 'PROYECTO', 'CITA', 'CONTRATO', 'GALERIA'))`,
    );
  });

  it("la numeración no tiene CHECK de clave en la base: no hay nada que reemplazar", () => {
    expect(sql).not.toMatch(/FotofficeSequence|FotofficeRecordNumber/);
  });

  it("el schema deja la portada única y las relaciones inversas en las tablas existentes", () => {
    expect(modelo("FotofficeGaleria")).toMatch(/coverFotoId\s+String\?\s+@unique/);
    expect(modelo("Workspace")).toMatch(/fotofficeGalerias\s+FotofficeGaleria\[\]/);
    expect(modelo("Workspace")).toMatch(/fotofficeGaleriaAjustes\s+FotofficeGaleriaAjustes\?/);
    expect(modelo("Client")).toMatch(/fotofficeGaleriaClientes\s+FotofficeGaleriaCliente\[\]/);
    expect(modelo("FotofficeProyecto")).toMatch(/galerias\s+FotofficeGaleria\[\]/);
  });
});
