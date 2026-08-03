import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { JSONContent } from "@tiptap/core";
import { generateContentHtml, sanitizeContentHtml } from "./tiptap/html";

describe("tiptap html", () => {
  it("generates HTML containing a paragraph from simple JSON", async () => {
    const doc: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Hola mundo" }],
        },
      ],
    };
    const html = await generateContentHtml(doc);
    assert.match(html, /<p>/);
    assert.match(html, /Hola mundo/);
  });

  it("sanitize strips script tags", () => {
    const dirty = `<p>ok</p><script>alert(1)</script><p onclick="x">safe</p>`;
    const clean = sanitizeContentHtml(dirty);
    assert.doesNotMatch(clean, /script/i);
    assert.doesNotMatch(clean, /onclick/i);
    assert.match(clean, /ok/);
  });

  it("allows table markup and youtube iframe attrs", () => {
    const html = sanitizeContentHtml(
      `<table><tr><td colspan="2">celda</td></tr></table>` +
        `<iframe src="https://www.youtube.com/embed/abc" data-youtube-video allowfullscreen></iframe>`
    );
    assert.match(html, /<table>/);
    assert.match(html, /colspan/);
    assert.match(html, /iframe/);
    assert.match(html, /data-youtube-video/);
    assert.match(html, /allowfullscreen/);
  });
});
