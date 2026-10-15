import { createHash } from "node:crypto";

/**
 * La huella de un juego de datos: cómo quedó un lado en la última corrida.
 *
 * Comparar la huella guardada con la actual responde la única pregunta que importa —
 * **¿cambió este lado?**— sin depender de que los relojes de Google y de la base coincidan.
 * Es lo que evita el error clásico de estas sincronizaciones, que es resolver todo por
 * fechas y pisar el trabajo de alguien en silencio.
 *
 * No es criptografía: nadie firma nada con esto. Es una comparación barata y estable.
 */

// Unit Separator (ASCII 0x1F): no puede escribirse desde un teclado ni pegarse en un campo de
// texto, así que nunca va a aparecer dentro de un nombre de campo ni de un valor normalizado.
// Sirve para separar tanto "campo=valor" dentro de `fingerprintOf` como "campo=hash" dentro de
// `fieldFingerprintsOf`, sin ambigüedad en ningún caso.
const SEPARADOR = "\x1F";

/**
 * Vacío, null y ausente son el mismo estado; el espacio de más no cuenta.
 *
 * Se exporta porque no alcanza con que las huellas normalicen: quien COMPARA valores sueltos
 * —`merge.ts`— tiene que usar exactamente el mismo criterio. Si la huella dice "no cambió
 * nada" y la comparación cruda dice "son distintos", el módulo escribe en cada corrida un
 * cambio que nunca se resuelve (ver `sameFieldValue`).
 */
export function normalizeFieldValue(valor: string | null | undefined): string {
  return (valor ?? "").trim();
}

/** Alias interno, para que el resto del archivo se siga leyendo en el mismo idioma. */
const normalizar = normalizeFieldValue;

/**
 * ¿Son el mismo dato, con el MISMO criterio con el que lo miran las huellas?
 *
 * Existe por un desajuste que costaba caro: las huellas normalizan (`trim`, y `null`/`""`/
 * ausente son un solo estado), pero una comparación cruda con `===` no. El padrón guarda `""`
 * donde `readFieldValues` devuelve SIEMPRE `null`, y guarda `"Ana "` donde Google devuelve
 * `"Ana"`. Con `===`, esos dos casos se leen como "hay algo distinto que empujar" mientras las
 * huellas se leen como "ningún lado tocó nada" — así que la diferencia no se resuelve nunca:
 * se empuja a Google en cada corrida, para siempre, quemando cuota y —lo peor— renovando el
 * `updateTime` del contacto, que es el único dato con el que después se desempatan los
 * conflictos de verdad.
 */
export function sameFieldValue(a: string | null | undefined, b: string | null | undefined): boolean {
  return normalizeFieldValue(a) === normalizeFieldValue(b);
}

export function fingerprintOf(values: Record<string, string | null | undefined>): string {
  // Normalizar es la mitad del asunto. El padrón guarda "" donde Google devuelve ausencia;
  // si no se igualaran, cada corrida creería que hubo un cambio y escribiría para siempre.
  const partes = Object.keys(values)
    .sort()
    .filter((key) => normalizar(values[key]) !== "")
    .map((key) => `${key}=${normalizar(values[key])}`);

  // El separador (Unit Separator ASCII) garantiza que la concatenación sea inequívoca.
  // Sin él, {a:"1b=2", b:"3"} y {a:"1", b:"2b=3"} darían el mismo texto "a=1b=2b=3".
  return createHash("sha1")
    .update(partes.join(SEPARADOR))
    .digest("hex");
}

// Cuántos caracteres hex del sha1 se guardan por campo. No es para seguridad —nadie firma nada
// acá— así que no hace falta el hash completo: alcanza con que la chance de que dos valores
// DISTINTOS choquen sea despreciable para el puñado de campos sincronizables que hay por persona.
const LARGO_HASH_CORTO = 12;

