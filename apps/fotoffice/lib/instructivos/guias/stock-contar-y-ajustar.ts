import type { Instructivo } from "../tipos";
import { SALES_MODULE_KEY } from "@/lib/sales/constants";

export const guia: Instructivo = {
  slug: "stock-contar-y-ajustar",
  titulo: "Contar lo que hay y corregir",
  resumen:
    "Cargar lo que entró, contar lo que realmente hay y corregir la existencia dejando anotado el motivo.",
  seccion: "Stock",
  moduleKey: SALES_MODULE_KEY,
  minutos: 5,
  pasos: [
    {
      titulo: "Abrí «Stock»",
      imagen: "/instructivos/stock-contar-y-ajustar/01-stock-insumos.jpg",
      imagenAlt:
        "Pantalla «Stock» con el bloque «Insumos»: el Kit Kodak 305 con su existencia en copias 10x15 y los botones «Cargar entrada» y «Ajustar por conteo».",
      texto: [
        "Entrá a «Stock». Arriba aparece «Para reponer» con lo que está por debajo del mínimo; más abajo, los «Insumos» y el resto de los productos.",
        "Cada tarjeta muestra la «Existencia» (con su unidad, por ejemplo «copias 10x15»), el «Mínimo» y dos botones: «Cargar entrada» y «Ajustar por conteo».",
      ],
    },
    {
      titulo: "Cuando llega mercadería: «Cargar entrada»",
      imagen: "/instructivos/stock-contar-y-ajustar/02-cargar-entrada-kit.jpg",
      imagenAlt:
        "«Cargar entrada» abierto en el kit: cantidad 2, la casilla «Cargo en Kit 305 6R (640 c/u)» tildada y «Costo por kit (opcional)».",
      texto: [
        "Tocá «Cargar entrada» en la tarjeta, escribí «Cantidad que entró» y, si querés, el costo. Después tocá «Confirmar entrada».",
        "Si el insumo tiene unidad de compra (como el «Kit 305 6R»), aparece la casilla «Cargo en Kit 305 6R (640 c/u)». Tildala y escribí cuántos kits llegaron: FOTOFFICE suma las copias solo. El costo pasa a ser «Costo por kit».",
      ],
      sistema: ["Queda registrada la entrada en el historial de movimientos del producto."],
    },
    {
      titulo: "Contá lo que hay de verdad",
      texto: [
        "A veces lo que dice FOTOFFICE no coincide con lo que hay: se rompió una hoja, una prueba gastó papel, o recién arrancás. Contá lo que hay físicamente.",
        "Tocá «Ajustar por conteo» y escribí el número en «Contaste». Es lo que hay, no la diferencia: si contaste 480 copias, escribí 480.",
      ],
    },
    {
      titulo: "Anotá por qué ajustás",
      imagen: "/instructivos/stock-contar-y-ajustar/03-ajustar-por-conteo.jpg",
      imagenAlt:
        "«Ajustar por conteo» abierto en el kit: «Contaste» 245 y «Por qué ajustás» con «Conteo de fin de mes».",
      texto: [
        "En «Por qué ajustás» escribí el motivo (por ejemplo «Conteo de fin de mes»). Es obligatorio: sin nota no te deja confirmar.",
        "Tocá «Confirmar ajuste». La existencia queda igual a lo que contaste.",
      ],
      sistema: [
        "FOTOFFICE calcula la diferencia contra lo que figuraba y la guarda como un movimiento con tu nota, para poder revisar quién corrigió qué y cuándo.",
      ],
      nota: "Con la Kodak 305, el primer conteo es el del ribbon: contá cuántas copias le quedan y cargalo en el kit con «Ajustar por conteo».",
    },
  ],
};
