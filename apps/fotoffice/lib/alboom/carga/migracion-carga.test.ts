import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = join(__dirname, "..", "..", "..", "..", "..");
const NOMBRE = "20261114120000_fotoffice_etapa_8b_alboom_carga";
const sql = readFileSync(join(RAIZ, `packages/db/prisma/migrations/${NOMBRE}/migration.sql`), "utf8");
const schema = readFileSync(join(RAIZ, "packages/db/prisma/schema.prisma"), "utf8");
const doc = readFileSync(join(RAIZ, "packages/db/docs/MIGRACION-ETAPA-8B1.md"), "utf8");

function modelo(nombre: string): string {
  const m = schema.match(new RegExp(`\\nmodel ${nombre} \\{[\\s\\S]*?\\n\\}`));
  if (!m) throw new Error(`No está el modelo ${nombre}`);
  return m[0];
}

describe("migración de la etapa 8B-1 (cargar desde Alboom)", () => {
  it("sólo tiene SQL y comentarios", () => {
    const sueltas = sql.split("\n").filter((l) => /^(warn|info|error)\b|pris\.ly|^For more information|[┌│└]/i.test(l.trim()));
    expect(sueltas).toEqual([]);
  });

  it("crea sólo las dos tablas nuevas y no toca otras ni borra datos", () => {
    expect([...sql.matchAll(/CREATE TABLE "([^"]+)"/g)].map((m) => m[1]).sort()).toEqual(["FotofficeAlboomCarga", "FotofficeAlboomMapa"]);
    const tocadas = new Set([...sql.matchAll(/(?:ALTER TABLE|CREATE TABLE|ON) "([^"]+)"/g)].map((m) => m[1]));
    expect([...tocadas].sort()).toEqual(["FotofficeAlboomCarga", "FotofficeAlboomMapa"]);
    expect(sql).not.toMatch(/DELETE FROM|UPDATE "|INSERT INTO|DROP |ADD COLUMN/);
  });

  it("FotofficeAlboomMapa: único por workspace+entidad+id, índice por destino, huella de 64 hex, cascada", () => {
    for (const c of [
      `"fieldHashes" JSONB NOT NULL DEFAULT '{}'`,
      `CREATE UNIQUE INDEX "FotofficeAlboomMapa_workspaceId_entity_alboomId_key" ON "FotofficeAlboomMapa"("workspaceId", "entity", "alboomId")`,
      `CREATE INDEX "FotofficeAlboomMapa_workspaceId_targetType_targetId_idx" ON "FotofficeAlboomMapa"("workspaceId", "targetType", "targetId")`,
      `CHECK ("payloadHash" ~ '^[0-9a-f]{64}$')`,
    ]) expect(sql, c).toContain(c);
    expect(sql).toMatch(/"FotofficeAlboomMapa_workspaceId_fkey" FOREIGN KEY \("workspaceId"\) REFERENCES "Workspace"\("id"\) ON DELETE CASCADE/);
  });

  it("FotofficeAlboomCarga: modo y estado por CHECK, una activa por workspace, fin coherente, cascada", () => {
    for (const c of [
      `CHECK ("mode" IN ('SIMULACION', 'CARGA'))`,
      `CHECK ("status" IN ('PENDIENTE', 'CORRIENDO', 'LISTA', 'ERROR', 'CANCELADA'))`,
      `CREATE UNIQUE INDEX "FotofficeAlboomCarga_workspaceId_activa_key" ON "FotofficeAlboomCarga"("workspaceId") WHERE "status" IN ('PENDIENTE', 'CORRIENDO')`,
      `char_length("errorReason") <= 500`,
      `"fingerprint" ~ '^[0-9a-f]{64}$'`,
      `"report" JSONB NOT NULL DEFAULT '{}'`,
    ]) expect(sql, c).toContain(c);
    expect(sql).toMatch(/"FotofficeAlboomCarga_workspaceId_fkey" FOREIGN KEY \("workspaceId"\) REFERENCES "Workspace"\("id"\) ON DELETE CASCADE/);
  });

  it("el esquema de Prisma coincide", () => {
    const mapa = modelo("FotofficeAlboomMapa");
    expect(mapa).toContain("@@unique([workspaceId, entity, alboomId])");
    expect(mapa).toContain("@@index([workspaceId, targetType, targetId])");
    expect(mapa).toMatch(/fieldHashes\s+Json\s+@default\("\{\}"\)/);
    expect(mapa).toMatch(/onDelete: Cascade/);
    const carga = modelo("FotofficeAlboomCarga");
    expect(carga).toMatch(/status\s+String\s+@default\("PENDIENTE"\)/);
    expect(carga).toMatch(/report\s+Json\s+@default\("\{\}"\)/);
    expect(carga).toMatch(/onDelete: Cascade/);
  });

  it("el documento tiene el checksum del archivo", () => {
    const sha = createHash("sha256").update(sql).digest("hex");
    expect(doc).toContain(sha);
    expect(doc).toContain(NOMBRE);
  });
});
