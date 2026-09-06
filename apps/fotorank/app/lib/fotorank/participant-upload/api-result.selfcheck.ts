/**
 * Selfcheck — el wizard no vuelve a llamar "error de red" a cualquier cosa.
 *   pnpm --filter fotorank run test:participant-upload:api-result
 *
 * Incidente que fija (producción, 2026-09-06, Santa Fe en Foco): el wizard
 * hacía `await res.json()` sobre la respuesta del upload. La plataforma
 * rechazaba las fotos de más de 4,5 MB con `413` y cuerpo de texto plano
 * (`FUNCTION_PAYLOAD_TOO_LARGE`); `res.json()` lanzaba, y el catch mostraba
 * "Error de red al subir. Conservamos tus datos: reintentá el envío." El
 * participante reintentaba el mismo archivo, volvía a fallar, y desde afuera
 * el caso era indistinguible de una mala conexión.
 *
 * Verificado contra producción ese día: 100 KB → 401 JSON; 6 MB → 413
 * `FUNCTION_PAYLOAD_TOO_LARGE` en texto plano.
 *
 * Todo va dentro de `main()` y no en top-level await: el runner (tsx en
 * formato CJS) rechaza el await de módulo, que es lo que hoy deja a
 * `entries.selfcheck.ts` sin poder ejecutarse.
 *
 * Lógica pura: no toca red, ni base, ni sube archivos.
 */
import {
  classifyHttpStatus,
  classifyTransportError,
  PLATFORM_REQUEST_LIMIT_BYTES,
  readApiResult,
} from "./api-result";
import { translateUploadError } from "./error-messages";

function ok(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok — ${msg}`);
}

const jsonRes = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const textRes = (body: string, status: number) =>
  new Response(body, { status, headers: { "Content-Type": "text/plain" } });

async function main() {
  /* ---------- 1) El caso exacto del incidente ---------- */
  const tooLarge = await readApiResult(
    textRes("Request Entity Too Large\n\nFUNCTION_PAYLOAD_TOO_LARGE\n\ngru1::abc123", 413),
  );
  ok(!tooLarge.ok, "413 con cuerpo de texto plano se reporta como fallo, no como éxito");
  ok(!tooLarge.ok && tooLarge.code === "PAYLOAD_TOO_LARGE", "413 se clasifica como PAYLOAD_TOO_LARGE");

  const msgTooLarge = translateUploadError("PAYLOAD_TOO_LARGE");
  ok(/peso/i.test(msgTooLarge), "el mensaje de 413 habla del peso del archivo");
  ok(
    !/error de red/i.test(msgTooLarge) && !/conexión/i.test(msgTooLarge),
    "el mensaje de 413 ya NO culpa a la conexión",
  );

  /* ---------- 2) Cada falla tiene su propia voz ---------- */
  const distintos = [
    ["PAYLOAD_TOO_LARGE", 413],
    ["UNAUTHENTICATED", 401],
    ["SERVER_TIMEOUT", 504],
    ["SERVER_UNAVAILABLE", 503],
  ] as const;
  const textos = new Set<string>();
  for (const [code, status] of distintos) {
    ok(classifyHttpStatus(status) === code, `status ${status} → ${code}`);
    textos.add(translateUploadError(code));
  }
  ok(textos.size === distintos.length, "cada causa produce un mensaje distinto (no un cartel único)");

  /* ---------- 3) Nunca se filtra el cuerpo crudo de la plataforma ---------- */
  /**
   * Un error de infraestructura puede traer HTML, hosts internos o el id de
   * request. Nada de eso puede terminar en la pantalla del participante.
   */
  const conHtml = await readApiResult(
    textRes("<html><body>nginx/1.2.3 upstream 10.0.0.7 timed out</body></html>", 502),
  );
  ok(!conHtml.ok && conHtml.code === "SERVER_UNAVAILABLE", "502 en HTML se clasifica sin leer el cuerpo");
  const textoHtml = !conHtml.ok ? translateUploadError(conHtml.code) : "";
  for (const fuga of ["nginx", "10.0.0.7", "<html>", "upstream"]) {
    ok(!textoHtml.includes(fuga), `el mensaje no filtra "${fuga}"`);
  }

  /* ---------- 4) El código del backend gana sobre el status ---------- */
  const conCodigo = await readApiResult(
    jsonRes({ error: { code: "INSTAGRAM_REQUIRED", message: "detalle interno" } }, 400),
  );
  ok(!conCodigo.ok && conCodigo.code === "INSTAGRAM_REQUIRED", "se respeta el código que manda el backend");

  /* ---------- 5) Éxito real y éxito falso ---------- */
  const bien = await readApiResult<{ entryId: string }>(jsonRes({ ok: true, entryId: "e1" }));
  ok(bien.ok && bien.data.entryId === "e1", "una respuesta válida se entrega parseada");

  const okConFalse = await readApiResult(jsonRes({ ok: false, error: { code: "NOT_READY" } }, 200));
  ok(!okConFalse.ok && okConFalse.code === "NOT_READY", "200 con ok:false es fallo, no éxito");

  const cuerpoRoto = await readApiResult(new Response("{ esto no es json", { status: 200 }));
  ok(
    !cuerpoRoto.ok && cuerpoRoto.code === "UNEXPECTED_RESPONSE",
    "200 con cuerpo ilegible no se toma como éxito inventado",
  );

  /* ---------- 6) Transporte: abort propio vs. red caída ---------- */
  const abortErr = new Error("aborted");
  abortErr.name = "AbortError";
  ok(classifyTransportError(abortErr) === "ABORTED", "el timeout propio se distingue de la red");
  ok(
    classifyTransportError(new TypeError("Failed to fetch")) === "NETWORK_FAILED",
    "fetch caído → NETWORK_FAILED",
  );
  ok(
    translateUploadError("NETWORK_FAILED") !== translateUploadError("PAYLOAD_TOO_LARGE"),
    "una red caída y un archivo pesado no dicen lo mismo",
  );

  /* ---------- 7) Todo código clasificado tiene mensaje propio ---------- */
  const generico = translateUploadError("CODIGO_QUE_NO_EXISTE");
  for (const status of [401, 403, 404, 408, 413, 429, 500, 502, 503, 504]) {
    const code = classifyHttpStatus(status);
    ok(
      translateUploadError(code) !== generico,
      `${status} (${code}) tiene mensaje propio y no cae en el genérico`,
    );
  }

  /* ---------- 8) El umbral del fallback queda debajo del tope real ---------- */
  /**
   * Si el PUT directo falla (bucket inalcanzable, CORS sin configurar), el
   * wizard reintenta por multipart sólo cuando el archivo entra en el pedido.
   * Ese umbral tiene que quedar por debajo de los 4,5 MB de la plataforma: si
   * lo igualara, el reintento chocaría contra el mismo 413 que motivó todo
   * este cambio.
   */
  const TOPE_REAL_PLATAFORMA = 4.5 * 1024 * 1024;
  ok(
    PLATFORM_REQUEST_LIMIT_BYTES < TOPE_REAL_PLATAFORMA,
    "el umbral de fallback está por debajo del tope real de la plataforma",
  );
  ok(PLATFORM_REQUEST_LIMIT_BYTES > 1024 * 1024, "el umbral no es tan chico que anule el fallback");

  console.log("FINAL: PASS");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
