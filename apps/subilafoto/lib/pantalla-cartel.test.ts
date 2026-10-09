import { describe, expect, test } from "vitest";
import { cartelDePantalla, type Cartel } from "./pantalla-cartel";

/** El cartel de proyección no lleva título: pedirlo acá es un error del test. */
function titulo(cartel: Cartel): string {
  if (cartel.tipo === "PROYECTANDO") {
    throw new Error("El cartel de proyección no tiene título");
  }
  return cartel.titulo;
}

describe("qué muestra la pantalla del salón", () => {
  test("antes de que empiece invita, no se despide", () => {
    /*
      El defecto que esto previene: la pantalla decidía mostrar el cartel de cierre
      cuando `puedeSubir` era falso, y eso es cierto en DOS momentos —antes y después—.
      Enchufar el televisor media hora antes mostraba "Gracias por la noche".
    */
    const cartel = cartelDePantalla({ momento: "ANTES", textoDeCierre: null });

    expect(cartel.tipo).toBe("ESPERANDO");
    expect(titulo(cartel)).not.toContain("Gracias");
  });

  test("durante el evento proyecta las fotos", () => {
    const cartel = cartelDePantalla({ momento: "ABIERTO", textoDeCierre: null });

    expect(cartel.tipo).toBe("PROYECTANDO");
  });

  test("cuando termina se despide", () => {
    const cartel = cartelDePantalla({ momento: "CERRADO", textoDeCierre: null });

    expect(cartel.tipo).toBe("CIERRE");
    expect(titulo(cartel)).toBe("Gracias por la noche");
  });

  test("el texto de cierre que puso el fotógrafo gana", () => {
    const cartel = cartelDePantalla({
      momento: "CERRADO",
      textoDeCierre: "Gracias por venir al cumple de Sofi",
    });

    expect(titulo(cartel)).toBe("Gracias por venir al cumple de Sofi");
  });

  test("el texto de cierre no se usa antes de empezar", () => {
    // Es un texto de despedida: ponerlo en la bienvenida sería igual de raro.
    const cartel = cartelDePantalla({
      momento: "ANTES",
      textoDeCierre: "Gracias por venir al cumple de Sofi",
    });

    expect(titulo(cartel)).not.toContain("Gracias");
  });

  test("un texto de cierre en blanco cae en el de siempre", () => {
    const cartel = cartelDePantalla({ momento: "CERRADO", textoDeCierre: "   " });

    expect(titulo(cartel)).toBe("Gracias por la noche");
  });
});
