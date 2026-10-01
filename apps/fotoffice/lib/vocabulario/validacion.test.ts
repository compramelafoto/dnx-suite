import { describe, expect, it } from "vitest";
import { personVocabulary } from "./personas";
import { PALABRA_MAX, validarPalabras } from "./validacion";

/**
 * Lo que la pantalla de palabras acepta y lo que devuelve.
 *
 * La validación vive del lado del servidor y no en el `required` del HTML: una server action
 * es alcanzable por POST directo, así que el formulario no es un control de nada.
 */
describe("validarPalabras", () => {
  it("las dos palabras escritas se guardan tal cual", () => {
    const r = validarPalabras({ singular: "voluntario/a", plural: "voluntarios/as" });
    expect(r).toEqual({ ok: true, terminos: { singular: "voluntario/a", plural: "voluntarios/as" } });
  });

  it("los espacios de los costados se recortan antes de guardar", () => {
    const r = validarPalabras({ singular: "  alumno ", plural: " alumnos  " });
    expect(r).toEqual({ ok: true, terminos: { singular: "alumno", plural: "alumnos" } });
  });

  it("los dos campos vacíos significan volver a socio/socios", () => {
    // Es la forma de dar marcha atrás, y tiene que ser fácil: borrar los dos campos.
    expect(validarPalabras({ singular: "", plural: "" })).toEqual({ ok: true, terminos: null });
  });

  it("dos campos con solo espacios también son vacíos", () => {
    expect(validarPalabras({ singular: "   ", plural: "\t" })).toEqual({ ok: true, terminos: null });
  });

  it("un formulario que nunca mandó los campos no rompe", () => {
    expect(validarPalabras({ singular: undefined, plural: null })).toEqual({
      ok: true,
      terminos: null,
    });
  });

  it("guardar vacío NUNCA devuelve cadenas vacías para guardar", () => {
    // Una fila con "" haría que `personVocabulary` la tomara como configurada y dejara las
    // pantallas sin la palabra. Por eso el vacío se expresa como `null`, no como "".
    const r = validarPalabras({ singular: "", plural: "" });
    expect(r.ok && r.terminos).toBeNull();
  });

  it("escribir una sola de las dos se devuelve, no se guarda a medias", () => {
    const r = validarPalabras({ singular: "voluntario/a", plural: "" });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.error).toContain("las dos formas");
    // Y el mensaje dice cómo volver atrás, porque es el error más probable de quien
    // quiso borrar la configuración y borró un solo campo.
    expect(r.ok === false && r.error).toContain("vacíos");
  });

  it("escribir solo el plural tampoco alcanza", () => {
    expect(validarPalabras({ singular: "", plural: "voluntarios/as" }).ok).toBe(false);
  });

  it("una palabra con llaves se rechaza", () => {
    // El texto del sistema lleva marcadores {personas}: una palabra con llaves los
    // reinyectaría en el texto ya sustituido.
    const r = validarPalabras({ singular: "{persona}", plural: "{personas}" });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.error).toContain("llaves");
  });

  it("una palabra larguísima se rechaza", () => {
    const larga = "a".repeat(PALABRA_MAX + 1);
    const r = validarPalabras({ singular: larga, plural: "socios" });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.error).toContain(String(PALABRA_MAX));
  });

  it("una palabra justo en el límite se acepta", () => {
    const justa = "a".repeat(PALABRA_MAX);
    expect(validarPalabras({ singular: justa, plural: justa }).ok).toBe(true);
  });

  it("un salto de línea se rechaza", () => {
    const r = validarPalabras({ singular: "voluntario\na", plural: "voluntarios" });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.error).toContain("una sola línea");
  });

  it("lo que se acepta es exactamente lo que el vocabulario sabe usar", () => {
    // El puente entre las dos mitades: lo validado entra en `personVocabulary` sin
    // transformaciones intermedias.
    const r = validarPalabras({ singular: "voluntario/a", plural: "voluntarios/as" });
    const v = personVocabulary(r.ok ? r.terminos : null);
    expect(v.Plural).toBe("Voluntarios/as");
  });

  it("borrar todo deja el vocabulario por omisión", () => {
    const r = validarPalabras({ singular: "", plural: "" });
    const v = personVocabulary(r.ok ? r.terminos : null);
    expect(v.plural).toBe("socios");
  });
});
