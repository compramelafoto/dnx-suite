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
        "Los productos que llevan proceso aparecen en el ticket con la etiqueta «Pedido». Debajo aparece el recuadro «Pedido para retirar · N trabajos».",
        "Podés mezclar en el mismo ticket cosas que se lleva ahora (un portarretratos) con trabajos para retirar: el sistema los separa solo.",
      ],
      imagen: "/instructivos/trabajos-tomar-con-sena/01-pedido-para-retirar.jpg",
      imagenAlt:
        "Ticket con dos productos para llevar y una Ampliación 20x30 marcada «Pedido»; a la derecha el recuadro «Pedido para retirar · 1 trabajo» con la fecha de entrega, Deja seña o Paga todo, el importe de la seña y el aviso «Elegí el cliente para poder cobrar.».",
      nota: "Si el producto no muestra «Pedido», no tiene cargado un proceso: se cobra como venta común y no aparece en el tablero de trabajos. Avisale a quien administra el catálogo (en la ficha del producto, «Proyecto que genera»).",
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
        "En «Entrega» ya viene una fecha: hoy más el plazo de ese producto. Si cae domingo, pasa al lunes.",
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
        "Crea un pedido con un trabajo por cada producto con proceso, con la fecha de entrega prometida. Cada trabajo aparece en Proyectos → «En curso», en la columna «Recibido».",
        "Registra la seña como cobro del pedido, con recibo, y la anota en Caja (en efectivo, entra al turno abierto).",
        "Lo que se lleva en el momento queda como venta común, con su stock.",
        "Le manda al cliente el correo «Recibimos tu pedido», con qué pidió, lo pagado, el saldo y cuándo va a estar listo.",
        "Recuerda el plazo que usaste para proponerlo la próxima vez.",
      ],
      nota: "Si aparece en amarillo «El pedido N quedó creado pero la seña no se registró», el trabajo ya está cargado: cobrá la seña desde la ficha del pedido con «Registrar cobro». No vuelvas a cargar el trabajo.",
    },
  ],
};
