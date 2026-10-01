import { describe, expect, test } from "vitest";
import {
  CATEGORIAS_DE_RIESGO_ALTO,
  PERFILES,
  VERSION_DE_POLITICA,
  decidir,
} from "./reglas";

const perfiles = [...PERFILES] as const;

describe("motor de reglas de moderación", () => {
  test("sin etiquetas, la foto se aprueba", () => {
    for (const perfil of perfiles) {
      const d = decidir([], perfil);
      expect(d.estado).toBe("APPROVED");
      expect(d.motivo).toBeNull();
    }
  });

  test("toda decisión viaja con la versión de política que la produjo", () => {
    // Sin esto no se puede explicar, seis meses después, por qué una foto se
    // bloqueó: las reglas ya cambiaron.
    expect(decidir([], "SOCIAL").versionDePolitica).toBe(VERSION_DE_POLITICA);
  });

  // Este es el criterio de aceptación 2.5 del backlog, escrito como test.
  test.each(CATEGORIAS_DE_RIESGO_ALTO)(
    "«%s» con confianza alta nunca se aprueba, en ningún perfil",
    (categoria) => {
      for (const perfil of perfiles) {
        const d = decidir([{ nombre: categoria, confianza: 95 }], perfil);
        expect(d.estado).toBe("BLOCKED");
        expect(d.motivo).toBe(categoria);
      }
    },
  );

  test.each(CATEGORIAS_DE_RIESGO_ALTO)(
    "«%s» apenas insinuada tampoco se aprueba: va a revisión",
    (categoria) => {
      for (const perfil of perfiles) {
        const d = decidir([{ nombre: categoria, confianza: 35 }], perfil);
        expect(d.estado).toBe("REVIEW_REQUIRED");
      }
    },
  );

  test("el alcohol es normal en una fiesta y no lo es en un cumpleaños infantil", () => {
    const copa = [{ nombre: "Alcohol", confianza: 95 }];
    expect(decidir(copa, "SOCIAL").estado).toBe("APPROVED");
    expect(decidir(copa, "FAMILIAR").estado).toBe("REVIEW_REQUIRED");
  });

  test("la malla en la pileta pasa en un evento social y se revisa en uno familiar", () => {
    const malla = [{ nombre: "Swimwear or Underwear", confianza: 70 }];
    expect(decidir(malla, "SOCIAL").estado).toBe("APPROVED");
    expect(decidir(malla, "FAMILIAR").estado).toBe("REVIEW_REQUIRED");
  });

  test("cuando hay varias etiquetas, manda la más severa", () => {
    const d = decidir(
      [
        { nombre: "Alcohol", confianza: 99 },
        { nombre: "Violence", confianza: 88 },
        { nombre: "Rude Gestures", confianza: 70 },
      ],
      "SOCIAL",
    );
    expect(d.estado).toBe("BLOCKED");
    expect(d.motivo).toBe("Violence");
  });

  test("una categoría que no conocemos no se aprueba a ciegas", () => {
    // Amazon agrega categorías cuando saca un modelo nuevo. Si aparece una que
    // esta política no contempla, va a revisión: es preferible molestar al
    // fotógrafo antes que proyectar algo que nadie evaluó.
    const d = decidir([{ nombre: "Categoria Que No Existe Todavia", confianza: 92 }], "SOCIAL");
    expect(d.estado).toBe("REVIEW_REQUIRED");
    expect(d.motivo).toBe("Categoria Que No Existe Todavia");
  });

  test("una categoría desconocida con poca confianza no molesta a nadie", () => {
    const d = decidir([{ nombre: "Otra Cosa", confianza: 45 }], "SOCIAL");
    expect(d.estado).toBe("APPROVED");
  });

  test("informa la etiqueta que decidió y su confianza, para poder auditarla", () => {
    const d = decidir([{ nombre: "Violence", confianza: 77.5 }], "FAMILIAR");
    expect(d.motivo).toBe("Violence");
    expect(d.confianza).toBe(77.5);
  });
});

describe("las subcategorías no se cuentan como categorías desconocidas", () => {
  // Encontrado el 2026-09-13 probando con una foto real: Amazon devuelve la
  // categoría y también su subcategoría. En una foto de brindis llegan
  // "Alcohol" (nivel 1) y "Alcoholic Beverages" (nivel 2), las dos con la misma
  // confianza. Si la subcategoría se trata como desconocida, arriba del 80%
  // manda a revisión — y entonces **toda foto de casamiento con una copa a la
  // vista queda retenida**, justo en el perfil donde el alcohol está permitido.

  test("una copa bien visible en un casamiento se aprueba", () => {
    const brindis = [
      { nombre: "Alcohol", confianza: 96, esDePrimerNivel: true },
      { nombre: "Alcoholic Beverages", confianza: 96, esDePrimerNivel: false },
    ];
    expect(decidir(brindis, "SOCIAL").estado).toBe("APPROVED");
  });

  test("pero una categoría nueva de primer nivel sigue yendo a revisión", () => {
    expect(
      decidir([{ nombre: "Algo Que Amazon Agregue", confianza: 92, esDePrimerNivel: true }], "SOCIAL")
        .estado,
    ).toBe("REVIEW_REQUIRED");
  });

  test("una subcategoría que sí está en la política se sigue evaluando", () => {
    // Si algún día se agrega una subcategoría concreta a los umbrales, tiene
    // que funcionar igual: lo que se ignora es lo desconocido, no lo profundo.
    expect(
      decidir([{ nombre: "Alcohol", confianza: 96, esDePrimerNivel: false }], "FAMILIAR").estado,
    ).toBe("REVIEW_REQUIRED");
  });

  test("sin el dato de nivel se asume primer nivel, que es lo prudente", () => {
    expect(decidir([{ nombre: "Desconocida", confianza: 92 }], "SOCIAL").estado).toBe(
      "REVIEW_REQUIRED",
    );
  });
});
