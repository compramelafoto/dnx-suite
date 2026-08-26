import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ResolvedTemplateDocument } from "@repo/template-engine";
import { escapeHtml, sanitizeCssColor } from "../template-v2-html-escape";
import { layoutStyle, typographyStyle, objectFitStyle } from "../template-v2-css-builder";
import { buildTemplatePreviewHtml } from "../template-v2-html-builder";
import {
  assertPreviewAssetUrlShape,
  resolvePreviewAssetSrc,
} from "../template-v2-asset-resolver";
import {
  TEMPLATE_V2_PREVIEW_LIMITS,
  clampPreviewScale,
} from "../template-v2-render-limits";
import { createTemplatePreviewExampleData } from "../create-template-preview-example-data";
import { previewAssetFailed, previewLimitExceeded } from "../template-v2-render-errors";

function miniDoc(
  overrides?: Partial<ResolvedTemplateDocument>
): ResolvedTemplateDocument {
  return {
    schemaVersion: 1,
    id: "preview-doc",
    name: "Preview",
    width: 400,
    height: 300,
    blocks: [],
    bindings: [],
    ...overrides,
  } as ResolvedTemplateDocument;
}

describe("template-v2 preview unit", () => {
  it("escapeHtml escapa caracteres peligrosos", () => {
    assert.equal(
      escapeHtml(`<script>"x"&'y'</script>`),
      "&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;&lt;/script&gt;"
    );
  });

  it("sanitizeCssColor bloquea inyección", () => {
    assert.equal(sanitizeCssColor("#abc"), "#abc");
    assert.equal(sanitizeCssColor("rgb(1,2,3)"), "rgb(1,2,3)");
    assert.equal(sanitizeCssColor("expression(alert(1))"), "#111111");
    assert.equal(sanitizeCssColor("url(evil)"), "#111111");
  });

  it("layoutStyle respeta coordenadas y rotación", () => {
    const s = layoutStyle({
      x: 10,
      y: 20,
      width: 100,
      height: 50,
      rotation: 15,
      opacity: 0.5,
      zIndex: 7,
    });
    assert.match(s, /left:10px/);
    assert.match(s, /top:20px/);
    assert.match(s, /width:100px/);
    assert.match(s, /height:50px/);
    assert.match(s, /opacity:0.5/);
    assert.match(s, /z-index:7/);
    assert.match(s, /rotate\(15deg\)/);
  });

  it("typographyStyle aplica font-size / text-align / line-height", () => {
    const s = typographyStyle({
      fontFamily: "Arial",
      fontSize: 24,
      fontWeight: 700,
      lineHeight: 1.4,
      textAlign: "LEFT",
      color: "#112233",
    });
    assert.match(s, /font-size:24px/);
    assert.match(s, /font-weight:700/);
    assert.match(s, /line-height:1.4/);
    assert.match(s, /text-align:left/);
    assert.match(s, /color:#112233/);
  });

  it("objectFitStyle", () => {
    assert.match(objectFitStyle("contain"), /object-fit:contain/);
    assert.match(objectFitStyle("cover"), /object-fit:cover/);
  });

  it("html builder escapa texto y ordena z-index", () => {
    const doc = miniDoc({
      blocks: [
        {
          id: "b-high",
          type: "TEXT",
          pageIndex: 0,
          layout: {
            x: 0,
            y: 0,
            width: 100,
            height: 40,
            rotation: 0,
            zIndex: 5,
            opacity: 1,
            visible: true,
          },
          config: { content: "<b>Hi</b>", fontSize: 16, color: "#000" },
        },
        {
          id: "b-low",
          type: "SHAPE",
          pageIndex: 0,
          layout: {
            x: 0,
            y: 0,
            width: 50,
            height: 50,
            rotation: 0,
            zIndex: 1,
            opacity: 1,
            visible: true,
          },
          config: { variant: "rectangle", fill: "#eee" },
        },
      ],
    } as unknown as ResolvedTemplateDocument);

    const built = buildTemplatePreviewHtml(doc);
    assert.ok(!built.html.includes("<b>Hi</b>"));
    assert.ok(built.html.includes("&lt;b&gt;Hi&lt;/b&gt;"));
    assert.ok(!built.html.includes("<script"));
    assert.ok(built.html.includes('script-src \'none\''));
    const low = built.html.indexOf('data-block-id="b-low"');
    const high = built.html.indexOf('data-block-id="b-high"');
    assert.ok(low >= 0 && high > low);
  });

  it("asset resolver bloquea protocolos peligrosos y hosts privados", () => {
    assert.throws(() => assertPreviewAssetUrlShape("javascript:alert(1)"), (e) => {
      assert.equal((e as { code?: string }).code, "TEMPLATE_PREVIEW_ASSET_FAILED");
      return true;
    });
    assert.throws(() => assertPreviewAssetUrlShape("file:///etc/passwd"));
    assert.throws(() => assertPreviewAssetUrlShape("ftp://x"));
    assert.throws(() => assertPreviewAssetUrlShape("blob:http://x"));
    assert.throws(() => assertPreviewAssetUrlShape("http://127.0.0.1/a.png"));
    assert.throws(() => assertPreviewAssetUrlShape("https://localhost/a.png"));
    assert.throws(() => assertPreviewAssetUrlShape("https://192.168.0.1/a.png"));
    assert.throws(() => assertPreviewAssetUrlShape("https://169.254.169.254/latest"));
    assert.throws(() => assertPreviewAssetUrlShape("data:text/html,<h1>x</h1>"));

    const ok = resolvePreviewAssetSrc(
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
    );
    assert.equal(ok.kind, "data");
    assert.equal(
      resolvePreviewAssetSrc("https://cdn.example.com/a.png").kind,
      "https"
    );
  });

  it("asset resolver rechaza data URL excesiva", () => {
    const huge = "data:image/png;base64," + "A".repeat(3_000_000);
    assert.throws(() => assertPreviewAssetUrlShape(huge), (e) => {
      assert.equal((e as { code?: string }).code, "TEMPLATE_PREVIEW_LIMIT_EXCEEDED");
      return true;
    });
  });

  it("límites de scale y canvas", () => {
    assert.equal(clampPreviewScale(99), TEMPLATE_V2_PREVIEW_LIMITS.maxScale);
    assert.equal(clampPreviewScale(0.01), TEMPLATE_V2_PREVIEW_LIMITS.minScale);
    assert.equal(TEMPLATE_V2_PREVIEW_LIMITS.maxWidth, 4000);
    assert.equal(TEMPLATE_V2_PREVIEW_LIMITS.maxBlocks, 300);
    assert.ok(previewLimitExceeded("x").httpStatus === 422);
    assert.ok(previewAssetFailed("x").httpStatus === 422);
  });

  it("createTemplatePreviewExampleData no usa PII real", () => {
    const d = createTemplatePreviewExampleData({ student: { fullName: "Preview Test" } });
    assert.equal((d.student as { fullName: string }).fullName, "Preview Test");
    assert.equal((d.school as { name: string }).name, "Escuela de ejemplo");
  });
});
