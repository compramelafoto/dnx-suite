import type { Instructivo } from "../tipos";
import { SALES_MODULE_KEY } from "@/lib/sales/constants";

export const guia: Instructivo = {
  slug: "stock-receta-consumo",
  titulo: "Decir cuánto gasta cada producto",
  resumen:
    "Armar la receta de un producto para que, al venderlo, FOTOFFICE descuente solo los insumos que usa.",
  seccion: "Stock",
  moduleKey: SALES_MODULE_KEY,
  minutos: 8,
  pasos: [
    {
      titulo: "Abrí la ficha del producto",
      texto: [
        "Entrá a «Catálogo» y tocá el producto que querés configurar, por ejemplo «Foto carnet x4» o «Copia 15x20».",
        "Abajo, después de los datos del producto, está la sección «Receta de consumo»: lo que gasta una unidad vendida.",
      ],
      nota: "Antes tenés que haber cargado los insumos (mirá «Dar de alta un insumo»). Si no hay ninguno, la sección te lo avisa.",
    },
    {
      titulo: "Agregá lo que gasta",
      imagen: "/instructivos/stock-receta-consumo/01-receta-carnet.jpg",
      imagenAlt:
        "«Receta de consumo» de la foto carnet instantánea: 1 copia 10x15 del Kit Kodak 305 cada 1 unidad vendida, y debajo «Vender 3 gasta 3 copias 10x15».",
      texto: [
        "Tocá «Agregar insumo». Cada línea se lee como una frase: «1 · copias 10x15 · Kit Kodak 305 cada 1 unidades vendidas».",
        "El primer número es cuánto gasta. Elegí el insumo y, en «cada», cuántas unidades vendidas hacen falta para ese gasto. Con «Quitar» sacás una línea. Cuando termines, tocá «Guardar».",
      ],
    },
    {
      titulo: "Ejemplos del día a día",
      texto: [
        "Foto carnet x4: 1 copia del kit y 1 sobre de carnet, cada 1 unidad vendida. Son dos líneas.",
        "Copia 15x20: 2 copias del kit cada 1 unidad vendida, porque la Kodak gasta 2 copias en una hoja grande.",
        "Polaroid 7,5×10: 1 copia del kit cada 2 unidades vendidas, porque en una hoja entran dos.",
      ],
    },
    {
      titulo: "Por qué 3 Polaroid gastan 2 copias",
      imagen: "/instructivos/stock-receta-consumo/02-receta-polaroid.jpg",
      imagenAlt:
        "«Receta de consumo» de la Polaroid: 1 copia 10x15 cada 2 unidades vendidas, y debajo «Vender 3 gasta 2 copias 10x15 (se redondea para arriba…)».",
      texto: [
        "Con la regla «1 copia cada 2», una Polaroid gasta media hoja, pero la hoja no se puede cortar a medias: 3 Polaroid ocupan 2 hojas (una con dos fotos y otra con una sola).",
        "FOTOFFICE redondea para arriba en cada venta, porque las fotos de clientes distintos no se juntan en la misma hoja. Cuando escribís la receta, abajo ves un ejemplo en vivo: «Vender 3 gasta…».",
      ],
    },
    {
      titulo: "Instantánea y «para retirar» son productos distintos",
      texto: [
        "Una Polaroid que se entrega en el momento y una Polaroid para retirar tienen precio distinto, así que se cargan como dos productos.",
        "Los dos gastan lo mismo: a cada uno le ponés la misma receta. El precio es de cada producto; el gasto de insumos se carga igual en ambos.",
      ],
    },
    {
      titulo: "Dejá que Impresión te sugiera la receta",
      texto: [
        "Si el producto se imprime en el local, aparece el botón «Sugerir desde Impresión»: completa las líneas con lo que gasta la impresora para esa hoja.",
        "Si el producto es de varias fotos por hoja, antes completá «¿Cuántas entran por hoja?». Después tocá «Sugerir desde Impresión», revisá lo que apareció y tocá «Guardar».",
      ],
      nota: "La sugerencia no guarda sola: es un borrador. Siempre revisá antes de tocar «Guardar».",
      sistema: [
        "Al cobrar en el Cobrador o al tomar un pedido, FOTOFFICE descuenta solo los insumos de la receta.",
        "Si anulás la venta o cancelás el pedido, los insumos vuelven al stock.",
        "Vender nunca se bloquea por falta de insumos: si se acaban, la existencia queda en negativo para que lo notes y repongas.",
      ],
    },
  ],
};
