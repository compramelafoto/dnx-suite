import {
  fieldChangeReader,
  fieldFingerprintsOf,
  normalizeFieldValue,
  sameFieldValue,
} from "./fingerprint";
import { SYNCABLE_FIELDS, type FieldValues, type SyncableField } from "./person";

/**
 * Qué hacer con cada persona. Módulo PURO: sin base y sin red.
 *
 * Es la pieza que decide, y por eso vive separada del cliente HTTP: el caso difícil —el
 * mismo campo tocado de los dos lados entre dos corridas— se prueba sin hablar con Google.
 *
 * ── La idea entera, en dos líneas ──
 *
 * En cada corrida se guarda una huella POR CAMPO de cómo quedó cada lado (ver
 * `fieldFingerprintsOf` en `./fingerprint`). En la siguiente, comparar esas huellas campo por
 * campo dice con exactitud CUÁLES tocó cada lado. Si un campo lo tocó un solo lado, gana ese
 * lado, sin mirar ningún reloj. Las fechas se usan únicamente cuando el MISMO campo cambió de
 * los dos lados, que es el único caso genuinamente ambiguo.
 *
 * ── Por qué no alcanza con una huella del conjunto ──
 *
 * Una huella del conjunto entero sólo contesta "¿cambió ALGO de este lado?" — no CUÁL campo.
 * Si el padrón toca nombre y dirección en la misma corrida en que Google recibe una corrección
 * de teléfono desde el celular, esa pregunta ya no alcanza: los tres campos quedan mezclados
 * bajo la misma bandera "cambió el padrón" / "cambió Google", y la única salida que queda es
 * el desempate por fecha aplicado a los tres por igual. Con el padrón más nuevo, ese desempate
 * hace ganar al padrón los tres campos — incluido el teléfono, que el padrón ni tocó — y la
 * corrección del celular se pierde en silencio, sobrescrita en la próxima escritura.
 *
 * Con la huella por campo el problema no existe: cada campo se compara contra SU PROPIA huella
 * anterior, así que nombre, dirección y teléfono se resuelven cada uno por separado y con
 * certeza — sin revertir nada, sin recalcular nada, sin ningún caso límite que dejar
 * documentado como pendiente.
 *
 * ── Qué se hace cuando NO se puede saber quién tocó un campo ──
 *
 * Puede pasar por tres motivos: primera corrida (no hay `link`), una huella guardada con un
 * formato que esta versión no sabe leer, o —el caso que va a llegar solo— un campo SIN ENTRADA
 * en la huella guardada, porque el conjunto `SYNCABLE_FIELDS` creció desde la corrida anterior.
 * Ahí la decisión NO se le entrega al reloj: se aplica la regla de desempate del propio spec,
 * que es "ante la duda gana FOTOFFICE, que es el registro". En concreto, Google tiene que
 * PROBAR que tocó un campo para llevárselo; si no se puede probar, no se lo lleva. Del lado del
 * padrón es al revés: si no se puede probar que NO lo tocó, se asume que sí, de modo que un
 * cambio de Google sobre ese mismo campo tenga que ganarse el lugar por fecha en vez de pisar
 * el padrón de prepo. Los dos casos empujan hacia el mismo lado, que es el que manda el spec.
 *
 * Ojo con el matiz, que es donde estaba el agujero: "un campo ausente en la huella guardada" y
 * "un campo presente en una huella y no en la otra" NO son lo mismo, y de qué lado falte cambia
 * el resultado. La tabla de las cuatro combinaciones está en `fieldChangeReader`.
 *
 * ══ QUÉ TIENE QUE GUARDAR EN `link` QUIEN CONSUME ESTA DECISIÓN (Tarea 9) ══
 *
 * Este módulo **recalcula** las huellas de los dos lados a partir de `local` y `remote`, y
 * decide con ésas — no con las que vinieron en `MergeInput.localFingerprint` /
 * `.remoteFingerprint`. Por eso la decisión las devuelve en `fingerprints`: si quien la consume
 * guardara en `link` las huellas que calculó por su cuenta, el `link` de la corrida siguiente
 * describiría un estado que nunca existió, y la atribución de esa corrida saldría mal. Guardá
 * las de `decision.fingerprints`, no las tuyas. En concreto:
 *
 * - `link.localFingerprint` → SIEMPRE `fingerprints.localAfterChanges`. Es la huella del padrón
 *   con `changes` ya aplicados; en `NOTHING` y `PUSH`, donde el padrón no se toca, coincide con
 *   `fingerprints.local`. La escritura en la base es nuestra, así que esta huella se sabe con
 *   certeza.
 * - `link.remoteFingerprint`, **si la corrida NO escribió en Google** (`NOTHING`, `PULL`) →
 *   `fingerprints.remote`.
 * - `link.remoteFingerprint`, **si la corrida SÍ escribió en Google** (`PUSH`, `BOTH`, `CREATE`)
 *   → `fieldFingerprintsOf(readFieldValues(<la persona que devuelve la respuesta de Google>))`.
 *   Acá, y sólo acá, la calcula el llamador: el módulo no puede saber qué guardó Google de
 *   verdad. Guardar `fieldFingerprintsOf(values)` a ciegas es una apuesta, y si Google no
 *   almacena exactamente lo que se le mandó, la corrida siguiente lee esa diferencia como "lo
 *   tocó Google" y —con su `updateTime` más nuevo, que es lo normal— se la lleva, revirtiendo
 *   la corrección del padrón.
 * - Si la escritura en Google FALLA, no se toca `link`: se deja el de la corrida anterior y se
 *   reintenta después. Un `link` que describe un estado que no se alcanzó es peor que uno viejo.
 *
 * Lo que NO hay que guardar nunca: las huellas que el llamador calculó antes de llamar a
 * `decideForPerson`. Pueden estar desactualizadas respecto de los valores que las acompañan
 * —una huella leída de una caché, o calculada antes de la última edición del socio— y el módulo
 * las ignoró justamente por eso.
 */

