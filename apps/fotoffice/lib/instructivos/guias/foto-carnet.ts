import type { Instructivo } from "../tipos";
import { SALES_MODULE_KEY } from "@/lib/sales/constants";

export const guia: Instructivo = {
  slug: "foto-carnet",
  titulo: "Hacer una foto carnet y la plancha para imprimir",
  resumen:
    "Encuadrar la foto del cliente a la medida del trámite, retocarla y descargar la plancha lista para imprimir en una copia 10x15 o 13x18.",
  seccion: "Mostrador",
  moduleKey: SALES_MODULE_KEY,
  minutos: 6,
  pasos: [
    {
      titulo: "Abrí Foto carnet",
      texto: [
        "En el menú abrí Ventas y elegí «Foto carnet». También la encontrás con el buscador (Ctrl+K) escribiendo «carnet» o «recortar».",
        "Arriba están los cuatro pasos: «Foto y medida», «Encuadre», «Retoque» y «Plancha». Se avanza con «Siguiente» y se vuelve con «Atrás».",
      ],
    },
    {
      titulo: "Elegí la foto",
      texto: [
        "Tocá «Elegir la foto» y buscá el archivo: la que sacaste en el estudio o la que te mandó el cliente por WhatsApp o por correo.",
        "Sirven JPG, PNG o WebP de hasta 40 MB.",
      ],
      imagen: "/instructivos/foto-carnet/01-foto-y-medida.jpg",
      imagenAlt:
        "Paso 1 del editor: el botón «Elegir otra foto» con la foto cargada y, debajo, la medida del trámite.",
      sistema: [
        "La foto no se sube a ningún lado: todo se hace en esta computadora. Sólo queda guardada si al final la guardás en la ficha del cliente.",
      ],
      nota: "Las fotos HEIC del iPhone no se abren. Pedile al cliente que te la mande por WhatsApp (llega como JPG) o pasala a JPG.",
    },
    {
      titulo: "Elegí la medida del trámite",
      texto: [
        "En «Medidas más usadas» elegí la que pide el trámite: 4 × 4, 3,5 × 4,5 (pasaporte y visas), 3 × 3, 3 × 4, 5 × 5, 5 × 7, 2,4 × 3,2, 2,6 × 3,2 o 2,5 × 3,5 cm. Al lado de cada una dice cuántas entran en la copia.",
        "Si piden otra, escribila en «Ancho (cm)» y «Alto (cm)». Cada lado tiene que medir al menos 2 cm.",
        "Abajo, «Cómo sacar una buena foto carnet» tiene los consejos para la toma: fondo claro, luz de frente, mirada al lente, expresión neutra.",
      ],
    },
    {
      titulo: "Encuadrá la cara",
      texto: [
        "Tocá «Siguiente». Aparece la foto con un recuadro de la medida elegida.",
        "Arrastrá la foto para centrar la cara. Con «Zoom» ajustá el tamaño de la cabeza y con «Giro» enderezá los hombros. También podés usar los botones − y +.",
      ],
      imagen: "/instructivos/foto-carnet/02-encuadre.jpg",
      imagenAlt:
        "Paso 2: la foto con el recuadro de 4 × 4 cm y la grilla, y a la derecha los controles de Zoom y Giro.",
      nota: "Mirá los requisitos del trámite: algunos piden que la cabeza ocupe una parte fija de la foto.",
    },
    {
      titulo: "Retocala si hace falta",
      texto: [
        "Tocá «Siguiente». A la izquierda se ve cómo queda cada foto y a la derecha los ajustes: Exposición, Contraste, Sombras, Negros, Luces, Altas luces, Saturación, Temperatura, Tinte, Nitidez suave, Fondo más blanco y Suavizado del borde.",
        "«Fondo más blanco» aclara un fondo que ya es claro; no reemplaza un fondo de color. Si te pasaste, «Volver a cero» deja todo como estaba.",
      ],
      imagen: "/instructivos/foto-carnet/03-retoque.jpg",
      imagenAlt:
        "Paso 3: a la izquierda «Así queda cada foto» y a la derecha los deslizadores de Exposición, Contraste, Sombras, Negros, Luces, Altas luces, Saturación, Temperatura, Tinte y Nitidez, con el botón «Volver a cero».",
    },
    {
      titulo: "Armá la plancha",
      texto: [
        "Tocá «Siguiente». Se ve la plancha completa, con la foto repetida y guías grises para cortar.",
        "En «Se imprime en» elegí «Copia 10 × 15» o «Copia 13 × 18».",
        "En «Cantidad de fotos» dejá «Todas las que entran» o elegí cuántas quiere el cliente.",
      ],
      imagen: "/instructivos/foto-carnet/04-plancha.jpg",
      imagenAlt:
        "Paso 4: la plancha 10 × 15 con 6 fotos de 4 × 4 cm y guías de corte; a la derecha «Se imprime en», «Cantidad de fotos», el botón «Descargar para imprimir», el recuadro para guardarla en la ficha del cliente y el aviso «Listo: se descargó…».",
    },
    {
      titulo: "Descargala e imprimila",
      texto: [
        "Tocá «Descargar para imprimir». El archivo se llama con la medida, la cantidad, la copia y la fecha, por ejemplo «foto-carnet_4x4cm_6u_10x15_20261019_1530.jpg».",
        "Imprimila en una copia del tamaño elegido, en tamaño real: sin «ajustar a la página» ni recortes de la impresora.",
        "Cortá por las guías grises con la guillotina.",
      ],
      sistema: ["El archivo sale en JPG marcado a 300 dpi, así el laboratorio y la impresora lo imprimen a la medida exacta."],
    },
    {
      titulo: "Guardala en la ficha del cliente (opcional)",
      texto: [
        "Si el cliente puede volver a pedirla, en «Guardarla en la ficha del cliente» buscalo por nombre, DNI o teléfono (o cargalo con «+») y tocá «Guardar en la ficha».",
        "Queda en sus «Adjuntos» para volver a imprimirla otro día sin rehacerla.",
      ],
      nota: "Para cobrarla, sumá el producto «Foto carnet digital» o «Foto carnet instantánea» en el Cobrador, como cualquier venta.",
    },
  ],
};
