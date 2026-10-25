import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = join(__dirname, "..", "..", "..", "..");
const CARPETA = "20261219120000_fotoffice_presupuesto_automatico_telegram";
const sql = readFileSync(join(RAIZ, "packages/db/prisma/migrations", CARPETA, "migration.sql"), "utf8");
const TABLAS = ["FotofficeTelegramConexion", "FotofficePresupuestoAutoCategoria", "FotofficePresupuestoAutoAjustes", "FotofficePresupuestoAprobacion"];

describe("migración del presupuesto automático con Telegram", () => {
  it("es posterior a las que existían al escribirla (la última conocida: 20261218120000)", () => {
    const todas = readdirSync(join(RAIZ, "packages/db/prisma/migrations")).filter((d) => /^\d{14}_/.test(d)).sort();
    expect(todas).toContain(CARPETA);
    expect(CARPETA > "20261218120000").toBe(true);
    expect(todas.filter((d) => d < CARPETA && d.startsWith("20261219")).length).toBe(0);
  });

  it("sólo crea tablas nuevas, sin tocar las existentes, y es idempotente", () => {
    expect(sql.match(/CREATE TABLE IF NOT EXISTS/g)).toHaveLength(TABLAS.length);
    for (const t of TABLAS) expect(sql).toContain(`CREATE TABLE IF NOT EXISTS "${t}"`);
    expect(sql).not.toMatch(/CREATE TABLE "(?!.*IF NOT EXISTS)/);
    expect(sql).not.toMatch(/ALTER TABLE|DROP |DELETE FROM|UPDATE "|ADD COLUMN|FOREIGN KEY/);
    expect(sql.match(/CREATE (UNIQUE )?INDEX(?! IF NOT EXISTS)/g)).toBeNull();
  });

  it("una aprobación por consulta y una conexión por workspace", () => {
    expect(sql).toContain(`"FotofficePresupuestoAprobacion_workspaceId_leadId_key" ON "FotofficePresupuestoAprobacion"("workspaceId", "leadId")`);
    expect(sql).toContain(`"FotofficeTelegramConexion_workspaceId_key" ON "FotofficeTelegramConexion"("workspaceId")`);
    expect(sql).toContain(`"FotofficePresupuestoAutoCategoria_workspaceId_categoryId_key"`);
  });

  it("el interruptor por categoría viene apagado y no hay columna para el token", () => {
    expect(sql).toContain(`"telegramEnabled" BOOLEAN NOT NULL DEFAULT false`);
    expect(sql).not.toMatch(/"token"|"botToken"/i);
  });
});
