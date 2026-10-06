import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { JSONContent } from "@tiptap/core";
import { generateContentHtml, sanitizeContentHtml } from "./tiptap/html";
import { getInstagramEmbedUrl } from "./tiptap/instagram";

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

  it("descarta iframes que no son de YouTube o Vimeo", () => {
    const html = sanitizeContentHtml(
      `<iframe src="https://evil.example.com/page"></iframe>` +
        `<iframe src="https://player.vimeo.com/video/1"></iframe>`
    );
    assert.doesNotMatch(html, /evil\.example\.com/);
    assert.match(html, /player\.vimeo\.com/);
  });

  it("incrusta una publicación de Instagram con su reproductor oficial", async () => {
    const html = await generateContentHtml({
      type: "doc",
      content: [{ type: "instagramEmbed", attrs: { src: "https://www.instagram.com/p/Ddpl5hBDLd-/?hl=es-la" } }],
    });
    assert.match(html, /class="blog-instagram-embed"/);
    assert.match(html, /<iframe[^>]+src="https:\/\/www\.instagram\.com\/p\/Ddpl5hBDLd-\/embed\/"/);
  });

  it("no arma iframe si el enlace no es una publicación de Instagram", async () => {
    const html = await generateContentHtml({
      type: "doc",
      content: [{ type: "instagramEmbed", attrs: { src: "https://evil.example.com/p/abc" } }],
    });
    assert.doesNotMatch(html, /iframe/);
  });

  it("reconoce posteos, reels y enlaces con usuario", () => {
    assert.equal(getInstagramEmbedUrl("https://instagram.com/reel/AbC_1-x/"), "https://www.instagram.com/reel/AbC_1-x/embed/");
    assert.equal(getInstagramEmbedUrl("https://www.instagram.com/diarioconclusion/p/Ddpl5hBDLd-/"), "https://www.instagram.com/p/Ddpl5hBDLd-/embed/");
    assert.equal(getInstagramEmbedUrl("https://www.instagram.com/diarioconclusion/"), null);
    assert.equal(getInstagramEmbedUrl("https://instagram.com.evil.com/p/abc"), null);
  });
});
