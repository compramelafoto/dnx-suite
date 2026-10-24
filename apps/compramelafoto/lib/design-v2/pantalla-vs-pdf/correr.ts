/**
 * Comparación automática entre la pantalla y el PDF.
 *
 * Para cada diseño de `casos.ts` y cada página:
 * 1. Pantalla: el mismo `TemplateCanvasRenderer` que usan el editor, «Probar con fotos» y el
 *    canje, abierto en Chromium con las tipografías de Google, y fotografiado a tamaño real.
 * 2. PDF: el mismo camino que la impresión (`editorADocumento` → `emitDesign`), pasado a imagen
 *    a la misma resolución.
 * 3. Las dos se comparan (`comparar.ts`). Si alguna página difiere más de lo tolerado, el proceso
 *    termina con error y deja en `salida/` las imágenes y un informe para ver qué se movió.
 *
 * Correr: `pnpm --filter compramelafoto test:pantalla-vs-pdf` (opcional `-- --solo=textos-girados`).
 *
 * Las tipografías del sistema (Helvetica, Times, Georgia) se muestran en la página con su
 * equivalente libre, el mismo que usa el PDF: así la prueba compara los dos motores y no las
 * letras que tenga instaladas cada computadora.
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";
import { chromium } from "@playwright/test";
import { emitDesign } from "@repo/design-studio";
import {
  buildEditorGoogleFontsStylesheetHrefs,
  parseClassListGroups,
  parseCourseMosaic,
  type TemplateV2Block,
} from "@repo/template-editor-core";
import { editorADocumento, type EditorBlock } from "@repo/template-editor-core/rendering";
import { TemplateCanvasRenderer } from "../../../../../packages/template-editor-ui/src/TemplateCanvasRenderer";
import { PAPER_TOKENS, editorThemeStyle } from "../../../../../packages/template-editor-ui/src/theme";
import { casosDeComparacion, type CasoDeComparacion } from "./casos";
import { compararImagenes, type ResultadoComparacion } from "./comparar";

const SALIDA = path.join(__dirname, "salida");
const LISTA_DEL_CURSO = "course.studentList";

const EQUIVALENTES: Array<[string, string]> = [
  ["Helvetica", "arimo"],
  ["Arial", "arimo"],
  ["Times New Roman", "tinos"],
  ["Georgia", "gelasio"],
];

function caraDeSistema(): string {
  const caras: string[] = [];
  for (const [familia, slug] of EQUIVALENTES) {
    for (const [peso, estilo] of [[400, "normal"], [700, "normal"], [400, "italic"], [700, "italic"]] as const) {
      caras.push(
        `@font-face{font-family:"${familia}";font-weight:${peso};font-style:${estilo};` +
          `src:url(https://cdn.jsdelivr.net/fontsource/fonts/${slug}@latest/latin-${peso}-${estilo}.woff2) format("woff2");}`,
      );
    }
  }
  return caras.join("\n");
}

/** Una imagen de prueba con color, bordes y detalle: si se recorta o se corre, se nota. */
async function imagenDePrueba(): Promise<string> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0d47a1"/><stop offset="1" stop-color="#ffb300"/></linearGradient></defs>
    <rect width="600" height="400" fill="url(#g)"/>
    <circle cx="150" cy="140" r="90" fill="#ffffff"/>
    <rect x="330" y="220" width="220" height="130" fill="#1b5e20"/>
    <rect x="0" y="0" width="600" height="400" fill="none" stroke="#000000" stroke-width="16"/>
  </svg>`;
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
}

function aBloquesDelPuente(blocks: TemplateV2Block[]): EditorBlock[] {
  return blocks.map((b) => ({
    id: b.id,
    type: b.type,
    name: b.name ?? null,
    pageIndex: b.pageIndex ?? 0,
    x: b.layout.x,
    y: b.layout.y,
    width: b.layout.width,
    height: b.layout.height,
    rotation: b.layout.rotation ?? 0,
    zIndex: b.layout.zIndex ?? 0,
    opacity: b.layout.opacity ?? 1,
    locked: b.layout.locked ?? false,
    visible: b.layout.visible ?? true,
    configJson: b.configJson,
  }));
}

function htmlDePantalla(caso: CasoDeComparacion, pagina: number): string {
  const lienzo = renderToStaticMarkup(
    createElement(
      "div",
      { id: "lienzo", style: { ...editorThemeStyle(PAPER_TOKENS), display: "inline-block" } },
      createElement(TemplateCanvasRenderer, {
        canvas: caso.canvas,
        blocks: caso.blocks,
        resolvedVariables: caso.valores ?? {},
        readOnly: true,
        pageIndex: pagina,
      }),
    ),
  );
  const hojas = buildEditorGoogleFontsStylesheetHrefs()
    .map((href) => `<link rel="stylesheet" href="${href.replace(/&/g, "&amp;")}">`)
    .join("\n");
  return `<!doctype html><html><head><meta charset="utf-8">${hojas}
    <style>${caraDeSistema()} html,body{margin:0;padding:0;background:#ffffff;}</style>
    </head><body>${lienzo}</body></html>`;
}

async function pdfPorPagina(caso: CasoDeComparacion): Promise<{ paginas: Buffer[]; avisos: string[] }> {
  const dpi = Number(caso.canvas.dpi ?? 300);
  const puente = editorADocumento({
    canvas: {
      width: caso.canvas.width,
      height: caso.canvas.height,
      background: typeof caso.canvas.background === "string" ? caso.canvas.background : "#ffffff",
      dpi,
      bleedMm: 0,
      safeAreaMm: 0,
    },
    blocks: aBloquesDelPuente(caso.blocks),
    nombre: caso.id,
    cursosDelListado: parseClassListGroups(caso.valores?.[LISTA_DEL_CURSO], caso.valores?.["course.displayName"]),
    colegioDelListado: caso.valores?.["school.name"] ?? null,
    mosaicoDelCurso: caso.valores?.["course.mosaic"] != null ? parseCourseMosaic(caso.valores["course.mosaic"]) : undefined,
  });
  const salida = await emitDesign({
    document: puente.document as never,
    contract: {
      variables: puente.variablesSinteticas.map((v) => ({
        key: v.key,
        type: "qrPayload" as const,
        label: v.label,
        required: true,
        sampleValue: v.value,
      })),
    },
    values: Object.fromEntries(puente.variablesSinteticas.map((v) => [v.key, v.value])),
    formats: ["PNG_PER_SIDE"],
    pngDpi: dpi,
    fileBaseName: caso.id,
    resources: {
      async read(refDelPuente: string) {
        // Las fotos del mosaico llegan con su prefijo; acá son las mismas imágenes en línea.
        const ref = refDelPuente.startsWith("mosaic-url:") ? refDelPuente.slice("mosaic-url:".length) : refDelPuente;
        const coma = ref.indexOf(",");
        if (!ref.startsWith("data:") || coma < 0) return null;
        return new Uint8Array(Buffer.from(ref.slice(coma + 1), "base64"));
      },
    },
  });
  if (!salida.ok) throw new Error(`${caso.id}: el PDF no se pudo armar: ${salida.errors.join(" | ")}`);
  const paginas = salida.files.filter((f) => f.contentType === "image/png").map((f) => Buffer.from(f.bytes));
  return { paginas, avisos: puente.avisos };
}

type Fila = { caso: CasoDeComparacion; pagina: number; r: ResultadoComparacion; avisos: string[] };

function informe(filas: Fila[]): string {
  const pct = (v: number) => `${(v * 100).toFixed(2)} %`;
  const items = filas
    .map(({ caso, pagina, r, avisos }) => {
      const base = `${caso.id}-p${pagina + 1}`;
      return `<section class="${r.aprobado ? "ok" : "mal"}">
        <h2>${r.aprobado ? "✓" : "✗"} ${caso.titulo} · página ${pagina + 1}</h2>
        <p>Distinto: <b>${pct(r.distinto)}</b> · peor zona: <b>${pct(r.peorZona)}</b>
        (a ${Math.round(r.peorZonaEn.x * 100)} % del ancho y ${Math.round(r.peorZonaEn.y * 100)} % del alto)</p>
        ${avisos.length ? `<p class="avisos">Avisos del PDF: ${avisos.join(" · ")}</p>` : ""}
        <div class="fila">
          <figure><img src="${base}-pantalla.png"><figcaption>Pantalla</figcaption></figure>
          <figure><img src="${base}-pdf.png"><figcaption>PDF</figcaption></figure>
          <figure><img src="${base}-diferencias.png"><figcaption>Diferencias (en rojo)</figcaption></figure>
        </div></section>`;
    })
    .join("\n");
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Pantalla vs PDF</title>
    <style>body{font-family:system-ui,sans-serif;margin:24px;background:#f6f4f1;color:#1f2328}
    section{background:#fff;border-radius:8px;padding:16px;margin-bottom:20px;border-left:6px solid #2e7d32}
    section.mal{border-left-color:#c62828}.fila{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
    img{width:100%;border:1px solid #ddd;background:#fff}figure{margin:0}.avisos{color:#8a5a00}</style>
    </head><body><h1>Pantalla vs PDF</h1>${items}</body></html>`;
}

