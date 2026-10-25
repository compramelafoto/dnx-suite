/**
 * Una versión de plantilla que ya usa algo (un diseño armado, un carnet impreso…) no se pisa al
 * guardar: queda congelada y los cambios van a una versión nueva, con el mapa de bloques para
 * pasar diseños de una a la otra.
 *
 * Corre contra una base en memoria que entiende sólo lo que usan estos servicios.
 */
import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import {
  saveAsNewVersion,
  saveTemplateV2Version,
  setTemplateV2Runtime,
  copyTemplateV2VersionAsPrivate,
  type TemplateV2VersionSaveDecision,
} from "../services";
import {
  TEMPLATE_V2_EDITOR_INITIAL_STATE,
  rebaseEditorStateToSavedVersion,
  templateV2EditorReducer,
  initializeEditor,
} from "../editor-store";
import {
  mergeServerOwnedMeta,
  readVersionOrigin,
  resolveBlockIdMapBetweenVersions,
} from "../template-v2-version-lineage";

type Row = Record<string, any>;

function matches(row: Row, where: Row | undefined): boolean {
  if (!where) return true;
  return Object.entries(where).every(([k, cond]) => {
    if (cond && typeof cond === "object" && !Array.isArray(cond) && !(cond instanceof Date)) {
      if ("in" in cond) return (cond.in as unknown[]).includes(row[k]);
      if ("not" in cond) return row[k] !== cond.not;
    }
    return row[k] === cond;
  });
}

function pick(row: Row | undefined, select?: Row): Row | null {
  if (!row) return null;
  if (!select) return { ...row };
  return Object.fromEntries(Object.keys(select).map((k) => [k, row[k]]));
}

let seq = 0;
function table(rows: Row[], opts: { autoId?: boolean; timestamps?: boolean } = {}) {
  return {
    rows,
    findUnique: async ({ where, select }: Row) => pick(rows.find((r) => matches(r, where)), select),
    findFirst: async ({ where, select }: Row) => pick(rows.find((r) => matches(r, where)), select),
    findMany: async ({ where, select }: Row = {}) => rows.filter((r) => matches(r, where)).map((r) => pick(r, select)!),
    count: async ({ where }: Row = {}) => rows.filter((r) => matches(r, where)).length,
    create: async ({ data }: Row) => {
      const row: Row = { ...data };
      if (opts.autoId && !row.id) row.id = `id-${++seq}`;
      if (opts.timestamps) row.updatedAt = new Date();
      rows.push(row);
      return { ...row };
    },
    createMany: async ({ data }: Row) => {
      for (const d of data as Row[]) {
        const row: Row = { ...d };
        if (opts.autoId && !row.id) row.id = `id-${++seq}`;
        if (rows.some((r) => r.id === row.id)) throw new Error(`clave duplicada ${row.id}`);
        rows.push(row);
      }
      return { count: (data as Row[]).length };
    },
    update: async ({ where, data }: Row) => {
      const row = rows.find((r) => matches(r, where));
      if (!row) throw new Error("no existe");
      Object.assign(row, data);
      if (opts.timestamps) row.updatedAt = new Date();
      return { ...row };
    },
    updateMany: async ({ where, data }: Row) => {
      const hit = rows.filter((r) => matches(r, where));
      for (const r of hit) Object.assign(r, data);
      return { count: hit.length };
    },
    deleteMany: async ({ where }: Row) => {
      const keep = rows.filter((r) => !matches(r, where));
      const n = rows.length - keep.length;
      rows.splice(0, rows.length, ...keep);
      return { count: n };
    },
    aggregate: async ({ where }: Row) => ({
      _max: { versionNumber: Math.max(0, ...rows.filter((r) => matches(r, where)).map((r) => r.versionNumber)) },
    }),
  };
}

function block(id: string, extra: Row = {}): Row {
  return {
    id,
    type: "IMAGE",
    pageIndex: 0,
    name: null,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    rotation: 0,
    zIndex: 1,
    opacity: 1,
    locked: false,
    visible: true,
    configJson: { source: { variableKey: "photo_1" } },
    ...extra,
  };
}