export type MergeInput = {
  local: FieldValues;
  /**
   * La huella actual del padrón, tal como la va a guardar la corrida. **La decisión no
   * depende de este valor**: `decideForPerson` la recalcula de `local`, que es el dato que
   * tiene a mano y la única fuente honesta. Creerle a una huella que no describe a `local`
   * —una calculada antes de la última edición, por ejemplo— hacía que el módulo diera por
   * no-tocado un campo que el padrón acababa de corregir, y que Google se lo llevara.
   */
  localFingerprint: string;
  localUpdatedAt: Date;
  /** `null` = no existe el contacto en Google (nunca se creó, o lo borraron). */
  remote: FieldValues | null;
  /**
   * La huella actual del contacto de Google. Puede llegar `null` —el llamador no la tiene, o
   * no la calculó— incluso con `remote` presente, porque el tipo lo permite. **La decisión
   * tampoco depende de este valor**: si hay `remote`, la huella se recalcula acá mismo. Antes,
   * un `null` con el contacto vivo degradaba la corrida entera y una corrección hecha desde el
   * celular terminaba pisada por el valor viejo del padrón.
   */
  remoteFingerprint: string | null;
  /** `null` = Google no dice cuándo se tocó. No se reemplaza por "ahora". */
  remoteUpdatedAt: Date | null;
  /** Lo guardado en la corrida anterior. `null` = nunca se sincronizó. */
  link: { localFingerprint: string; remoteFingerprint: string } | null;
  /** Qué campos acepta el módulo que le corrijan desde Google. */
  pullableFields: readonly SyncableField[];
};

/**
 * Las huellas que el módulo usó para decidir. Van en TODAS las decisiones, incluidas las que no
 * escriben nada, porque `link` se guarda igual. Ver la sección "QUÉ TIENE QUE GUARDAR EN
 * `link`" del encabezado del archivo: quien consume la decisión guarda éstas, no las suyas.
 */
export type MergeFingerprints = {
  /**
   * La huella por campo del PADRÓN tal como el módulo lo leyó, calculada de `local`. No es la
   * que vino en `MergeInput.localFingerprint`.
   */
  local: string;
  /**
   * La huella por campo del CONTACTO DE GOOGLE tal como el módulo lo leyó, calculada de
   * `remote`. `null` sólo cuando no hay contacto: `CREATE`, o `NOTHING` por contacto borrado.
   */
  remote: string | null;
  /**
   * La huella del padrón DESPUÉS de aplicar `changes` — es decir, cómo queda el padrón una vez
   * ejecutada esta decisión. Es lo que va a `link.localFingerprint`. En `NOTHING` y `PUSH`,
   * donde no se corrige nada del padrón, es idéntica a `local`.
   */
  localAfterChanges: string;
};

export type MergeDecision =
  | { kind: "CREATE"; fingerprints: MergeFingerprints }
  | { kind: "NOTHING"; fingerprints: MergeFingerprints }
  | { kind: "PUSH"; values: FieldValues; fingerprints: MergeFingerprints }
  | { kind: "PULL"; changes: Partial<FieldValues>; fingerprints: MergeFingerprints }
  | {
      kind: "BOTH";
      values: FieldValues;
      changes: Partial<FieldValues>;
      fingerprints: MergeFingerprints;
    };

