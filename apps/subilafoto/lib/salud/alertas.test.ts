import { describe, expect, test } from "vitest";
import { alertasDeLosDatos, type Conteos } from "./alertas";

const TRANQUILO: Conteos = {
  fotosTrabadas: 0,
  fotosSinVariante: 0,
  paquetesFallados: 0,
  correosFallados: 0,
  pagosSinEvento: 0,
  eventosSinCerrar: 0,
};

describe("qué merece que alguien mire", () => {
  test("una noche tranquila no dice nada", () => {
    expect(alertasDeLosDatos(TRANQUILO)).toEqual([]);
  });

  test("plata que entró sin evento es lo primero de la lista", () => {
    const r = alertasDeLosDatos({ ...TRANQUILO, pagosSinEvento: 1, fotosTrabadas: 40 });
    expect(r[0]!.clave).toBe("pagos-sin-evento");
    expect(r[0]!.gravedad).toBe("grave");
  });

  test("cada alerta dice qué hacer, no sólo qué pasa", () => {
    const r = alertasDeLosDatos({ ...TRANQUILO, fotosTrabadas: 12 });
    expect(r[0]!.queHacer.length).toBeGreaterThan(20);
  });

  test("fotos trabadas: pocas avisan, muchas alarman", () => {
    expect(alertasDeLosDatos({ ...TRANQUILO, fotosTrabadas: 3 })[0]!.gravedad).toBe("aviso");
    expect(alertasDeLosDatos({ ...TRANQUILO, fotosTrabadas: 30 })[0]!.gravedad).toBe("grave");
  });

  test("una foto aprobada sin variante no se ve en ningún lado", () => {
    const r = alertasDeLosDatos({ ...TRANQUILO, fotosSinVariante: 2 });
    expect(r[0]!.clave).toBe("fotos-sin-variante");
  });

  test("un evento que debió cerrar y sigue abierto se avisa", () => {
    const r = alertasDeLosDatos({ ...TRANQUILO, eventosSinCerrar: 1 });
    expect(r[0]!.clave).toBe("eventos-sin-cerrar");
  });

  test("los paquetes y los correos fallados también", () => {
    const r = alertasDeLosDatos({ ...TRANQUILO, paquetesFallados: 1, correosFallados: 2 });
    expect(r.map((a) => a.clave).sort()).toEqual(["correos-fallados", "paquetes-fallados"]);
  });

  test("van ordenadas: primero lo grave", () => {
    const r = alertasDeLosDatos({
      ...TRANQUILO,
      correosFallados: 1,
      pagosSinEvento: 1,
      fotosSinVariante: 1,
    });
    expect(r[0]!.gravedad).toBe("grave");
    expect(r.at(-1)!.gravedad).toBe("aviso");
  });

  test("el texto dice el número, que es lo que uno busca", () => {
    const r = alertasDeLosDatos({ ...TRANQUILO, fotosTrabadas: 7 });
    expect(r[0]!.titulo).toContain("7");
  });
});
