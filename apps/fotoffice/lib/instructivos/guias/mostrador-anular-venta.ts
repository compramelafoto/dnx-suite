import type { Instructivo } from "../tipos";
import { SALES_MODULE_KEY } from "@/lib/sales/constants";

export const guia: Instructivo = {
  slug: "mostrador-anular-venta",
  titulo: "Ver las ventas hechas y anular una",
  resumen: "Encontrar una venta ya cobrada, revisar qué se vendió y anularla si hubo un error.",
  seccion: "Mostrador",
  moduleKey: SALES_MODULE_KEY,
  minutos: 3,
  pasos: [
    {
      titulo: "Buscá la venta",
      texto: [
        "Entrá a Ventas → «Ventas hechas». Están todas, de la más nueva a la más vieja, con número, fecha, cliente, medio de pago y total.",
        "Tocá la venta para ver qué se vendió, a qué precio y la nota (por ejemplo «Pagó con $10.000 · vuelto $1.500»).",
      ],
      imagen: "/instructivos/mostrador-anular-venta/01-ventas-hechas.jpg",
      imagenAlt:
        "Pantalla Ventas hechas con una fila por venta: número, fecha y hora, cliente, medio de pago y total.",
    },
    {
      titulo: "Anulala",
      texto: [
        "Con la venta abierta, escribí en «Motivo de la anulación» por qué se anula (es obligatorio) y tocá «Anular venta».",
        "La venta queda marcada «Anulada el … Motivo: …».",
        "Si había que cobrar otra cosa, hacé la venta correcta de nuevo en el Cobrador.",
      ],
      sistema: [
        "No borra la venta: la deja anulada para que quede el rastro.",
        "Devuelve el stock de los productos y saca de Caja la plata de esa venta (de la misma cuenta donde había entrado).",
      ],
      nota: "Si la plata ya se devolvió en efectivo, anular la venta es lo que hace que la caja cuadre al cierre. Si no anulás, va a dar sobrante.",
    },
    {
      titulo: "Ventas que no se anulan acá",
      texto: [
        "Una venta de la tienda online se cancela desde Ventas → «Pedidos online» («Esta venta es de un pedido online: cancelala desde Pedidos online.»).",
        "La seña o el saldo de un trabajo para retirar se anulan desde la ficha del pedido, con «Anular cobro».",
      ],
    },
  ],
};
