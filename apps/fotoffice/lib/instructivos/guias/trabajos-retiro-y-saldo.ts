import type { Instructivo } from "../tipos";
import { SALES_MODULE_KEY } from "@/lib/sales/constants";

export const guia: Instructivo = {
  slug: "trabajos-retiro-y-saldo",
  titulo: "El cliente viene a retirar: cobrar el saldo y entregar",
  resumen:
    "Encontrar los trabajos del cliente, cobrarle lo que debe y dejar registrado que se lo llevó.",
  seccion: "Trabajos y entregas",
  moduleKey: SALES_MODULE_KEY,
  minutos: 4,
  pasos: [
    {
      titulo: "Buscá al cliente en el Cobrador",
      texto: [
        "Abrí el Cobrador y, en «Buscar cliente», escribí su nombre, DNI o teléfono.",
        "Debajo aparece «Tiene un pedido en curso» (o «N pedidos en curso»). Cada pedido muestra su número, «Debe $…» o «Pagado» y los trabajos con la etapa en la que están.",
      ],
      nota: "Fijate que la etapa diga «Listo para retirar» (o similar). Si dice que está en el laboratorio o en proceso, todavía no llegó: no lo cobres como entregado.",
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
        "La tarjeta pasa a «Entregado», donde queda visible 7 días.",
      ],
      sistema: ["Si era la última etapa, cierra el trabajo como terminado y lo saca de la agenda de entregas."],
    },
    {
      titulo: "Cerrá el pedido",
      texto: [
        "Cuando todos los trabajos del pedido están entregados y no hay saldo, abrí el pedido (tocá «Pedido N» en el Cobrador o buscalo en Consultas → «Pedidos») y tocá «Marcar completado».",
        "Así el pedido deja de aparecer como «En curso» en los listados.",
      ],
      nota: "Si el cliente se lleva el trabajo sin pagar todo, no completes el pedido: queda con saldo y aparece en Pedidos → «Informes» como deuda.",
    },
  ],
};
