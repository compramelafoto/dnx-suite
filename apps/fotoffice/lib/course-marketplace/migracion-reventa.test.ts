import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * La migración de la reventa se escribe a mano y la aplica el controlador después, también a
 * mano, en las bases. Esta barrera evita las dos cosas que más duelen: que no sea aditiva y que
 * no coincida con el esquema.
 */
const RAIZ = join(import.meta.dirname, "..", "..", "..", "..");
const MIGRACIONES = join(RAIZ, "packages", "db", "prisma", "migrations");
const CARPETA = "20261013120000_mercado_cursos_reventa";
const SQL = join(MIGRACIONES, CARPETA, "migration.sql");

describe("migración de la reventa de cursos", () => {
  it("existe y va después de la última que había en main", () => {
    expect(existsSync(SQL)).toBe(true);
    expect(CARPETA > "20261012120000_fotoffice_correo_ciclo").toBe(true);
  });

  it("su marca de tiempo no la comparte ninguna otra carpeta", () => {
    const mismas = readdirSync(MIGRACIONES).filter((n) => n.startsWith("20261013120000_"));
    expect(mismas).toEqual([CARPETA]);
  });

  it("sólo agrega: nada de borrar, renombrar ni cambiar columnas", () => {
    const sql = readFileSync(SQL, "utf8");
    expect(sql).not.toMatch(/\bDROP\b/i);
    expect(sql).not.toMatch(/\bRENAME\b/i);
    expect(sql).not.toMatch(/ALTER COLUMN/i);
  });

  it("crea el enum, la tabla, las columnas y las claves", () => {
    const sql = readFileSync(SQL, "utf8");
    expect(sql).toContain(`CREATE TYPE "CourseResaleAgreementStatus" AS ENUM ('PENDIENTE', 'ACTIVO', 'PAUSADO', 'RECHAZADO', 'TERMINADO');`);
    expect(sql).toContain(`CREATE TABLE "CourseResaleAgreement"`);
    expect(sql).toMatch(/"offeredToResellers" BOOLEAN NOT NULL DEFAULT false/);
    expect(sql).toMatch(/"suggestedResellerBps" INTEGER/);
    expect(sql).toMatch(/"resaleAgreementId" TEXT/);
    expect(sql).toContain(`CREATE UNIQUE INDEX "CourseResaleAgreement_courseId_resellerWorkspaceId_key"`);
    expect(sql).toMatch(/"CourseEnrollment_resaleAgreementId_fkey".*ON DELETE SET NULL/);
    expect(sql).toMatch(/"CourseResaleAgreement_courseId_fkey".*ON DELETE CASCADE/);
    expect(sql).toMatch(/"CourseResaleAgreement_resellerWorkspaceId_fkey".*ON DELETE CASCADE/);
  });

  it("el esquema declara lo mismo", () => {
    const esquema = readFileSync(join(RAIZ, "packages", "db", "prisma", "schema.prisma"), "utf8");
    expect(esquema).toMatch(/model CourseResaleAgreement \{/);
    expect(esquema).toMatch(/enum CourseResaleAgreementStatus \{/);
    expect(esquema).toMatch(/offeredToResellers\s+Boolean\s+@default\(false\)/);
    expect(esquema).toMatch(/suggestedResellerBps\s+Int\?/);
    expect(esquema).toMatch(/resaleAgreementId\s+String\?/);
  });
});
