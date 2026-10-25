import { describe, expect, it } from "vitest";
import { armarMensaje, avisoDeSalidaVisible, completarTexto, ocasionesDelDia, type ContextoMensaje, type Pieza } from "./mensajes";
import { REPERTORIO_INICIAL } from "./repertorio";
import { debeOfrecerPase } from "./pase";
import { sumarDias } from "./fechas";

const piezas: Pieza[] = REPERTORIO_INICIAL.map((p) => ({ ...p, id: p.clave, activa: true }));

function ctx(p: Partial<ContextoMensaje> = {}): ContextoMensaje {
  return {
    momento: "APERTURA",
    fecha: "2026-10-26",
    nombre: "Cami",
    ventasHoy: 0,
    ocasiones: [],
    feriado: null,
    usadas: [],
    semilla: "2|2026-10-26|APERTURA",
    ...p,
  };
}

describe("repertorio inicial", () => {
  it("tiene entre 15 y 20 variantes por pieza y claves únicas", () => {
    const grupos = new Map<string, number>();
    for (const p of REPERTORIO_INICIAL) {
      const k = `${p.momento}|${p.parte}|${p.ocasion ?? ""}`;
      grupos.set(k, (grupos.get(k) ?? 0) + 1);
    }
    for (const [, n] of grupos) {
      expect(n).toBeGreaterThanOrEqual(15);
      expect(n).toBeLessThanOrEqual(20);
    }
    expect(new Set(REPERTORIO_INICIAL.map((p) => p.clave)).size).toBe(REPERTORIO_INICIAL.length);
  });

  it("el aviso de salida siempre recuerda contar y cerrar la caja", () => {
    for (const p of REPERTORIO_INICIAL.filter((x) => x.momento === "SALIDA" && x.parte === "CIERRE")) {
      expect(p.texto.toLowerCase()).toMatch(/cont/);
      expect(p.texto.toLowerCase()).toMatch(/cerr/);
    }
  });

  it("nunca dice «plata»", () => {
    for (const p of REPERTORIO_INICIAL) expect(p.texto.toLowerCase()).not.toContain("plata");
  });
});

describe("armarMensaje", () => {
  it("combina saludo, medio y cierre, con el nombre y el día", () => {
    const m = armarMensaje(piezas, ctx())!;
    expect(m.piezas).toHaveLength(3);
    expect(m.texto).not.toMatch(/\{\w+\}/);
    expect(m.combinacion.split("|")).toHaveLength(3);
  });

  it("es determinístico: misma persona, día y momento, mismo mensaje", () => {
    expect(armarMensaje(piezas, ctx())!.texto).toBe(armarMensaje(piezas, ctx())!.texto);
  });

  it("no repite la misma combinación en 30 días aunque la semilla sea la misma", () => {
    const usadas: string[] = [];
    for (let i = 0; i < 30; i++) {
      const m = armarMensaje(piezas, ctx({ usadas, semilla: "fija" }))!;
      expect(usadas).not.toContain(m.combinacion);
      usadas.push(m.combinacion);
    }
    expect(new Set(usadas).size).toBe(30);
  });

  it("deja para el final las piezas usadas hace poco", () => {
    const primera = armarMensaje(piezas, ctx({ semilla: "x" }))!;
    const segunda = armarMensaje(piezas, ctx({ semilla: "x", usadas: [primera.combinacion], recientes: primera.piezas }))!;
    for (const id of segunda.piezas) expect(primera.piezas).not.toContain(id);
  });

  it("el cumpleaños cambia el saludo", () => {
    const m = armarMensaje(piezas, ctx({ ocasiones: ["CUMPLEANOS"] }))!;
    expect(m.piezas[0]).toMatch(/^cumple-saludo/);
    expect(m.texto.toLowerCase()).toContain("cumple");
    expect(m.ocasion).toContain("CUMPLEANOS");
  });

  it("el viernes al cerrar, si no trabaja el sábado, despide el fin de semana", () => {
    const m = armarMensaje(piezas, ctx({ momento: "CIERRE", fecha: "2026-10-30", ocasiones: ["FIN_DE_SEMANA"] }))!;
    expect(m.piezas[2]).toMatch(/^finde-cierre/);
  });

  it("la víspera de feriado gana sobre el fin de semana", () => {
    const m = armarMensaje(piezas, ctx({ momento: "CIERRE", ocasiones: ["VISPERA_FERIADO", "FIN_DE_SEMANA"] }))!;
    expect(m.piezas[2]).toMatch(/^vispera-cierre/);
  });

  it("trabajando en un feriado, la frase del medio lo agradece", () => {
    const m = armarMensaje(piezas, ctx({ ocasiones: ["FERIADO"], feriado: "Día de la Soberanía Nacional" }))!;
    expect(m.piezas[1]).toMatch(/^feriado-medio/);
  });

  it("las frases con ventas sólo aparecen si hubo alguna, y en singular cuando es una", () => {
    const sinVentas = piezas.filter((p) => p.momento === "CIERRE" && p.parte === "MEDIO" && p.ocasion === null);
    for (let i = 0; i < 40; i++) {
      const m = armarMensaje(sinVentas, ctx({ momento: "CIERRE", semilla: `s${i}` }))!;
      expect(m.texto).not.toMatch(/venta/);
    }
    expect(completarTexto("Hoy cargaste {ventas}.", { nombre: "x", fecha: "2026-10-26", ventasHoy: 1, feriado: null })).toBe("Hoy cargaste 1 venta.");
  });

  it("si el dueño apagó todas las piezas de una ocasión, usa las de todos los días", () => {
    const sinCumple = piezas.map((p) => (p.ocasion === "CUMPLEANOS" ? { ...p, activa: false } : p));
    const m = armarMensaje(sinCumple, ctx({ ocasiones: ["CUMPLEANOS"] }))!;
    expect(m.piezas[0]).toMatch(/^apertura-saludo/);
  });

  it("sin ninguna pieza para el momento no arma nada", () => {
    expect(armarMensaje([], ctx())).toBeNull();
  });
});

