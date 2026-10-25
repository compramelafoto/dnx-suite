import type { Instructivo } from "../tipos";
import { SALES_MODULE_KEY } from "@/lib/sales/constants";

export const guia: Instructivo = {
  slug: "trabajos-tomar-con-sena",
  titulo: "Tomar un trabajo para retirar (con seña)",
  resumen:
    "Recibir un trabajo que se entrega otro día (copias, fotolibro, digitalización, rollo), fijar la fecha de entrega y cobrar la seña o el total en el Cobrador.",
  seccion: "Trabajos y entregas",
  moduleKey: SALES_MODULE_KEY,
  minutos: 5,
  pasos: [
    {
      titulo: "Sumá el trabajo al ticket",
      texto: [
        "En el Cobrador buscá el producto del trabajo (por ejemplo, «Copias 10x15» o «Fotolibro 20x30») y tocalo, igual que en una venta común.",
        "Todos los renglones muestran «Seña». En los productos que llevan proceso ya viene prendido y no se apaga: siempre se producen después, y aparecen con la etiqueta «Pedido». En cualquier otro producto (un portarretratos, un marco) es un interruptor: si el cliente deja seña y lo retira después, activalo y ese renglón también pasa a ser un pedido.",
        "Debajo aparece el recuadro «Pedido para retirar · N trabajos».",
        "Podés mezclar en el mismo ticket cosas que se lleva ahora (un portarretratos) con trabajos para retirar: el sistema los separa solo.",
      ],
      imagen: "/instructivos/trabajos-tomar-con-sena/01-pedido-para-retirar.jpg",
      imagenAlt:
        "Ticket con una Copia instantánea 10x15 con «Seña» activada y marcada «Pedido», y una Fotocopia color para llevar con su botón «Seña» apagado; a la derecha el recuadro «Pedido para retirar · 1 trabajo» con la entrega de mañana, Deja seña o Paga todo, la seña propuesta, «Se cobra ahora $ 3.300,00 · al retirar $ 2.500,00» y el aviso «Elegí el cliente para poder cobrar.».",
      nota: "Si el producto no muestra «Pedido» ni tenés el interruptor «Seña» activado, se cobra como venta común: se lo lleva en el momento y no aparece en el tablero de trabajos.",
    },
    {
      titulo: "Elegí el cliente",
      texto: [
        "Para un trabajo el cliente es obligatorio: hay que saber a quién avisarle y a quién entregárselo.",
        "Buscalo en «Buscar cliente» o cargalo con «Cliente nuevo». Pedile el correo y el WhatsApp: son los medios por donde le llega el aviso de que está listo.",
      ],
      nota: "Sin cliente el botón queda bloqueado y aparece «Elegí el cliente para poder cobrar.».",
    },
    {
      titulo: "Confirmá la fecha de entrega",
      texto: [
        "En «Entrega» ya viene una fecha: hoy más el plazo de ese producto (si no tiene plazo propio, un día). Si cae domingo, pasa al lunes.",
        "Cambiala si le prometés otro día. No acepta fechas pasadas.",
      ],
    },
    {
      titulo: "Seña o pago total",
      texto: [
        "Elegí «Deja seña» o «Paga todo».",
        "Con seña, el campo «Seña» propone la mitad, redondeada hacia arriba a $100. Cambiala si el cliente deja otro importe.",
        "Debajo se ve «Se cobra ahora $… · al retirar $…».",
      ],
    },
    {
      titulo: "Cobrá",
      texto: [
        "Elegí el medio de pago y tocá «Cobrar seña $…» (o «Cobrar $…» si paga todo).",
        "Aparece «Pedido N creado», «Cobrado $… · queda $… al retirar» y, si se llevó algo en el momento, «Y la venta #N.».",
        "Decile al cliente el número de pedido y la fecha de entrega.",
      ],
      sistema: [
        "Crea un pedido con un trabajo por cada producto con proceso y por cada renglón con «Seña», con la fecha de entrega prometida. Cada trabajo aparece en Proyectos → «En curso», en la columna «Recibido».",
        "Los renglones con «Seña» que no tienen proceso propio entran al flujo «Para retirar» (Recibido, En preparación, Listo para retirar, Entregado), con plazo sugerido de 1 día. Si el producto lleva control de stock, la unidad se aparta en el momento.",
        "Registra la seña como cobro del pedido, con recibo, y la anota en Caja (en efectivo, entra al turno abierto).",
        "Lo que se lleva en el momento (sin «Seña») queda como venta común, con su stock.",
        "Le manda al cliente el correo «Recibimos tu pedido», con qué pidió, lo pagado, el saldo y cuándo va a estar listo.",
        "Recuerda el plazo que usaste para proponerlo la próxima vez.",
      ],
      nota: "Si aparece en amarillo «El pedido N quedó creado pero la seña no se registró», el trabajo ya está cargado: cobrá la seña desde la ficha del pedido con «Registrar cobro». No vuelvas a cargar el trabajo.",
    },
  ],
};
