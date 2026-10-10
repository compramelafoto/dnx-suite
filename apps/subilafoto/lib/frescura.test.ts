import { describe, expect, test } from "vitest";
import { ESPERA_ENTRE_MIRADAS_MS, textoDeFrescura } from "./frescura";

describe("si el control en vivo está vivo o congelado", () => {
  /*
    Por qué existe esto.

    `/panel/eventos/[id]/control` es un componente de servidor con `revalidate = 0`, y un
    comentario que decía "se recarga sola". No se recargaba: `revalidate = 0` evita que la
    respuesta se guarde en caché, pero nada volvía a pedirla. La página mostraba la foto de
    un instante —el de cuando se abrió— para toda la noche.

    Desde que no hay cola de revisión manual, sacar algo de acá es la única forma de frenar
    lo que no corresponde. Una lista congelada no frena nada, y lo peor es que se ve igual
    que una lista al día: en una fiesta, a oscuras, nadie se da cuenta. De ahí el cartel
    con la hora: es lo que distingue "no subió nadie" de "esto está colgado".
  */
  test("recién mirado dice que está al día", () => {
    expect(textoDeFrescura(0)).toBe("al día");
    expect(textoDeFrescura(4_000)).toBe("al día");
  });

  test("después de unos segundos dice cuántos", () => {
    expect(textoDeFrescura(12_000)).toBe("hace 12 s");
  });

  test("pasado el minuto cuenta en minutos", () => {
    expect(textoDeFrescura(60_000)).toBe("hace 1 min");
    expect(textoDeFrescura(5 * 60_000)).toBe("hace 5 min");
  });

  test("si pasó mucho, lo dice fuerte: eso es un problema", () => {
    /*
      Diez minutos sin refrescar en plena fiesta significa que el teléfono se durmió o
      se cortó la señal. Tiene que leerse como una falla, no como un dato.
    */
    expect(textoDeFrescura(10 * 60_000)).toContain("sin actualizar");
  });

  test("mira seguido, pero no tanto como para pelearse con el dedo", () => {
    expect(ESPERA_ENTRE_MIRADAS_MS).toBeGreaterThanOrEqual(5_000);
    expect(ESPERA_ENTRE_MIRADAS_MS).toBeLessThanOrEqual(15_000);
  });
});
