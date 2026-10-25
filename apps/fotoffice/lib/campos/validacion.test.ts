import { describe, expect, it } from "vitest";
import { claveDeCampo, textoLegible, validarNombreCampo, validarValor } from "./validacion";
import { ETIQUETA_TIPO_CAMPO, MAX_CAMPOS, TIPOS_CAMPO, TIPOS_REGISTRO, TIPOS_REGISTRO_ACTIVOS } from "./constantes";

const ok = (v: unknown) => ({ ok: true, valor: v });

describe("constantes", () => {
  it("tipos de registro y de campo", () => {
    expect(TIPOS_REGISTRO_ACTIVOS).toEqual(["CLIENTE", "SOCIO", "CONSULTA", "PROYECTO"]);
    // Sin repetir: los activos van primero y después los reservados.
    expect(TIPOS_REGISTRO).toEqual(["CLIENTE", "SOCIO", "CONSULTA", "PROYECTO", "PRESUPUESTO", "PEDIDO", "CONTRATO"]);
    expect(TIPOS_CAMPO).toEqual(["TEXTO", "TEXTO_LARGO", "NUMERO", "FECHA", "SI_NO", "LISTA", "ENLACE"]);
    for (const t of TIPOS_CAMPO) expect(ETIQUETA_TIPO_CAMPO[t]).toBeTruthy();
    expect(MAX_CAMPOS).toBe(40);
  });
});

describe("claveDeCampo", () => {
  it("minúsculas, sin acentos, con guion bajo", () => {
    expect(claveDeCampo("Archivos del Cliente")).toBe("archivos_del_cliente");
    expect(claveDeCampo("  Año de Ingreso / Nº  ")).toBe("ano_de_ingreso_n");
    expect(claveDeCampo("Ñandú!!!")).toBe("nandu");
  });
  it("tope de 40 sin guion colgando", () => {
    const k = claveDeCampo("a".repeat(39) + " bbbbbb");
    expect(k.length).toBeLessThanOrEqual(40);
    expect(k.endsWith("_")).toBe(false);
  });
  it("nombre sin letras ni números da 'campo'", () => {
    expect(claveDeCampo("???")).toBe("campo");
  });
});

describe("validarNombreCampo", () => {
  it("acepta y recorta", () => expect(validarNombreCampo("  Hijos ")).toBeNull());
  it("rechaza vacío, no texto y largo", () => {
    expect(validarNombreCampo("   ")).toMatch(/nombre/i);
    expect(validarNombreCampo(undefined)).toMatch(/nombre/i);
    expect(validarNombreCampo(42)).toMatch(/nombre/i);
    expect(validarNombreCampo("x".repeat(61))).toMatch(/60/);
    expect(validarNombreCampo("x".repeat(60))).toBeNull();
  });
});

describe("validarValor · vacío", () => {
  it("null, undefined, '' y espacios son vacío para todos los tipos", () => {
    for (const t of TIPOS_CAMPO) {
      for (const v of [null, undefined, "", "   "]) expect(validarValor(t, v, [])).toEqual(ok(null));
    }
  });
});

describe("validarValor · texto", () => {
  it("recorta y respeta el tope", () => {
    expect(validarValor("TEXTO", "  hola ", [])).toEqual(ok({ texto: "hola" }));
    expect(validarValor("TEXTO", "x".repeat(200), []).ok).toBe(true);
    expect(validarValor("TEXTO", "x".repeat(201), [])).toMatchObject({ ok: false });
    expect(validarValor("TEXTO_LARGO", "x".repeat(4000), []).ok).toBe(true);
    expect(validarValor("TEXTO_LARGO", "x".repeat(4001), [])).toMatchObject({ ok: false });
  });
  it("rechaza lo que no es texto", () => {
    expect(validarValor("TEXTO", 5, [])).toMatchObject({ ok: false });
    expect(validarValor("TEXTO", {}, [])).toMatchObject({ ok: false });
  });
  it("el texto largo conserva los saltos de línea", () => {
    expect(validarValor("TEXTO_LARGO", "a\nb", [])).toEqual(ok({ texto: "a\nb" }));
  });
});