function payloadFrom(blocks: Row[], revision: number, meta: Row = {}) {
  return {
    revision,
    canvas: { width: 1200, height: 1800, background: "#fff" },
    blocks: blocks.map((b) => ({
      id: b.id,
      type: b.type,
      pageIndex: b.pageIndex,
      layout: {
        x: b.x,
        y: b.y,
        width: b.width,
        height: b.height,
        rotation: 0,
        zIndex: b.zIndex,
        opacity: 1,
        locked: false,
        visible: true,
      },
      configJson: b.configJson,
    })),
    variableBindings: [],
    meta,
  };
}

const user = { id: 7, role: "PHOTOGRAPHER" };
let db: ReturnType<typeof makeDb>;
let decide: (versionId: string, meta: unknown) => TemplateV2VersionSaveDecision;

function makeDb() {
  const d = {
    templateV2: table([{ id: "t1", ownerUserId: 7, workspaceId: null, status: "ACTIVE", name: "Librito", currentVersionId: "v1" }], { timestamps: true }),
    templateV2Publication: table([{ templateId: "t1", reviewStatus: "DRAFT", visibility: "PRIVATE" }]),
    templateV2Version: table(
      [{ id: "v1", templateId: "t1", versionNumber: 1, revision: 3, isLocked: false, canvasJson: {}, metaJson: { templatePageCount: 1 } }],
      { autoId: true, timestamps: true },
    ),
    templateV2Block: table([block("tapa"), block("contra", { configJson: { source: { variableKey: "photo_2" } } })]),
    templateV2VariableBinding: table([]),
    templateV2Asset: table([{ id: "a1", templateVersionId: "v1", kind: "IMAGE", storageKey: "k/fondo.jpg", mimeType: "image/jpeg", metaJson: null }], {
      autoId: true,
    }),
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(d),
  };
  for (const b of d.templateV2Block.rows) b.templateVersionId = "v1";
  return d;
}

beforeEach(() => {
  db = makeDb();
  decide = () => ({ mode: "in-place" });
  setTemplateV2Runtime({
    prisma: db,
    requireUser: async () => user,
    uploadImage: async () => ({ url: "", key: "" }),
    policy: { canDesign: () => true },
    resolveVersionSave: async ({ versionId, metaJson }) => decide(versionId, metaJson),
  });
});

const v1Blocks = () => db.templateV2Block.rows.filter((b) => b.templateVersionId === "v1");

