import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/*
 * Este test lee el código fuente de dos formularios, que es raro, y lo hace por una razón
 * concreta: el defecto que arregla no vivía ni en el parser ni en la lógica, sino en el
 * ORDEN de dos etiquetas del formulario. Una casilla sin tildar no manda nada, así que
 * cada casilla necesita un `<input type="hidden" value="off">` de respaldo — y ese respaldo
 * tiene que ir DESPUÉS de la casilla, porque `FormData.get` devuelve la primera coincidencia
 * y si va antes gana siempre el "off", con lo cual la casilla deja de poder tildarse.
 *
 * Ninguna prueba del parser puede ver esto: el parser recibe un `FormData` ya armado y no
 * sabe qué etiquetas lo produjeron. De hecho así fue como el defecto original pasó
 * desapercibido: las pruebas mandaban "off" a mano, un valor que el formulario real nunca
 * producía, y quedaban en verde con la pantalla rota. Es el mismo motivo por el que
 * `lib/template-v2/access.test.ts` también mira el fuente.
 *
 * Nota: el mismo defecto sigue vivo en los formularios de Caja. Está anotado como pendiente
 * y no se arregla acá para no mezclar dos cosas en una misma revisión.
 */
describe("el respaldo oculto de cada casilla", () => {
  const CASILLAS = [
    { archivo: "app/(shell)/ventas/product-form.tsx", campo: "tracksStock" },
    { archivo: "app/(shell)/ventas/category-form.tsx", campo: "isActive" },
  ];

  it.each(CASILLAS)("$archivo manda el respaldo de $campo después de la casilla", ({ archivo, campo }) => {
    const src = readFileSync(join(import.meta.dirname, "..", "..", archivo), "utf8");

    // Cada `<input …>` del archivo con su posición, en el orden en que el navegador los
    // serializa.
    const inputs = [...src.matchAll(/<input[^>]*>/g)].map((m) => ({ tag: m[0], desde: m.index }));
    const delCampo = inputs.filter(({ tag }) => tag.includes(`name="${campo}"`));

    const casilla = delCampo.find(({ tag }) => tag.includes('type="checkbox"'));
    expect(casilla, `no hay ninguna casilla para "${campo}"`).toBeDefined();
    if (!casilla) return;

    const respaldos = delCampo.filter(
      ({ tag }) => tag.includes('type="hidden"') && tag.includes('value="off"'),
    );

    /*
     * No alcanza con que EXISTA un respaldo en el archivo ni con que esté más abajo: tiene
     * que estar dentro de la MISMA etiqueta `<label>` que la casilla. `product-form.tsx`
     * tiene un segundo `<input type="hidden" name="tracksStock" value="off">` en la rama de
     * SERVICIO, fuera del label, y una versión anterior de este test lo daba por bueno: con
     * el respaldo de la casilla borrado —el defecto original, exactamente— seguía en verde.
     */
    const acompañan = respaldos.filter(
      ({ desde }) => desde > casilla.desde && !src.slice(casilla.desde, desde).includes("</label>"),
    );

    const antes = respaldos.filter(
      ({ desde }) => desde < casilla.desde && !src.slice(desde, casilla.desde).includes("</label>"),
    );
    // Si el respaldo va antes, `FormData.get` devuelve "off" incluso con la casilla tildada
    // y el campo queda trabado en falso para siempre.
    expect(antes, `el respaldo de "${campo}" está ANTES de la casilla: tildarla no va a servir de nada`).toHaveLength(0);

    expect(
      acompañan.length,
      `la casilla "${campo}" no tiene respaldo oculto al lado: destildarla no manda nada y el parser la deja prendida`,
    ).toBeGreaterThan(0);
  });
});
