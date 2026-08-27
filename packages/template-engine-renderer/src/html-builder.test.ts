import assert from "node:assert/strict";
import { test } from "node:test";
import type { ResolvedTemplateDocument } from "@repo/template-engine";
import { buildTemplatePreviewHtml } from "./html-builder";

function doc(
  blocks: ResolvedTemplateDocument["blocks"]
): ResolvedTemplateDocument {
  return {
    id: "doc",
    name: "doc",
    width: 1080,
    height: 1920,
    background: { color: "#000000" },
    blocks,
  } as ResolvedTemplateDocument;
}

function block(
  type: string,
  config: Record<string, unknown>
): ResolvedTemplateDocument["blocks"][number] {
  return {
    id: "b1",
    type,
    pageIndex: 0,
    layout: { x: 0, y: 0, width: 100, height: 50, zIndex: 1 },
    config,
  } as unknown as ResolvedTemplateDocument["blocks"][number];
}

test("el stack tipográfico con comillas no corta el atributo style", () => {
  const { html } = buildTemplatePreviewHtml(
    doc([
      block("TEXT", {
        content: "¡BIENVENID@ A CLICKATÓN!",
        fontFamily: "Barlow Condensed",
        fontSize: 72,
        color: "#FFE600",
      }),
    ])
  );

  const match = /<div class="block block-text"[^>]*style="([^"]*)"/.exec(html);
  assert.ok(match, "el bloque de texto debe tener atributo style");
  const style = match[1]!;

  // La comilla del stack va escapada, así que el atributo llega completo
  // hasta el color. Sin escapar, el navegador descartaba `color` y el texto
  // quedaba negro sobre fondo negro (invisible).
  assert.ok(style.includes("&quot;Barlow Condensed&quot;"));
  assert.ok(style.includes("color:#FFE600"));
  assert.ok(style.includes("font-size:72px"));
});

test("las imágenes conservan fit y máscara en el atributo style", () => {
  const { html } = buildTemplatePreviewHtml(
    doc([
      block("PHOTO", {
        src: "data:image/png;base64,iVBORw0KGgo=",
        fit: "cover",
        maskShape: "circle",
      }),
    ])
  );

  const match = /<img class="block-img"[^>]*style="([^"]*)"/.exec(html);
  assert.ok(match, "la imagen debe tener atributo style");
  assert.ok(match[1]!.includes("object-fit:cover"));
  assert.ok(match[1]!.includes("border-radius:50%"));
});

test("el texto sigue escapándose contra inyección de HTML", () => {
  const { html } = buildTemplatePreviewHtml(
    doc([block("TEXT", { content: '<img src=x onerror="alert(1)">' })])
  );
  assert.ok(!html.includes("<img src=x"));
  assert.ok(html.includes("&lt;img src=x"));
});
