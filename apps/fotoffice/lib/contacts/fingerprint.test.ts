import { describe, expect, it } from "vitest";
import {
  fieldChangeReader,
  fieldFingerprintsOf,
  fieldsThatDiffer,
  fingerprintOf,
  normalizeFieldValue,
  readFieldFingerprints,
  sameFieldValue,
} from "./fingerprint";

describe("la huella de un juego de datos", () => {
  it("dos veces los mismos datos dan la misma huella", () => {
    expect(fingerprintOf({ a: "1", b: "2" })).toBe(fingerprintOf({ a: "1", b: "2" }));
  });

  it("el orden en que vienen los campos no cambia la huella", () => {
    // Si el orden contara, cambiar el orden de una consulta haría creer que todo cambió y
    // la corrida siguiente reescribiría el padrón entero en Google.
    expect(fingerprintOf({ a: "1", b: "2" })).toBe(fingerprintOf({ b: "2", a: "1" }));
  });

  it("un dato distinto da una huella distinta", () => {
    expect(fingerprintOf({ a: "1" })).not.toBe(fingerprintOf({ a: "2" }));
  });

  it("vacío, null y ausente son lo mismo", () => {
    // El padrón guarda "" donde Google devuelve ausencia. Tratarlos distinto haría que cada
    // corrida creyera que hubo un cambio y escribiera para siempre.
    const base = fingerprintOf({ a: "1", b: null });
    expect(fingerprintOf({ a: "1", b: "" })).toBe(base);
    expect(fingerprintOf({ a: "1" })).toBe(base);
    expect(fingerprintOf({ a: "1", b: undefined })).toBe(base);
  });

  it("los espacios de más no cuentan", () => {
    expect(fingerprintOf({ a: "  Ana  " })).toBe(fingerprintOf({ a: "Ana" }));
  });

  it("la concatenación sin separador es ambigua: dos pares distintos dan el mismo texto", () => {
    // Sin separador, "a=1b=2b=3" viene de dos fuentes distintas:
    // 1. {a:"1b=2", b:"3"} → ["a=1b=2", "b=3"] → "a=1b=2b=3"
    // 2. {a:"1", b:"2b=3"}  → ["a=1", "b=2b=3"] → "a=1b=2b=3"
    // El separador Unit Separator () impide esa ambigüedad.
    expect(fingerprintOf({ a: "1b=2", b: "3" })).not.toBe(
      fingerprintOf({ a: "1", b: "2b=3" })
    );
  });

  it("es corta: se guarda en cada fila de la base", () => {
    expect(fingerprintOf({ a: "1" })).toHaveLength(40);
  });
});

describe("la huella por campo", () => {
  // Es la que reemplaza a `fingerprintOf` adentro de `link`: en vez de una huella del
  // conjunto entero, una entrada por campo — así se sabe con exactitud CUÁL campo cambió,
  // no sólo que "algo" cambió de ese lado.

  it("dos veces los mismos valores dan la misma huella por campo", () => {
    expect(fieldFingerprintsOf({ a: "1", b: "2" })).toBe(fieldFingerprintsOf({ a: "1", b: "2" }));
  });

  it("un solo campo distinto cambia sólo la entrada de ESE campo", () => {
    // Es la propiedad que hace falta para atribuir por campo: cambiar "b" no puede alterar
    // la entrada de "a", porque si no, un cambio ajeno haría creer que "a" también cambió.
    const base = fieldFingerprintsOf({ a: "1", b: "2" });
    const conBCambiado = fieldFingerprintsOf({ a: "1", b: "9" });
    const mapaBase = readFieldFingerprints(base);
    const mapaCambiado = readFieldFingerprints(conBCambiado);
    expect(mapaCambiado?.a).toBe(mapaBase?.a);
    expect(mapaCambiado?.b).not.toBe(mapaBase?.b);
  });

  it("vacío, null y ausente son el mismo estado también acá", () => {
    // Reusa la misma normalización que `fingerprintOf` — no se reinventa.
    const base = readFieldFingerprints(fieldFingerprintsOf({ a: "1", b: null }));
    expect(readFieldFingerprints(fieldFingerprintsOf({ a: "1", b: "" }))).toEqual(base);
    expect(readFieldFingerprints(fieldFingerprintsOf({ a: "1", b: undefined }))).toEqual(base);
    expect(readFieldFingerprints(fieldFingerprintsOf({ a: " 1 ", b: null }))).toEqual(base);
  });

  it("leer una huella por campo devuelve el mapa campo → hash", () => {
    const mapa = readFieldFingerprints(fieldFingerprintsOf({ phone: "342 5550000", email: "a@b.com" }));
    expect(mapa).not.toBeNull();
    expect(Object.keys(mapa ?? {}).sort()).toEqual(["email", "phone"]);
  });

  it("una huella que no tiene el formato esperado es 'no comparable'", () => {
    // La huella VIEJA del conjunto entero (40 hex, sin "=") es el caso real: no hay que
    // migrar nada porque esto no se desplegó todavía, pero si algo raro llega, no se inventa
    // una respuesta — se admite que no se puede comparar.
    expect(readFieldFingerprints("a".repeat(40))).toBeNull();
    expect(readFieldFingerprints("")).toBeNull();
    expect(readFieldFingerprints("esto no tiene la forma campo=hash")).toBeNull();
  });

  it("fieldsThatDiffer dice con exactitud cuáles campos cambiaron, y ninguno más", () => {
    const antes = fieldFingerprintsOf({ firstName: "Ana", phone: "1", email: "a@b.com" });
    const despues = fieldFingerprintsOf({ firstName: "Ana", phone: "2", email: "a@b.com" });
    expect(fieldsThatDiffer(antes, despues)).toEqual(["phone"]);
  });

  it("fieldsThatDiffer da lista vacía cuando no cambió nada", () => {
    const huella = fieldFingerprintsOf({ a: "1", b: "2" });
    expect(fieldsThatDiffer(huella, huella)).toEqual([]);
  });

  it("fieldsThatDiffer es null si cualquiera de las dos huellas no es comparable", () => {
    const valida = fieldFingerprintsOf({ a: "1" });
    expect(fieldsThatDiffer(valida, "huella-vieja-del-conjunto")).toBeNull();
    expect(fieldsThatDiffer("huella-vieja-del-conjunto", valida)).toBeNull();
  });
});

