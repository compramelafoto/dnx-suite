/**
 * QA vivo de Insertar video (InfoSpot local + DB staging).
 * No publica la nota. Evidencia en apps/infospot/.qa-artifacts/video-embed-live-qa/
 *
 * pnpm --filter @repo/db exec tsx ../../apps/infospot/scripts/video-embed-live-qa.ts
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Page, type ConsoleMessage } from "@playwright/test";
import { prisma } from "@repo/db";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const outDir = resolve(root, ".qa-artifacts/video-embed-live-qa");
const sessionFile = resolve(root, ".qa-artifacts/video-embed-qa-session.json");
const stockJpg = resolve(root, "public/editorial-stock/concert.jpg");
const stockJpg2 = resolve(root, "public/editorial-stock/stadium.jpg");

mkdirSync(outDir, { recursive: true });

const YOUTUBE = "https://www.youtube.com/watch?v=jNQXAC9IVRw";
const VIMEO = "https://vimeo.com/347119375";
const INSTAGRAM_REEL = "https://www.instagram.com/reel/DIs7cObRVUl/";

const REJECTED: { raw: string; expect: string }[] = [
  { raw: `<iframe src="https://www.youtube.com/embed/jNQXAC9IVRw"></iframe>`, expect: "HTML" },
  { raw: `<script>alert(1)</script>`, expect: "HTML" },
  { raw: "javascript:alert(1)", expect: "HTML" },
  { raw: "data:text/html,<script>alert(1)</script>", expect: "HTML" },
  { raw: "https://youtube.com.evil.com/watch?v=jNQXAC9IVRw", expect: "dominio" },
  { raw: "http://www.youtube.com/watch?v=jNQXAC9IVRw", expect: "https" },
  { raw: "https://user:pass@www.youtube.com/watch?v=jNQXAC9IVRw", expect: "" },
  { raw: "https://www.instagram.com/nasa/", expect: "incrustable" },
  { raw: "https://www.instagram.com/stories/nasa/123456789/", expect: "incrustable" },
  { raw: "https://www.tiktok.com/@x/video/1", expect: "dominio" },
];

type Report = {
  startedAt: string;
  baseUrl: string;
  articleId: string | null;
  articleSlug: string | null;
  articleStatus: string | null;
  editor: Record<string, unknown>;
  rejected: Array<{ raw: string; message: string; ok: boolean }>;
  persistence: Record<string, unknown>;
  preview: Record<string, unknown>;
  consoleErrors: string[];
  pageErrors: string[];
  networkFailures: string[];
  screenshots: string[];
  cleanup: string;
};

const report: Report = {
  startedAt: new Date().toISOString(),
  baseUrl: "http://127.0.0.1:3004",
  articleId: null,
  articleSlug: null,
  articleStatus: null,
  editor: {},
  rejected: [],
  persistence: {},
  preview: {},
  consoleErrors: [],
  pageErrors: [],
  networkFailures: [],
  screenshots: [],
  cleanup: "",
};

async function archiveQaArticles(exceptId?: string | null) {
  const result = await prisma.infoSpotArticle.updateMany({
    where: {
      title: { contains: "[QA VIDEO]" },
      ...(exceptId ? { NOT: { id: exceptId } } : {}),
    },
    data: { status: "ARCHIVED" },
  });
  return result.count;
}

async function clickVideoChrome(
  page: Page,
  provider: "youtube" | "vimeo" | "instagram",
) {
  const chrome = page.locator(`.is-video-${provider} .is-video-chrome-label`).first();
  await chrome.waitFor({ state: "visible" });
  await chrome.scrollIntoViewIfNeeded();
  await chrome.click({ force: true });
}

async function moveCaretAfterBlock(page: Page) {
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("End");
}

function shot(name: string) {
  const file = resolve(outDir, `${name}.png`);
  report.screenshots.push(file);
  return file;
}

async function insertVideo(
  page: Page,
  url: string,
  opts: { caption?: string; width?: "full" | "content"; align?: "left" | "center" | "right" },
) {
  await page.getByRole("button", { name: "Insertar video" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ state: "visible" });
  await dialog.getByLabel("Pegá el enlace del video").fill(url);
  await page.waitForTimeout(600);
  if (opts.width === "content") {
    await dialog.getByText("Ancho contenido", { exact: true }).click();
    if (opts.align === "right") await dialog.getByText("Derecha", { exact: true }).click();
    if (opts.align === "left") await dialog.getByText("Izquierda", { exact: true }).click();
  }
  if (opts.caption) {
    await dialog.getByLabel("Epígrafe (opcional)").fill(opts.caption);
  }
  await dialog.getByRole("button", { name: "Insertar video" }).click();
  await dialog.waitFor({ state: "hidden", timeout: 15_000 });
  await moveCaretAfterBlock(page);
}

async function insertImage(page: Page, file: string, alt: string, caption: string, credit: string) {
  await page.getByRole("button", { name: "Insertar imagen propia" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ state: "visible" });
  await dialog.locator('input[type="file"]').setInputFiles(file);
  await dialog.getByLabel("Texto alternativo").fill(alt);
  await dialog.getByLabel("Epígrafe").fill(caption);
  await dialog.getByLabel("Crédito fotográfico").fill(credit);
  await dialog.getByRole("button", { name: "Insertar" }).click();
  await dialog.waitFor({ state: "hidden", timeout: 30_000 });
  await moveCaretAfterBlock(page);
}

if (!existsSync(sessionFile)) {
  throw new Error("Falta sesión QA. Corré mint-video-embed-qa-session.ts");
}
const session = JSON.parse(readFileSync(sessionFile, "utf8")) as { rawToken: string };

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  locale: "es-AR",
});
await context.addCookies([
  {
    name: "dnx_session",
    value: session.rawToken,
    url: "http://127.0.0.1:3004",
    httpOnly: true,
    sameSite: "Lax",
  },
]);
const page = await context.newPage();
page.on("console", (msg: ConsoleMessage) => {
  if (msg.type() === "error") report.consoleErrors.push(msg.text());
});
page.on("pageerror", (err) => {
  report.pageErrors.push(err.message);
});
page.on("requestfailed", (req) => {
  const url = req.url();
  if (/youtube|vimeo|instagram|embed\.js/i.test(url)) {
    report.networkFailures.push(`${req.failure()?.errorText ?? "failed"} ${url}`);
  }
});
let embedJsRequests = 0;
page.on("request", (req) => {
  if (req.url().includes("instagram.com/embed.js")) embedJsRequests += 1;
});

try {
  const archivedLeftovers = await archiveQaArticles();
  report.cleanup = archivedLeftovers
    ? `Archivadas ${archivedLeftovers} nota(s) QA previa(s). `
    : "";

  await page.goto("http://127.0.0.1:3004/redaccion/nueva?directo=1", { waitUntil: "networkidle" });
  if (page.url().includes("/ingresar")) {
    throw new Error("La sesión QA no autenticó. URL=" + page.url());
  }

  await page.locator("#title").fill("[QA VIDEO] Insertar video — no publicar");
  await page.locator("#excerpt").fill("Nota temporal de QA del bloque de video. No debe quedar pública.");
  const category = page.locator("#categoryId");
  const options = await category.locator("option").allTextContents();
  const firstReal = options.find((o) => o.trim() && !/categoría|seleccion/i.test(o));
  if (firstReal) await category.selectOption({ label: firstReal.trim() });
  await page.getByRole("button", { name: "Guardar borrador" }).click();
  await page.waitForURL(/\/redaccion\/noticias\/[^/]+\/editar/, { timeout: 30_000 });
  report.articleId = page.url().match(/noticias\/([^/]+)\/editar/)?.[1] ?? null;

  await page.locator(".ProseMirror").waitFor({ state: "visible" });
  await page.screenshot({ path: shot("01-editor-toolbar"), fullPage: false });
  const insertVideoBtn = page.getByRole("button", { name: "Insertar video" });
  const insertImageBtn = page.getByRole("button", { name: "Insertar imagen propia" });
  report.editor.buttonVisible = await insertVideoBtn.isVisible();
  report.editor.buttonNextToImage = await insertImageBtn.isVisible();

  // Diálogo abre / cierra / teclado
  await insertVideoBtn.click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ state: "visible" });
  await dialog.getByLabel("Pegá el enlace del video").fill(YOUTUBE);
  await page.waitForTimeout(800);
  await page.screenshot({ path: shot("02-dialog-valid-url"), fullPage: false });
  report.editor.dialogPreview = await dialog.locator("iframe, .is-video-embed-root").count();
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  report.editor.escapeCloses = (await dialog.count()) === 0 || !(await dialog.isVisible());

  // URLs rechazadas
  for (const item of REJECTED) {
    await insertVideoBtn.click();
    await dialog.waitFor({ state: "visible" });
    await dialog.getByLabel("Pegá el enlace del video").fill(item.raw);
    await page.waitForTimeout(400);
    const err = (await dialog.locator("p.text-red-800, p.text-red-700").first().textContent()) || "";
    const insertDisabled = await dialog.getByRole("button", { name: "Insertar video" }).isDisabled();
    const ok = insertDisabled && err.length > 0;
    report.rejected.push({ raw: item.raw.slice(0, 80), message: err, ok });
    if (item.raw.includes("javascript")) {
      await page.screenshot({ path: shot("10-url-rejected"), fullPage: false });
    }
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
  }

  // Cuerpo: párrafo → imagen → youtube → párrafo → vimeo → imagen → reel → párrafo
  await page.locator(".ProseMirror").click();
  await page.keyboard.type("Arranca la jornada en el predio, con el público ya adentro.");
  await page.keyboard.press("Enter");
  await insertImage(page, stockJpg, "Público en el predio", "El público espera la largada", "Foto: QA InfoSpot");
  await insertVideo(page, YOUTUBE, {
    caption: "Primer video de YouTube, archivo histórico",
    width: "full",
  });
  await page.keyboard.press("Enter");
  await page.keyboard.type("Entre un video y el siguiente, el relato sigue en párrafos normales.");
  await page.keyboard.press("Enter");
  await insertVideo(page, VIMEO, {
    caption: "Pieza de Vimeo a ancho contenido",
    width: "content",
    align: "right",
  });
  await insertImage(page, stockJpg2, "Estadio de noche", "La tribuna se ilumina", "Foto: QA InfoSpot");
  await insertVideo(page, INSTAGRAM_REEL, {
    caption: "Reel público de NASA Kennedy",
    width: "content",
  });
  await page.keyboard.press("Enter");
  await page.keyboard.type("Cierre de la crónica de QA: texto, fotos y tres videos externos.");
  report.editor.videoCount = await page.locator(".is-video-embed-root").count();
  report.editor.youtubeCount = await page.locator(".is-video-youtube").count();
  report.editor.vimeoCount = await page.locator(".is-video-vimeo").count();
  report.editor.instagramCount = await page.locator(".is-video-instagram").count();

  await clickVideoChrome(page, "youtube");
  await page.screenshot({ path: shot("03-youtube-selected"), fullPage: false });
  report.editor.youtubeSelected = await page.locator(".is-video-selected, .ProseMirror-selectednode").count();

  await clickVideoChrome(page, "instagram");
  await page.screenshot({ path: shot("04-instagram-selected"), fullPage: true });

  // Editar + deshacer/rehacer sobre YouTube
  await page.locator(".is-video-youtube .is-video-chrome-btn", { hasText: "Editar" }).click({ force: true });
  await dialog.waitFor({ state: "visible" });
  await dialog.getByLabel("Epígrafe (opcional)").fill("Epígrafe YouTube editado en QA");
  await dialog.getByRole("button", { name: "Guardar cambios" }).click();
  await dialog.waitFor({ state: "hidden" });
  report.editor.editedCaption = await page.locator(".is-video-youtube .is-caption").first().textContent();

  const beforeDelete = await page.locator(".is-video-embed-root").count();
  await page.locator(".is-video-vimeo .is-video-chrome-btn", { hasText: "Eliminar" }).click({ force: true });
  const afterDelete = await page.locator(".is-video-embed-root").count();
  report.editor.deleteWorks = afterDelete === beforeDelete - 1;
  await page.getByTitle("Deshacer").click();
  report.editor.undoRestores = (await page.locator(".is-video-embed-root").count()) === beforeDelete;
  await page.getByTitle("Rehacer").click();
  report.editor.redoDeletes = (await page.locator(".is-video-embed-root").count()) === afterDelete;
  await page.getByTitle("Deshacer").click();

  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await page.waitForTimeout(2000);

  const hidden = await page.locator('input[name="content"]').inputValue();
  report.persistence.hiddenHasIframe = /<iframe/i.test(hidden);
  report.persistence.hiddenHasEmbedJs = /embed\.js/i.test(hidden);
  report.persistence.hiddenVideoFigures = (hidden.match(/data-editorial-video="true"/g) || []).length;
  report.persistence.hiddenImageFigures = (hidden.match(/data-editorial-image="true"/g) || []).length;

  // Reabrir
  const editUrl = page.url();
  await page.goto("http://127.0.0.1:3004/redaccion", { waitUntil: "domcontentloaded" });
  await page.goto(editUrl, { waitUntil: "networkidle" });
  await page.locator(".ProseMirror").waitFor({ state: "visible" });
  report.persistence.reopenVideoCount = await page.locator(".is-video-embed-root").count();
  report.persistence.reopenImageCount = await page.locator(".is-editorial-figure, figure[data-editorial-image]").count();
  const hidden2 = await page.locator('input[name="content"]').inputValue();
  report.persistence.reopenSameFigures = hidden2.includes('data-editorial-video="true"');
  report.persistence.reopenNoIframe = !/<iframe/i.test(hidden2);

  if (report.articleId) {
    const row = await prisma.infoSpotArticle.findUnique({
      where: { id: report.articleId },
      select: { content: true, status: true, slug: true, title: true },
    });
    report.articleSlug = row?.slug ?? null;
    report.articleStatus = row?.status ?? null;
    const stored = row?.content ?? "";
    report.persistence.dbHasIframe = /<iframe/i.test(stored);
    report.persistence.dbHasScript = /<script/i.test(stored);
    report.persistence.dbHasEmbedJs = /embed\.js/i.test(stored);
    report.persistence.dbVideoCount = (stored.match(/data-editorial-video="true"/g) || []).length;
    report.persistence.dbProviders = {
      youtube: /data-provider="youtube"/.test(stored),
      vimeo: /data-provider="vimeo"/.test(stored),
      instagram: /data-provider="instagram"/.test(stored),
    };
    report.persistence.dbStoredSnippet = stored.slice(0, 500);
  }

  // Preview = mismo ArticleView que la nota pública
  await page.getByRole("link", { name: "Vista previa" }).click();
  await page.waitForURL(/\/preview/, { timeout: 20_000 });
  await page.waitForTimeout(8000);
  await page.screenshot({ path: shot("05-preview-desktop-full"), fullPage: true });
  await page.locator(".is-video-youtube").first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: shot("06-preview-youtube-vimeo"), fullPage: false });
  await page.locator(".is-video-instagram, .instagram-media").first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: shot("07-preview-instagram-desktop"), fullPage: false });

  const ytSrc = await page.locator(".is-video-youtube iframe").first().getAttribute("src");
  const vimeoSrc = await page.locator(".is-video-vimeo iframe").first().getAttribute("src");
  const ytLazy = await page.locator(".is-video-youtube iframe").first().getAttribute("loading");
  const vimeoLazy = await page.locator(".is-video-vimeo iframe").first().getAttribute("loading");
  const igScripts = await page.locator('script[src*="instagram.com/embed.js"]').count();
  const igBlockquotes = await page.locator("blockquote.instagram-media").count();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
  report.preview.youtubeSrc = ytSrc;
  report.preview.vimeoSrc = vimeoSrc;
  report.preview.youtubeLazy = ytLazy;
  report.preview.vimeoLazy = vimeoLazy;
  report.preview.instagramScripts = igScripts;
  report.preview.instagramEmbedJsRequests = embedJsRequests;
  report.preview.instagramBlockquotes = igBlockquotes;
  report.preview.horizontalOverflow = overflow;
  report.preview.instagramIframes = await page
    .locator(".is-video-instagram iframe, blockquote.instagram-media iframe")
    .count();
  report.preview.youtubeNoError153Text = !(await page.getByText("Error 153").count());

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: shot("08-preview-mobile-full"), fullPage: true });
  await page.locator(".is-video-instagram, .instagram-media").first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: shot("09-preview-instagram-mobile"), fullPage: false });
  const overflowMobile = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
  report.preview.horizontalOverflowMobile = overflowMobile;

  // Compatibilidad: abrir nota vieja sin videos (solo lectura)
  await page.setViewportSize({ width: 1440, height: 900 });
  const old = await prisma.infoSpotArticle.findFirst({
    where: {
      NOT: { id: report.articleId ?? "" },
      content: { not: { contains: "data-editorial-video" } },
    },
    select: { id: true, title: true, content: true },
  });
  if (old) {
    const before = old.content;
    await page.goto(`http://127.0.0.1:3004/redaccion/noticias/${old.id}/editar`, {
      waitUntil: "networkidle",
    });
    await page.locator(".ProseMirror").waitFor({ state: "visible", timeout: 20_000 });
    const after = await prisma.infoSpotArticle.findUnique({
      where: { id: old.id },
      select: { content: true },
    });
    report.persistence.oldNoteId = old.id;
    report.persistence.oldNoteUnchanged = after?.content === before;
    report.persistence.oldNoteHasVideo = /data-editorial-video/.test(after?.content ?? "");
  }
} catch (err) {
  report.cleanup = `${report.cleanup}ERROR: ${err instanceof Error ? err.message : String(err)}`;
  await page.screenshot({ path: shot("99-error"), fullPage: true }).catch(() => {});
  throw err;
} finally {
  if (report.articleId) {
    await prisma.infoSpotArticle
      .update({
        where: { id: report.articleId },
        data: { status: "ARCHIVED", title: "[QA VIDEO][ARCHIVED] Insertar video — no publicar" },
      })
      .catch(() => {});
    report.articleStatus = "ARCHIVED";
    report.cleanup = `${report.cleanup}Nota archivada; nunca PUBLISHED.`;
  }
  writeFileSync(resolve(outDir, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
  await prisma.$disconnect();
}

console.log(JSON.stringify(report, null, 2));
