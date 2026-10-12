import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = join(__dirname, "..", "..", "..", "..");
const RUTA = "packages/db/prisma/migrations/20261105120000_fotoffice_etapa_8_alboom_extraccion/migration.sql";
const sql = readFileSync(join(RAIZ, RUTA), "utf8");
const schema = readFileSync(join(RAIZ, "packages/db/prisma/schema.prisma"), "utf8");
const doc = readFileSync(join(RAIZ, "packages/db/docs/MIGRACION-ETAPA-8A.md"), "utf8");

function modelo(nombre: string): string {
  const m = schema.match(new RegExp(`\\nmodel ${nombre} \\{[\\s\\S]*?\\n\\}`));
  if (!m) throw new Error(`No está el modelo ${nombre}`);
  return m[0];
}

describe("migración de la etapa 8A (Alboom)", () => {
  it("sólo tiene SQL y comentarios", () => {
    const sueltas = sql.split("\n").filter((l) => /^(warn|info|error)\b|pris\.ly|^For more information/i.test(l.trim()));
    expect(sueltas).toEqual([]);
  });

  it("crea sólo las dos tablas nuevas y no toca otras ni borra datos", () => {
    expect([...sql.matchAll(/CREATE TABLE "([^"]+)"/g)].map((m) => m[1]).sort()).toEqual(["FotofficeAlboomCrudo", "FotofficeAlboomExtraccion"]);
    const tocadas = new Set([...sql.matchAll(/(?:ALTER TABLE|CREATE TABLE|ON) "([^"]+)"/g)].map((m) => m[1]));
    expect([...tocadas].sort()).toEqual(["FotofficeAlboomCrudo", "FotofficeAlboomExtraccion"]);
    expect(sql).not.toMatch(/DELETE FROM|UPDATE "|INSERT INTO|DROP /);
  });

  it("FotofficeAlboomCrudo: payload JSONB, único por workspace+entidad+id, huella de 64 hex, cascada", () => {
    for (const c of [
      `"payload" JSONB NOT NULL`,
      `"hash" TEXT NOT NULL`,
      `"firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
      `CREATE UNIQUE INDEX "FotofficeAlboomCrudo_workspaceId_entity_alboomId_key" ON "FotofficeAlboomCrudo"("workspaceId", "entity", "alboomId")`,
      `CREATE INDEX "FotofficeAlboomCrudo_workspaceId_entity_idx" ON "FotofficeAlboomCrudo"("workspaceId", "entity")`,
      `CHECK ("hash" ~ '^[0-9a-f]{64}$')`,
    ]) expect(sql, c).toContain(c);
    expect(sql).toMatch(/"FotofficeAlboomCrudo_workspaceId_fkey" FOREIGN KEY \("workspaceId"\) REFERENCES "Workspace"\("id"\) ON DELETE CASCADE/);
  });

  it("FotofficeAlboomExtraccion: estados por CHECK, una activa por workspace, fin coherente con el estado, cascada", () => {
    for (const c of [
      `"status" TEXT NOT NULL DEFAULT 'PENDIENTE'`,
      `"progress" JSONB NOT NULL DEFAULT '{}'`,
      `CHECK ("status" IN ('PENDIENTE', 'CORRIENDO', 'LISTA', 'ERROR', 'CANCELADA'))`,
      `CHECK ("mode" IN ('TODO', 'INCREMENTAL'))`,
      `CREATE UNIQUE INDEX "FotofficeAlboomExtraccion_workspaceId_activa_key" ON "FotofficeAlboomExtraccion"("workspaceId") WHERE "status" IN ('PENDIENTE', 'CORRIENDO')`,
      `char_length("errorReason") <= 500`,
    ]) expect(sql, c).toContain(c);
    expect(sql).toMatch(/"FotofficeAlboomExtraccion_workspaceId_fkey" FOREIGN KEY \("workspaceId"\) REFERENCES "Workspace"\("id"\) ON DELETE CASCADE/);
  });

  it("el esquema de Prisma coincide", () => {
    const crudo = modelo("FotofficeAlboomCrudo");
    expect(crudo).toContain("@@unique([workspaceId, entity, alboomId])");
    expect(crudo).toContain("@@index([workspaceId, entity])");
    expect(crudo).toMatch(/payload\s+Json\n/);
    expect(crudo).toMatch(/onDelete: Cascade/);
    const ext = modelo("FotofficeAlboomExtraccion");
    expect(ext).toMatch(/status\s+String\s+@default\("PENDIENTE"\)/);
    expect(ext).toMatch(/progress\s+Json\s+@default\("\{\}"\)/);
    expect(ext).toMatch(/onDelete: Cascade/);
  });

  it("el documento de la migración tiene el checksum del archivo", () => {
    const sha = createHash("sha256").update(sql).digest("hex");
    expect(doc).toContain(sha);
    expect(doc).toContain("20261105120000_fotoffice_etapa_8_alboom_extraccion");
  });
});
