import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = join(__dirname, "..", "..", "..", "..");
const sql = readFileSync(
  join(RAIZ, "packages/db/prisma/migrations/20261021120000_fotoffice_etapa_2_propuesta_modelo/migration.sql"),
  "utf8",
);
const schema = readFileSync(join(RAIZ, "packages/db/prisma/schema.prisma"), "utf8");

function modelo(nombre: string): string {
  const m = schema.match(new RegExp(`\\nmodel ${nombre} \\{[\\s\\S]*?\\n\\}`));
  if (!m) throw new Error(`No está el modelo ${nombre}`);
  return m[0];
}

describe("migración de la entrega B (propuesta modelo)", () => {
  it("crea sólo la tabla de la propuesta modelo y no toca ninguna otra", () => {
    expect(sql.match(/CREATE TABLE/g)).toHaveLength(1);
    expect(sql).toContain(`CREATE TABLE "FotofficePropuestaModelo"`);
    expect(sql).not.toMatch(/ALTER TABLE "(?!FotofficePropuestaModelo")/);
    expect(sql).not.toMatch(/DROP |DELETE FROM|UPDATE "|ADD COLUMN/);
  });

  it("una propuesta por categoría y workspace", () => {
    expect(sql).toContain(
      `CREATE UNIQUE INDEX "FotofficePropuestaModelo_workspaceId_categoryId_key" ON "FotofficePropuestaModelo"("workspaceId", "categoryId")`,
    );
  });

  it("índices que empiezan por la FK para borrar una categoría o una plantilla sin recorrer la tabla", () => {
    expect(sql).toContain(`ON "FotofficePropuestaModelo"("categoryId")`);
    expect(sql).toContain(`ON "FotofficePropuestaModelo"("templateId")`);
  });

  it("FKs: workspace y categoría en cascada; borrar la plantilla la deja sin plantilla", () => {
    const fk = (col: string, destino: string, accion: string) =>
      expect(sql).toMatch(
        new RegExp(
          `ALTER TABLE "FotofficePropuestaModelo" ADD CONSTRAINT "FotofficePropuestaModelo_${col}_fkey" FOREIGN KEY \\("${col}"\\) REFERENCES "${destino}"\\("id"\\) ON DELETE ${accion}`,
        ),
      );
    fk("workspaceId", "Workspace", "CASCADE");
    fk("categoryId", "FotofficeConsultaCategoria", "CASCADE");
    fk("templateId", "FotofficeMessageTemplate", "SET NULL");
  });

  it("nace sin enviarse sola", () => {
    expect(sql).toContain(`"autoSendOnWeb" BOOLEAN NOT NULL DEFAULT false`);
    expect(sql).toContain(`"items" JSONB NOT NULL`);
  });

  it("el esquema coincide y las tablas existentes sólo reciben relaciones inversas", () => {
    const m = modelo("FotofficePropuestaModelo");
    for (const c of ["workspaceId", "categoryId", "items", "terms", "autoSendOnWeb", "templateId", "updatedAt", "updatedByUserId"]) {
      expect(m).toMatch(new RegExp(`^\\s+${c}\\s`, "m"));
    }
    expect(m).toContain("@@unique([workspaceId, categoryId])");
    expect(modelo("FotofficeConsultaCategoria")).toMatch(/propuestasModelo\s+FotofficePropuestaModelo\[\]/);
    expect(modelo("FotofficeMessageTemplate")).toMatch(/propuestasModelo\s+FotofficePropuestaModelo\[\]/);
  });
});
