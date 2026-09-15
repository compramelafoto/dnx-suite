import { describe, expect, test } from "vitest";
import { PLANTILLAS } from "./plantillas";
import { contraste, mezclar } from "./contraste";

/**
 * Las opacidades que las pantallas del invitado le aplican al texto del tema.
 *
 * `opacity` no baja "un poquito" el contraste: mezcla el color con el fondo. Un texto que
 * pasaba WCAG con holgura puede quedar abajo del mínimo, y en una pantalla que se mira
 * desde el fondo del salón o con el brillo bajo eso no es un detalle.
 */
const OPACIDADES = [0.62, 0.7, 0.78, 0.8] as const;

describe("el texto con opacidad sigue siendo legible", () => {
  test.each(
    PLANTILLAS.flatMap((p) => OPACIDADES.map((o) => [p.nombre, o, p] as const)),
  )("«%s» al %f", (_nombre, alfa, plantilla) => {
    const visto = mezclar(plantilla.tokens.texto, plantilla.tokens.fondo, alfa);
    expect(contraste(visto, plantilla.tokens.fondo)).toBeGreaterThanOrEqual(4.5);
  });
});
