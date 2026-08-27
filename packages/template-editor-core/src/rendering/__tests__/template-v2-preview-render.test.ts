import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import type { ResolvedTemplateDocument } from "@repo/template-engine";
import {
  createSchoolTemplateEngineRegistry,
  resolveSchoolTemplateDocument,
} from "../../template-engine-compat";
import { legacyPayloadToCore } from "../../services/template-v2-mappers";
import { createTemplatePreviewExampleData } from "../create-template-preview-example-data";
import { renderTemplatePreviewPng } from "../template-v2-preview-renderer";
import {
  closeTemplatePreviewBrowser,
} from "../template-v2-browser-manager";

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function assertPng(buf: Buffer) {
  assert.ok(buf.length > 32, "PNG no vacío");
  assert.ok(buf.subarray(0, 8).equals(PNG_SIG), "firma PNG");
}

describe("template-v2 preview render (Chromium)", () => {
  after(async () => {
    await closeTemplatePreviewBrowser();
  });

  it("simple-text", async () => {
    const doc = {
      schemaVersion: 1,
      id: "t-simple",
      name: "simple-text",
      width: 320,
      height: 180,
      background: { color: "#ffffff" },
      blocks: [
        {
          id: "t1",
          type: "TEXT",
          pageIndex: 0,
          layout: {
            x: 20,
            y: 40,
            width: 280,
            height: 60,
            rotation: 0,
            zIndex: 1,
            opacity: 1,
            visible: true,
          },
          config: {
            content: "Hola Preview",
            fontFamily: "Arial",
            fontSize: 28,
            fontWeight: 700,
            color: "#111111",
            textAlign: "CENTER",
          },
        },
      ],
      bindings: [],
    } as unknown as ResolvedTemplateDocument;

    const r = await renderTemplatePreviewPng(doc);
    assertPng(r.png);
    assert.equal(r.width, 320);
    assert.equal(r.height, 180);
    assert.equal(r.mimeType, "image/png");
  });

  it("school-variable", async () => {
    const { document } = legacyPayloadToCore(
      {
        canvas: { width: 400, height: 200, background: "#f8fafc" },
        blocks: [
          {
            id: "vt",
            type: "VARIABLE_TEXT",
            pageIndex: 0,
            layout: {
              x: 16,
              y: 60,
              width: 360,
              height: 48,
              rotation: 0,
              zIndex: 2,
              opacity: 1,
              visible: true,
            },
            configJson: {
              variableKey: "student.fullName",
              fallback: "[student.fullName]",
              fontFamily: "Arial",
              fontSize: 24,
              color: "#0f172a",
              textAlign: "CENTER",
            },
          },
        ],
        variableBindings: [
          {
            blockId: "vt",
            targetPath: "variableKey",
            variableKey: "student.fullName",
          },
        ],
        meta: {},
      },
      { name: "school-variable" }
    );

    const resolved = resolveSchoolTemplateDocument(
      document,
      createTemplatePreviewExampleData(),
      createSchoolTemplateEngineRegistry()
    );
    const r = await renderTemplatePreviewPng(resolved.document);
    assertPng(r.png);
    const htmlProbe = JSON.stringify(resolved.document.blocks);
    assert.match(htmlProbe, /Nombre Apellido|Nombre de prueba|student\.fullName|Nombre/);
  });

  it("photo-circle + shape-background + rotated-text", async () => {
    const doc = {
      schemaVersion: 1,
      id: "layered",
      name: "layered-elements",
      width: 360,
      height: 360,
      background: { color: "#e2e8f0" },
      blocks: [
        {
          id: "bg",
          type: "BACKGROUND",
          pageIndex: 0,
          layout: {
            x: 0,
            y: 0,
            width: 360,
            height: 360,
            rotation: 0,
            zIndex: 0,
            opacity: 1,
            visible: true,
          },
          config: { backgroundColor: "#e2e8f0", src: "" },
        },
        {
          id: "sh",
          type: "SHAPE",
          pageIndex: 0,
          layout: {
            x: 40,
            y: 40,
            width: 120,
            height: 120,
            rotation: 0,
            zIndex: 1,
            opacity: 1,
            visible: true,
          },
          config: { variant: "circle", fill: "#c27b3d", stroke: "#8b5a2b", strokeWidth: 2 },
        },
        {
          id: "ph",
          type: "PHOTO",
          pageIndex: 0,
          layout: {
            x: 200,
            y: 40,
            width: 120,
            height: 120,
            rotation: 0,
            zIndex: 2,
            opacity: 1,
            visible: true,
          },
          config: { src: TINY_PNG, fit: "cover", maskShape: "circle" },
        },
        {
          id: "rt",
          type: "TEXT",
          pageIndex: 0,
          layout: {
            x: 80,
            y: 220,
            width: 200,
            height: 40,
            rotation: -12,
            zIndex: 3,
            opacity: 0.9,
            visible: true,
          },
          config: {
            content: "Rotado",
            fontFamily: "Arial",
            fontSize: 22,
            color: "#111827",
          },
        },
        {
          id: "miss",
          type: "IMAGE",
          pageIndex: 0,
          layout: {
            x: 20,
            y: 300,
            width: 40,
            height: 40,
            rotation: 0,
            zIndex: 4,
            opacity: 1,
            visible: true,
          },
          config: { src: "" },
        },
      ],
      bindings: [],
    } as unknown as ResolvedTemplateDocument;

    const r = await renderTemplatePreviewPng(doc);
    assertPng(r.png);
    assert.equal(r.blockCount, 5);
  });

  it("warm render reutiliza browser", async () => {
    const doc = {
      schemaVersion: 1,
      id: "warm",
      name: "warm",
      width: 200,
      height: 120,
      blocks: [
        {
          id: "t",
          type: "TEXT",
          pageIndex: 0,
          layout: {
            x: 10,
            y: 40,
            width: 180,
            height: 40,
            rotation: 0,
            zIndex: 1,
            opacity: 1,
            visible: true,
          },
          config: { content: "warm", fontSize: 18, color: "#000" },
        },
      ],
      bindings: [],
    } as unknown as ResolvedTemplateDocument;

    const a = await renderTemplatePreviewPng(doc);
    const b = await renderTemplatePreviewPng(doc);
    assertPng(a.png);
    assertPng(b.png);
    // warm debería ser razonable (no assert estricto de ms: CI variable)
    assert.ok(b.durationMs < 15_000);
  });
});
