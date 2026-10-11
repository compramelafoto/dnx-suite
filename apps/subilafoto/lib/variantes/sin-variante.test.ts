import { describe, expect, test } from "vitest";
import { SIN_VARIANTE } from "./sin-variante";

/*
  La constante está anotada con el tipo de Prisma, que para `status` admite tanto un valor
  suelto como un filtro. Acá se lee como filtro porque es como está escrita: la prueba
  mira la forma real, no la que permitiría el tipo.
*/
const condicion = SIN_VARIANTE as {
  kind: string;
  status: { in: string[] };
  variants: unknown;
  originalKey: unknown;
};

describe("a qué se le genera la variante rezagada", () => {
  /*
    El defecto que esto previene: la consulta es anterior a los saludos grabados y daba
    por sentado que todo lo que tiene `originalKey` es una imagen. Desde el 10/10/2026 el
    audio del ensayo entraba cada cinco minutos — se bajaba de R2 y se le pedía a `sharp`
    que lo redimensionara.

    Lo caro no era el gasto sino que el contador de fallas quedaba clavado en 1. Un
    indicador que siempre está en rojo deja de avisar.
  */
  test("sólo fotos: un audio no tiene variante y nunca la va a tener", () => {
    expect(condicion.kind).toBe("PHOTO");
  });

  test("sólo lo que se muestra en algún lado", () => {
    // Una bloqueada no aparece ni en el álbum ni en la pantalla: no necesita variante.
    expect(condicion.status.in).toEqual(["APPROVED", "REVIEW_REQUIRED"]);
    expect(condicion.status.in).not.toContain("BLOCKED");
  });

  test("sólo lo que todavía no la tiene", () => {
    expect(condicion.variants).toEqual({ none: {} });
  });

  test("y sólo lo que tiene un archivo del que generarla", () => {
    expect(condicion.originalKey).toEqual({ not: "" });
  });
});
