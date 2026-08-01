import type { Browser, BrowserContext, Page } from "playwright-core";
import { TEMPLATE_V2_PREVIEW_LIMITS } from "./render-limits";
import {
  previewBusy,
  previewTimeout,
  previewUnavailable,
} from "./render-errors";

type PlaywrightModule = typeof import("playwright-core");

let browserPromise: Promise<Browser> | null = null;
let activeRenders = 0;

async function loadPlaywright(): Promise<PlaywrightModule> {
  try {
    return await import("playwright-core");
  } catch {
    throw previewUnavailable("playwright-core no disponible en este runtime");
  }
}

export async function getTemplatePreviewBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = (async () => {
      const pw = await loadPlaywright();
      try {
        // Preferir el Chromium de Playwright instalado (local/CI).
        return await pw.chromium.launch({
          headless: true,
          args: ["--disable-dev-shm-usage", "--no-sandbox"],
        });
      } catch (err) {
        browserPromise = null;
        throw previewUnavailable(
          err instanceof Error ? err.message : "No se pudo iniciar Chromium"
        );
      }
    })();
  }
  return browserPromise;
}

export async function closeTemplatePreviewBrowser(): Promise<void> {
  const p = browserPromise;
  browserPromise = null;
  if (!p) return;
  try {
    const b = await p;
    await b.close();
  } catch {
    /* ignore */
  }
}

async function waitForRenderReady(page: Page, timeoutMs: number): Promise<void> {
  await page.evaluate(async () => {
    const fonts = (document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts;
    if (fonts?.ready) {
      await fonts.ready;
    }
    const imgs = Array.from(document.images || []);
    await Promise.all(
      imgs.map(
        (img) =>
          new Promise<void>((resolve) => {
            if (img.complete) {
              resolve();
              return;
            }
            img.addEventListener("load", () => resolve(), { once: true });
            img.addEventListener("error", () => resolve(), { once: true });
          })
      )
    );
    (window as unknown as { __TEMPLATE_RENDER_READY__?: boolean }).__TEMPLATE_RENDER_READY__ =
      true;
  });
  await page.waitForFunction(
    () =>
      Boolean(
        (window as unknown as { __TEMPLATE_RENDER_READY__?: boolean }).__TEMPLATE_RENDER_READY__
      ),
    { timeout: timeoutMs }
  );
}

export type PreviewCaptureInput = {
  html: string;
  width: number;
  height: number;
  scale?: number;
  timeoutMs?: number;
};

export type PreviewCaptureResult = {
  png: Buffer;
  width: number;
  height: number;
  durationMs: number;
};

/**
 * Captura PNG de HTML aislado.
 * Context + page se cierran siempre; browser singleton por proceso.
 */
export async function captureTemplatePreviewPng(
  input: PreviewCaptureInput
): Promise<PreviewCaptureResult> {
  if (activeRenders >= TEMPLATE_V2_PREVIEW_LIMITS.maxConcurrent) {
    throw previewBusy();
  }
  activeRenders += 1;
  const started = Date.now();
  const timeoutMs = input.timeoutMs ?? TEMPLATE_V2_PREVIEW_LIMITS.renderTimeoutMs;
  const scale = input.scale ?? 1;

  let context: BrowserContext | null = null;
  let page: Page | null = null;

  try {
    const browser = await getTemplatePreviewBrowser();
    context = await browser.newContext({
      viewport: {
        width: Math.ceil(input.width * scale),
        height: Math.ceil(input.height * scale),
      },
      deviceScaleFactor: scale,
      javaScriptEnabled: true, // solo para fonts.ready / img load desde page.evaluate
    });
    page = await context.newPage();
    page.setDefaultTimeout(timeoutMs);

    // Bloquear navegación externa / downloads
    await page.route("**/*", async (route) => {
      const req = route.request();
      const url = req.url();
      if (url.startsWith("data:") || url === "about:blank") {
        await route.continue();
        return;
      }
      // setContent usa about:blank; assets https/http se permiten solo como imágenes
      if (req.resourceType() === "image" && /^https?:/i.test(url)) {
        await route.continue();
        return;
      }
      if (req.resourceType() === "document") {
        await route.continue();
        return;
      }
      await route.abort();
    });

    await page.setContent(input.html, {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });

    try {
      await waitForRenderReady(page, timeoutMs);
    } catch {
      throw previewTimeout();
    }

    const stage = page.locator("#stage");
    const png = await stage.screenshot({
      type: "png",
      omitBackground: false,
      timeout: timeoutMs,
    });

    return {
      png: Buffer.from(png),
      width: input.width,
      height: input.height,
      durationMs: Date.now() - started,
    };
  } catch (err) {
    if (err && typeof err === "object" && "httpStatus" in err) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    if (/timeout/i.test(msg)) throw previewTimeout(msg);
    if (/Executable doesn't exist|browserType\.launch/i.test(msg)) {
      throw previewUnavailable(msg);
    }
    throw previewUnavailable(msg);
  } finally {
    activeRenders = Math.max(0, activeRenders - 1);
    try {
      await page?.close();
    } catch {
      /* ignore */
    }
    try {
      await context?.close();
    } catch {
      /* ignore */
    }
  }
}

/** Solo tests. */
export function __previewActiveRendersForTests(): number {
  return activeRenders;
}