async function main() {
  const solo = process.argv.find((a) => a.startsWith("--solo="))?.slice("--solo=".length);
  const casos = casosDeComparacion(await imagenDePrueba()).filter((c) => !solo || c.id === solo);
  rmSync(SALIDA, { recursive: true, force: true });
  mkdirSync(SALIDA, { recursive: true });

  const navegador = await chromium.launch();
  const filas: Fila[] = [];
  try {
    for (const caso of casos) {
      const { paginas: pdf, avisos } = await pdfPorPagina(caso);
      for (let pagina = 0; pagina < caso.paginas; pagina++) {
        const page = await navegador.newPage({
          viewport: { width: caso.canvas.width, height: caso.canvas.height },
          deviceScaleFactor: 1,
        });
        await page.setContent(htmlDePantalla(caso, pagina), { waitUntil: "networkidle" });
        await page.evaluate(async () => {
          await document.fonts.ready;
          await Promise.all(
            Array.from(document.images).map((img) =>
              img.complete ? null : new Promise((r) => img.addEventListener("load", r, { once: true })),
            ),
          );
        });
        const pantalla = await page.locator("#lienzo > div").first().screenshot();
        await page.close();
        const deLPdf = pdf[pagina];
        if (!deLPdf) throw new Error(`${caso.id}: el PDF no tiene la página ${pagina + 1}.`);
        const r = await compararImagenes(pantalla, deLPdf, caso.umbrales);
        const base = path.join(SALIDA, `${caso.id}-p${pagina + 1}`);
        writeFileSync(`${base}-pantalla.png`, pantalla);
        writeFileSync(`${base}-pdf.png`, deLPdf);
        writeFileSync(`${base}-diferencias.png`, r.diferencias);
        filas.push({ caso, pagina, r, avisos });
        console.log(
          `${r.aprobado ? "✓" : "✗"} ${caso.id} p${pagina + 1}: distinto ${(r.distinto * 100).toFixed(2)} %, ` +
            `peor zona ${(r.peorZona * 100).toFixed(1)} %`,
        );
      }
    }
  } finally {
    await navegador.close();
  }

  writeFileSync(path.join(SALIDA, "index.html"), informe(filas));
  const fallidas = filas.filter((f) => !f.r.aprobado);
  console.log(`\nInforme: ${path.join(SALIDA, "index.html")}`);
  if (fallidas.length) {
    console.error(`\n${fallidas.length} página(s) se ven distintas en pantalla y en el PDF.`);
    process.exit(1);
  }
  console.log("\nTodas las páginas coinciden.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
