import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import PhotoSlideViewer from "./PhotoSlideViewer";
import ScanProtectedPhoto from "./ScanProtectedPhoto";

const PHOTO = {
  id: "1",
  src: "/api/photos/1/view?mode=preview&albumId=9",
  alt: "Foto de prueba",
};

function renderViewer(props: Record<string, unknown> = {}) {
  return renderToStaticMarkup(
    <PhotoSlideViewer photos={[PHOTO]} onClose={() => {}} {...props} />,
  );
}

describe("ventana de escaneo en el visor ampliado", () => {
  it("1. se renderiza al ampliar una fotografía no comprada", () => {
    const html = renderViewer({ protectUnpurchased: true });
    assert.ok(html.includes('data-scan-protected="true"'), "falta la capa de protección");
    assert.ok(html.includes("cmf-scan__window"), "falta la franja");
  });

  it("2. la fotografía base sigue desenfocada", () => {
    const html = renderViewer({ protectUnpurchased: true });
    assert.ok(html.includes("cmf-scan__base"), "falta la capa base");
    assert.ok(html.includes("--cmf-scan-blur"), "falta la variable de desenfoque");
  });

  it("3. la capa nítida está limitada a una franja, no a toda la foto", () => {
    const html = renderToStaticMarkup(<ScanProtectedPhoto src={PHOTO.src} alt={PHOTO.alt} />);
    assert.ok(html.includes("--cmf-scan-band"), "la franja no define su alto");
    const window = html.slice(html.indexOf("cmf-scan__window"));
    assert.ok(window.includes("cmf-scan__inner"), "falta la contra-animación");
    assert.ok(window.includes("cmf-scan__sharp"), "falta la capa nítida dentro de la franja");
  });

  it("4. la franja conserva una marca de agua visible", () => {
    const html = renderToStaticMarkup(
      <ScanProtectedPhoto src={PHOTO.src} alt={PHOTO.alt} watermarkLabel="MiEstudio" />,
    );
    const window = html.slice(html.indexOf("cmf-scan__window"));
    assert.ok(window.includes('data-scan-watermark="true"'), "la franja no tiene marca de agua");
    assert.ok(window.includes("MiEstudio"), "no usa el texto de marca indicado");
  });

  it("5. no aparece sobre una fotografía ya comprada", () => {
    const html = renderViewer({
      protectUnpurchased: true,
      photos: [{ ...PHOTO, purchased: true }],
    });
    assert.ok(!html.includes("data-scan-protected"), "protegió una foto comprada");
    assert.ok(!html.includes("cmf-scan"), "quedaron restos de la protección");
    assert.ok(
      html.includes("/api/photos/1/view"),
      "la foto comprada debe seguir mostrándose",
    );
  });

  it("5b. no aparece en vistas internas que no piden la protección", () => {
    const html = renderViewer();
    assert.ok(!html.includes("data-scan-protected"), "protegió una vista interna");
  });

  it("6. las miniaturas no llevan la protección", () => {
    const photos = [PHOTO, { ...PHOTO, id: "2" }, { ...PHOTO, id: "3" }];
    const html = renderViewer({ protectUnpurchased: true, photos });
    const thumbs = html.slice(html.indexOf("Ver foto 1"));
    assert.ok(!thumbs.includes("cmf-scan"), "la protección se filtró a las miniaturas");
    assert.equal(
      (html.match(/data-scan-protected/g) ?? []).length,
      1,
      "solo la foto ampliada debe estar protegida",
    );
  });

  it("7. los controles del visor siguen presentes", () => {
    const photos = [PHOTO, { ...PHOTO, id: "2" }];
    const html = renderViewer({ protectUnpurchased: true, photos });
    assert.ok(html.includes('aria-label="Foto anterior"'), "falta el botón anterior");
    assert.ok(html.includes('aria-label="Foto siguiente"'), "falta el botón siguiente");
    assert.ok(html.includes('aria-label="Ver foto 2"'), "faltan las miniaturas de navegación");
  });

  it("8. cada foto monta su propia protección (no quedan capas de la anterior)", () => {
    const primera = renderViewer({ protectUnpurchased: true });
    const segunda = renderViewer({
      protectUnpurchased: true,
      photos: [{ ...PHOTO, id: "7", src: "/api/photos/7/view?mode=preview&albumId=9" }],
    });
    assert.ok(primera.includes("/api/photos/1/view"));
    assert.ok(segunda.includes("/api/photos/7/view"));
    assert.ok(!segunda.includes("/api/photos/1/view"), "quedó la imagen anterior");
  });

  it("13. muestra el aviso de derechos mientras la protección está activa", () => {
    const html = renderViewer({ protectUnpurchased: true });
    assert.ok(html.includes('data-copyright-notice="compact"'), "falta el aviso legal");
    assert.ok(html.includes("Ley 11.723"), "el aviso no menciona la ley");
  });

  it("13b. una foto comprada no muestra el aviso de la protección", () => {
    const html = renderViewer({
      protectUnpurchased: true,
      photos: [{ ...PHOTO, purchased: true }],
    });
    assert.ok(!html.includes("data-copyright-notice"), "mostró el aviso sobre una foto comprada");
  });

  it("12. la franja reutiliza la misma URL: no genera descargas extra", () => {
    const html = renderToStaticMarkup(<ScanProtectedPhoto src={PHOTO.src} alt={PHOTO.alt} />);

    const capas = html.match(/<img[^>]*src="([^"]*)"/g) ?? [];
    assert.equal(capas.length, 2, "esperaba exactamente 2 capas de imagen");

    const urls = new Set(html.match(/\/api\/photos\/1\/view[^"]*/g) ?? []);
    assert.equal(
      urls.size,
      1,
      "todas las capas deben apuntar a la misma URL: una sola descarga",
    );
  });
});

describe("hoja de estilos de la protección", () => {
  // Relativo a este archivo: funciona igual en el repo legacy y en el monorepo.
  const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");
  const bloque = css.slice(css.indexOf(".cmf-scan {"));

  it("la capa móvil no intercepta clics ni gestos", () => {
    const frame = bloque.slice(bloque.indexOf(".cmf-scan__frame"), bloque.indexOf("@keyframes"));
    assert.ok(
      (frame.match(/pointer-events:\s*none/g) ?? []).length >= 2,
      "la franja debe tener pointer-events: none",
    );
  });

  it("la animación usa transform (no estado de React por frame)", () => {
    assert.ok(bloque.includes("@keyframes cmf-scan-window"));
    assert.ok(bloque.includes("@keyframes cmf-scan-inner"));
    assert.ok(bloque.includes("animation: cmf-scan-window var(--cmf-scan-duration) linear infinite"));
  });

  it("10. prefers-reduced-motion no deja una zona nítida fija", () => {
    const reduced = bloque.slice(bloque.indexOf("@media (prefers-reduced-motion: reduce)"));
    assert.ok(reduced.length > 0, "falta el bloque de reduced motion");
    assert.ok(
      reduced.includes("--cmf-scan-duration-reduced"),
      "debe seguir animando, más lento",
    );
    assert.ok(
      !/animation:\s*none/.test(reduced) && !/animation-play-state:\s*paused/.test(reduced),
      "no debe detener la animación: dejaría una sección siempre nítida",
    );
  });

  it("los bordes de la franja están difuminados", () => {
    assert.ok(bloque.includes("mask-image: linear-gradient"), "falta la máscara de bordes suaves");
  });
});
