/**
 * El directorio respetaba los interruptores y la página pública no. Un jurado
 * apagaba "mostrar mi web" y su web se mostraba igual.
 *
 * Se recorta en la capa de datos: un dato que no se puede mostrar no sale de
 * la consulta, así ninguna pantalla puede filtrarlo por descuido.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { recortarPerfilParaElPublico } from "./publicProfileVisibility";

function perfilCompleto() {
  return {
    website: "https://ana.com",
    instagram: "ana.foto",
    otherLinksJson: [{ nombre: "Behance", url: "https://behance.net/ana" }],
    city: "Santa Fe",
    country: "Argentina",
    phone: "+54 342 400 0000",
    showWebsitePublicly: true,
    showInstagramPublicly: true,
    showLocationPublicly: true,
  };
}

test("con todo encendido se muestra todo menos el teléfono", () => {
  const v = recortarPerfilParaElPublico(perfilCompleto());
  assert.equal(v.website, "https://ana.com");
  assert.equal(v.instagram, "ana.foto");
  assert.equal(v.city, "Santa Fe");
  assert.equal(v.country, "Argentina");
  assert.ok(!("phone" in v), "el teléfono no sale nunca");
});

test("apagar la web la saca", () => {
  const v = recortarPerfilParaElPublico({ ...perfilCompleto(), showWebsitePublicly: false });
  assert.equal(v.website, null);
  assert.equal(v.instagram, "ana.foto");
});

test("apagar Instagram lo saca", () => {
  const v = recortarPerfilParaElPublico({ ...perfilCompleto(), showInstagramPublicly: false });
  assert.equal(v.instagram, null);
  assert.equal(v.website, "https://ana.com");
});

test("apagar la ubicación saca ciudad y país juntos", () => {
  const v = recortarPerfilParaElPublico({ ...perfilCompleto(), showLocationPublicly: false });
  assert.equal(v.city, null);
  assert.equal(v.country, null);
});

test("los otros links se muestran siempre: el jurado los cargó para que se vean", () => {
  const v = recortarPerfilParaElPublico({ ...perfilCompleto(), showWebsitePublicly: false });
  assert.deepEqual(v.otherLinksJson, [{ nombre: "Behance", url: "https://behance.net/ana" }]);
});

test("con todo apagado no queda nada de contacto", () => {
  const v = recortarPerfilParaElPublico({
    ...perfilCompleto(),
    showWebsitePublicly: false,
    showInstagramPublicly: false,
    showLocationPublicly: false,
  });
  assert.equal(v.website, null);
  assert.equal(v.instagram, null);
  assert.equal(v.city, null);
  assert.equal(v.country, null);
});
