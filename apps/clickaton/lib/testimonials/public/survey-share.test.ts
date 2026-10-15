import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildSurveyShareMessage,
  buildWhatsappShareUrl,
  surveyPath,
} from "./survey-share";

test("la ruta de la encuesta sale del slug de la edición", () => {
  assert.equal(surveyPath("clickaton-argentina-2026"), "/maratones/clickaton-argentina-2026/testimonio");
});

test("el mensaje nombra la edición y termina con el enlace", () => {
  const msg = buildSurveyShareMessage({
    editionName: "Clickatón Navidad 2026",
    url: "https://maratonfotografica.com/maratones/x/testimonio",
  });
  assert.ok(msg.includes("Clickatón Navidad 2026"));
  assert.ok(
    msg.trimEnd().endsWith("https://maratonfotografica.com/maratones/x/testimonio"),
    "el enlace tiene que quedar al final para que WhatsApp lo previsualice",
  );
});

test("el enlace de WhatsApp lleva el mensaje codificado", () => {
  const url = buildWhatsappShareUrl({
    editionName: "Clickatón Navidad 2026",
    url: "https://maratonfotografica.com/maratones/x/testimonio",
  });
  assert.ok(url.startsWith("https://wa.me/?text="));
  // Sin codificar, los espacios y los acentos rompen el enlace.
  assert.ok(!url.includes(" "));
  const decoded = decodeURIComponent(url.slice("https://wa.me/?text=".length));
  assert.ok(decoded.includes("Clickatón Navidad 2026"));
  assert.ok(decoded.includes("https://maratonfotografica.com/maratones/x/testimonio"));
});

test("una edición con caracteres raros no rompe el enlace", () => {
  const url = buildWhatsappShareUrl({
    editionName: "Clickatón — Día del Fotógrafo & Cía. 1º",
    url: "https://maratonfotografica.com/maratones/x/testimonio?a=1&b=2",
  });
  assert.ok(!url.includes(" "));
  assert.ok(!url.slice("https://wa.me/?text=".length).includes("&b=2"));
  const decoded = decodeURIComponent(url.slice("https://wa.me/?text=".length));
  assert.ok(decoded.includes("&b=2"));
});
