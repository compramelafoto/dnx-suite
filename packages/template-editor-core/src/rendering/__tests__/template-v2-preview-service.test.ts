import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { Role } from "@prisma/client";
import { runTemplateV2Preview } from "../template-v2-preview-service";
import { TemplateV2DomainError } from "../../services/template-v2-errors";
import { closeTemplatePreviewBrowser } from "../template-v2-browser-manager";

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const draftValid = {
  canvas: { width: 240, height: 160, background: "#ffffff" },
  blocks: [
    {
      id: "t1",
      type: "TEXT" as const,
      layout: {
        x: 8,
        y: 40,
        width: 220,
        height: 40,
        rotation: 0,
        zIndex: 1,
        opacity: 1,
        visible: true,
      },
      configJson: {
        content: "Service Preview",
        fontFamily: "Arial",
        fontSize: 20,
        color: "#111111",
      },
    },
  ],
  variableBindings: [],
  meta: {},
};

describe("template-v2 preview service", () => {
  after(async () => {
    await closeTemplatePreviewBrowser();
  });

  it("rechaza formato no png", async () => {
    await assert.rejects(
      () =>
        runTemplateV2Preview({
          user: { id: 1, role: Role.PHOTOGRAPHER },
          body: { draft: draftValid, output: { format: "jpeg" as "png" } },
        }),
      (err: unknown) =>
        err instanceof TemplateV2DomainError && err.code === "TEMPLATE_INVALID"
    );
  });

  it("rechaza draft inválido (sin canvas)", async () => {
    await assert.rejects(
      () =>
        runTemplateV2Preview({
          user: { id: 1, role: Role.PHOTOGRAPHER },
          body: { draft: { blocks: [] } },
        }),
      (err: unknown) =>
        err instanceof TemplateV2DomainError &&
        err.code === "TEMPLATE_PREVIEW_INVALID"
    );
  });

  it("rechaza asset peligroso en draft", async () => {
    await assert.rejects(
      () =>
        runTemplateV2Preview({
          user: { id: 1, role: Role.PHOTOGRAPHER },
          body: {
            draft: {
              ...draftValid,
              blocks: [
                {
                  id: "img",
                  type: "IMAGE" as const,
                  layout: {
                    x: 0,
                    y: 0,
                    width: 100,
                    height: 100,
                    rotation: 0,
                    zIndex: 1,
                    opacity: 1,
                    visible: true,
                  },
                  configJson: { src: "javascript:alert(1)", fit: "cover" },
                },
              ],
            },
          },
        }),
      (err: unknown) =>
        err instanceof TemplateV2DomainError &&
        (err.code === "TEMPLATE_PREVIEW_ASSET_FAILED" ||
          err.code === "TEMPLATE_PREVIEW_INVALID" ||
          err.code === "TEMPLATE_ASSET_INVALID")
    );
  });

  it("canvas excesivo → LIMIT_EXCEEDED", async () => {
    await assert.rejects(
      () =>
        runTemplateV2Preview({
          user: { id: 1, role: Role.PHOTOGRAPHER },
          body: {
            draft: {
              ...draftValid,
              canvas: { width: 9000, height: 9000 },
            },
          },
        }),
      (err: unknown) =>
        err instanceof TemplateV2DomainError &&
        (err.code === "TEMPLATE_PREVIEW_LIMIT_EXCEEDED" ||
          err.code === "TEMPLATE_PREVIEW_INVALID" ||
          err.code === "TEMPLATE_INVALID")
    );
  });

  it("draft válido genera PNG real", async () => {
    const result = await runTemplateV2Preview({
      user: { id: 1, role: Role.PHOTOGRAPHER },
      body: { draft: draftValid, output: { format: "png" } },
    });
    assert.equal(result.mimeType, "image/png");
    assert.ok(result.png.subarray(0, 8).equals(PNG_SIG));
    assert.equal(result.width, 240);
    assert.equal(result.height, 160);
  });

  it("binding peligroso se rechaza", async () => {
    await assert.rejects(
      () =>
        runTemplateV2Preview({
          user: { id: 1, role: Role.PHOTOGRAPHER },
          body: {
            draft: {
              ...draftValid,
              blocks: [
                {
                  id: "vt",
                  type: "VARIABLE_TEXT" as const,
                  layout: {
                    x: 0,
                    y: 0,
                    width: 100,
                    height: 40,
                    rotation: 0,
                    zIndex: 1,
                    opacity: 1,
                    visible: true,
                  },
                  configJson: {
                    variableKey: "__proto__",
                    fallback: "x",
                    fontSize: 16,
                    color: "#000",
                  },
                },
              ],
              variableBindings: [
                {
                  blockId: "vt",
                  targetPath: "variableKey",
                  variableKey: "__proto__",
                },
              ],
            },
          },
        }),
      (err: unknown) => err instanceof TemplateV2DomainError
    );
  });

});