describe("comparar dos valores con el mismo criterio que la huella", () => {
  // Existe porque quien compara valores sueltos —`merge.ts`— tiene que usar exactamente la
  // misma normalización que la huella. Si la huella dice "nadie tocó nada" y la comparación
  // dice "son distintos", el módulo escribe en Google una diferencia que no se resuelve nunca.

  it("un vacío escrito de cualquiera de las tres formas es el mismo valor", () => {
    // Es el caso real: el padrón guarda "" donde `readFieldValues` devuelve SIEMPRE null.
    expect(sameFieldValue("", null)).toBe(true);
    expect(sameFieldValue(null, undefined)).toBe(true);
    expect(sameFieldValue("   ", null)).toBe(true);
  });

  it("el espacio de más no hace a dos valores distintos, pero el dato distinto sí", () => {
    expect(sameFieldValue("Ana ", "Ana")).toBe(true);
    expect(sameFieldValue("Ana", "Ana María")).toBe(false);
    expect(normalizeFieldValue("  Ana  ")).toBe("Ana");
    expect(normalizeFieldValue(null)).toBe("");
  });

  it("dos valores iguales para `sameFieldValue` dan la misma entrada de huella, siempre", () => {
    // La propiedad que hace falta: las dos funciones no pueden discrepar nunca. Si discrepan,
    // vuelve el empuje eterno.
    const pares: [string | null | undefined, string | null | undefined][] = [
      ["", null],
      ["Ana ", "Ana"],
      ["   ", undefined],
      [" 342 5550000 ", "342 5550000"],
    ];
    for (const [a, b] of pares) {
      expect(sameFieldValue(a, b)).toBe(true);
      expect(fieldFingerprintsOf({ campo: a })).toBe(fieldFingerprintsOf({ campo: b }));
    }
  });
});

describe("atribuir un cambio a un lado, campo por campo", () => {
  // `fieldsThatDiffer` contesta "¿en qué se distinguen estos dos textos?". Acá se contesta otra
  // pregunta, que es la que decide: "¿tocó este lado este campo?" — con un tercer estado, "no
  // se puede saber", que no se confunde con "no lo tocó".

  it("con las dos entradas presentes dice si lo tocó o no", () => {
    const antes = fieldFingerprintsOf({ firstName: "Ana", phone: "1" });
    const despues = fieldFingerprintsOf({ firstName: "Ana", phone: "2" });
    const leer = fieldChangeReader(antes, despues);
    expect(leer("phone")).toBe(true);
    expect(leer("firstName")).toBe(false);
  });

  it("un campo sin entrada en la huella guardada es 'no se sabe', no 'lo tocó'", () => {
    // El día en que el conjunto de campos sincronizables CRECE, el campo nuevo no tiene
    // entrada en la huella guardada de NINGUNO de los dos lados. Contarlo como "cambiado"
    // lo hace aparecer cambiado de los dos lados a la vez: un conflicto fabricado, que
    // desempata la fecha y que casi siempre gana Google. Eso borraba el dato del padrón.
    const antes = fieldFingerprintsOf({ firstName: "Ana" });
    const despues = fieldFingerprintsOf({ firstName: "Ana", birthDate: "1985-04-12" });
    expect(fieldChangeReader(antes, despues)("birthDate")).toBeNull();
    // Para el mismo par de huellas, `fieldsThatDiffer` sí lo cuenta como diferente: son dos
    // preguntas distintas, y por eso la atribución no puede salir de ahí.
    expect(fieldsThatDiffer(antes, despues)).toEqual(["birthDate"]);
  });

  it("un campo sin entrada en la huella actual también es 'no se sabe'", () => {
    // El caso espejo: los valores de esta corrida no traen el campo (el conjunto se achicó, o
    // llegaron incompletos). Tampoco hay con qué compararlo.
    const antes = fieldFingerprintsOf({ firstName: "Ana", birthDate: "1985-04-12" });
    const despues = fieldFingerprintsOf({ firstName: "Ana" });
    expect(fieldChangeReader(antes, despues)("birthDate")).toBeNull();
  });

  it("sin corrida anterior, o con una huella ilegible, no se sabe nada de ningún campo", () => {
    const actual = fieldFingerprintsOf({ firstName: "Ana", phone: "1" });
    expect(fieldChangeReader(null, actual)("phone")).toBeNull();
    expect(fieldChangeReader("huella-vieja-del-conjunto", actual)("phone")).toBeNull();
  });

  it("dos huellas idénticas dicen 'no cambió nada', aunque no se entienda el formato", () => {
    // Deducción sólida: si los dos textos son el mismo string, ese lado no tocó nada. Evita
    // caer al camino de la duda por una huella vieja que igual estaba diciendo eso.
    const vieja = "huella-vieja-del-conjunto";
    expect(fieldChangeReader(vieja, vieja)("phone")).toBe(false);
  });
});
