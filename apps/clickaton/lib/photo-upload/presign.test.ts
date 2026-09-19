import assert from "node:assert/strict";
import test from "node:test";
import { amzDates, presignPutUrl } from "./presign";

/**
 * La URL de referencia se generó comparando contra `@aws-sdk/s3-request-presigner`
 * con credenciales de juguete y el reloj congelado: con los mismos datos, aquella
 * implementación y ésta producen la misma firma, carácter por carácter. Ese
 * paquete no quedó como dependencia —reordena el lockfile del monorepo y rompe
 * el chequeo de tipos de CompraMeLaFoto—, así que la equivalencia se conserva
 * acá, fijada.
 *
 * Si este valor cambia, la firma dejó de ser la que el proveedor acepta.
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
  "https://clickaton-media.cuentademo.r2.cloudflarestorage.com/clickaton/private/entries/ed-1/inbox/reg-1/abc-def.jpg" +
  "?X-Amz-Algorithm=AWS4-HMAC-SHA256" +
  "&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD" +
  "&X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20260919%2Fauto%2Fs3%2Faws4_request" +
  "&X-Amz-Date=20260919T184500Z" +
  "&X-Amz-Expires=900" +
  "&X-Amz-SignedHeaders=host" +
  "&x-id=PutObject" +
  "&X-Amz-Signature=a48ae547c917579e3d472675b4327236f125b3f8e4ad82d78da0ea7c851b0559";

test("firma igual que el SDK oficial para la misma petición", () => {
  assert.equal(presignPutUrl(ENTRADA), ESPERADA);
});

test("el bucket viaja en el nombre del servidor, no en la ruta", () => {
  const url = new URL(presignPutUrl(ENTRADA));
  assert.equal(url.host, "clickaton-media.cuentademo.r2.cloudflarestorage.com");
  assert.equal(url.pathname, `/${ENTRADA.key}`);
});

test("las barras de la ruta no se escapan; los caracteres raros sí", () => {
  const url = new URL(
    presignPutUrl({ ...ENTRADA, key: "clickaton/private/entries/ed 1/foto #2.jpg" }),
  );
  assert.equal(url.pathname, "/clickaton/private/entries/ed%201/foto%20%232.jpg");
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
