import { describe, expect, it } from "vitest";
import { groupResults, matchEntries, normalize, queryTerms, MAX_RESULTS } from "./match";
import type { QuickSearchEntry } from "./types";

const entrada = (
  id: string,
  label: string,
  group: string,
  description?: string,
  keywords?: string[],
): QuickSearchEntry => ({ id, label, group, href: `/${id}`, description, keywords });

const MENU: QuickSearchEntry[] = [
  entrada("padron", "Padrón", "Socios", "Todos los socios, su estado y su ficha.", ["usuarios"]),
  entrada("cuotas", "Cuotas", "Socios", "Qué se debe, qué se cobró y qué se generó.", ["pagos", "morosos"]),
  entrada("carnets", "Carnets", "Socios", "Emisión de credenciales.", ["credencial"]),
  entrada("cobros", "Cobros", "Institución", "Cómo cobra la institución y con qué cuenta.", ["plata", "facturación"]),
  entrada("espacios", "Espacios", "Reservas", "Qué se alquila, cuándo y a qué precio.", ["salón"]),
  entrada("agenda", "Agenda", "Reservas", "Quién ocupa qué espacio esta semana.", ["turnos"]),
];

describe("normalize", () => {
  it("baja a minúsculas y saca los acentos", () => {
    expect(normalize("Cuótas")).toBe("cuotas");
    expect(normalize("PADRÓN")).toBe("padron");
  });
});

describe("matchEntries", () => {
  it("con la consulta vacía devuelve el menú completo, en su orden", () => {
    expect(matchEntries(MENU, "")).toEqual(MENU);
    expect(matchEntries(MENU, "   ")).toEqual(MENU);
  });

  it("encuentra sin importar acentos ni mayúsculas", () => {
    expect(matchEntries(MENU, "cuótas")[0]?.id).toBe("cuotas");
    expect(matchEntries(MENU, "CUOTAS")[0]?.id).toBe("cuotas");
  });

  it("encuentra por sinónimo", () => {
    expect(matchEntries(MENU, "plata")[0]?.id).toBe("cobros");
    expect(matchEntries(MENU, "facturacion")[0]?.id).toBe("cobros");
  });

  it("encuentra por descripción", () => {
    expect(matchEntries(MENU, "credenciales")[0]?.id).toBe("carnets");
  });

  it("el título le gana a la descripción", () => {
    // "espacio" está en el título de Espacios y en la descripción de Agenda.
    const r = matchEntries(MENU, "espacio");
    expect(r[0]?.id).toBe("espacios");
    expect(r.map((e) => e.id)).toContain("agenda");
  });

  it("con varias palabras se queda con las entradas que tienen todas", () => {
    expect(matchEntries(MENU, "socios cuotas").map((e) => e.id)).toEqual(["cuotas"]);
    expect(matchEntries(MENU, "res esp").map((e) => e.id)).toEqual(["espacios", "agenda"]);
  });

  it("no devuelve más de MAX_RESULTS", () => {
    const muchas = Array.from({ length: 20 }, (_, i) =>
      entrada(`i${i}`, `Ítem ${i}`, "Grupo", "Una descripción cualquiera."),
    );
    expect(matchEntries(muchas, "item")).toHaveLength(MAX_RESULTS);
  });

  it("devuelve vacío cuando no hay nada", () => {
    expect(matchEntries(MENU, "zzzz")).toEqual([]);
  });

  it("entiende una frase: descarta las palabras vacías", () => {
    expect(matchEntries(MENU, "¿dónde veo los morosos?")[0]?.id).toBe("cuotas");
    expect(matchEntries(MENU, "quiero alquilar el salón")[0]?.id).toBe("espacios");
  });

  it("si ninguna entrada tiene todas las palabras, trae las que tienen más", () => {
    expect(matchEntries(MENU, "turnos de mañana zzzz").map((e) => e.id)).toEqual(["agenda"]);
  });

  it("encuentra el singular escribiendo el plural", () => {
    expect(matchEntries(MENU, "credenciales")[0]?.id).toBe("carnets");
    expect(matchEntries(MENU, "salones")[0]?.id).toBe("espacios");
  });
});

describe("queryTerms", () => {
  it("normaliza, saca signos y palabras vacías y recorta plurales", () => {
    expect(queryTerms("¿Cómo cobro las cuotas?")).toEqual(["cobro", "cuota"]);
    expect(queryTerms("de")).toEqual(["de"]);
  });
});

describe("groupResults", () => {
  it("agrupa por sección en el orden de llegada", () => {
    const r = groupResults([MENU[3]!, MENU[0]!, MENU[1]!]);
    expect(r.map((g) => g.group)).toEqual(["Institución", "Socios"]);
    expect(r[1]?.entries.map((e) => e.id)).toEqual(["padron", "cuotas"]);
  });
});
