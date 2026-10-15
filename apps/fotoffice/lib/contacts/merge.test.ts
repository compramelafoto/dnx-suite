import { describe, expect, it } from "vitest";
import { fieldFingerprintsOf, fingerprintOf } from "./fingerprint";
import { SYNCABLE_FIELDS, type FieldValues, type SyncableField } from "./person";
import { decideForPerson, type MergeInput } from "./merge";

const VACIO: FieldValues = {
  firstName: null,
  lastName: null,
  email: null,
  phone: null,
  address: null,
  city: null,
  province: null,
  postalCode: null,
  birthDate: null,
};

const valores = (over: Partial<FieldValues> = {}): FieldValues => ({
  ...VACIO,
  firstName: "Ana",
  lastName: "Pérez",
  email: "ana@ejemplo.com",
  phone: "342 5550000",
  ...over,
});

/** Todos menos los institucionales, que no vuelven nunca. */
const PULLABLES = SYNCABLE_FIELDS;

const AYER = new Date("2026-09-15T10:00:00Z");
const HOY = new Date("2026-09-16T10:00:00Z");

/** Un caso ya sincronizado y quieto: las dos huellas coinciden con lo guardado. */
function sincronizado(over: Partial<MergeInput> = {}): MergeInput {
  const local = valores();
  const remote = valores();
  return {
    local,
    localFingerprint: fieldFingerprintsOf(local),
    localUpdatedAt: AYER,
    remote,
    remoteFingerprint: fieldFingerprintsOf(remote),
    remoteUpdatedAt: AYER,
    link: {
      localFingerprint: fieldFingerprintsOf(local),
      remoteFingerprint: fieldFingerprintsOf(remote),
    },
    pullableFields: PULLABLES,
    ...over,
  };
}

/** La huella por campo de una corrida que todavía NO sincronizaba ese campo. */
function huellaSin(campo: SyncableField, v: FieldValues): string {
  const resto: Record<string, string | null> = { ...v };
  delete resto[campo];
  return fieldFingerprintsOf(resto);
}

