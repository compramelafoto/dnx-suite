import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = join(__dirname, "..", "..", "..", "..");
const sql = readFileSync(join(RAIZ, "packages/db/prisma/migrations/20261103120000_fotoffice_etapa_7_galeria_entrega/migration.sql"), "utf8");
const schema = readFileSync(join(RAIZ, "packages/db/prisma/schema.prisma"), "utf8");

function modelo(nombre: string): string {
  const m = schema.match(new RegExp(`\\nmodel ${nombre} \\{[\\s\\S]*?\\n\\}`));
  if (!m) throw new Error(`No está el modelo ${nombre}`);
  return m[0];
}

describe("migración de la etapa 7, Entrega B (entrega con videos, descargas y dispositivos)", () => {
  it("sólo tiene SQL y comentarios", () => {
    const sueltas = sql.split("\n").filter((l) => /^(warn|info|error)\b|pris\.ly|^For more information/i.test(l.trim()));
    expect(sueltas).toEqual([]);
    const raras = sql.split("\n").map((l) => l.trim()).filter((l) => l !== "" && !l.startsWith("--") && !/^[A-Z"(),;\s]|^[A-Za-z]/.test(l));
    expect(raras).toEqual([]);
  });

  it("crea sólo las dos tablas nuevas y altera sólo FotofficeGaleriaFoto y las nuevas", () => {
    expect([...sql.matchAll(/CREATE TABLE "([^"]+)"/g)].map((m) => m[1]).sort()).toEqual(["FotofficeDispositivo", "FotofficeGaleriaDescarga"]);
    const alteradas = new Set([...sql.matchAll(/ALTER TABLE "([^"]+)"/g)].map((m) => m[1]));
    for (const t of alteradas) expect(["FotofficeGaleriaFoto", "FotofficeGaleriaDescarga", "FotofficeDispositivo"]).toContain(t);
    expect(sql).not.toMatch(/DROP |DELETE FROM|UPDATE "|INSERT INTO|CulturalActivityWork|PhotographerProfile/);
  });

  it("suma mediaType (NOT NULL DEFAULT 'FOTO': seguro con filas existentes) y contentType", () => {
    expect(sql).toContain(`ALTER TABLE "FotofficeGaleriaFoto" ADD COLUMN "mediaType" TEXT NOT NULL DEFAULT 'FOTO'`);
    expect(sql).toContain(`ADD COLUMN "contentType" TEXT;`);
    expect(sql).toContain(`"FotofficeGaleriaFoto_mediaType" CHECK ("mediaType" IN ('FOTO', 'VIDEO'))`);
  });

  it("FotofficeGaleriaDescarga: columnas, estados, índices y claves foráneas en cascada", () => {
    for (const c of [
      `"galeriaClienteId" TEXT,`, `"status" TEXT NOT NULL DEFAULT 'PENDIENTE'`, `"totalFiles" INTEGER NOT NULL`, `"totalBytes" BIGINT NOT NULL`,
      `"parts" JSONB NOT NULL DEFAULT '[]'`, `"cursor" JSONB,`, `"errorReason" TEXT`, `"requestedEmail" TEXT`, `"notifiedAt" TIMESTAMP(3)`,
      `"expiresAt" TIMESTAMP(3) NOT NULL`,
      `CREATE INDEX "FotofficeGaleriaDescarga_status_updatedAt_idx" ON "FotofficeGaleriaDescarga"("status", "updatedAt")`,
      `CREATE INDEX "FotofficeGaleriaDescarga_galeriaClienteId_createdAt_idx" ON "FotofficeGaleriaDescarga"("galeriaClienteId", "createdAt")`,
      `CHECK ("status" IN ('PENDIENTE', 'ARMANDO', 'LISTA', 'ERROR', 'VENCIDA'))`,
    ]) expect(sql, c).toContain(c);
    const fk = (tabla: string, col: string, destino: string) =>
      expect(sql).toMatch(new RegExp(`ALTER TABLE "${tabla}" ADD CONSTRAINT "${tabla}_${col}_fkey" FOREIGN KEY \\("${col}"\\) REFERENCES "${destino}"\\("id"\\) ON DELETE CASCADE`));
    fk("FotofficeGaleriaDescarga", "workspaceId", "Workspace");
    fk("FotofficeGaleriaDescarga", "galeriaId", "FotofficeGaleria");
    fk("FotofficeGaleriaDescarga", "galeriaClienteId", "FotofficeGaleriaCliente");
    fk("FotofficeDispositivo", "workspaceId", "Workspace");
    expect(sql.match(/FOREIGN KEY/g)).toHaveLength(4);
  });

  it("FotofficeDispositivo: hash único, prefijo, nombre acotado y hash hexadecimal de 64", () => {
    for (const c of [
      `"keyHash" TEXT NOT NULL`, `"keyPrefix" TEXT NOT NULL`, `"createdByUserId" INTEGER`, `"lastUsedAt" TIMESTAMP(3)`, `"revokedAt" TIMESTAMP(3)`,
      `CREATE UNIQUE INDEX "FotofficeDispositivo_keyHash_key" ON "FotofficeDispositivo"("keyHash")`,
      `char_length(btrim("name")) >= 1 AND char_length("name") <= 60`,
      `"keyHash" ~ '^[0-9a-f]{64}$'`,
    ]) expect(sql, c).toContain(c);
  });

  it("el schema tiene las columnas, los dos modelos y las relaciones inversas", () => {
    expect(modelo("FotofficeGaleriaFoto")).toMatch(/mediaType\s+String\s+@default\("FOTO"\)/);
    expect(modelo("FotofficeGaleriaFoto")).toMatch(/contentType\s+String\?/);
    expect(modelo("FotofficeGaleriaDescarga")).toMatch(/totalBytes\s+BigInt/);
    expect(modelo("FotofficeGaleriaDescarga")).toMatch(/parts\s+Json\s+@default\("\[\]"\)/);
    expect(modelo("FotofficeGaleriaDescarga")).toMatch(/@@index\(\[status, updatedAt\]\)/);
    expect(modelo("FotofficeGaleriaDescarga")).toMatch(/@@index\(\[galeriaClienteId, createdAt\]\)/);
    expect(modelo("FotofficeDispositivo")).toMatch(/keyHash\s+String\s+@unique/);
    expect(modelo("Workspace")).toMatch(/fotofficeGaleriaDescargas\s+FotofficeGaleriaDescarga\[\]/);
    expect(modelo("Workspace")).toMatch(/fotofficeDispositivos\s+FotofficeDispositivo\[\]/);
    expect(modelo("FotofficeGaleria")).toMatch(/descargas\s+FotofficeGaleriaDescarga\[\]/);
    expect(modelo("FotofficeGaleriaCliente")).toMatch(/descargas\s+FotofficeGaleriaDescarga\[\]/);
  });
});