describe("guardar una versión de plantilla en uso", () => {
  it("sin uso, se guarda encima de la misma versión (como siempre)", async () => {
    const r = await saveTemplateV2Version({
      user,
      templateId: "t1",
      versionId: "v1",
      body: payloadFrom([block("tapa", { x: 50 })], 3),
    });
    assert.equal(r.versionId, "v1");
    assert.equal(r.forkedFromVersionId, null);
    assert.equal(r.revision, 4);
    assert.deepEqual(v1Blocks().map((b) => [b.id, b.x]), [["tapa", 50]]);
  });

  it("en uso, la versión queda congelada y los cambios van a una nueva", async () => {
    decide = (id) => (id === "v1" ? { mode: "fork" } : { mode: "in-place" });
    const r = await saveTemplateV2Version({
      user,
      templateId: "t1",
      versionId: "v1",
      body: payloadFrom([block("tapa", { x: 50 }), block("nuevo")], 3),
    });

    assert.notEqual(r.versionId, "v1");
    assert.equal(r.forkedFromVersionId, "v1");
    assert.equal(r.versionNumber, 2);
    assert.equal(r.revision, 0);

    // La vieja: intacta y congelada.
    const v1 = db.templateV2Version.rows.find((v) => v.id === "v1")!;
    assert.equal(v1.isLocked, true);
    assert.equal(v1.revision, 3);
    assert.deepEqual(v1Blocks().map((b) => [b.id, b.x]).sort(), [["contra", 0], ["tapa", 0]]);

    // La nueva: vigente, con otros ids y con el mapa para pasar diseños.
    assert.equal(db.templateV2.rows[0]!.currentVersionId, r.versionId);
    const nueva = db.templateV2Version.rows.find((v) => v.id === r.versionId)!;
    const origen = readVersionOrigin(nueva.metaJson)!;
    assert.equal(origen.versionId, "v1");
    assert.equal(origen.reason, "en-uso");
    assert.deepEqual(Object.keys(origen.blockIdMap), ["tapa"], "sólo los bloques que ya estaban (contra se borró, nuevo es nuevo)");
    assert.equal(origen.blockIdMap.tapa, r.blockIdMap.tapa);
    const nuevos = db.templateV2Block.rows.filter((b) => b.templateVersionId === r.versionId);
    assert.equal(nuevos.find((b) => b.id === r.blockIdMap.tapa)!.x, 50);
    // Los fondos subidos siguen disponibles en la nueva.
    assert.equal(db.templateV2Asset.rows.filter((a) => a.templateVersionId === r.versionId).length, 1);
  });

  it("el siguiente guardado ya pisa la nueva (todavía nadie la usa) y conserva el mapa", async () => {
    decide = (id) => (id === "v1" ? { mode: "fork" } : { mode: "in-place" });
    const r1 = await saveTemplateV2Version({ user, templateId: "t1", versionId: "v1", body: payloadFrom([block("tapa")], 3) });
    const tapa2 = r1.blockIdMap.tapa!;
    const r2 = await saveTemplateV2Version({
      user,
      templateId: "t1",
      versionId: r1.versionId,
      // El navegador manda la meta sin las marcas del servidor; igual no se pierden.
      body: payloadFrom([block(tapa2, { x: 9 })], 0, { templatePageCount: 1 }),
    });
    assert.equal(r2.versionId, r1.versionId);
    assert.equal(r2.revision, 1);
    const meta = db.templateV2Version.rows.find((v) => v.id === r1.versionId)!.metaJson;
    assert.equal(readVersionOrigin(meta)?.blockIdMap.tapa, tapa2);
  });

  it("si el editor manda ids de la versión congelada (deshizo), se traducen y se avisa", async () => {
    decide = (id) => (id === "v1" ? { mode: "fork" } : { mode: "in-place" });
    const r1 = await saveTemplateV2Version({ user, templateId: "t1", versionId: "v1", body: payloadFrom([block("tapa"), block("contra")], 3) });
    const r2 = await saveTemplateV2Version({
      user,
      templateId: "t1",
      versionId: r1.versionId,
      body: payloadFrom([block("tapa"), block("contra")], 0),
    });
    assert.equal(r2.blockIdMap.tapa, r1.blockIdMap.tapa);
    assert.equal(r2.blockIdMap.contra, r1.blockIdMap.contra);
    assert.equal(v1Blocks().length, 2, "la congelada no se tocó");
  });

  it("otra pestaña que sigue en la versión congelada choca en vez de crear una rama paralela", async () => {
    decide = () => ({ mode: "fork" });
    await saveTemplateV2Version({ user, templateId: "t1", versionId: "v1", body: payloadFrom([block("tapa")], 3) });
    await assert.rejects(
      saveTemplateV2Version({ user, templateId: "t1", versionId: "v1", body: payloadFrom([block("tapa", { x: 1 })], 3) }),
      (err: { code?: string }) => err.code === "TEMPLATE_EDIT_CONFLICT",
    );
  });

  it("una versión congelada nunca se pisa, aunque la app diga que no está en uso", async () => {
    db.templateV2Version.rows[0]!.isLocked = true;
    const r = await saveTemplateV2Version({ user, templateId: "t1", versionId: "v1", body: payloadFrom([block("tapa")], 3) });
    assert.notEqual(r.versionId, "v1");
  });

  it("la app puede dejarla de sólo lectura (p. ej. librito ya en imprenta)", async () => {
    decide = () => ({ mode: "read-only", message: "Ya se mandó a imprimir." });
    await assert.rejects(
      saveTemplateV2Version({ user, templateId: "t1", versionId: "v1", body: payloadFrom([block("tapa")], 3) }),
      (err: { message?: string; httpStatus?: number }) => err.message === "Ya se mandó a imprimir." && err.httpStatus === 403,
    );
    assert.equal(db.templateV2Version.rows.length, 1);
  });

  it("dos cambios seguidos componen el mapa desde la versión del diseño hasta la vigente", async () => {
    decide = () => ({ mode: "fork" });
    const r1 = await saveTemplateV2Version({ user, templateId: "t1", versionId: "v1", body: payloadFrom([block("tapa"), block("contra")], 3) });
    const r2 = await saveTemplateV2Version({
      user,
      templateId: "t1",
      versionId: r1.versionId,
      body: payloadFrom([block(r1.blockIdMap.tapa!), block(r1.blockIdMap.contra!)], 0),
    });
    const load = async (id: string) =>
      (db.templateV2Version.rows.find((v) => v.id === id) as { id: string; metaJson: unknown } | undefined) ?? null;
    const map = await resolveBlockIdMapBetweenVersions("v1", r2.versionId, load);
    assert.deepEqual(map, { tapa: r2.blockIdMap[r1.blockIdMap.tapa!], contra: r2.blockIdMap[r1.blockIdMap.contra!] });
    assert.equal(await resolveBlockIdMapBetweenVersions(r2.versionId, "v1", load), null, "al revés no hay camino");
  });

  it("«Guardar como nueva versión» también anota el mapa, y no se puede hacer desde una copia privada", async () => {
    const r = await saveAsNewVersion({ user, templateId: "t1", body: { ...payloadFrom([block("tapa")], 3), branchFromVersionId: "v1" } });
    const meta = db.templateV2Version.rows.find((v) => v.id === r.versionId)!.metaJson;
    assert.equal(readVersionOrigin(meta)?.reason, "nueva-version");

    const copia = await copyTemplateV2VersionAsPrivate(db, {
      templateId: "t1",
      versionId: "v1",
      userId: 7,
      privateCopy: { kind: "design-project", id: "12", at: "" },
    });
    await assert.rejects(
      saveAsNewVersion({ user, templateId: "t1", body: { ...payloadFrom([block("x")], 0), branchFromVersionId: copia.newVersionId } }),
      (err: { httpStatus?: number }) => err.httpStatus === 403,
    );
  });

  it("la copia privada de un diseño no pasa a ser la vigente y trae todos los bloques", async () => {
    const copia = await copyTemplateV2VersionAsPrivate(db, {
      templateId: "t1",
      versionId: "v1",
      userId: 7,
      privateCopy: { kind: "design-project", id: "12", at: "" },
    });
    assert.equal(db.templateV2.rows[0]!.currentVersionId, "v1");
    assert.deepEqual(Object.keys(copia.blockIdMap).sort(), ["contra", "tapa"]);
    assert.equal(db.templateV2Block.rows.filter((b) => b.templateVersionId === copia.newVersionId).length, 2);
  });
});

