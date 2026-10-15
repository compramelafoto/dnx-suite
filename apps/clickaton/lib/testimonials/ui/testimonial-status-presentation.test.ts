import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canPublish,
  npsToneLabel,
  presentTestimonialStatus,
} from "./testimonial-status-presentation";

test("sin autorización no se muestra como pendiente de revisión", () => {
  const sinConsentimiento = presentTestimonialStatus("PENDING", false);
  assert.equal(sinConsentimiento.label, "Sin autorización");
  assert.equal(sinConsentimiento.tone, "neutral");
});

test("con autorización y sin revisar, queda pendiente", () => {
  const pendiente = presentTestimonialStatus("PENDING", true);
  assert.equal(pendiente.label, "Pendiente de revisión");
  assert.equal(pendiente.tone, "warning");
});

test("publicado y rechazado se distinguen", () => {
  assert.equal(presentTestimonialStatus("PUBLISHED", true).label, "Publicado");
  assert.equal(presentTestimonialStatus("PUBLISHED", true).tone, "success");
  assert.equal(presentTestimonialStatus("REJECTED", true).label, "Rechazado");
  assert.equal(presentTestimonialStatus("REJECTED", true).tone, "danger");
});

test("quien respondió sin dejar testimonio se muestra como tal", () => {
  const soloEncuesta = presentTestimonialStatus(null, false);
  assert.equal(soloEncuesta.label, "Sólo encuesta");
  assert.equal(soloEncuesta.tone, "neutral");
});

test("no se puede publicar lo que no fue autorizado", () => {
  assert.equal(canPublish({ status: "PENDING", publicationConsent: true }).allowed, true);
  const sinConsentimiento = canPublish({
    status: "PENDING",
    publicationConsent: false,
  });
  assert.equal(sinConsentimiento.allowed, false);
  assert.equal(
    sinConsentimiento.reason,
    "Quien lo escribió no autorizó que se publique.",
  );
});

test("un testimonio ya publicado no se vuelve a publicar", () => {
  const yaPublicado = canPublish({ status: "PUBLISHED", publicationConsent: true });
  assert.equal(yaPublicado.allowed, false);
  assert.equal(yaPublicado.reason, "Ya está publicado.");
});

test("el NPS se lee con una etiqueta, no sólo con un número", () => {
  assert.equal(npsToneLabel(60), "Excelente");
  assert.equal(npsToneLabel(50), "Excelente");
  assert.equal(npsToneLabel(30), "Bueno");
  assert.equal(npsToneLabel(1), "Mejorable");
  assert.equal(npsToneLabel(0), "Crítico");
  assert.equal(npsToneLabel(-20), "Crítico");
});