describe("validarValor · número", () => {
  it("acepta punto o coma y normaliza a punto", () => {
    expect(validarValor("NUMERO", "12,5", [])).toEqual(ok({ numero: "12.5" }));
    expect(validarValor("NUMERO", "12.50", [])).toEqual(ok({ numero: "12.5" }));
    expect(validarValor("NUMERO", " 7 ", [])).toEqual(ok({ numero: "7" }));
    expect(validarValor("NUMERO", "-3,25", [])).toEqual(ok({ numero: "-3.25" }));
    expect(validarValor("NUMERO", 4.5, [])).toEqual(ok({ numero: "4.5" }));
    expect(validarValor("NUMERO", "0,0001", [])).toEqual(ok({ numero: "0.0001" }));
    expect(validarValor("NUMERO", "-0", [])).toEqual(ok({ numero: "0" }));
  });
  it("rechaza más de 4 decimales, letras, miles y vacíos raros", () => {
    for (const v of ["1,23456", "abc", "1a", "1.234,5", "1,,5", ",5", "5,", "--1", "1e3", NaN, Infinity, "12 3"]) {
      expect(validarValor("NUMERO", v, [])).toMatchObject({ ok: false });
    }
  });
  it("rechaza lo que no entra en Decimal(18,4)", () => {
    expect(validarValor("NUMERO", "1".repeat(14), []).ok).toBe(true);
    expect(validarValor("NUMERO", "1".repeat(15), [])).toMatchObject({ ok: false });
  });
});

describe("validarValor · fecha", () => {
  it("acepta días reales", () => {
    expect(validarValor("FECHA", "2026-10-01", [])).toEqual(ok({ fecha: "2026-10-01" }));
    expect(validarValor("FECHA", "2028-02-29", []).ok).toBe(true);
  });
  it("rechaza fechas imposibles y formatos otros", () => {
    for (const v of ["2026-02-31", "2027-02-29", "2026-13-01", "2026-00-10", "2026-10-00", "01/10/2026", "2026-1-1", "2026-10-01T00:00", 20261001]) {
      expect(validarValor("FECHA", v, [])).toMatchObject({ ok: false });
    }
  });
});

describe("validarValor · enlace", () => {
  it("acepta http y https", () => {
    expect(validarValor("ENLACE", " https://drive.google.com/x?y=1 ", [])).toEqual(ok({ texto: "https://drive.google.com/x?y=1" }));
    expect(validarValor("ENLACE", "http://a.com", []).ok).toBe(true);
  });
  it("rechaza otros protocolos, sin protocolo, con espacios o largos", () => {
    for (const v of ["ftp://a.com", "javascript:alert(1)", "www.a.com", "https://", "https://a b.com", "mailto:a@b.com", 5]) {
      expect(validarValor("ENLACE", v, [])).toMatchObject({ ok: false });
    }
    expect(validarValor("ENLACE", "https://a.com/" + "x".repeat(500), [])).toMatchObject({ ok: false });
  });
});

describe("validarValor · sí/no", () => {
  it("sólo 'si' y 'no'", () => {
    expect(validarValor("SI_NO", "si", [])).toEqual(ok({ booleano: true }));
    expect(validarValor("SI_NO", "no", [])).toEqual(ok({ booleano: false }));
    for (const v of ["sí", "SI", "true", true, 1, "yes"]) expect(validarValor("SI_NO", v, [])).toMatchObject({ ok: false });
  });
});

describe("validarValor · lista", () => {
  it("sólo ids de opciones válidas", () => {
    expect(validarValor("LISTA", "o1", ["o1", "o2"])).toEqual(ok({ opcionId: "o1" }));
    expect(validarValor("LISTA", "o3", ["o1", "o2"])).toMatchObject({ ok: false });
    expect(validarValor("LISTA", "o1", [])).toMatchObject({ ok: false });
    expect(validarValor("LISTA", 1, ["1"])).toMatchObject({ ok: false });
  });
});

describe("textoLegible", () => {
  it("vacío", () => expect(textoLegible("TEXTO", null, {})).toBe(""));
  it("texto y enlace", () => {
    expect(textoLegible("TEXTO", { texto: "hola" }, {})).toBe("hola");
    expect(textoLegible("ENLACE", { texto: "https://a.com" }, {})).toBe("https://a.com");
  });
  it("número con coma", () => {
    expect(textoLegible("NUMERO", { numero: "12.5" }, {})).toBe("12,5");
    expect(textoLegible("NUMERO", { numero: "-3.0000" }, {})).toBe("-3");
  });
  it("fecha dd/mm/aaaa", () => expect(textoLegible("FECHA", { fecha: "2026-10-01" }, {})).toBe("01/10/2026"));
  it("sí/no", () => {
    expect(textoLegible("SI_NO", { booleano: true }, {})).toBe("Sí");
    expect(textoLegible("SI_NO", { booleano: false }, {})).toBe("No");
  });
  it("lista: la etiqueta, o vacío si no se conoce", () => {
    expect(textoLegible("LISTA", { opcionId: "o1" }, { o1: "Boda" })).toBe("Boda");
    expect(textoLegible("LISTA", { opcionId: "zz" }, {})).toBe("");
  });
});