function hashCorto(valorNormalizado: string): string {
  return createHash("sha1").update(valorNormalizado).digest("hex").slice(0, LARGO_HASH_CORTO);
}

/**
 * La huella, pero UNA POR CAMPO en vez de una sola para todo el juego de datos.
 *
 * `fingerprintOf` contesta "¿cambió ALGO de este lado?" — y esa pregunta no alcanza para saber
 * QUÉ campo cambió cuando un lado toca más de uno a la vez. Acá se guarda, en el mismo string,
 * una entrada `campo=hash` por cada campo que trae `values`, ordenadas alfabéticamente por
 * nombre de campo y separadas por el mismo separador que usa `fingerprintOf` — por la misma
 * razón: no puede aparecer ni en un nombre de campo ni en un hash hexadecimal.
 *
 * Con esto, comparar dos huellas campo por campo (ver `fieldsThatDiffer`) dice con certeza
 * quién tocó cada campo, sin ningún truco de revertir-y-recalcular y sin ningún caso límite:
 * a diferencia de la huella del conjunto, esta no se degrada cuando un lado cambia varios
 * campos a la vez.
 */
export function fieldFingerprintsOf(values: Record<string, string | null | undefined>): string {
  return Object.keys(values)
    .sort()
    .map((campo) => `${campo}=${hashCorto(normalizar(values[campo]))}`)
    .join(SEPARADOR);
}

// Una entrada válida es "campo=hash": el campo es cualquier texto que no sea el separador ni
// contenga un "=" (así el corte es inequívoco), y el hash son sólo los caracteres que puede
// producir `hashCorto`.
const PATRON_ENTRADA = new RegExp(`^([^=${SEPARADOR}]+)=([0-9a-f]{${LARGO_HASH_CORTO}})$`);

/**
 * Lee una huella por campo y devuelve el mapa campo → hash.
 *
 * Un string que no tiene esta forma —vacío, la huella VIEJA del conjunto entero (40 hex sin
 * "="), o cualquier otra cosa— se trata como "no comparable" y devuelve `null`. Quien llama
 * decide de forma conservadora qué hacer ante eso: no hay forma honesta de "adivinar" qué
 * campo cambió a partir de un dato que no se entiende.
 */
export function readFieldFingerprints(fingerprint: string): Record<string, string> | null {
  const mapa: Record<string, string> = {};
  for (const entrada of fingerprint.split(SEPARADOR)) {
    const coincidencia = PATRON_ENTRADA.exec(entrada);
    if (!coincidencia) return null;
    const [, campo, hash] = coincidencia;
    mapa[campo] = hash;
  }
  return mapa;
}

/**
 * Qué campos difieren entre dos huellas por campo.
 *
 * Devuelve `null` cuando alguna de las dos huellas no es comparable (formato inesperado) —
 * nunca una lista vacía por defecto ante la duda, porque "no sé" y "no cambió nada" son
 * respuestas distintas y confundirlas es exactamente el tipo de error que pierde datos.
 *
 * **No sirve para atribuir un cambio a un lado**, y por eso `merge.ts` NO la usa para eso: esta
 * función recorre la UNIÓN de los campos de las dos huellas, así que un campo que aparece en
 * una sola figura como "diferente". Es la respuesta correcta a "¿en qué se distinguen estos dos
 * textos?" y la respuesta equivocada a "¿tocó este lado este campo?". Para lo segundo está
 * `fieldChangeReader`, que distingue "no lo tocó" de "no hay con qué compararlo".
 */
export function fieldsThatDiffer(huellaA: string, huellaB: string): string[] | null {
  const mapaA = readFieldFingerprints(huellaA);
  const mapaB = readFieldFingerprints(huellaB);
  if (!mapaA || !mapaB) return null;

  const campos = new Set([...Object.keys(mapaA), ...Object.keys(mapaB)]);
  const diferentes = [...campos].filter((campo) => mapaA[campo] !== mapaB[campo]);
  return diferentes.sort();
}