describe("ocasionesDelDia", () => {
  const lunesAViernes = (f: string) => {
    const d = new Date(`${f}T12:00:00Z`).getUTCDay();
    return d >= 1 && d <= 5;
  };
  it("el viernes es fin de semana si el sábado no trabaja; si trabaja, no", () => {
    expect(ocasionesDelDia({ fecha: "2026-10-30", cumple: false, trabaja: lunesAViernes }).ocasiones).toContain("FIN_DE_SEMANA");
    expect(ocasionesDelDia({ fecha: "2026-10-30", cumple: false, trabaja: () => true }).ocasiones).not.toContain("FIN_DE_SEMANA");
  });
  it("feriado, víspera y fin de mes", () => {
    expect(ocasionesDelDia({ fecha: "2026-12-08", cumple: false, trabaja: lunesAViernes })).toMatchObject({ ocasiones: expect.arrayContaining(["FERIADO"]) });
    expect(ocasionesDelDia({ fecha: "2026-12-07", cumple: false, trabaja: lunesAViernes }).ocasiones).toContain("VISPERA_FERIADO");
    // Viernes 30/10: el sábado 31 no trabaja, así que es su último día del mes.
    expect(ocasionesDelDia({ fecha: "2026-10-30", cumple: false, trabaja: lunesAViernes }).ocasiones).toContain("FIN_DE_MES");
    expect(ocasionesDelDia({ fecha: "2026-10-26", cumple: false, trabaja: lunesAViernes }).ocasiones).not.toContain("FIN_DE_MES");
  });
  it("el cumpleaños entra como ocasión", () => {
    expect(ocasionesDelDia({ fecha: "2026-10-26", cumple: true, trabaja: lunesAViernes }).ocasiones).toContain("CUMPLEANOS");
  });
  it("no se confunde con el mes siguiente", () => {
    expect(sumarDias("2026-10-31", 1).slice(0, 7)).toBe("2026-11");
  });
});

describe("aviso de salida y pase de turno", () => {
  it("el aviso aparece 5 minutos antes del fin, con turno propio abierto y sin cerrarlo", () => {
    const base = { finMin: 780, tieneTurnoPropioAbierto: true, cerrado: false };
    expect(avisoDeSalidaVisible({ ...base, ahoraMin: 774 })).toBe(false);
    expect(avisoDeSalidaVisible({ ...base, ahoraMin: 775 })).toBe(true);
    expect(avisoDeSalidaVisible({ ...base, ahoraMin: 800 })).toBe(true);
    expect(avisoDeSalidaVisible({ ...base, ahoraMin: 776, cerrado: true })).toBe(false);
    expect(avisoDeSalidaVisible({ ...base, ahoraMin: 776, tieneTurnoPropioAbierto: false })).toBe(false);
    expect(avisoDeSalidaVisible({ ...base, ahoraMin: 776, finMin: null })).toBe(false);
  });
  it("el pase se ofrece sólo a alguien del equipo frente al turno abierto de otra persona", () => {
    expect(debeOfrecerPase({ abiertoPor: 1, usuarioId: 2, usuarioEnEquipo: true, omitido: false })).toBe(true);
    expect(debeOfrecerPase({ abiertoPor: 2, usuarioId: 2, usuarioEnEquipo: true, omitido: false })).toBe(false);
    expect(debeOfrecerPase({ abiertoPor: 1, usuarioId: 9, usuarioEnEquipo: false, omitido: false })).toBe(false);
    expect(debeOfrecerPase({ abiertoPor: 1, usuarioId: 2, usuarioEnEquipo: true, omitido: true })).toBe(false);
    expect(debeOfrecerPase({ abiertoPor: null, usuarioId: 2, usuarioEnEquipo: true, omitido: false })).toBe(false);
  });
});