export function decideForPerson(input: MergeInput): MergeDecision {
  // La huella de AHORA se calcula acá, de los valores que el módulo tiene delante, en vez de
  // creerle a `localFingerprint` / `remoteFingerprint`. Es gratis (el módulo es puro y la
  // función está a mano) y cierra de raíz toda una familia de errores del llamador: una huella
  // que no describe a los valores que la acompañan hace que el módulo se equivoque de dueño y
  // pise el cambio del otro lado.
  const huellaLocalActual = fieldFingerprintsOf(input.local);

  // Sin vínculo y sin contacto: hay que crearlo.
  if (!input.link && !input.remote) {
    return {
      kind: "CREATE",
      fingerprints: {
        local: huellaLocalActual,
        remote: null,
        localAfterChanges: huellaLocalActual,
      },
    };
  }

  // Había vínculo y el contacto ya no está: alguien lo borró en Google a propósito.
  // No se recrea. Que el vínculo quede marcado es tarea de `sync.ts`, no de acá.
  if (!input.remote) {
    return {
      kind: "NOTHING",
      fingerprints: {
        local: huellaLocalActual,
        remote: null,
        localAfterChanges: huellaLocalActual,
      },
    };
  }

  const huellaRemotaActual = fieldFingerprintsOf(input.remote);

  // ¿Tocó cada lado ESTE campo desde la corrida anterior? Con precisión de campo, y con un
  // tercer estado —"no se sabe"— que no se confunde con "no lo tocó". Ver `fieldChangeReader`.
  const tocoElPadron = fieldChangeReader(input.link?.localFingerprint ?? null, huellaLocalActual);
  const tocoGoogle = fieldChangeReader(input.link?.remoteFingerprint ?? null, huellaRemotaActual);

  const pullables = new Set(input.pullableFields);
  const remoteGanaElEmpate =
    input.remoteUpdatedAt !== null &&
    input.remoteUpdatedAt.getTime() > input.localUpdatedAt.getTime();

  const changes: Partial<FieldValues> = {};
  const finales: FieldValues = { ...input.local };

  for (const campo of SYNCABLE_FIELDS) {
    const valorRemoto = input.remote[campo] ?? null;
    const valorLocal = input.local[campo] ?? null;
    // La comparación usa la MISMA normalización que la huella (ver `sameFieldValue`). Con
    // `===` a secas, un `""` del padrón contra el `null` que devuelve siempre `readFieldValues`
    // —o un espacio de más— se leía como una diferencia eterna: las huellas decían "nadie tocó
    // nada", así que nunca se resolvía y se empujaba a Google en cada corrida.
    if (sameFieldValue(valorRemoto, valorLocal)) continue;

    // Un campo que el módulo no acepta corregir nunca viaja de Google al padrón: el valor
    // local se mantiene y el push lo restituye del lado de Google.
    if (!pullables.has(campo)) continue;

    // Acá se resuelve el "no se sabe" (`null`), y se resuelve ASIMÉTRICO a propósito: es la
    // regla del spec —ante la duda gana FOTOFFICE, que es el registro— aplicada campo por
    // campo. Google tiene que probar que tocó el campo para llevárselo; del padrón, mientras
    // no se pueda probar lo contrario, se asume que sí lo tocó, así un cambio de Google sobre
    // ese mismo campo tiene que ganarse el lugar por fecha en vez de pisarlo de prepo.
    const cambioEsteCampoLocal = tocoElPadron(campo) ?? true;
    const cambioEsteCampoRemoto = tocoGoogle(campo) ?? false;

    // Difieren y el campo es corregible. ¿Quién tiene razón?
    // - Sólo Google tocó este campo → gana Google, sin mirar reloj.
    // - Sólo el padrón lo tocó → gana el padrón, sin mirar reloj.
    // - Los dos lo tocaron (conflicto real) → desempata la fecha, y si Google no informa
    //   cuándo, gana el padrón, que es el registro.
    // Una sola fórmula cubre los tres casos: si Google no lo tocó, el resultado es `false`
    // sin más (no hace falta preguntar si el padrón lo tocó); si sí lo tocó, el resultado es
    // "el padrón no lo tocó" o, si lo tocaron los dos, "ganó la fecha".
    const loTrajoGoogle = cambioEsteCampoRemoto && (!cambioEsteCampoLocal || remoteGanaElEmpate);

    if (loTrajoGoogle) {
      // Lo que entra al padrón entra NORMALIZADO, con el mismo criterio que usa la huella: un
      // "  342 5557777  " de Google no ensucia el dato del socio. Vacío en cualquiera de sus
      // formas entra como `null`, que es lo que la base guarda para "no hay dato".
      const valorNormalizado = normalizeFieldValue(valorRemoto) || null;
      changes[campo] = valorNormalizado;
      finales[campo] = valorNormalizado;
    }
  }

  const hayQueTraer = Object.keys(changes).length > 0;
  // Si después de resolver quedó algo distinto en Google, hay que escribirlo allá. Misma
  // normalización que arriba, por la misma razón: un `""` contra un `null` no es una
  // diferencia que justifique una escritura.
  const hayQueEmpujar = SYNCABLE_FIELDS.some(
    (campo) => !sameFieldValue(finales[campo], input.remote?.[campo]),
  );

  const fingerprints: MergeFingerprints = {
    local: huellaLocalActual,
    remote: huellaRemotaActual,
    // Cómo queda el padrón una vez aplicados los `changes`. Sin `changes`, `finales` es una
    // copia de `local` y esta huella es la misma que `local`.
    localAfterChanges: hayQueTraer ? fieldFingerprintsOf(finales) : huellaLocalActual,
  };

  if (hayQueTraer && hayQueEmpujar) {
    return { kind: "BOTH", values: finales, changes, fingerprints };
  }
  if (hayQueTraer) return { kind: "PULL", changes, fingerprints };
  if (hayQueEmpujar) return { kind: "PUSH", values: finales, fingerprints };
  return { kind: "NOTHING", fingerprints };
}
