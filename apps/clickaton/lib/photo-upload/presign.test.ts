import assert from "node:assert/strict";
import test from "node:test";
import { amzDates, presignGetUrl, presignPutUrl } from "./presign";

/**
 * El algoritmo se verificó contra `@aws-sdk/s3-request-presigner`: con los mismos
 * datos y el reloj congelado, ambas implementaciones firman idéntico. Ese paquete
 * no quedó como dependencia —reordena el lockfile del monorepo y rompe el chequeo
 * de tipos de CompraMeLaFoto—, así que el resultado se conserva acá, fijado.
 *
 * La forma de la dirección NO se copió del SDK, y ésa es la parte que costó cara:
 * el SDK arma `bucket.cuenta.r2.cloudflarestorage.com` (virtual-host) y **R2
 * responde 503 a esa dirección**. Se descubrió en producción, con la maratón
 * corriendo y nadie pudiendo entregar. La que R2 acepta es la de abajo, con el
 * bucket en la ruta.
 *
 * Si este valor cambia, la subida del navegador deja de funcionar.
 */
const ENTRADA = {
  endpoint: "https://cuentademo.r2.cloudflarestorage.com",
  bucket: "clickaton-media",
  key: "clickaton/private/entries/ed-1/inbox/reg-1/abc-def.jpg",
  accessKeyId: "AKIAIOSFODNN7EXAMPLE",
  secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
  expiresInSeconds: 900,
  now: new Date("2026-09-19T18:45:00.000Z"),
};

const ESPERADA =
  "https://cuentademo.r2.cloudflarestorage.com/clickaton-media/clickaton/private/entries/ed-1/inbox/reg-1/abc-def.jpg" +
  "?X-Amz-Algorithm=AWS4-HMAC-SHA256" +
  "&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD" +
  "&X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20260919%2Fauto%2Fs3%2Faws4_request" +
  "&X-Amz-Date=20260919T184500Z" +
  "&X-Amz-Expires=900" +
  "&X-Amz-SignedHeaders=host" +
  "&x-id=PutObject" +
  "&X-Amz-Signature=d6d6a1a61973c86c896a63f2b847f912933bf5bd53e269e9b70994e4b83c6c31";

test("la URL firmada es la que R2 acepta", () => {
  assert.equal(presignPutUrl(ENTRADA), ESPERADA);
});

test("el bucket va en la ruta, no en el nombre del servidor", () => {
  const url = new URL(presignPutUrl(ENTRADA));
  assert.equal(url.host, "cuentademo.r2.cloudflarestorage.com");
  assert.equal(url.pathname, `/clickaton-media/${ENTRADA.key}`);
  // La variante virtual-host es la que devuelve 503: que no vuelva por descuido.
  assert.ok(!url.host.startsWith("clickaton-media."));
});

test("las barras de la ruta no se escapan; los caracteres raros sí", () => {
  const url = new URL(
    presignPutUrl({ ...ENTRADA, key: "clickaton/private/entries/ed 1/foto #2.jpg" }),
  );
  assert.equal(url.pathname, "/clickaton-media/clickaton/private/entries/ed%201/foto%20%232.jpg");
});

test("cambiar un solo dato cambia la firma", () => {
  const otra = presignPutUrl({ ...ENTRADA, key: `${ENTRADA.key}x` });
  assert.notEqual(
    new URL(otra).searchParams.get("X-Amz-Signature"),
    new URL(ESPERADA).searchParams.get("X-Amz-Signature"),
  );
});

test("la firma caduca: el vencimiento viaja en la URL", () => {
  const url = new URL(presignPutUrl({ ...ENTRADA, expiresInSeconds: 60 }));
  assert.equal(url.searchParams.get("X-Amz-Expires"), "60");
});

test("las fechas salen en el formato que pide la firma", () => {
  const { amzDate, dateStamp } = amzDates(new Date("2026-09-19T18:45:00.000Z"));
  assert.equal(amzDate, "20260919T184500Z");
  assert.equal(dateStamp, "20260919");
});

test("la descarga firma GET y el nombre de archivo, con espacios como %20", () => {
  const url = presignGetUrl({ ...ENTRADA, downloadFileName: "Ana Pérez consigna 1.jpg" });
  assert.ok(url.includes("x-id=GetObject"));
  assert.ok(
    url.includes("response-content-disposition=attachment%3B%20filename%3D%22Ana_Perez_consigna_1.jpg%22"),
  );
  assert.ok(!url.includes("+"));
  assert.notEqual(new URL(url).searchParams.get("X-Amz-Signature"), null);
});
