import type { Instructivo } from "../tipos";
import { SALES_MODULE_KEY } from "@/lib/sales/constants";

export const guia: Instructivo = {
  slug: "ventas-mostrador",
  titulo: "Vender en el mostrador",
  resumen:
    "Cómo armar un ticket con productos del catálogo, cobrarlo y, si hace falta, anular una venta ya hecha.",
  seccion: "Dinero",
  moduleKey: SALES_MODULE_KEY,
  minutos: 5,
  pasos: [
    {
      titulo: "Entrá al Mostrador",
      texto: [
        "En el menú de la izquierda abrí Ventas y elegí Mostrador.",
        "A la izquierda están los productos del catálogo; a la derecha, el «Ticket» de la venta que estás armando.",
      ],
      nota: "Si ves el aviso «El módulo de Caja está apagado», la venta se registra igual, pero el dinero no queda anotado en Caja.",
    },
    {
      titulo: "Buscá el producto",
      texto: [
        "Escribí parte del nombre en el buscador «Escaneá un código, o buscá por nombre…». La grilla se filtra mientras escribís. También podés elegir una categoría en «Todas las categorías».",
        "Si tenés lector de códigos de barras, escaneá el producto: se suma directo al ticket.",
      ],
    },
    {
      titulo: "Sumalo al ticket",
      texto: [
        "Hacé clic en el producto. Se agrega al ticket con cantidad 1; si lo tocás de nuevo, suma uno más.",
        "Si el producto tiene talles, primero aparece «Elegí el talle de …»: tocá el talle que corresponde.",
        "En el ticket podés cambiar la cantidad o el precio de cada renglón, y sacarlo con «Quitar». Si cambiás el precio, queda marcado «Precio pisado a mano.».",
      ],
      nota: "Si un producto dice «Sin existencia», se puede vender igual; el aviso es para que sepas que hay que reponerlo.",
    },
    {
      titulo: "Algo que no está en el catálogo",
      texto: [
        "Tocá «+ Renglón suelto», escribí la «Descripción» y el «Precio» y tocá «Agregar al ticket».",
        "Sirve para algo que se vende una sola vez. No descuenta stock.",
      ],
    },
    {
      titulo: "Revisá el total y elegí cómo paga",
      texto: [
        "Abajo del ticket está el «Subtotal». Si hacés un descuento, escribilo en «Descuento» (el importe en pesos, no el porcentaje). El «Total» se actualiza solo.",
        "Si aparece el campo «Cliente», podés dejar «Sin cliente», elegir un «Cliente ya cargado» o cargar un «Cliente nuevo».",
        "En «Medio de pago» elegí Efectivo, Mercado Pago, Transferencia, Tarjeta u Otro. Si querés, agregá una «Nota (opcional)».",
      ],
    },
    {
      titulo: "Cobrá",
      texto: [
        "Tocá el botón «Cobrar $…». Aparece «Venta #… registrada.» y el ticket queda vacío, listo para la siguiente venta.",
        "El dinero se anota solo en Caja, en la categoría «Ventas», y el stock de los productos baja solo.",
      ],
      nota: "Si además aparece «No se depositó en Caja», la venta quedó hecha pero el dinero no se anotó en Caja. Avisale a quien administra Caja.",
    },
    {
      titulo: "Mirá las ventas hechas",
      texto: [
        "Entrá a Ventas → Ventas hechas. Ahí está cada venta, de la más nueva a la más vieja, con su número, fecha, cliente, medio de pago y total.",
        "Hacé clic en una venta para ver el detalle de lo que se vendió.",
      ],
    },
    {
      titulo: "Si te equivocaste, anulá la venta",
      texto: [
        "Abrí la venta en «Ventas hechas», escribí el «Motivo de la anulación» y tocá «Anular venta».",
        "La venta no se borra: queda marcada como «Anulada» y con el importe tachado. El stock vuelve y el dinero sale de Caja solo.",
        "Después, si hace falta, hacé la venta correcta desde el Mostrador.",
      ],
      nota: "Una venta que vino de un pedido de la tienda online no se anula desde acá: se cancela el pedido desde Pedidos online.",
    },
  ],
};
