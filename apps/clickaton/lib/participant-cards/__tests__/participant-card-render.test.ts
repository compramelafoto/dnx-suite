import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { createClickatonTemplateExampleData } from "@repo/template-engine";
import {
  closeTemplatePreviewBrowser,
  TemplateRenderError,
} from "@repo/template-engine-renderer";
import { renderClickatonParticipantCard } from "../participant-card-renderer";

describe("renderClickatonParticipantCard integration", () => {
  after(async () => {
    await closeTemplatePreviewBrowser().catch(() => undefined);
  });

  it("renders welcome preset PNG with example data when Chromium is available", async () => {
    try {
      const result = await renderClickatonParticipantCard({
        cardType: "welcome",
        templateData: createClickatonTemplateExampleData(),
      });

      assert.ok(result.png.length > 100);
      assert.equal(result.width, 1080);
      assert.equal(result.height, 1920);
      assert.equal(result.mimeType, "image/png");
      assert.equal(result.sourceSummary.templateKey, "CLICKATON_WELCOME_STORY_V1");
      assert.ok(result.sourceSummary.blockCount > 0);
    } catch (err) {
      if (
        err instanceof TemplateRenderError &&
        (err.code === "TEMPLATE_PREVIEW_UNAVAILABLE" ||
          err.message.includes("Chromium") ||
          err.message.includes("playwright"))
      ) {
        // Entorno sin Chromium instalado — skip explícito.
        return;
      }
      throw err;
    }
  });

  it("renders member preset PNG with example data when Chromium is available", async () => {
    try {
      const result = await renderClickatonParticipantCard({
        cardType: "member",
        templateData: createClickatonTemplateExampleData(),
      });
      assert.ok(result.png.length > 100);
      assert.equal(result.sourceSummary.templateKey, "CLICKATON_MEMBER_STORY_V1");
    } catch (err) {
      if (
        err instanceof TemplateRenderError &&
        err.code === "TEMPLATE_PREVIEW_UNAVAILABLE"
      ) {
        return;
      }
      throw err;
    }
  });
});
