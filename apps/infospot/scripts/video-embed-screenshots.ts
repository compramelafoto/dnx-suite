/**
 * Capturas QA del bloque de video (editor + nota pública, desktop y mobile).
 * pnpm --filter infospot exec tsx scripts/video-embed-screenshots.ts
 */
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const outDir = join(dirname(fileURLToPath(import.meta.url)), "../.tmp/video-embed-qa");
mkdirSync(outDir, { recursive: true });

const css = `
:root {
  --is-accent: #c27b3d;
  --is-accent-hover: #a86a33;
  --is-border: #e7e2db;
  --is-border-strong: #d4cdc3;
  --is-muted: #6b645c;
  --is-text: #1a1a1a;
  --is-text-secondary: #4a453f;
  --is-surface-muted: #f7f5f2;
  --is-radius-sm: 8px;
  --is-radius-md: 12px;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: "DM Sans", system-ui, sans-serif;
  color: var(--is-text);
  background: #fff;
}
h1 { font-size: 2rem; line-height: 1.15; margin: 0 0 0.75rem; }
h2 { font-size: 1.5rem; margin: 2.5rem 0 1rem; }
p { line-height: 1.7; margin: 0 0 1.25rem; }
.is-prose { max-width: 42rem; margin: 0 auto; padding: 2rem 1.25rem 4rem; }
.is-editor-shell { max-width: 52rem; margin: 0 auto; padding: 1.5rem 1rem 3rem; }
.is-toolbar {
  display: flex; flex-wrap: wrap; gap: 0.25rem;
  border: 1px solid var(--is-border); border-bottom: 0;
  background: var(--is-surface-muted); padding: 0.4rem 0.6rem;
}
.is-toolbar button {
  min-height: 2.5rem; padding: 0 0.75rem;
  border: 1px solid var(--is-border-strong); border-radius: 8px; background: #fff;
  font-size: 0.875rem;
}
.is-toolbar .primary { background: #fff; font-weight: 650; }
.is-editor-body {
  border: 1px solid var(--is-border); padding: 1.25rem 1.5rem; min-height: 24rem;
}
.is-video-embed-root { margin: 2.5rem 0; max-width: 100%; }
.is-video-width-content { max-width: min(100%, 36rem); }
.is-video-align-center { margin-inline: auto; }
.is-video-align-right { margin-inline: auto 0; }
.is-video-frame {
  position: relative; width: 100%; aspect-ratio: 16 / 9;
  overflow: hidden; border-radius: var(--is-radius-md); background: var(--is-surface-muted);
}
.is-video-vertical.is-video-instagram-reel,
.is-video-instagram-reel { max-width: min(100%, 25rem); margin-inline: auto; }
.is-video-frame iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
.is-figcaption { margin-top: 0.75rem; font-size: 0.9375rem; color: var(--is-muted); }
.is-video-fallback-link { margin-top: 0.5rem; font-size: 0.8125rem; color: var(--is-muted); }
.is-video-chrome { display: flex; justify-content: space-between; gap: 0.75rem; margin-bottom: 0.75rem; }
.is-video-chrome-label { font-size: 0.75rem; font-weight: 650; letter-spacing: 0.06em; text-transform: uppercase; color: var(--is-muted); }
.is-video-chrome-btn { min-height: 2.25rem; padding: 0.25rem 0.75rem; border: 1px solid var(--is-border-strong); border-radius: 8px; background: #fff; font-size: 0.8125rem; font-weight: 600; }
.is-video-selected { outline: 2px solid var(--is-accent); outline-offset: 6px; border-radius: var(--is-radius-md); }
.is-dialog {
  border: 1px solid var(--is-border); border-radius: var(--is-radius-md);
  padding: 1.5rem; margin-top: 1.5rem; background: #fff;
}
label { display: block; font-weight: 650; margin: 1rem 0 0.5rem; }
input, select { width: 100%; min-height: 2.75rem; padding: 0.5rem 0.75rem; border: 1px solid var(--is-border-strong); border-radius: 8px; }
.hint { color: var(--is-muted); font-size: 0.875rem; margin: 0.5rem 0 0; }
.actions { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem; }
.eyebrow { font-size: 0.75rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--is-accent); font-weight: 650; }
img.inline { width: 100%; border-radius: var(--is-radius-md); margin: 2rem 0 0.5rem; background: #ddd; min-height: 12rem; object-fit: cover; }
@media (max-width: 640px) {
  .is-video-align-right { margin-inline: auto; }
}
`;

const youtube = "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ";
const vimeo = "https://player.vimeo.com/video/347119375";

