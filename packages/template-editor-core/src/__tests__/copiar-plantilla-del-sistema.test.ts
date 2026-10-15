/**
 * «Usar y personalizar»: copiar una plantilla del sistema a las del fotógrafo copia la versión
 * completa (bloques, vínculos de variables, archivos y meta sin la marca de sistema) y la copia
 * queda suya, en borrador, editable y sin publicar. El original no se toca.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { duplicateTemplateV2InsideTransaction } from "../services/duplicate-template-v2-in-transaction";

function txFalsa() {
  const escrito: Record<string, unknown[]> = {};
  const anotar = (tabla: string, fila: unknown) => (escrito[tabla] ??= []).push(fila);
  let n = 0;
  const tx = {
    templateV2: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const fila = { id: `tpl-${++n}`, ...data };
        anotar("templateV2.create", fila);
        return fila;
      },
      update: async (args: unknown) => anotar("templateV2.update", args),
    },
    templateV2Version: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const fila = { id: `ver-${++n}`, ...data };
        anotar("templateV2Version.create", fila);
        return fila;
      },
    },
    templateV2Block: { createMany: async ({ data }: { data: unknown[] }) => data.forEach((d) => anotar("block", d)) },
    templateV2Asset: { createMany: async ({ data }: { data: unknown[] }) => data.forEach((d) => anotar("asset", d)) },
    templateV2VariableBinding: {
      createMany: async ({ data }: { data: unknown[] }) => data.forEach((d) => anotar("binding", d)),
    },
    templateV2Publication: { create: async ({ data }: { data: unknown }) => anotar("publication", data) },
  };
  return { tx, escrito };
}

const fuente = {
  id: "sys_librito_primaria_pizarron",
  name: "Librito Primaria · Pizarrón",
  description: "Carpeta 30×20",
  currentVersion: {
    canvasJson: { width: 3543, height: 2362 },
    metaJson: {
      system: true,
      version: "v2",
      legacyStyleFlags: { system: true, version: "v2" },
      categoria: "Primaria",
      photoInputs: [{ slotKey: "photo_individual" }],
    },
    blocks: [
      { id: "b-foto", pageIndex: 1, type: "IMAGE", name: "Foto", x: 1, y: 2, width: 3, height: 4, rotation: 0, zIndex: 2, opacity: 1, visible: true, locked: true, configJson: { source: { variableKey: "photo_individual" } } },
      { id: "b-texto", pageIndex: 0, type: "VARIABLE_TEXT", name: "Nombre", x: 5, y: 6, width: 7, height: 8, rotation: 0, zIndex: 3, opacity: 1, visible: true, configJson: { variableKey: "student.fullName" } },
    ],
    assets: [{ kind: "BACKGROUND", storageKey: "template-v2/sistema/librito-exterior.jpg", mimeType: "image/jpeg", metaJson: { originalName: "x" } }],
    variableBindings: [{ blockId: "b-foto", targetPath: "src", variableKey: "photo_individual" }],
  },
};

test("copiar una plantilla del sistema deja una copia propia, completa y sin publicar", async () => {
  const { tx, escrito } = txFalsa();
  const r = await duplicateTemplateV2InsideTransaction(tx, {
    source: structuredClone(fuente),
    newOwnerUserId: 33,
    createdByUserId: 33,
    versionMetaStrategy: "fork_from_public_catalog",
    catalogTemplateIdForMeta: fuente.id,
    customCloneName: "Librito Primaria · Pizarrón — copia",
  });

  const tpl = escrito["templateV2.create"]![0] as Record<string, unknown>;
  assert.equal(tpl.ownerUserId, 33, "queda del fotógrafo");
  assert.equal(tpl.status, "DRAFT", "en borrador");
  assert.equal(tpl.name, "Librito Primaria · Pizarrón — copia");
  assert.notEqual(r.templateId, fuente.id, "es otra plantilla, el original no se toca");

  const ver = escrito["templateV2Version.create"]![0] as Record<string, unknown>;
  assert.equal(ver.isLocked, false, "editable");
  assert.deepEqual(ver.canvasJson, fuente.currentVersion.canvasJson);
  const meta = ver.metaJson as Record<string, unknown>;
  assert.equal(meta.system, undefined, "sin la marca de sistema");
  assert.deepEqual(meta.legacyStyleFlags, { version: "v2" });
  assert.equal(meta.categoria, "Primaria", "conserva el resto del meta");
  assert.deepEqual(meta.photoInputs, [{ slotKey: "photo_individual" }]);
  assert.equal(meta.forkedFromTemplateId, fuente.id);
  // El original sigue marcado como sistema.
  assert.equal(fuente.currentVersion.metaJson.system, true);

  const bloques = escrito.block as Array<Record<string, unknown>>;
  assert.equal(bloques.length, 2);
  assert.ok(bloques.every((b) => b.templateVersionId === r.versionId));
  assert.ok(bloques.every((b) => b.id !== "b-foto" && b.id !== "b-texto"), "bloques con ids nuevos");
  assert.deepEqual(bloques[0]!.configJson, { source: { variableKey: "photo_individual" } });

  const vinculos = escrito.binding as Array<Record<string, unknown>>;
  assert.equal(vinculos.length, 1);
  assert.equal(vinculos[0]!.blockId, bloques[0]!.id, "el vínculo apunta al bloque copiado");
  assert.equal(vinculos[0]!.variableKey, "photo_individual");

  const archivos = escrito.asset as Array<Record<string, unknown>>;
  assert.equal(archivos.length, 1);
  assert.equal(archivos[0]!.storageKey, "template-v2/sistema/librito-exterior.jpg");

  assert.deepEqual(escrito.publication, [{ templateId: r.templateId, visibility: "PRIVATE", reviewStatus: "DRAFT" }]);
});
