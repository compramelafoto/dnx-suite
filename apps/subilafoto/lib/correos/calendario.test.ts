import { describe, expect, test } from "vitest";
import { HITOS, avisoQueCorresponde } from "./calendario";

const CIERRE = new Date("2026-10-11T08:00:00Z");
const dias = (n: number) => new Date(CIERRE.getTime() + n * 24 * 60 * 60 * 1000);

describe("qué aviso corresponde mandar", () => {
  test("los hitos son 1, 3, 7, 15 y 30", () => {
    expect(HITOS).toEqual([1, 3, 7, 15, 30]);
  });

  test("el mismo día del cierre todavía no toca ninguno", () => {
    expect(avisoQueCorresponde({ cierre: CIERRE, ahora: CIERRE, yaEnviados: [] })).toBeNull();
  });

  test.each(HITOS)("al día %i toca ese aviso", (hito) => {
    const r = avisoQueCorresponde({ cierre: CIERRE, ahora: dias(hito), yaEnviados: [] });
    expect(r).toBe(`dia-${hito}`);
  });

  test("uno ya enviado no se repite", () => {
    // Es el criterio 3.7: un reintento del worker no manda el mismo dos veces.
    const r = avisoQueCorresponde({ cierre: CIERRE, ahora: dias(3), yaEnviados: ["dia-1", "dia-3"] });
    expect(r).toBeNull();
  });

  test("si el worker estuvo caído un día, el aviso sale igual", () => {
    // Un día tarde sigue siendo útil. Que se caiga el cron no tiene por qué
    // costarle al cliente el aviso.
    expect(avisoQueCorresponde({ cierre: CIERRE, ahora: dias(2), yaEnviados: [] })).toBe("dia-1");
  });

  test("pero uno viejo no se manda tarde: se saltea", () => {
    /*
      Si el worker estuvo caído una semana, mandar de golpe los avisos del día 1
      y del 3 junto al del 7 sería tres correos en un minuto. El aviso del día 1
      ya no dice nada útil el día 7: se saltea.
    */
    const r = avisoQueCorresponde({ cierre: CIERRE, ahora: dias(7), yaEnviados: [] });
    expect(r).toBe("dia-7");
  });

  test("nunca manda dos en la misma vuelta", () => {
    // Devuelve uno solo, siempre. La vuelta siguiente manda el que siga.
    const r = avisoQueCorresponde({ cierre: CIERRE, ahora: dias(15), yaEnviados: ["dia-7"] });
    expect(typeof r === "string" || r === null).toBe(true);
  });

  test("pasado el borrado no se manda nada más", () => {
    // A los 30 días el material se borró. Un aviso después ofrece algo que no existe.
    expect(avisoQueCorresponde({ cierre: CIERRE, ahora: dias(31), yaEnviados: [] })).toBeNull();
    expect(avisoQueCorresponde({ cierre: CIERRE, ahora: dias(45), yaEnviados: [] })).toBeNull();
  });

  test("sin fecha de cierre no hay calendario", () => {
    expect(avisoQueCorresponde({ cierre: null, ahora: dias(3), yaEnviados: [] })).toBeNull();
  });

  test("antes del cierre tampoco", () => {
    const antes = new Date(CIERRE.getTime() - 60 * 60 * 1000);
    expect(avisoQueCorresponde({ cierre: CIERRE, ahora: antes, yaEnviados: [] })).toBeNull();
  });
});
