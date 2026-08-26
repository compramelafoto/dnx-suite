import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseVideoUrl,
  resolveEditorialVideo,
  serializeEditorialVideoHtml,
  extractEditorialVideos,
  buildSafeIframeSrc,
  sanitizeEditorialHtml,
  markdownToEditorHtml,
  editorHtmlToMarkdown,
  extractEditorialFigures,
} from "./index";

describe("parseVideoUrl — proveedores admitidos", () => {
  it("1. YouTube estándar watch?v=", () => {
    const result = parseVideoUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.provider, "youtube");
    assert.equal(result.value.videoId, "dQw4w9WgXcQ");
    assert.equal(result.value.url, "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    assert.equal(buildSafeIframeSrc(result.value), "https://www.youtube.com/embed/dQw4w9WgXcQ");
  });

  it("2. Enlace corto de YouTube youtu.be", () => {
    const result = parseVideoUrl("https://youtu.be/dQw4w9WgXcQ?si=abc");
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.provider, "youtube");
    assert.equal(result.value.videoId, "dQw4w9WgXcQ");
  });

  it("3. YouTube Shorts y embed", () => {
    const shorts = parseVideoUrl("https://www.youtube.com/shorts/dQw4w9WgXcQ");
    assert.equal(shorts.ok, true);
    if (!shorts.ok) return;
    assert.equal(shorts.value.variant, "short");
    assert.equal(shorts.value.videoId, "dQw4w9WgXcQ");

    const embed = parseVideoUrl("https://www.youtube.com/embed/dQw4w9WgXcQ");
    assert.equal(embed.ok, true);
    if (!embed.ok) return;
    assert.equal(embed.value.videoId, "dQw4w9WgXcQ");
  });

  it("4. Vimeo y player.vimeo.com", () => {
    const page = parseVideoUrl("https://vimeo.com/347119375");
    assert.equal(page.ok, true);
    if (!page.ok) return;
    assert.equal(page.value.provider, "vimeo");
    assert.equal(page.value.videoId, "347119375");
    assert.equal(buildSafeIframeSrc(page.value), "https://player.vimeo.com/video/347119375");

    const player = parseVideoUrl("https://player.vimeo.com/video/347119375");
    assert.equal(player.ok, true);
    if (!player.ok) return;
    assert.equal(player.value.videoId, "347119375");
  });

  it("5. Publicación de Instagram", () => {
    const result = parseVideoUrl("https://www.instagram.com/p/CxYz123AbCD/?img_index=1");
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.provider, "instagram");
    assert.equal(result.value.variant, "post");
    assert.equal(result.value.videoId, "CxYz123AbCD");
    assert.equal(result.value.url, "https://www.instagram.com/p/CxYz123AbCD/");
    assert.equal(buildSafeIframeSrc(result.value), null);
  });

  it("6. Reel de Instagram", () => {
    const result = parseVideoUrl("https://www.instagram.com/reel/CxYz123AbCD/");
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.variant, "reel");
    assert.equal(result.value.url, "https://www.instagram.com/reel/CxYz123AbCD/");
  });
});

describe("parseVideoUrl — rechazos de seguridad", () => {
  it("7. URL inválida", () => {
    const result = parseVideoUrl("esto no es una url");
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, "invalid_url");
  });

  it("8. Dominio parecido pero no autorizado", () => {
    const lookalikes = [
      "https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ",
      "https://notyoutube.com/watch?v=dQw4w9WgXcQ",
      "https://youtubee.com/watch?v=dQw4w9WgXcQ",
      "https://vimeo.example.com/347119375",
      "https://instagram.com.attacker.net/p/CxYz123AbCD/",
    ];
    for (const url of lookalikes) {
      const result = parseVideoUrl(url);
      assert.equal(result.ok, false, url);
      if (result.ok) continue;
      assert.equal(result.code, "provider", url);
    }
  });

  it("9. Intento de insertar HTML o JavaScript", () => {
    const payloads = [
      `<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>`,
      `<script>alert(1)</script>`,
      `javascript:alert(1)`,
      `https://www.youtube.com/watch?v=dQw4w9WgXcQ"><script>alert(1)</script>`,
      `data:text/html,<script>alert(1)</script>`,
    ];
    for (const raw of payloads) {
      const result = parseVideoUrl(raw);
      assert.equal(result.ok, false, raw);
      if (result.ok) continue;
      assert.ok(result.code === "html" || result.code === "invalid_url" || result.code === "protocol", raw);
    }
  });

  it("rechaza http y perfiles de Instagram", () => {
    assert.equal(parseVideoUrl("http://www.youtube.com/watch?v=dQw4w9WgXcQ").ok, false);
    assert.equal(parseVideoUrl("https://www.instagram.com/infospot/").ok, false);
  });
});