describe("qué hacer con cada persona", () => {
  it("una persona sin contacto todavía se crea", () => {
    const d = decideForPerson(sincronizado({ link: null, remote: null, remoteFingerprint: null }));
    expect(d.kind).toBe("CREATE");
  });

  it("si no cambió nada, no se llama a Google", () => {
    // Es el caso normal: con 200 socios quietos, una corrida no escribe nada.
    expect(decideForPerson(sincronizado()).kind).toBe("NOTHING");
  });

  it("cambió solo el padrón: se empuja", () => {
    const local = valores({ phone: "342 5559999" });
    const d = decideForPerson(
      sincronizado({ local, localFingerprint: fieldFingerprintsOf(local), localUpdatedAt: HOY }),
    );
    expect(d.kind).toBe("PUSH");
    expect(d.kind === "PUSH" && d.values.phone).toBe("342 5559999");
  });

  it("cambió solo Google: se trae, y solo lo que cambió", () => {
    const remote = valores({ phone: "342 5558888" });
    const d = decideForPerson(
      sincronizado({
        remote,
        remoteFingerprint: fieldFingerprintsOf(remote),
        remoteUpdatedAt: HOY,
      }),
    );
    expect(d.kind).toBe("PULL");
    expect(d.kind === "PULL" && d.changes).toEqual({ phone: "342 5558888" });
  });

  it("un campo que el módulo NO acepta corregir se vuelve a empujar", () => {
    // Alguien le cambió el apellido al contacto en el celular y el módulo no acepta que el
    // apellido venga de afuera: gana el padrón y la corrida lo restituye.
    const remote = valores({ lastName: "Otro" });
    const pullables: readonly SyncableField[] = ["email", "phone"];
    const d = decideForPerson(
      sincronizado({
        remote,
        remoteFingerprint: fieldFingerprintsOf(remote),
        remoteUpdatedAt: HOY,
        pullableFields: pullables,
      }),
    );
    expect(d.kind).toBe("PUSH");
    expect(d.kind === "PUSH" && d.values.lastName).toBe("Pérez");
  });

  it("campos distintos de cada lado: se aplican los dos, ninguno se pisa", () => {
    const local = valores({ phone: "342 5559999" });
    const remote = valores({ email: "nuevo@ejemplo.com" });
    const d = decideForPerson(
      sincronizado({
        local,
        localFingerprint: fieldFingerprintsOf(local),
        localUpdatedAt: HOY,
        remote,
        remoteFingerprint: fieldFingerprintsOf(remote),
        remoteUpdatedAt: HOY,
      }),
    );
    expect(d.kind).toBe("BOTH");
    expect(d.kind === "BOTH" && d.changes).toEqual({ email: "nuevo@ejemplo.com" });
    // El push lleva el estado final: el mail que vino de Google y el teléfono del padrón.
    expect(d.kind === "BOTH" && d.values).toMatchObject({
      email: "nuevo@ejemplo.com",
      phone: "342 5559999",
    });
  });

  it("el MISMO campo cambiado de los dos lados: gana el más reciente", () => {
    const local = valores({ phone: "342 5559999" });
    const remote = valores({ phone: "342 5558888" });
    const d = decideForPerson(
      sincronizado({
        local,
        localFingerprint: fieldFingerprintsOf(local),
        localUpdatedAt: AYER,
        remote,
        remoteFingerprint: fieldFingerprintsOf(remote),
        remoteUpdatedAt: HOY,
      }),
    );
    expect(d.kind).toBe("PULL");
    expect(d.kind === "PULL" && d.changes.phone).toBe("342 5558888");
  });

  it("el mismo campo, y el padrón es el más reciente: gana el padrón", () => {
    const local = valores({ phone: "342 5559999" });
    const remote = valores({ phone: "342 5558888" });
    const d = decideForPerson(
      sincronizado({
        local,
        localFingerprint: fieldFingerprintsOf(local),
        localUpdatedAt: HOY,
        remote,
        remoteFingerprint: fieldFingerprintsOf(remote),
        remoteUpdatedAt: AYER,
      }),
    );
    expect(d.kind).toBe("PUSH");
    expect(d.kind === "PUSH" && d.values.phone).toBe("342 5559999");
  });

  it("el mismo campo y Google no dice cuándo: gana FOTOFFICE, que es el registro", () => {
    const local = valores({ phone: "342 5559999" });
    const remote = valores({ phone: "342 5558888" });
    const d = decideForPerson(
      sincronizado({
        local,
        localFingerprint: fieldFingerprintsOf(local),
        localUpdatedAt: AYER,
        remote,
        remoteFingerprint: fieldFingerprintsOf(remote),
        remoteUpdatedAt: null,
      }),
    );
    expect(d.kind).toBe("PUSH");
    expect(d.kind === "PUSH" && d.values.phone).toBe("342 5559999");
  });

  it("hay vínculo pero el contacto ya no está en Google: no se recrea", () => {
    // Recrearlo sería desobedecer a quien lo borró a propósito.
    const d = decideForPerson(sincronizado({ remote: null, remoteFingerprint: null }));
    expect(d.kind).toBe("NOTHING");
  });

  it("primera corrida sobre un contacto que ya existía: se empuja sin perder nada", () => {
    // Sin huellas previas no se puede saber quién cambió. Ante la duda manda el padrón,
    // que es el registro — pero nunca se borra nada del contacto.
    const local = valores({ phone: "342 5559999" });
    const remote = valores({ email: "viejo@ejemplo.com" });
    const d = decideForPerson(
      sincronizado({
        local,
        localFingerprint: fieldFingerprintsOf(local),
        remote,
        remoteFingerprint: fieldFingerprintsOf(remote),
        link: null,
      }),
    );
    expect(d.kind).toBe("PUSH");
  });

  it("el caso que se perdía: el padrón toca dos campos y Google un tercero, y con la huella del conjunto se perdía el de Google", () => {
    // Este es el agujero que motiva la huella POR CAMPO. Con una sola huella por lado, la
    // corrida sólo sabe "cambió el padrón" y "cambió Google" — dos banderas globales, no una
    // por campo. Si el padrón toca nombre Y dirección en la misma corrida en que alguien
    // corrige el teléfono desde el celular (un campo de Google, distinto de los dos que tocó
    // el padrón), las tres diferencias quedan bajo las mismas dos banderas, y la única salida
    // es desempatar por fecha los tres campos por igual. Con el padrón más nuevo, ese
    // desempate global hace ganar al padrón los tres — incluido el teléfono, que el padrón
    // nunca tocó — y la corrección del celular se pierde en silencio en la próxima escritura.
    //
    // Comprobado a mano contra el código ingenuo de la propuesta original (una sola bandera
    // `loTrajoGoogle` global, sin ningún intento de aislar por campo): da exactamente eso,
    // `PUSH` con `values.phone` igual al teléfono VIEJO del padrón — el dato de Google
    // desaparece sin que nada lo avise.
    //
    // Con la huella por campo, nombre, dirección y teléfono se comparan cada uno contra SU
    // propia huella anterior: nombre y dirección se atribuyen al padrón con certeza (Google no
    // los tocó) y el teléfono se atribuye a Google con la misma certeza (el padrón no lo tocó),
    // sin que la fecha tenga que decidir nada. El resultado tiene que ser `BOTH`, con el
    // teléfono de Google conservado en `changes` y también en el estado final.
    const local = valores({ firstName: "Anita", address: "Nueva 123" });
    const remote = valores({ phone: "342 5557777" });
    const d = decideForPerson(
      sincronizado({
        local,
        localFingerprint: fieldFingerprintsOf(local),
        localUpdatedAt: HOY,
        remote,
        remoteFingerprint: fieldFingerprintsOf(remote),
        remoteUpdatedAt: AYER,
      }),
    );
    expect(d.kind).toBe("BOTH");
    expect(d.kind === "BOTH" && d.changes).toEqual({ phone: "342 5557777" });
    expect(d.kind === "BOTH" && d.values).toMatchObject({
      firstName: "Anita",
      address: "Nueva 123",
      phone: "342 5557777",
    });
  });

  it("cada lado cambió varios campos distintos, sin solaparse: se aplican todos, ninguno se pisa", () => {
    // Generalización del test anterior: dos campos de cada lado, ninguno en común. Cada uno
    // se atribuye por separado y con certeza — no hay ningún desempate por fecha de por medio.
    const local = valores({ firstName: "Anita", address: "Nueva 123" });
    const remote = valores({ phone: "342 5557777", email: "nuevo@ejemplo.com" });
    const d = decideForPerson(
      sincronizado({
        local,
        localFingerprint: fieldFingerprintsOf(local),
        localUpdatedAt: HOY,
        remote,
        remoteFingerprint: fieldFingerprintsOf(remote),
        remoteUpdatedAt: HOY,
      }),
    );
    expect(d.kind).toBe("BOTH");
    expect(d.kind === "BOTH" && d.changes).toEqual({
      phone: "342 5557777",
      email: "nuevo@ejemplo.com",
    });
    expect(d.kind === "BOTH" && d.values).toMatchObject({
      firstName: "Anita",
      address: "Nueva 123",
      phone: "342 5557777",
      email: "nuevo@ejemplo.com",
    });
  });

  it("varios campos cambiados de los dos lados con uno solo en común: el común desempata por fecha, los demás ganan por lado", () => {
    // El caso más general: el padrón toca nombre y teléfono; Google toca dirección y también
    // teléfono (el campo en común). Nombre y dirección se atribuyen sin mirar el reloj —cada
    // uno lo tocó un solo lado—; teléfono, que tocaron los dos, se resuelve por fecha como
    // cualquier conflicto real. Acá Google es más nuevo, así que gana su teléfono.
    const local = valores({ firstName: "Anita", phone: "342 5559999" });
    const remote = valores({ address: "Nueva 123", phone: "342 5557777" });
    const d = decideForPerson(
      sincronizado({
        local,
        localFingerprint: fieldFingerprintsOf(local),
        localUpdatedAt: AYER,
        remote,
        remoteFingerprint: fieldFingerprintsOf(remote),
        remoteUpdatedAt: HOY,
      }),
    );
    expect(d.kind).toBe("BOTH");
    expect(d.kind === "BOTH" && d.changes).toEqual({
      address: "Nueva 123",
      phone: "342 5557777",
    });
    expect(d.kind === "BOTH" && d.values).toMatchObject({
      firstName: "Anita",
      address: "Nueva 123",
      phone: "342 5557777",
    });
  });

  it("una huella guardada que esta versión no sabe leer no le entrega la decisión al reloj", () => {
    // La secuencia que se perdía, verificada:
    //
    // 1. Una corrida anterior dejó en `link` una huella con un formato que esta versión ya no
    //    entiende — la vieja del conjunto entero (40 hex, sin "="), un formato futuro, o un
    //    valor que la columna truncó. Ana tenía el teléfono 342 5550000 de los dos lados.
    // 2. Hoy el padrón CORRIGE el teléfono a 342 5559999. Google no tocó nada, pero su
    //    `updateTime` es más nuevo igual — que es lo normal, porque la última escritura en
    //    Google la hizo la sincronización misma, mientras que `localUpdatedAt` es de cuando se
    //    editó el socio.
    // 3. Como la huella no se puede leer, no se sabe qué campos tocó cada lado. El código
    //    caía entonces a una señal gruesa ("¿cambió algo de este lado?") que, con una huella
    //    ilegible, daba `true` para Google por comparar dos formatos distintos — y con el
    //    reloj a favor, Google se llevaba TODO.
    // 4. Resultado real: `PULL {"phone":"342 5550000"}`. La corrección del padrón se revertía
    //    al valor viejo de Google y encima se escribía ese valor viejo en la base. En silencio.
    //
    // Ojo con el argumento de que esto "ya era el comportamiento conservador de la primera
    // corrida": no lo era. Con `link: null` esa señal gruesa da `false` por construcción y
    // Google no puede ganar nunca; con `link` presente y huella ilegible daba `true` y Google
    // ganaba todo lo que el reloj le concediera. Esa diferencia era exactamente la pérdida.
    //
    // La regla del spec para lo que no se puede atribuir es una sola: gana FOTOFFICE, que es
    // el registro. Con eso, el camino degradado da lo mismo que el de la primera corrida.
    const local = valores({ phone: "342 5559999" });
    const remote = valores();
    const d = decideForPerson(
      sincronizado({
        local,
        localFingerprint: fieldFingerprintsOf(local),
        localUpdatedAt: AYER,
        remote,
        remoteFingerprint: fieldFingerprintsOf(remote),
        remoteUpdatedAt: HOY,
        link: {
          // Huellas del formato VIEJO (del conjunto entero): ilegibles para esta versión.
          localFingerprint: fingerprintOf(valores()),
          remoteFingerprint: fingerprintOf(valores()),
        },
      }),
    );
    expect(d.kind).toBe("PUSH");
    expect(d.kind === "PUSH" && d.values.phone).toBe("342 5559999");
  });

  it("si el llamador no trae la huella de Google pero el contacto está, se calcula acá y no se pisa nada", () => {
    // La secuencia que se perdía, verificada:
    //
    // 1. Hay `link` de una corrida anterior y el contacto existe en Google.
    // 2. Alguien corrige el teléfono desde el celular: Google queda con 342 5557777 y un
    //    `updateTime` de hoy. El padrón no tocó nada.
    // 3. El llamador pasa `remoteFingerprint: null` — el tipo lo permite sin advertencia
    //    (`remote: FieldValues` junto a `remoteFingerprint: null`) y el comentario del campo
    //    no decía cuándo podía ser `null`.
    // 4. Resultado real: `PUSH` con `phone: 342 5550000`. El teléfono viejo del padrón se
    //    escribía encima del nuevo de Google, porque sin huella remota el módulo daba por
    //    hecho que Google no había tocado nada.
    //
    // El módulo es puro y tiene `fieldFingerprintsOf` a mano: con `remote` presente, la huella
    // se calcula acá en vez de degradarse. No hace falta que el llamador la traiga.
    const remote = valores({ phone: "342 5557777" });
    const d = decideForPerson(
      sincronizado({
        remote,
        remoteFingerprint: null,
        remoteUpdatedAt: HOY,
      }),
    );
    expect(d.kind).toBe("PULL");
    expect(d.kind === "PULL" && d.changes).toEqual({ phone: "342 5557777" });
  });

  it("con nadie tocando nada, un vacío escrito distinto de cada lado no dispara una escritura", () => {
    // La secuencia que se perdía, verificada. Acá no se pierde un dato: se pierde el NOTHING,
    // que es la promesa del test "si no cambió nada, no se llama a Google".
    //
    // 1. El padrón guarda `city: ""` y `firstName: "Ana "`. Google devuelve `city: null` —que
    //    es lo que devuelve SIEMPRE `readFieldValues`, por su `limpio()`— y `firstName: "Ana"`.
    // 2. Nadie tocó nada de ningún lado: las huellas de los dos lados coinciden con las
    //    guardadas, porque la huella normaliza (`trim`, y `null`/`""`/ausente son un solo
    //    estado).
    // 3. Pero el módulo comparaba los valores en CRUDO (`===`), así que `""` contra `null` y
    //    `"Ana "` contra `"Ana"` figuraban como diferencias.
    // 4. Resultado real: `PUSH` en vez de `NOTHING`. Y como las huellas seguían diciendo "no
    //    cambió nada", la diferencia no se resolvía NUNCA: se empujaba en cada corrida, para
    //    siempre, por cada socio con un `""` o un espacio de más en la base. Quema cuota de la
    //    API y —lo peor— le renueva el `updateTime` al contacto de Google, que es el único
    //    dato con el que después se desempatan los conflictos de verdad.
    //
    // Este es además el caso que le faltaba al test "si no cambió nada, no se llama a Google":
    // ese pasa incluso con la lógica de huellas rota, porque los valores son idénticos y el
    // bucle nunca entra. Acá los valores DIFIEREN y ningún lado los tocó.
    const local = valores({ city: "", firstName: "Ana " });
    const remote = valores({ city: null, firstName: "Ana" });
    const d = decideForPerson(
      sincronizado({
        local,
        localFingerprint: fieldFingerprintsOf(local),
        remote,
        remoteFingerprint: fieldFingerprintsOf(remote),
        link: {
          localFingerprint: fieldFingerprintsOf(local),
          remoteFingerprint: fieldFingerprintsOf(remote),
        },
      }),
    );
    expect(d.kind).toBe("NOTHING");
  });

  it("una huella del padrón que no describe al padrón no le regala el campo a Google", () => {
    // El cuarto camino, simétrico al de `remoteFingerprint: null` y encontrado auditando: el
    // tipo tampoco garantiza que `localFingerprint` describa a `local`.
    //
    // 1. La corrida lee al socio y calcula su huella; entre esa lectura y la decisión, el
    //    padrón queda con el teléfono corregido a 342 5559999 (una huella calculada antes de
    //    la última edición, un dato leído de una caché, dos consultas distintas).
    // 2. Google, en paralelo, tiene 342 5558888 y un `updateTime` MÁS VIEJO que el del socio.
    // 3. Con la huella vieja, el módulo concluía "el padrón no tocó el teléfono" y, como
    //    Google sí lo tocó, se lo daba a Google sin mirar el reloj.
    // 4. Resultado real: `PULL {"phone":"342 5558888"}` — la corrección del padrón, que
    //    además era la más reciente, se revertía.
    //
    // La huella de AHORA se calcula de `local`, que es el dato que el módulo tiene delante:
    // así el conflicto se reconoce como tal y lo resuelve la fecha, que acá favorece al padrón.
    const local = valores({ phone: "342 5559999" });
    const remote = valores({ phone: "342 5558888" });
    const d = decideForPerson(
      sincronizado({
        local,
        // La huella de ANTES de la corrección: no describe a `local`.
        localFingerprint: fieldFingerprintsOf(valores()),
        localUpdatedAt: HOY,
        remote,
        remoteFingerprint: fieldFingerprintsOf(remote),
        remoteUpdatedAt: AYER,
      }),
    );
    expect(d.kind).toBe("PUSH");
    expect(d.kind === "PUSH" && d.values.phone).toBe("342 5559999");
  });
  it("un campo que se suma al conjunto sincronizado no le borra el dato al padrón", () => {
    // El quinto camino, y el único que quedaba abierto. La secuencia, medida:
    //
    // 1. La corrida anterior guardó en `link` una huella por campo que NO tiene entrada para
    //    `birthDate`: esa versión todavía no sincronizaba la fecha de nacimiento (o el conjunto
    //    `SYNCABLE_FIELDS` creció después, que es exactamente lo que va a pasar cuando la
    //    etapa 2 sume los módulos de Reservas y Cursos).
    // 2. Hoy el padrón tiene `birthDate: "1985-04-12"` y el contacto de Google no tiene fecha.
    // 3. La comparación de huellas contaba como "cambiado" todo campo que apareciera en una
    //    sola de las dos huellas. `birthDate` aparece sólo en la actual, y eso pasa de los DOS
    //    lados a la vez — porque a las dos huellas guardadas les falta la misma entrada.
    // 4. Se fabricaba así un conflicto que nunca existió. Lo desempataba la fecha, y
    //    `remoteUpdatedAt` es casi siempre más nuevo, porque la última escritura en Google la
    //    hizo la sincronización misma.
    // 5. Resultado real: `PULL {"birthDate": null}`. Se borraba la fecha de nacimiento del
    //    socio en la base, sin que nada lo avisara.
    //
    // Un campo SIN entrada en la huella guardada no es "lo tocaron los dos": es "no hay con
    // qué comparar ese campo", y eso cae a la regla del spec — gana FOTOFFICE, que es el
    // registro. Acá eso significa conservar la fecha y escribirla en Google.
    const local = valores({ birthDate: "1985-04-12" });
    const remote = valores({ birthDate: null });
    const d = decideForPerson(
      sincronizado({
        local,
        localFingerprint: fieldFingerprintsOf(local),
        localUpdatedAt: AYER,
        remote,
        remoteFingerprint: fieldFingerprintsOf(remote),
        remoteUpdatedAt: HOY,
        link: {
          // Las huellas de una corrida que todavía no sincronizaba `birthDate`.
          localFingerprint: huellaSin("birthDate", valores()),
          remoteFingerprint: huellaSin("birthDate", valores()),
        },
      }),
    );
    expect(d.kind).toBe("PUSH");
    expect(d.kind === "PUSH" && d.values.birthDate).toBe("1985-04-12");
  });

  it("la decisión expone las huellas que el módulo usó, no las que trajo el llamador", () => {
    // El contrato con la Tarea 9. El módulo recalcula las huellas adentro y decide con ésas.
    // Si quien consume la decisión guardara en `link` las huellas que calculó por su cuenta
    // —las mismas que el módulo descartó por desactualizadas—, el `link` de la corrida
    // siguiente describiría un estado que nunca existió, y la atribución de la corrida
    // siguiente saldría mal. Por eso la decisión las devuelve.
    const local = valores({ phone: "342 5559999" });
    const remote = valores({ email: "nuevo@ejemplo.com" });
    const d = decideForPerson(
      sincronizado({
        local,
        // Huellas del llamador que no describen a los valores que las acompañan.
        localFingerprint: "huella-que-no-describe-al-padron",
        localUpdatedAt: HOY,
        remote,
        remoteFingerprint: "huella-que-no-describe-a-google",
        remoteUpdatedAt: AYER,
      }),
    );
    expect(d.fingerprints.local).toBe(fieldFingerprintsOf(local));
    expect(d.fingerprints.remote).toBe(fieldFingerprintsOf(remote));
    expect(d.fingerprints.local).not.toBe("huella-que-no-describe-al-padron");
    expect(d.fingerprints.remote).not.toBe("huella-que-no-describe-a-google");
  });

  it("después de traer un cambio, la huella a guardar es la del padrón ya corregido", () => {
    // El otro medio del contrato: en un PULL el padrón queda distinto de como entró, así que
    // la huella local que va a `link` no es la del padrón de antes sino la del padrón ya
    // corregido. Guardar la de antes haría que la corrida siguiente crea que el padrón acaba
    // de tocar ese campo, y lo pondría a competir contra Google por fecha sin motivo.
    const remote = valores({ phone: "342 5558888" });
    const d = decideForPerson(
      sincronizado({
        remote,
        remoteFingerprint: fieldFingerprintsOf(remote),
        remoteUpdatedAt: HOY,
      }),
    );
    expect(d.kind).toBe("PULL");
    expect(d.fingerprints.localAfterChanges).toBe(
      fieldFingerprintsOf(valores({ phone: "342 5558888" })),
    );
    expect(d.fingerprints.localAfterChanges).not.toBe(d.fingerprints.local);
  });

  it("lo que se trae de Google entra normalizado al padrón", () => {
    // Menor, pero ensucia el dato del socio: Google devuelve el teléfono con espacios de más
    // —"  342 5557777  "— y el `PULL` lo escribía tal cual en la base. No genera empuje eterno,
    // porque `sameFieldValue` después lo iguala, pero el padrón queda con basura adentro.
    // Lo que entra al padrón entra con la misma normalización que usa la huella.
    const remote = valores({ phone: "  342 5557777  " });
    const d = decideForPerson(
      sincronizado({
        remote,
        remoteFingerprint: fieldFingerprintsOf(remote),
        remoteUpdatedAt: HOY,
      }),
    );
    expect(d.kind).toBe("PULL");
    expect(d.kind === "PULL" && d.changes).toEqual({ phone: "342 5557777" });
  });
});