function editorHtml() {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Editor InfoSpot</title><style>${css}</style></head>
<body>
  <div class="is-editor-shell">
    <p class="eyebrow">Editor de notas · InfoSpot</p>
    <div class="is-toolbar">
      <button>H2</button><button>H3</button><button><strong>B</strong></button><button><em>I</em></button>
      <button>Enlace</button><button>• Lista</button><button>Cita</button>
      <button class="primary">Insertar imagen</button>
      <button class="primary">Insertar video</button>
    </div>
    <div class="is-editor-body">
      <p>El redactor coloca el cursor y pulsa Insertar video. El bloque usa el mismo render que la nota pública.</p>
      <figure class="is-video-embed-root is-video-embed is-video-youtube is-video-width-full is-video-align-center is-video-landscape is-video-selected">
        <div class="is-video-chrome">
          <span class="is-video-chrome-label">YouTube</span>
          <div><button class="is-video-chrome-btn">Editar</button> <button class="is-video-chrome-btn">Eliminar</button></div>
        </div>
        <div class="is-video-frame"><iframe src="${youtube}" title="YouTube" loading="lazy" allowfullscreen></iframe></div>
        <figcaption class="is-figcaption">Registro de YouTube a ancho completo</figcaption>
        <p class="is-video-fallback-link"><a href="https://www.youtube.com/watch?v=dQw4w9WgXcQ">Abrir en YouTube</a></p>
      </figure>
      <div class="is-dialog">
        <h2 style="margin-top:0">Insertar video</h2>
        <p class="hint">Admitimos YouTube, Vimeo e Instagram (publicaciones, Reels y videos públicos).</p>
        <label>Pegá el enlace del video</label>
        <input value="https://www.youtube.com/watch?v=dQw4w9WgXcQ" readonly>
        <label>Tamaño</label>
        <p>Ancho completo · Ancho contenido</p>
        <label>Epígrafe (opcional)</label>
        <input value="Registro de YouTube a ancho completo" readonly>
        <div class="actions"><button>Cancelar</button><button class="primary">Insertar video</button></div>
      </div>
    </div>
  </div>
</body></html>`;
}

function publicHtml() {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Nota pública</title><style>${css}</style></head>
<body>
  <article class="is-prose">
    <p class="eyebrow">Nota pública · InfoSpot</p>
    <h1>En el predio, con el público ya adentro</h1>
    <p>La crónica combina texto, una imagen y tres videos externos. YouTube y Vimeo van en 16:9; el Reel queda vertical.</p>
    <img class="inline" alt="Público" src="https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&q=60">
    <p class="is-figcaption">El público espera la largada · Foto: Redacción Info Spot</p>
    <h2>YouTube a ancho completo</h2>
    <figure class="is-video-embed-root is-video-width-full is-video-align-center">
      <div class="is-video-frame"><iframe src="${youtube}" title="YouTube" loading="lazy" allowfullscreen></iframe></div>
      <figcaption class="is-figcaption">Registro de YouTube a ancho completo</figcaption>
      <p class="is-video-fallback-link"><a href="https://www.youtube.com/watch?v=dQw4w9WgXcQ">Abrir en YouTube</a></p>
    </figure>
    <p>Entre un video y el siguiente, el relato sigue en párrafos normales.</p>
    <h2>Vimeo a ancho contenido</h2>
    <figure class="is-video-embed-root is-video-width-content is-video-align-right">
      <div class="is-video-frame"><iframe src="${vimeo}" title="Vimeo" loading="lazy" allowfullscreen></iframe></div>
      <figcaption class="is-figcaption">Pieza de Vimeo a ancho contenido</figcaption>
      <p class="is-video-fallback-link"><a href="https://vimeo.com/347119375">Abrir en Vimeo</a></p>
    </figure>
    <h2>Reel de Instagram</h2>
    <figure class="is-video-embed-root is-video-width-content is-video-align-center is-video-instagram-reel">
      <blockquote class="instagram-media" data-instgrm-permalink="https://www.instagram.com/reel/CxYz123AbCD/" data-instgrm-version="14" style="border:1px solid #e7e2db;border-radius:12px;padding:1.25rem;background:#f7f5f2;">
        <p>Si Instagram bloquea el embed, queda este fallback.</p>
        <p><a href="https://www.instagram.com/reel/CxYz123AbCD/">Ver en Instagram</a></p>
      </blockquote>
      <figcaption class="is-figcaption">Reel público de Instagram</figcaption>
    </figure>
  </article>
</body></html>`;
}

const browser = await chromium.launch();
const shots: { name: string; html: string; width: number; height: number }[] = [
  { name: "editor-desktop", html: editorHtml(), width: 1280, height: 900 },
  { name: "editor-mobile", html: editorHtml(), width: 390, height: 844 },
  { name: "public-desktop", html: publicHtml(), width: 1280, height: 1400 },
  { name: "public-mobile", html: publicHtml(), width: 390, height: 1600 },
];

for (const shot of shots) {
  const page = await browser.newPage({ viewport: { width: shot.width, height: shot.height } });
  await page.setContent(shot.html, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  const file = join(outDir, `${shot.name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(file);
  await page.close();
}

await browser.close();
console.log("video-embed screenshots: ok");
