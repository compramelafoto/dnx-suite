import type { Instructivo } from "../tipos";
import { SALES_MODULE_KEY } from "@/lib/sales/constants";

export const guia: Instructivo = {
  slug: "stock-recibir-pedido",
  titulo: "Recibir un pedido del proveedor",
  resumen:
    "Escanear las cajas que llegan, revisar los costos y confirmar para que todo se sume al stock de una sola vez.",
  seccion: "Stock",
  moduleKey: SALES_MODULE_KEY,
  minutos: 6,
  pasos: [
    {
      titulo: "Tocá «Recibir pedido»",
      texto: [
        "Entrá a «Stock» y tocá «Recibir pedido». Se abre «Recepción de pedidos», donde quedan todos los pedidos que recibiste.",
        "Ahí tocá otra vez «Recibir pedido»: se abre una recepción nueva, con su número («Recepción» y el número arriba).",
      ],
      nota: "Todavía no se suma nada al stock: eso pasa recién cuando confirmás.",
    },
    {
      titulo: "Elegí el proveedor y anotá el comprobante",
      texto: [
        "Arriba elegí el «Proveedor» (si no sabés, dejá «Sin proveedor») y revisá la «Fecha».",
        "En «Comprobante» escribí el número de la factura o del remito. Si los costos del comprobante ya traen el IVA, tildá «Los costos incluyen IVA».",
      ],
      sistema: ["Estos datos se guardan solos, campo por campo. No hay un botón de guardar."],
    },
    {
      titulo: "Escaneá caja por caja",
      texto: [
        "Hacé clic en «Escaneá o escribí el código» y pasá el lector por el código de barras de cada caja. Si no hay lector, escribí el código y apretá Enter.",
        "Cada escaneo suma uno. Si llegaron 5 cajas iguales, escaneás 5 veces: te avisa «Se sumó uno» y la cantidad sube.",
        "Si el producto no tiene código, usá «¿No tiene código? Buscalo por nombre»: escribí dos letras o más y elegilo de la lista.",
      ],
    },
    {
      titulo: "Revisá cantidades y costos",
      texto: [
        "Cada producto aparece en la lista con su «Cantidad» y su «Costo». Podés cambiar la cantidad escribiendo el número que llegó.",
        "Si el proveedor manda bultos (por ejemplo cajas de 100 hojas), tildá «en bultos de» y escribí cuántas unidades trae cada bulto: abajo te muestra el total en unidades.",
        "Escribí el costo de cada producto. Al lado ves el «Costo anterior (c/u)» y, si lo que pagás ahora es más caro, la fila se marca con el aviso «El costo subió». También ves el «Precio y margen», para saber si el precio de venta todavía te conviene.",
        "Si cargaste algo por error, usá «Quitar» en esa fila.",
      ],
    },
    {
      titulo: "Si un producto no está: «Dar de alta»",
      texto: [
        "Si escaneás un código que no existe en tu catálogo, se abre «Dar de alta» con el aviso de que el código no está en tu catálogo. A veces ya trae el nombre: revisalo.",
        "Elegí qué es: «Producto (se vende)» o «Insumo (se usa)», completá lo que pide y tocá «Dar de alta y sumar». Queda creado y ya cargado en la recepción.",
      ],
    },
    {
      titulo: "Confirmá la recepción",
      texto: [
        "Cuando termines de escanear todo, mirá el «Total» y la cantidad de unidades de stock que figura abajo. Tocá «Confirmar recepción».",
        "Te pregunta cuántas unidades se van a sumar al stock. Si está bien, tocá «Sí, confirmar». Si querés revisar algo más, tocá «Volver».",
      ],
      sistema: [
        "FOTOFFICE suma al stock todo lo que escaneaste, deja anotada la entrada de cada producto y actualiza el costo con el último que cargaste.",
        "Una recepción confirmada ya no se puede editar. Si algo no cierra, corregilo desde «Stock» con «Ajustar por conteo».",
      ],
      nota: "Si te equivocaste de recepción entera, tocá «Descartar»: no se suma nada al stock.",
    },
    {
      titulo: "Dejarla a medias y seguir después",
      texto: [
        "Si llegaron muchas cajas y no alcanzás a terminar, simplemente cerrá o tocá «Volver al historial». Nada se pierde.",
        "Para retomarla, entrá a «Recepción de pedidos»: las que quedaron abiertas figuran como «Sin confirmar». Tocá el número y seguí escaneando donde habías quedado.",
      ],
    },
  ],
};