/**
 * Contesta, campo por campo: `true` lo tocó, `false` no lo tocó, `null` **no se puede saber**.
 */
export type FieldChangeReader = (campo: string) => boolean | null;

/**
 * ¿Tocó este lado ESTE campo entre la corrida anterior y ahora?
 *
 * ── Por qué no alcanza con `fieldsThatDiffer` ──
 *
 * Porque un campo que aparece en una sola de las dos huellas no es un campo cambiado: es un
 * campo sobre el que no hay información. La diferencia importa el día en que el conjunto de
 * campos sincronizables CRECE —la etapa 2 suma los módulos de Reservas y Cursos—: el campo
 * nuevo no tiene entrada en la huella guardada de NINGUNO de los dos lados, así que contado
 * como "cambiado" aparece cambiado **de los dos lados a la vez**. Eso fabrica un conflicto que
 * nunca existió, y un conflicto lo desempata la fecha — que casi siempre favorece a Google,
 * porque la última escritura en Google la hizo la sincronización misma. Con el padrón teniendo
 * `birthDate: "1985-04-12"` y Google sin fecha, el resultado medido era `PULL {"birthDate":
 * null}`: la fecha de nacimiento del socio borrada de la base, en silencio.
 *
 * ── Las cuatro combinaciones, y qué significa cada una ──
 *
 * - En las DOS, con el mismo hash → no lo tocó: `false`.
 * - En las DOS, con distinto hash → lo tocó: `true`.
 * - Sólo en la ACTUAL (falta en la guardada) → la corrida anterior no guardaba nada de ese
 *   campo: el conjunto creció, o aquella versión no lo sincronizaba. No hay con qué
 *   compararlo: `null`. **No** es "cambió".
 * - Sólo en la GUARDADA (falta en la actual) → esta corrida no trae ese campo entre los
 *   valores: el conjunto se achicó, o los valores llegaron incompletos. Tampoco hay con qué
 *   compararlo: `null`.
 *
 * ── Por qué `null` no es una respuesta simétrica ──
 *
 * `null` no decide nada por sí mismo: lo resuelve quien llama, y **de qué lado falte la entrada
 * cambia el resultado**. Del lado de Google, "no sé" se lee como "no lo tocó": Google tiene que
 * PROBAR que tocó un campo para llevárselo. Del lado del padrón se lee al revés, como "lo
 * tocó": si no se puede probar que FOTOFFICE no lo tocó, se asume que sí, así un cambio de
 * Google sobre ese mismo campo tiene que ganarse el lugar por fecha en vez de pisar el padrón
 * de prepo. Los dos empujan hacia el mismo lado, que es el que manda el spec: ante la duda gana
 * FOTOFFICE, que es el registro. Ver el bucle de `merge.ts`.
 */
export function fieldChangeReader(
  huellaGuardada: string | null,
  huellaActual: string,
): FieldChangeReader {
  // No hay corrida anterior: no se sabe nada de ningún campo.
  if (huellaGuardada === null) return () => null;

  // Si los dos textos son el MISMO string, este lado no cambió nada — se entienda o no el
  // formato. Es una deducción sólida, y evita caer al camino de la duda por una huella vieja
  // que igual estaba diciendo "acá no pasó nada".
  if (huellaGuardada === huellaActual) return () => false;

  const guardada = readFieldFingerprints(huellaGuardada);
  const actual = readFieldFingerprints(huellaActual);
  // Alguna de las dos tiene un formato que esta versión no entiende: no se sabe nada de ningún
  // campo. Adivinar a partir de un dato que no se entiende es justo lo que pierde datos.
  if (!guardada || !actual) return () => null;

  return (campo) => {
    const antes = guardada[campo];
    const ahora = actual[campo];
    if (antes === undefined || ahora === undefined) return null;
    return antes !== ahora;
  };
}
