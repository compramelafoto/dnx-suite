import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createTemplateVariableRegistry,
  fromLegacyTemplateV2,
  parseTemplateDocument,
  resolveTemplateDocument,
} from "../../index";
import { sponsorTemplateVariablesPlugin } from "../../plugins/sponsor";
import {
  CLICKATON_SPONSOR_THANKYOU_STORY_V1,
  FOTORANK_SPONSOR_THANKYOU_STORY_V1,
  getSponsorThankYouPreset,
  getSponsorThankYouPresetForProduct,
  instantiateSponsorThankYouPreset,
  listSponsorThankYouPresets,
} from "./index";

const DATA = {
  sponsor: {
    name: "Óptica Del Centro",
    logoUrl: "data:image/png;base64,iVBORw0KGgo=",
    tierLabel: "SPONSOR OFICIAL",
    instagram: "@opticadelcentro",
    website: "opticadelcentro.com.ar",
    message: "Gracias por acompañar a la comunidad.",
  },
  program: {
    productLabel: "CLICKATÓN",
    name: "Clickatón Córdoba 2026",
    dateFormatted: "11 DE OCTUBRE",
    city: "Córdoba",
    metaLine: "11 DE OCTUBRE · Córdoba",
    logoUrl: "data:image/png;base64,iVBORw0KGgo=",
    participantsCount: "135",
  },
};

function flatten(
  source: Record<string, unknown>,
  prefix = "",
  target: Record<string, unknown> = {}
): Record<string, unknown> {
  for (const [key, value] of Object.entries(source)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      flatten(value as Record<string, unknown>, path, target);
    } else {
      target[path] = value;
    }
  }
  return target;
}

describe("sponsor thank-you presets", () => {
  it("lista y resuelve ambos presets por clave y por producto", () => {
    assert.equal(listSponsorThankYouPresets().length, 2);
    assert.ok(getSponsorThankYouPreset("CLICKATON_SPONSOR_THANKYOU_STORY_V1"));
    assert.ok(getSponsorThankYouPreset("fotorank-sponsor-thankyou-story-v1"));
    assert.equal(
      getSponsorThankYouPresetForProduct("fotorank").meta.templateKey,
      "FOTORANK_SPONSOR_THANKYOU_STORY_V1"
    );
    assert.equal(
      getSponsorThankYouPresetForProduct("clickaton").meta.templateKey,
      "CLICKATON_SPONSOR_THANKYOU_STORY_V1"
    );
  });

  it("ambas placas son Instagram Story 1080×1920", () => {
    for (const preset of [
      CLICKATON_SPONSOR_THANKYOU_STORY_V1,
      FOTORANK_SPONSOR_THANKYOU_STORY_V1,
    ]) {
      assert.equal(preset.payload.canvas.width, 1080);
      assert.equal(preset.payload.canvas.height, 1920);
      assert.equal(preset.meta.format, "instagram_story");
      assert.equal(preset.meta.purpose, "sponsor_thankyou");
    }
  });

  it("usan colores de marca distintos por producto", () => {
    const accentOf = (preset: typeof CLICKATON_SPONSOR_THANKYOU_STORY_V1) =>
      preset.payload.blocks.find((b) => b.name === "Acento superior")?.configJson
        .fill;
    assert.equal(accentOf(CLICKATON_SPONSOR_THANKYOU_STORY_V1), "#FFE600");
    assert.equal(accentOf(FOTORANK_SPONSOR_THANKYOU_STORY_V1), "#D4AF37");
  });

  it("resuelven sin errores con el plugin de sponsors", () => {
    const registry = createTemplateVariableRegistry({
      plugins: [sponsorTemplateVariablesPlugin],
    });

    for (const product of ["clickaton", "fotorank"] as const) {
      const preset = getSponsorThankYouPresetForProduct(product);
      const bridged = fromLegacyTemplateV2(
        instantiateSponsorThankYouPreset(preset),
        { id: preset.presetId, name: preset.name }
      );
      const parsed = parseTemplateDocument(bridged.document);
      assert.ok(parsed.ok, `preset ${product} debe parsear`);

      const resolved = resolveTemplateDocument({
        template: parsed.data,
        data: { ...DATA, ...flatten(DATA) },
        registry,
      });

      assert.deepEqual(resolved.errors, []);

      const texts = resolved.document.blocks
        .map((b) => (b.config as { content?: string } | undefined)?.content)
        .filter((c): c is string => typeof c === "string");

      assert.ok(texts.some((t) => t.includes("Óptica Del Centro")));
      assert.ok(texts.some((t) => t.includes("Clickatón Córdoba 2026")));
      assert.ok(texts.some((t) => t.includes("11 DE OCTUBRE · Córdoba")));
      assert.ok(texts.some((t) => t.includes("¡GRACIAS!")));
    }
  });
});
