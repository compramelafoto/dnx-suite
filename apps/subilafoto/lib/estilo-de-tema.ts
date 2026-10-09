import type { CSSProperties } from "react";
import { dibujoDeTextura } from "./texturas";
import type { Tema } from "./tema";

/**
 * El tema de un evento convertido en estilo para la etiqueta que lo contiene.
 *
 * Vive acá y no repetido en cada pantalla porque son cinco lugares —la puerta, la carga,
 * el álbum, la proyección y la vista previa del selector— y la textura hay que pintarla
 * igual en todos. Cinco copias de la misma expresión es cuestión de tiempo hasta que una
 * quede vieja.
 *
 * El color de fondo va **además** del dibujo, no en su lugar: la textura es un SVG con
 * partes transparentes y sin color debajo la pantalla del salón quedaría blanca.
 */
export function estiloDeTema(tema: Tema): CSSProperties {
  const dibujo = dibujoDeTextura(tema.textura, tema.acento);

  return {
    background: tema.fondo,
    color: tema.texto,
    // El respaldo importa: si la tipografía no cargó —datos móviles en un salón lleno—
    // el texto se tiene que ver igual, no desaparecer.
    fontFamily: `${tema.tipografia}, system-ui, sans-serif`,
    ...(dibujo ? { backgroundImage: dibujo.imagen, backgroundSize: dibujo.tamano } : {}),
  };
}

/**
 * Tipografías que **no** se usan en el teléfono del invitado.
 *
 * La de cartel es condensada y en mayúsculas: se lee perfecto proyectada a tres metros y
 * es ilegible a un palmo, a oscuras, en una fiesta. La manuscrita tiene el mismo
 * problema en un botón o en un párrafo.
 *
 * La serif no está acá: es legible en un teléfono y además es la que da el tono de una
 * boda o un egreso, así que ahí sí vale respetar la plantilla.
 */
const SOLO_PARA_PROYECTAR = ["--slf-font-cartel", "--slf-font-mano"];

/**
 * El mismo tema, pero con la letra que el invitado pueda leer.
 *
 * **Los colores y la textura se conservan**: lo que cambia es la tipografía, no la
 * identidad. El invitado tiene que ver su fiesta, nada más que poder leerla.
 */
export function estiloLegible(tema: Tema): CSSProperties {
  const esDeCartel = SOLO_PARA_PROYECTAR.some((f) => tema.tipografia.includes(f));

  return estiloDeTema(esDeCartel ? { ...tema, tipografia: "var(--slf-font)" } : tema);
}
