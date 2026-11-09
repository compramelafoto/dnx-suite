import type { MaterialBox } from "./secuencia";

/**
 * Las 10 cajas del recorrido del Club de Beluz (SOYBELUZ), tal como las definió Belén.
 *
 * Las carga `scripts/box-cargar-soybeluz.ts`. Viven acá, en un módulo puro, para que una prueba
 * pueda verificar que están las 10, en orden y sin cantidades raras, sin tocar la base.
 */

export const WORKSPACE_SOYBELUZ = "ws_soybeluz";

export type CajaDelCatalogo = { number: number; name: string; materials: MaterialBox[] };

const m = (material: string, perBox: number): MaterialBox => ({ material, perBox });

export const CATALOGO_BOX_SOYBELUZ: readonly CajaDelCatalogo[] = [
  {
    number: 1,
    name: "Mi primer universo creativo: Soltar la mano",
    materials: [
      m("Block/cuaderno de dibujo A4 liso", 1),
      m("Fibra negra de trazo medio", 1),
      m("Microfibra negra fina", 1),
      m("Lápiz grafito HB", 1),
      m("Lápiz grafito 2B", 1),
      m("Goma blanca", 1),
      m("Sacapuntas", 1),
      m("Carpeta o sobre A4", 1),
      m("Tarjetas de propuestas de dibujo", 5),
      m("Guía de bienvenida y actividad", 1),
    ],
  },
  {
    number: 2,
    name: "Un mundo de flores",
    materials: [
      m("Hojas A4 blancas lisas", 8),
      m("Hojas de papel vegetal A4", 4),
      m("Láminas de referencias botánicas", 2),
      m("Tarjetas de formas: pétalos, hojas y tallos", 4),
      m("Mini guía de dibujo floral", 1),
    ],
  },
  {
    number: 3,
    name: "El universo de los patrones",
    materials: [
      m("Hojas A4 cuadriculadas", 5),
      m("Hojas de papel vegetal A4", 5),
      m("Cartulinas blancas A4", 3),
      m("Plantillas geométricas impresas", 4),
      m("Tarjetas de desafíos de repetición y simetría", 4),
    ],
  },
  {
    number: 4,
    name: "Mirar de otra manera",
    materials: [
      m("Hojas A4 lisas", 6),
      m("Hojas A5 o recortes de papel", 10),
      m("Cartón liviano para marcos de observación", 2),
      m("Láminas de objetos cotidianos", 3),
      m("Tarjetas de consignas de observación", 4),
    ],
  },
  {
    number: 5,
    name: "Dibujar el movimiento",
    materials: [
      m("Papel blanco A3 (o A4 en cantidad doble)", 4),
      m("Papel obra A4 para bocetos", 10),
      m("Marcador negro de punta gruesa", 1),
      m("Tarjetas de gestos, ritmo y movimiento", 5),
      m("Láminas de referencias de movimiento", 2),
    ],
  },
  {
    number: 6,
    name: "Inventar lo que no existe",
    materials: [
      m("Hojas A4 lisas para bocetos", 8),
      m("Cartulinas blancas A4", 3),
      m("Tarjetas de formas aleatorias", 12),
      m("Plantillas de formas orgánicas", 4),
      m("Tarjetas para crear personajes y mundos", 5),
    ],
  },
  {
    number: 7,
    name: "El poder de las texturas",
    materials: [
      m("Hojas A4 lisas", 8),
      m("Muestras de papeles de distintas superficies", 6),
      m("Tarjetas de tramas y texturas", 8),
      m("Láminas de texturas de objetos y superficies", 3),
      m("Hojas de papel vegetal A4", 3),
    ],
  },
  {
    number: 8,
    name: "Crear espacios y mundos",
    materials: [
      m("Papel cuadriculado A4", 8),
      m("Papel blanco A4 para composición", 6),
      m("Escuadra pequeña", 1),
      m("Plantillas de perspectiva y formas espaciales", 5),
      m("Tarjetas de profundidad, superposición y escala", 5),
    ],
  },
  {
    number: 9,
    name: "Luces, sombras y volumen",
    materials: [
      m("Lápiz grafito 4B", 1),
      m("Papel para dibujo A4", 8),
      m("Goma moldeable", 1),
      m("Difumino de papel", 1),
      m("Tarjeta de escala de valores", 1),
      m("Láminas de objetos para estudiar luz y sombra", 3),
    ],
  },
  {
    number: 10,
    name: "Encontrar mi propio trazo",
    materials: [
      m("Papeles A4 y A5 de distintos gramajes", 12),
      m("Cartulinas blancas A4", 2),
      m("Tarjetas de desafíos personales", 8),
      m("Funda o sobre A4", 1),
      m("Guía de cierre y registro del recorrido", 1),
    ],
  },
];
