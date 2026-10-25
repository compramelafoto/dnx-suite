import { describe, expect, test } from "vitest";
import {
  esPuntoDelSalon,
  faltanImprescindibles,
  puntosDePreparacion,
  type EstadoDelEvento,
} from "./preparacion";

const vacio: EstadoDelEvento = {
  tieneHorario: false,
  tienePlantilla: false,
  tienePortada: false,
  tieneAnfitriones: false,
  tieneLogo: false,
  tieneBanner: false,
  confirmado: {},
};
const listo: EstadoDelEvento = {
  tieneHorario: true,
  tienePlantilla: true,
  tienePortada: true,
  tieneAnfitriones: true,
  tieneLogo: true,
  tieneBanner: true,
  confirmado: {
    pantalla: "2026-10-11T12:00:00.000Z",
    "enlace-probado": "2026-10-11T12:00:00.000Z",
    impresos: "2026-10-11T12:00:00.000Z",
    conexion: "2026-10-11T12:00:00.000Z",
  },
};

describe("qué se pregunta y qué se comprueba", () => {
  /*
    Nace de una fiesta que no se hizo: el 10/10/2026 el salón no tenía pantalla y el
    sistema no se usó. No fue un error de programación, y por eso importa: el producto
    depende de cosas del mundo físico que nadie le preguntó a nadie.
  */
  test("lo que el sistema ve, no lo pregunta", () => {
    // Pedir que tilde "cargué la portada" cuando la portada está en la base le enseña
    // a tildar sin leer, y entonces el tilde deja de significar algo.
    const p = puntosDePreparacion({ ...vacio, tienePortada: true }, "ev1");
    const portada = p.find((x) => x.clave === "portada")!;

    expect(portada.listo).toBe(true);
    expect(portada.confirmadoEl).toBeUndefined();
  });

  test("lo que pasa en el salón sólo lo sabe el fotógrafo", () => {
    const p = puntosDePreparacion(vacio, "ev1");
    const pantalla = p.find((x) => x.clave === "pantalla")!;

    expect(pantalla.listo).toBe(false);
    expect(pantalla.importancia).toBe("IMPRESCINDIBLE");
  });

  test("la confirmación guarda la fecha, no un sí", () => {
    // Una confirmación sobre el salón hecha hace tres semanas vale menos que una de ayer.
    const p = puntosDePreparacion(listo, "ev1");

    expect(p.find((x) => x.clave === "pantalla")!.confirmadoEl).toBe("2026-10-11T12:00:00.000Z");
  });

  test("los cuatro puntos del salón son imprescindibles", () => {
    // Cada uno, solo, deja la fiesta sin sistema: sin pantalla, sin impresos que la
    // reemplacen, sin señal, o con un enlace que nadie probó.
    const p = puntosDePreparacion(vacio, "ev1");
    const salon = p.filter((x) => x.confirmadoEl !== undefined || !x.href);

    expect(salon).toHaveLength(4);
    expect(salon.every((x) => x.importancia === "IMPRESCINDIBLE")).toBe(true);
  });
});

describe("cuánto falta", () => {
  test("un evento vacío tiene cinco cosas sin las que no hay fiesta", () => {
    // El horario más los cuatro del salón. Lo demás mejora, no bloquea.
    expect(faltanImprescindibles(puntosDePreparacion(vacio, "ev1"))).toBe(5);
  });

  test("todo confirmado, no falta nada", () => {
    expect(faltanImprescindibles(puntosDePreparacion(listo, "ev1"))).toBe(0);
  });

  test("tener la plantilla no alcanza para estar listo", () => {
    // Lo lindo no reemplaza a lo que hace falta.
    const casi = { ...vacio, tienePlantilla: true, tienePortada: true, tieneLogo: true };

    expect(faltanImprescindibles(puntosDePreparacion(casi, "ev1"))).toBe(5);
  });
});

describe("qué claves se aceptan", () => {
  test("sólo las que existen", () => {
    // Lo que manda el navegador no entra crudo en lo que se guarda.
    expect(esPuntoDelSalon("pantalla")).toBe(true);
    expect(esPuntoDelSalon("__proto__")).toBe(false);
    expect(esPuntoDelSalon("portada")).toBe(false);
  });
});
