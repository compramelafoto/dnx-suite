import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** La migración de los cursos compartidos se aplica a mano: tiene que ser aditiva y coincidir con el esquema. */
const RAIZ = join(import.meta.dirname, "..", "..", "..", "..");
const MIGRACIONES = join(RAIZ, "packages", "db", "prisma", "migrations");
const CARPETA = "20270208090000_fotoffice_cursos_compartidos";
const SQL = join(MIGRACIONES, CARPETA, "migration.sql");

describe("migración de los cursos compartidos", () => {
  it("existe y va después de la del registro docente", () => {
    expect(existsSync(SQL)).toBe(true);
    expect(CARPETA > "20270207090000_registro_docente").toBe(true);
  });

  it("su marca de tiempo no la comparte ninguna otra carpeta", () => {
    expect(readdirSync(MIGRACIONES).filter((n) => n.startsWith("20270208090000_"))).toEqual([CARPETA]);
  });

  it("sólo agrega columnas con valor por defecto", () => {
    const sql = readFileSync(SQL, "utf8");
    expect(sql).not.toMatch(/\bDROP\b|\bRENAME\b|ALTER COLUMN/i);
    expect(sql).toContain(`ADD COLUMN "invitedByOwner" BOOLEAN NOT NULL DEFAULT false`);
    expect(sql).toContain(`ADD COLUMN "membersFree" BOOLEAN NOT NULL DEFAULT false`);
  });

  it("el esquema declara lo mismo", () => {
    const esquema = readFileSync(join(RAIZ, "packages", "db", "prisma", "schema.prisma"), "utf8");
    expect(esquema).toMatch(/invitedByOwner\s+Boolean\s+@default\(false\)/);
    expect(esquema).toMatch(/membersFree\s+Boolean\s+@default\(false\)/);
  });
});
