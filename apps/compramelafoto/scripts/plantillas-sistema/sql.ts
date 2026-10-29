/**
 * El SQL que carga las plantillas de sistema. Idempotente: se puede correr dos veces.
 *
 * Marcadores que reemplaza quien lo corre:
 * - `{{OWNER_USER_ID}}`: id del usuario dueño (el admin).
 * - `{{R2_BASE}}`: URL pública del bucket, sin barra final (los fondos van en `template-v2/sistema/`).
 *
 * Por plantilla: la plantilla y su versión se insertan o actualizan; los bloques, vínculos y
 * archivos de la versión se borran y se vuelven a escribir (así una segunda corrida refleja la
 * definición actual); la publicación queda PUBLIC · APPROVED.
 */
import type { PlantillaSistema } from "./definiciones";

const lit = (s: string | null) => (s == null ? "NULL" : `'${s.replace(/'/g, "''")}'`);
const json = (v: unknown) => `${lit(JSON.stringify(v))}::jsonb`;
const num = (n: number) => (Number.isFinite(n) ? String(n) : "0");
const OWNER = "{{OWNER_USER_ID}}";

function sqlDePlantilla(p: PlantillaSistema): string {
  const v = lit(p.versionId);
  const t = lit(p.templateId);
  const partes: string[] = [];
  partes.push(`-- ${p.nombre} (${p.modelo.slug})`);
  partes.push(`INSERT INTO "TemplateV2" ("id", "ownerUserId", "workspaceId", "name", "description", "status", "currentVersionId", "createdAt", "updatedAt")
VALUES (${t}, ${OWNER}, NULL, ${lit(p.nombre)}, ${lit(p.descripcion)}, 'ACTIVE'::"TemplateV2Status", NULL, NOW(), NOW())
ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name", "description" = EXCLUDED."description", "status" = EXCLUDED."status", "updatedAt" = NOW();`);
  partes.push(`INSERT INTO "TemplateV2Version" ("id", "templateId", "versionNumber", "canvasJson", "metaJson", "revision", "isLocked", "createdByUserId", "createdAt", "updatedAt")
VALUES (${v}, ${t}, 1, ${json(p.canvasJson)}, ${json(p.metaJson)}, 0, false, ${OWNER}, NOW(), NOW())
ON CONFLICT ("id") DO UPDATE SET "canvasJson" = EXCLUDED."canvasJson", "metaJson" = EXCLUDED."metaJson", "revision" = "TemplateV2Version"."revision" + 1, "updatedAt" = NOW();`);
  partes.push(`UPDATE "TemplateV2" SET "currentVersionId" = ${v} WHERE "id" = ${t};`);
  partes.push(`DELETE FROM "TemplateV2VariableBinding" WHERE "templateVersionId" = ${v};`);
  partes.push(`DELETE FROM "TemplateV2Block" WHERE "templateVersionId" = ${v};`);
  partes.push(`DELETE FROM "TemplateV2Asset" WHERE "templateVersionId" = ${v};`);

  const filas = p.bloques.map(
    (b) =>
      `  (${lit(b.id)}, ${v}, ${b.pageIndex}, '${b.type}'::"TemplateV2BlockType", ${lit(b.name)}, ${num(b.x)}, ${num(b.y)}, ${num(b.width)}, ${num(b.height)}, ${num(b.rotation)}, ${b.zIndex}, ${num(b.opacity)}, ${b.locked}, ${b.visible}, ${json(b.configJson)}, NOW(), NOW())`,
  );
  partes.push(`INSERT INTO "TemplateV2Block" ("id", "templateVersionId", "pageIndex", "type", "name", "x", "y", "width", "height", "rotation", "zIndex", "opacity", "locked", "visible", "configJson", "createdAt", "updatedAt") VALUES
${filas.join(",\n")};`);

  const vinculos = p.bindings.map(
    (b) => `  (${lit(b.id)}, ${v}, ${lit(b.blockId)}, ${lit(b.targetPath)}, ${lit(b.variableKey)}, NULL, NULL, NOW(), NOW())`,
  );
  partes.push(`INSERT INTO "TemplateV2VariableBinding" ("id", "templateVersionId", "blockId", "targetPath", "variableKey", "formatter", "fallbackOverride", "createdAt", "updatedAt") VALUES
${vinculos.join(",\n")};`);

  const archivos = p.assets.map(
    (a) => `  (${lit(a.id)}, ${v}, 'IMAGE'::"TemplateV2AssetKind", ${lit(a.storageKey)}, ${lit(a.mimeType)}, ${json(a.metaJson)}, NOW(), NOW())`,
  );
  partes.push(`INSERT INTO "TemplateV2Asset" ("id", "templateVersionId", "kind", "storageKey", "mimeType", "metaJson", "createdAt", "updatedAt") VALUES
${archivos.join(",\n")};`);

  partes.push(`INSERT INTO "TemplateV2Publication" ("id", "templateId", "visibility", "reviewStatus", "reviewNotes", "reviewedByUserId", "reviewedAt", "publishedByUserId", "publishedAt", "createdAt", "updatedAt")
VALUES (${lit(p.publicationId)}, ${t}, 'PUBLIC'::"TemplateV2Visibility", 'APPROVED'::"TemplateV2ReviewStatus", ${lit(p.notaDeRevision ?? "Plantilla de sistema: librito 30×20 cm.")}, ${OWNER}, NOW(), ${OWNER}, NOW(), NOW(), NOW())
ON CONFLICT ("templateId") DO UPDATE SET "visibility" = EXCLUDED."visibility", "reviewStatus" = EXCLUDED."reviewStatus", "reviewNotes" = EXCLUDED."reviewNotes", "updatedAt" = NOW();`);
  return partes.join("\n");
}

export function generarSql(plantillas: PlantillaSistema[]): string {
  return [
    "-- Plantillas de sistema para venta escolar (CompraMeLaFoto).",
    "-- Generado por apps/compramelafoto/scripts/plantillas-sistema/generar.ts. No editar a mano.",
    "-- Reemplazar {{OWNER_USER_ID}} (id del admin) y {{R2_BASE}} (URL pública del bucket, sin barra final).",
    "-- Antes de correrlo, subir los fondos JPG a template-v2/sistema/<archivo> en R2.",
    "BEGIN;",
    ...plantillas.map(sqlDePlantilla),
    "COMMIT;",
    "",
  ].join("\n\n");
}
