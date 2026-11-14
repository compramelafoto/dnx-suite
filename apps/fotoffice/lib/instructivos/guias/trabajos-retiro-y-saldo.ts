import type { Instructivo } from "../tipos";
import { SALES_MODULE_KEY } from "@/lib/sales/constants";

export const guia: Instructivo = {
  slug: "trabajos-retiro-y-saldo",
  titulo: "El cliente viene a retirar: cobrar el saldo y entregar",
  resumen:
    "Cobrarle lo que debe y dejar registrado que se lo llevó: en un solo paso desde el tablero de trabajos, o desde el Cobrador.",
  seccion: "Trabajos y entregas",
  moduleKey: SALES_MODULE_KEY,
  minutos: 4,
  pasos: [
    {
      titulo: "Lo más rápido: «Cobrar y entregar» en el tablero",
      texto: [
        "Entrá a Proyectos → «En curso» y buscá la tarjeta del cliente en la columna «Listo para retirar».",
        "Si el pedido debe dinero, la tarjeta dice «Retenido · debe $…» y el botón es «Cobrar y entregar». Tocalo (también podés arrastrar la tarjeta a «Entregado»).",
        "En la ventana elegí el medio de pago. En efectivo, si querés, escribí con cuánto paga y te muestra el vuelto.",
        "Si el pedido tiene otros trabajos listos, aparecen tildados para entregarlos juntos: destildá los que no se lleva.",
        "Tocá «Cobrar $… y entregar».",
      ],
      sistema: [
        "Cobra el saldo del pedido entero con recibo numerado y lo anota en Caja (en efectivo, entra al turno abierto). Es el mismo cobro que «Cobrar saldo» del Cobrador.",
        "Después marca como entregados los trabajos tildados. Si el cobro no entra, no se entrega nada.",
      ],
      nota: "Si el cobro entró pero la entrega falló (por ejemplo, otra persona movió la tarjeta), la ventana lo avisa y el botón pasa a «Reintentar entrega»: no se vuelve a cobrar. Los pasos de abajo son el camino largo, desde el Cobrador.",
    },
    {
      titulo: "Buscá al cliente en el Cobrador",
      texto: [
        "Abrí el Cobrador y, en «Buscar cliente», escribí su nombre, DNI o teléfono.",
        "Debajo aparece «Tiene un pedido en curso» (o «N pedidos en curso»). Cada pedido muestra su número, «Debe $…» o «Pagado» y los trabajos con la etapa en la que están.",
      ],
      nota: "Si el pedido debe dinero y el trabajo ya está en «Listo para retirar», el Cobrador avisa «Debe $… · retenido hasta pagar»: no se puede entregar hasta cobrar el saldo. Fijate que la etapa diga «Listo para retirar» (o similar). Si dice que está en el laboratorio o en proceso, todavía no llegó: no lo cobres como entregado.",
    },
    {
      titulo: "Cobrá el saldo",
      texto: [
        "Con el ticket vacío, elegí el medio de pago y tocá «Cobrar saldo $… ([medio])».",
        "Si paga por transferencia o Mercado Pago, podés usar el «Verificar pago» chico que aparece al lado.",
        "Aparece «Saldo del pedido N cobrado: $…. Recibo R.».",
      ],
      sistema: [
        "Registra el cobro en el pedido, con recibo numerado, y lo anota en Caja (en efectivo, entra al turno abierto).",
        "Si el cliente tiene correo y el aviso de recibo está encendido, le manda el recibo.",
      ],
      nota: "Si además se lleva algo más (un portarretratos), cobralo aparte como venta común, antes o después del saldo.",
    },
    {
      titulo: "Marcá el trabajo como entregado",
      texto: [
        "Cobrar el saldo NO marca el trabajo como entregado. Hay que hacerlo aparte.",
        "Entrá a Proyectos → «En curso», buscá la tarjeta del cliente en la columna «Listo para retirar» y tocá «Entregado».",
        "Si el pedido todavía debe dinero, la tarjeta dice «Retenido · debe $…» y en lugar de «Entregado» aparece «Cobrar y entregar» (el primer paso de esta guía).",
        "La tarjeta pasa a «Entregado», donde queda visible 7 días.",
      ],
      sistema: [
        "Rechaza la entrega mientras el pedido tenga saldo: ni siquiera quien administra puede saltearlo. Un trabajo sí puede quedar en «Listo para retirar» con deuda.",
        "Si era la última etapa, cierra el trabajo como terminado y lo saca de la agenda de entregas.",
      ],
    },
    {
      titulo: "Cerrá el pedido",
      texto: [
        "Cuando todos los trabajos del pedido están entregados y no hay saldo, abrí el pedido (tocá «Pedido N» en el Cobrador o buscalo en Consultas → «Pedidos») y tocá «Marcar completado».",
        "Así el pedido deja de aparecer como «En curso» en los listados.",
      ],
    },
  ],
};
