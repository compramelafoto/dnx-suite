import { describe, expect, it } from "vitest";
import { MARCADOR_FIRMA } from "./constantes";
import { analizar, completar, type Pieza } from "./motor";

const P = new Set(["nombre", "consulta_fecha", "consulta_lugar", "firma", "campo:dni", "campo:2do_nombre"]);

function piezas(texto: string, permitidas = P): Pieza[] {
  const r = analizar(texto, permitidas);
  if (!r.ok) throw new Error(JSON.stringify(r.errores));
  return r.piezas;
}
function errores(texto: string, permitidas = P) {
  const r = analizar(texto, permitidas);
  if (r.ok) throw new Error("se esperaba error");
  return r.errores;
}
const valores = (m: Record<string, string | null>) => (clave: string) => m[clave] ?? null;

describe("analizar", () => {
  it("texto sin variables es una sola pieza literal", () => {
    expect(piezas("Hola, ¿cómo estás?")).toEqual([{ tipo: "texto", texto: "Hola, ¿cómo estás?" }]);
    expect(piezas("")).toEqual([]);
  });

  it("reconoce variables, campos y bloques", () => {
    expect(piezas("Hola [nombre]! DNI [campo:dni] [si:consulta_fecha]el [consulta_fecha][/si].")).toEqual([
      { tipo: "texto", texto: "Hola " },
      { tipo: "variable", clave: "nombre" },
      { tipo: "texto", texto: "! DNI " },
      { tipo: "variable", clave: "campo:dni" },
      { tipo: "texto", texto: " " },
      { tipo: "bloque", clave: "consulta_fecha", piezas: [{ tipo: "texto", texto: "el " }, { tipo: "variable", clave: "consulta_fecha" }] },
      { tipo: "texto", texto: "." },
    ]);
    expect(piezas("[si:campo:dni]tu DNI: [campo:dni][/si]")[0]).toMatchObject({ tipo: "bloque", clave: "campo:dni" });
    expect(piezas("[campo:2do_nombre]")).toEqual([{ tipo: "variable", clave: "campo:2do_nombre" }]);
  });

  it("los corchetes que no forman una variable son texto literal", () => {
    for (const t of ["[nota al pie]", "[Nombre]", "[2026]", "[]", "[ nombre]", "[nombre ]", "a [b-c] d", "[[", "]]", "[nom bre]", "[ñandú]", "[si: nombre]"]) {
      expect(piezas(t), t).toEqual([{ tipo: "texto", texto: t }]);
    }
  });

  it("frontera del patrón: [ + [a-z_:] + [a-z0-9_:]* + ] parece variable", () => {
    expect(errores("[x]")[0]).toMatchObject({ posicion: 0, variable: "x" });
    expect(errores("[_]")[0]).toMatchObject({ variable: "_" });
    expect(errores("[a1]")[0]).toMatchObject({ variable: "a1" });
    expect(errores("[campo:]")[0]).toMatchObject({ posicion: 0 });
    expect(piezas("[1a]")).toEqual([{ tipo: "texto", texto: "[1a]" }]);
    expect(piezas("[A]")).toEqual([{ tipo: "texto", texto: "[A]" }]);
  });

  it("variable desconocida: error con posición (0-based) y nombre", () => {
    const e = errores("Hola [nombre], tu [apellidoo] y [campo:color]");
    expect(e).toHaveLength(2);
    expect(e[0]).toMatchObject({ posicion: 18, variable: "apellidoo" });
    expect(e[0]!.mensaje).toContain("[apellidoo]");
    expect(e[1]).toMatchObject({ posicion: 32, variable: "campo:color" });
  });

  it("la condición de un bloque también tiene que existir", () => {
    expect(errores("[si:inventada]x[/si]")[0]).toMatchObject({ posicion: 0, variable: "inventada" });
  });

  it("bloque sin cerrar, cierre sin abrir y bloques anidados son error", () => {
    expect(errores("Hola [si:nombre]x")[0]).toMatchObject({ posicion: 5 });
    expect(errores("Hola [si:nombre]x")[0]!.mensaje).toContain("[/si]");
    expect(errores("x[/si]")[0]).toMatchObject({ posicion: 1 });
    const anid = errores("[si:nombre]a[si:consulta_lugar]b[/si][/si]");
    expect(anid[0]).toMatchObject({ posicion: 12 });
    expect(anid[0]!.mensaje).toMatch(/anidar/);
    expect(errores("[/otro]")[0]).toMatchObject({ posicion: 0 });
    expect(errores("[si:]x[/si]")[0]).toMatchObject({ posicion: 0 });
  });
});

describe("completar", () => {
  it("reemplaza variables y avisa las vacías", () => {
    const r = completar(piezas("Hola [nombre], DNI [campo:dni]."), valores({ nombre: "Ana" }));
    expect(r.texto).toBe("Hola Ana, DNI .");
    expect(r.vacias).toEqual(["campo:dni"]);
    expect(r.conFirma).toBe(false);
  });

  it("un bloque con la variable llena se muestra; vacía, desaparece entero", () => {
    const p = piezas("Gracias[si:consulta_fecha] para tu evento del [consulta_fecha][/si].");
    expect(completar(p, valores({ consulta_fecha: "05/12/2026" })).texto).toBe("Gracias para tu evento del 05/12/2026.");
    const vacio = completar(p, valores({}));
    expect(vacio.texto).toBe("Gracias.");
    expect(vacio.vacias).toEqual([]);
    expect(completar(p, valores({ consulta_fecha: "   " })).texto).toBe("Gracias.");
  });

  it("dentro de un bloque visible, las vacías se informan una sola vez", () => {
    const r = completar(piezas("[nombre] [nombre] [si:nombre][consulta_lugar][/si] [consulta_lugar]"), valores({ nombre: "Ana" }));
    expect(r.vacias).toEqual(["consulta_lugar"]);
  });

  it("[firma] deja el marcador y prende conFirma (salvo en un bloque quitado)", () => {
    const r = completar(piezas("Saludos\n[firma]"), valores({}));
    expect(r.texto).toBe(`Saludos\n${MARCADOR_FIRMA}`);
    expect(r.conFirma).toBe(true);
    const quitado = completar(piezas("[si:nombre][firma][/si]"), valores({}));
    expect(quitado.conFirma).toBe(false);
    expect(quitado.texto).toBe("");
  });

  it("nadie puede falsificar el marcador de firma desde el texto ni los valores", () => {
    const r = completar(piezas(`a${MARCADOR_FIRMA}b [nombre]`), valores({ nombre: `x${MARCADOR_FIRMA}y` }));
    expect(r.texto).not.toContain(MARCADOR_FIRMA);
    expect(r.conFirma).toBe(false);
  });

  it("los valores se insertan tal cual (sin interpretar corchetes)", () => {
    expect(completar(piezas("[nombre]"), valores({ nombre: "[consulta_lugar]" })).texto).toBe("[consulta_lugar]");
  });
});
