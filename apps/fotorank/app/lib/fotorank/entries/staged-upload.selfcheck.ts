/**
 * Selfcheck — área de staging de la subida directa.
 *   pnpm --filter fotorank run test:entries:staged-upload
 *
 * Por qué existe: en la subida directa el navegador escribe el original en el
 * bucket por su cuenta y después le dice al servidor "listo". Ese "listo" es
 * un dato que viene del cliente, así que la key del objeto la arma el servidor
 * y nunca se acepta armada desde afuera. Si el id se colara tal cual dentro de
 * la key, un `../` alcanzaría para hacer que el servidor lea —y borre— un
 * objeto de otra obra.
 *
 * Lógica pura: no toca red, ni base, ni sube archivos.
 */
import {
  buildStagedUploadKey,
  isValidStagedUploadId,
  newStagedUploadId,
  STAGED_UPLOAD_URL_TTL_SECONDS,
} from "./staged-upload";
import { storageKeyContainsPiiLeak } from "../storage/private-local-storage";

function ok(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok — ${msg}`);
}

/* ---------- 1) Ids generados ---------- */
const id = newStagedUploadId();
ok(isValidStagedUploadId(id), "el id generado pasa su propia validación");
ok(/^[0-9a-f]{32}$/.test(id), "el id es hex de 32 caracteres");
ok(newStagedUploadId() !== newStagedUploadId(), "dos ids seguidos no colisionan");

/* ---------- 2) Nada que no sea hex entra en la key ---------- */
const venenos = [
  "../../otra-obra/original",
  "..",
  "/etc/passwd",
  "abc",
  "",
  "A".repeat(32), // mayúsculas: fuera del alfabeto aceptado
  `${"a".repeat(32)}/x`,
  "a".repeat(31),
  "a".repeat(33),
];
for (const malicioso of venenos) {
  ok(!isValidStagedUploadId(malicioso), `rechaza el id "${malicioso.slice(0, 24)}"`);
  let lanzo = false;
  try {
    buildStagedUploadKey({ contestId: "c1", entryId: "e1", uploadId: malicioso });
  } catch {
    lanzo = true;
  }
  ok(lanzo, `buildStagedUploadKey lanza ante "${malicioso.slice(0, 24)}"`);
}
for (const tipo of [null, undefined, 42, {}, []]) {
  ok(!isValidStagedUploadId(tipo), `rechaza un id de tipo ${typeof tipo}`);
}

/* ---------- 3) La key queda dentro del árbol de la obra ---------- */
const key = buildStagedUploadKey({ contestId: "c1", entryId: "e1", uploadId: id });
ok(key === `fotorank/contests/c1/entries/e1/staging/${id}`, "la key tiene la forma esperada");
ok(key.startsWith("fotorank/contests/c1/entries/e1/"), "la key cae bajo el prefijo de la obra");
ok(!key.includes(".."), "la key no contiene saltos de directorio");

/* ---------- 4) Sin PII ---------- */
/**
 * Mismo contrato que el resto de las keys de storage: el nombre del archivo
 * que eligió el participante puede contener su nombre o su email, y no entra.
 */
ok(!storageKeyContainsPiiLeak(key), "la key no filtra PII");
ok(!/@/.test(key), "la key no contiene direcciones de correo");

/* ---------- 5) La URL firmada dura lo que dura una subida real ---------- */
/**
 * 25 MB por una red móvil lenta pueden tardar varios minutos. Una URL de
 * 60 s dejaría al participante mirando un error que no puede evitar.
 */
ok(STAGED_UPLOAD_URL_TTL_SECONDS >= 600, "la URL firmada dura al menos 10 minutos");

console.log("FINAL: PASS");
