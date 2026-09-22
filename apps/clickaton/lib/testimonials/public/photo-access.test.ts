import assert from "node:assert/strict";
import { test } from "node:test";
import { canServeTestimonialPhoto } from "./photo-access";

const publicado = {
  status: "PUBLISHED" as const,
  publicationConsent: true,
  authorPhotoAssetId: "a1",
};

test("un testimonio publicado y consentido entrega su foto", () => {
  assert.equal(canServeTestimonialPhoto(publicado), true);
});

test("un testimonio pendiente no entrega su foto", () => {
  assert.equal(canServeTestimonialPhoto({ ...publicado, status: "PENDING" }), false);
});

test("un testimonio rechazado no entrega su foto", () => {
  assert.equal(canServeTestimonialPhoto({ ...publicado, status: "REJECTED" }), false);
});

test("sin autorización de publicación no entrega su foto", () => {
  assert.equal(
    canServeTestimonialPhoto({ ...publicado, publicationConsent: false }),
    false,
  );
});

test("sin foto cargada no hay nada que entregar", () => {
  assert.equal(
    canServeTestimonialPhoto({ ...publicado, authorPhotoAssetId: null }),
    false,
  );
});

test("un testimonio inexistente no entrega nada", () => {
  assert.equal(canServeTestimonialPhoto(null), false);
});
