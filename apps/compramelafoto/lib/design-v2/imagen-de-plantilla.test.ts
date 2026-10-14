import assert from "node:assert/strict";
import { test } from "node:test";
import { hostsDeImagenesPermitidos, urlDeImagenPermitida } from "./imagen-de-plantilla";

const hosts = hostsDeImagenesPermitidos({
  R2_PUBLIC_URL: "https://pub-994c690619564473b8ce8b798ffa1eb4.r2.dev",
  NEXT_PUBLIC_R2_PUBLIC_URL: "no es una url",
});

test("acepta imágenes de nuestro almacenamiento público", () => {
  const u = urlDeImagenPermitida("https://pub-994c690619564473b8ce8b798ffa1eb4.r2.dev/templates/fondo.png", hosts);
  assert.equal(u?.pathname, "/templates/fondo.png");
});

test("rechaza cualquier otro lugar: no es un intermediario abierto", () => {
  for (const raw of [
    "https://otro-bucket.r2.dev/x.png",
    "http://pub-994c690619564473b8ce8b798ffa1eb4.r2.dev/x.png",
    "https://user:pass@pub-994c690619564473b8ce8b798ffa1eb4.r2.dev/x.png",
    "http://169.254.169.254/latest/meta-data",
    "file:///etc/passwd",
    "no-es-una-url",
    "",
    null,
  ]) {
    assert.equal(urlDeImagenPermitida(raw, hosts), null, String(raw));
  }
});

test("sin almacenamiento configurado no se permite nada", () => {
  assert.equal(hostsDeImagenesPermitidos({}).size, 0);
});
