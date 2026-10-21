import type { Instructivo } from "../tipos";
import { SALES_MODULE_KEY } from "@/lib/sales/constants";

export const guia: Instructivo = {
  slug: "stock-cargar-paso-a-paso",
  titulo: "Cómo cargar el stock, paso a paso",
  resumen:
    "Un recorrido de punta a punta: dar de alta, definir cuánto gasta cada producto, recibir pedidos, importar facturas, contar y saber qué comprar.",
  seccion: "Stock",
  moduleKey: SALES_MODULE_KEY,
  minutos: 8,
  pasos: [
    {
      titulo: "Abrí «Stock»",
      imagen: "/instructivos/stock-cargar-paso-a-paso/01-stock.jpg",
      imagenAlt:
        "Pantalla «Stock» con el botón «Recibir pedido» arriba y el bloque «Insumos» más abajo.",
      texto: [
        "Entrá a Ventas y tocá «Stock». Desde esta pantalla se hace todo el circuito: arriba está «Recibir pedido» y más abajo los «Insumos» y el resto de los productos.",
        "Esta guía es un mapa corto. En cada paso te decimos cuál es la guía con el detalle.",
      ],
    },
    {
      titulo: "Dá de alta lo que todavía no está",
      imagen: "/instructivos/stock-cargar-paso-a-paso/05-unidad-de-compra.jpg",
      imagenAlt:
        "Alta de un insumo con su unidad de compra: el Kit 305 6R que trae 640 copias.",
      texto: [
        "Primero tiene que existir en el catálogo todo lo que vas a comprar o usar: los productos que vendés y los insumos que se gastan (papel, kits, ribbon).",
        "Si tenés la Kodak 305, en «Stock» aparece la tarjeta «Controlá el ribbon de la Kodak 305»: tocá «Configurar» y queda armado el kit.",
        "El detalle está en la guía «Dar de alta un insumo».",
      ],
    },
    {
      titulo: "Decí cuánto gasta cada producto",
      imagen: "/instructivos/stock-cargar-paso-a-paso/06-receta-polaroid.jpg",
      imagenAlt: "Receta de un producto: cuántas unidades de cada insumo gasta por cada venta.",
      texto: [
        "Para que los insumos bajen solos, cada producto necesita su receta: cuánto papel o cuántas copias gasta cada vez que se vende.",
        "El detalle está en la guía «Decir cuánto gasta cada producto».",
      ],
      sistema: [
        "Con la receta cargada, FOTOFFICE descuenta el stock al vender y lo devuelve si anulás la venta.",
      ],
    },
    {
      titulo: "Cuando llega el pedido: «Recibir pedido»",
      imagen: "/instructivos/stock-cargar-paso-a-paso/02-recepcion.jpg",
      imagenAlt:
        "Recepción de un pedido con el proveedor, el comprobante y la lista de productos escaneados.",
      texto: [
        "En «Stock» tocá «Recibir pedido» y abrí una recepción nueva. Elegí el «Proveedor» y escribí el «Comprobante».",
        "Cargá lo que llegó: escaneá el código de barras de cada caja o usá «¿No tiene código? Buscalo por nombre».",
        "El detalle está en la guía «Recibir un pedido del proveedor».",
      ],
    },
    {
      titulo: "Si tenés la factura: «Importar desde factura o remito»",
      imagen: "/instructivos/stock-cargar-paso-a-paso/03-importar.jpg",
      imagenAlt:
        "Bloque «Importar desde factura o remito» con «Subir foto o PDF», «Pegar texto» y la plantilla CSV.",
      texto: [
        "En vez de escanear todo, podés cargar las líneas desde la factura: subí una foto o un PDF y la IA lo lee, tocá «Pegar texto» para pegar un mail, o usá la plantilla CSV.",
        "El detalle está en la guía «Importar una factura del proveedor».",
      ],
    },
    {
      titulo: "Revisá las líneas y confirmá",
      imagen: "/instructivos/stock-cargar-paso-a-paso/04-revisar-lineas.jpg",
      imagenAlt:
        "Líneas importadas: una con «Elegí el producto» en rojo y otras ya asociadas, con su cantidad en bultos y su costo.",
      texto: [
        "En las líneas que no se asociaron ves «Elegí el producto»: tocá una sugerencia o buscá el producto por nombre.",
        "Controlá la «Cantidad» (en bultos, si el proveedor manda cajas o kits) y el «Costo» contra la factura.",
        "Cuando todo coincida, tocá «Confirmar recepción» y «Sí, confirmar».",
      ],
      sistema: [
        "Al confirmar, la mercadería se suma al stock y se actualiza el costo de cada producto.",
        "Si el proveedor está elegido, FOTOFFICE recuerda qué producto es cada descripción y la próxima factura se asocia sola.",
      ],
    },
    {
      titulo: "Contá y corregí",
      imagen: "/instructivos/stock-cargar-paso-a-paso/07-ajustar-por-conteo.jpg",
      imagenAlt:
        "«Ajustar por conteo» abierto en el kit: «Contaste» y «Por qué ajustás».",
      texto: [
        "De vez en cuando contá lo que hay de verdad. En la tarjeta del producto tocá «Ajustar por conteo», escribí lo que contaste y el motivo.",
        "El detalle está en la guía «Contar lo que hay y corregir».",
      ],
    },
    {
      titulo: "Sabé qué comprar",
      texto: [
        "En «Stock», el bloque «Para comprar» te muestra lo que está por terminarse y cuántos días te alcanza. Con «Copiar lista» armás el pedido para el proveedor y lo pegás en un WhatsApp o un mail.",
        "En el inicio también ves la tarjeta «Para comprar», que te avisa sin tener que entrar a «Stock».",
        "El detalle está en la guía «Saber qué comprar y armar el pedido al proveedor».",
      ],
    },
  ],
};