describe("marcas del servidor en la meta", () => {
  it("lo que manda el navegador no puede escribir el origen", () => {
    const merged = mergeServerOwnedMeta(
      { templatePageCount: 2, origenDeVersion: { versionId: "trucho", blockIdMap: {} } },
      { origenDeVersion: { versionId: "v1", blockIdMap: { a: "b" } } },
    );
    assert.equal(merged.templatePageCount, 2);
    assert.equal(readVersionOrigin(merged)?.versionId, "v1");
  });
});

describe("el editor pasa a la versión nueva", () => {
  it("traduce ids en bloques, vínculos, selección e historial", () => {
    let s = templateV2EditorReducer(
      TEMPLATE_V2_EDITOR_INITIAL_STATE,
      initializeEditor({
        templateId: "t1",
        versionId: "v1",
        revision: 3,
        canvas: { width: 1200, height: 1800, background: "#fff" },
        blocks: [
          {
            id: "tapa",
            type: "IMAGE",
            pageIndex: 0,
            layout: { x: 0, y: 0, width: 10, height: 10, rotation: 0, zIndex: 1, opacity: 1, visible: true },
            configJson: {},
          },
        ],
        variableBindings: [{ id: "vb-v1-1", blockId: "tapa", targetPath: "x", variableKey: "y" }],
      }),
    );
    s = templateV2EditorReducer(s, { type: "updateBlock", payload: { blockId: "tapa", patch: { layout: { x: 5 } } } });
    s = { ...s, selectedBlockIds: ["tapa"] };
    s = rebaseEditorStateToSavedVersion(s, { versionId: "v2", revision: 0, blockIdMap: { tapa: "T2" } });
    assert.equal(s.versionId, "v2");
    assert.equal(s.revision, 0);
    assert.equal(s.blocks[0]!.id, "T2");
    assert.deepEqual(s.selectedBlockIds, ["T2"]);
    assert.equal(s.variableBindings[0]!.blockId, "T2");
    assert.equal(s.variableBindings[0]!.id, undefined, "el id del vínculo viejo está ocupado");
    assert.equal(s.historyPast[0]!.blocks[0]!.id, "T2");

    // Deshacer no vuelve a la revisión vieja (chocaría contra el servidor).
    const undone = templateV2EditorReducer(s, { type: "undo" });
    assert.equal(undone.revision, 0);
    assert.equal(undone.blocks[0]!.id, "T2");
    assert.equal(undone.isDirty, true);
  });
});
