import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { resolveTemplateDocument } from "@repo/template-engine";
import { createClickatonTemplateExampleData } from "@repo/template-engine/clickaton";
import { legacyPayloadToCore } from "../../services/template-v2-mappers";
import { getTemplatePreset } from "../../presets/registry";
import { renderTemplatePreviewPng } from "../../rendering/template-v2-preview-renderer";
import { closeTemplatePreviewBrowser } from "../../rendering/template-v2-browser-manager";
import { resolveTemplateVariablePlugin } from "../../resolve-template-product";

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const OUT = join(
  // tests se ejecutan vía pnpm filter template-engine (cwd package) o desde CLF
  process.cwd().includes("compramelafoto")
    ? process.cwd()
    : join(process.cwd(), "../../apps/compramelafoto"),
  "test-results/template-v2/clickaton"
);

async function renderPreset(
  key: string,
  data: Record<string, unknown>,
  fileBase: string
) {
  const preset = getTemplatePreset(key)!;
  const { document } = legacyPayloadToCore(preset.payload, { name: preset.name });
  const registry = resolveTemplateVariablePlugin("clickaton");
  const resolved = resolveTemplateDocument({ template: document, data, registry });
  const r = await renderTemplatePreviewPng(resolved.document);
  assert.ok(r.png.subarray(0, 8).equals(PNG_SIG));
  assert.equal(r.width, 1080);
  assert.equal(r.height, 1920);
  assert.ok(r.png.byteLength > 1000);

  const htmlProbe = JSON.stringify(resolved.document.blocks);
  assert.ok(!htmlProbe.includes("undefined"));
  assert.ok(!/"content":"@"/.test(htmlProbe));
  assert.ok(!htmlProbe.includes("[participant."));

  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, `${fileBase}.png`), r.png);
  return r;
}

describe("clickaton presets render (Chromium)", () => {
  after(async () => {
    await closeTemplatePreviewBrowser();
  });

  it("clickaton-welcome-complete", async () => {
    await renderPreset(
      "CLICKATON_WELCOME_STORY_V1",
      createClickatonTemplateExampleData(),
      "clickaton-welcome-complete"
    );
  });

  it("clickaton-welcome-no-instagram", async () => {
    await renderPreset(
      "CLICKATON_WELCOME_STORY_V1",
      createClickatonTemplateExampleData({
        participant: { instagram: "", instagramHandle: "" },
      }),
      "clickaton-welcome-no-instagram"
    );
  });

  it("clickaton-member-complete", async () => {
    await renderPreset(
      "CLICKATON_MEMBER_STORY_V1",
      createClickatonTemplateExampleData(),
      "clickaton-member-complete"
    );
  });

  it("clickaton-member-no-instagram", async () => {
    await renderPreset(
      "CLICKATON_MEMBER_STORY_V1",
      createClickatonTemplateExampleData({
        participant: { instagram: "", instagramHandle: "" },
      }),
      "clickaton-member-no-instagram"
    );
  });

  it("foto ausente usa placeholder sin crash", async () => {
    const r = await renderPreset(
      "CLICKATON_WELCOME_STORY_V1",
      createClickatonTemplateExampleData({
        participant: { photoUrl: "", photo: "" },
      }),
      "clickaton-welcome-no-photo"
    );
    assert.ok(r.png.byteLength > 500);
  });
});