describe("persistencia y notas mixtas", () => {
  const youtubeHtml = serializeEditorialVideoHtml({
    provider: "youtube",
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    videoId: "dQw4w9WgXcQ",
    caption: "Show en vivo",
    width: "full",
    alignment: "center",
    variant: "standard",
  });
  const vimeoHtml = serializeEditorialVideoHtml({
    provider: "vimeo",
    url: "https://vimeo.com/347119375",
    videoId: "347119375",
    caption: "",
    width: "content",
    alignment: "right",
    variant: "standard",
  });
  const reelHtml = serializeEditorialVideoHtml({
    provider: "instagram",
    url: "https://www.instagram.com/reel/CxYz123AbCD/",
    videoId: "CxYz123AbCD",
    caption: "Reel de la largada",
    width: "content",
    alignment: "center",
    variant: "reel",
  });
  const imageHtml = `<figure data-editorial-image="true" data-credit="Foto: Redacción" data-caption="Público" class="is-editorial-figure"><img src="https://cdn.example/foto.jpg" alt="Público" loading="lazy" /><figcaption class="is-figcaption"><span data-caption="true">Público</span><span data-credit-text="true">Foto: Redacción</span></figcaption></figure>`;

  it("10. Nota con varios videos", () => {
    const markdown = `## Crónica\n\nIntro.\n\n${youtubeHtml}\n\nMás texto.\n\n${vimeoHtml}\n\nCierre.\n\n${reelHtml}\n`;
    const html = markdownToEditorHtml(markdown);
    const videos = extractEditorialVideos(html);
    assert.equal(videos.length, 3);
    assert.deepEqual(
      videos.map((v) => v.provider),
      ["youtube", "vimeo", "instagram"],
    );
    assert.doesNotMatch(html, /<iframe/i);
    const back = editorHtmlToMarkdown(html);
    assert.equal(extractEditorialVideos(back).length, 3);
  });

  it("11. Nota con imágenes y videos combinados", () => {
    const markdown = `Párrafo inicial.\n\n${imageHtml}\n\n${youtubeHtml}\n\nFinal.\n`;
    const html = markdownToEditorHtml(markdown);
    assert.equal(extractEditorialFigures(html).length, 1);
    assert.equal(extractEditorialVideos(html).length, 1);
    assert.match(html, /data-editorial-image/);
    assert.match(html, /data-editorial-video/);
    const figures = extractEditorialFigures(html);
    assert.equal(figures[0]?.credit, "Foto: Redacción");
  });

  it("12. Edición y eliminación de un video existente", () => {
    const original = markdownToEditorHtml(`Uno\n\n${youtubeHtml}\n\nDos`);
    const videos = extractEditorialVideos(original);
    assert.equal(videos.length, 1);

    const edited = serializeEditorialVideoHtml({
      ...videos[0]!,
      caption: "Epígrafe actualizado",
      width: "content",
      alignment: "left",
    });
    const afterEdit = original.replace(youtubeHtml.includes("figure") ? /<figure[^>]*data-editorial-video[\s\S]*?<\/figure>/i : "", edited);
    const editedVideos = extractEditorialVideos(afterEdit);
    assert.equal(editedVideos[0]?.caption, "Epígrafe actualizado");
    assert.equal(editedVideos[0]?.width, "content");
    assert.equal(editedVideos[0]?.alignment, "left");
    assert.equal(editedVideos[0]?.videoId, "dQw4w9WgXcQ");

    const removed = afterEdit.replace(/<figure[^>]*data-editorial-video[\s\S]*?<\/figure>/i, "");
    assert.equal(extractEditorialVideos(removed).length, 0);
    assert.match(removed, /Uno/);
    assert.match(removed, /Dos/);
  });

  it("13. Layout responsive: clases de ancho, alineación y Reels verticales", () => {
    assert.match(youtubeHtml, /is-video-width-full/);
    assert.match(vimeoHtml, /is-video-width-content/);
    assert.match(vimeoHtml, /is-video-align-right/);
    assert.match(reelHtml, /is-video-vertical/);
    assert.match(youtubeHtml, /is-video-landscape/);
  });

  it("14. Compatibilidad de notas antiguas sin videos", () => {
    const legacy = `## Título de sección\n\nPárrafo con **negrita** y *cursiva*.\n\n> Una cita\n\n- Item uno\n- Item dos\n\n${imageHtml}\n`;
    const html = markdownToEditorHtml(legacy);
    const back = editorHtmlToMarkdown(html);
    assert.equal(extractEditorialVideos(html).length, 0);
    assert.equal(extractEditorialVideos(back).length, 0);
    assert.match(html, /<h2>/);
    assert.match(html, /<strong>/);
    assert.match(html, /<em>/);
    assert.match(html, /<blockquote>/);
    assert.match(html, /<ul>/);
    assert.equal(extractEditorialFigures(html).length, 1);
    assert.match(back, /data-editorial-image/);
  });
});

describe("sanitización", () => {
  it("no persiste iframes, scripts ni URLs de video inválidas", () => {
    const dirty = `<p>ok</p><iframe src="https://evil.test/x"></iframe><script>alert(1)</script><figure data-editorial-video="true" data-provider="youtube" data-video-id="abc" data-url="javascript:alert(1)"></figure>`;
    const clean = sanitizeEditorialHtml(dirty);
    assert.doesNotMatch(clean, /iframe/i);
    assert.doesNotMatch(clean, /script/i);
    assert.doesNotMatch(clean, /javascript:/i);
    assert.doesNotMatch(clean, /data-editorial-video/);
    assert.match(clean, /ok/);
  });

  it("normaliza una figura de video válida y descarta HTML en el epígrafe", () => {
    const html = serializeEditorialVideoHtml({
      provider: "youtube",
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      videoId: "dQw4w9WgXcQ",
      caption: `<img src=x onerror=alert(1)>Hola`,
      width: "full",
      alignment: "center",
      variant: "standard",
    });
    const clean = sanitizeEditorialHtml(html);
    assert.match(clean, /data-editorial-video="true"/);
    assert.match(clean, /data-video-id="dQw4w9WgXcQ"/);
    assert.doesNotMatch(clean, /onerror/);
    assert.doesNotMatch(clean, /<img/i);
    const videos = extractEditorialVideos(clean);
    assert.equal(videos[0]?.caption, "Hola");
  });

  it("resolveEditorialVideo reconstruye desde provider + id si la URL se pierde", () => {
    const result = resolveEditorialVideo({
      provider: "vimeo",
      videoId: "347119375",
      url: "",
      caption: "x",
      width: "full",
      alignment: "center",
      variant: "standard",
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.url, "https://vimeo.com/347119375");
  });
});
