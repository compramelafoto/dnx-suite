import type { Instructivo } from "../tipos";
import { SALES_MODULE_KEY } from "@/lib/sales/constants";

export const guia: Instructivo = {
  slug: "ventas-mostrador",
  titulo: "Cobrar una venta en el Cobrador",
  resumen:
    "Armar el ticket con productos del catálogo, elegir cómo paga el cliente, calcular el vuelto y cobrar.",
  seccion: "Mostrador",
  moduleKey: SALES_MODULE_KEY,
  minutos: 6,
  pasos: [
    {
      titulo: "Abrí el Cobrador",
      texto: [
        "Tocá el botón grande «Cobrador» en el inicio, o elegí «Cobrador» primero en el menú de Caja. Las dos llevan a la pantalla «Mostrador».",
        "La pantalla tiene tres partes: a la izquierda el catálogo, en el medio el «Ticket» y a la derecha el cobro. El menú lateral se esconde para que haya más lugar.",
      ],
      imagen: "/instructivos/ventas-mostrador/01-mostrador.jpg",
      imagenAlt:
        "Pantalla Mostrador: a la izquierda el buscador y el catálogo con precios, en el medio el Ticket vacío con los atajos de teclado y a la derecha el buscador de cliente, el total, los medios de pago y el botón Cobrar.",
      nota: "Si arriba dice «La Caja está apagada: las ventas se registran, pero el dinero no entra al libro.», avisale a quien administra FOTOFFICE antes de cobrar.",
    },
    {
      titulo: "Buscá el producto",
      texto: [
        "Escribí parte del nombre en «Nombre o código de barras», o elegí una categoría en «Todas las categorías».",
        "Con lector de códigos de barras, escaneá el producto: entra directo al ticket.",
        "Con el teclado: ↑ y ↓ recorren la lista y Enter suma el marcado.",
      ],
    },
    {
      titulo: "Sumalo al ticket",
      texto: [
        "Tocá el producto: se suma 1 al ticket y en la tarjeta aparece «×1». Cada toque suma uno más.",
        "Si el producto tiene talles aparece «Elegí el talle de …», con la existencia de cada uno. Tocá el talle.",
      ],
      nota: "«Sin existencia» no impide vender: es un aviso de que hay que reponer.",
    },
    {
      titulo: "Ajustá el ticket",
      texto: [
        "Con − y + cambiás la cantidad. Cuando la cantidad es 1, el − se convierte en un tacho que saca el renglón.",
        "Tocá el precio («$… c/u») para cambiarlo. El renglón queda marcado «· precio cambiado».",
        "El tacho de arriba del ticket lo vacía entero.",
      ],
      imagen: "/instructivos/ventas-mostrador/02-ticket.jpg",
      imagenAlt:
        "Ticket con dos renglones, Fotocopia color por 2 y Sticker por 1, con los botones de cantidad y el total de $ 2.100.",
    },
    {
      titulo: "Algo que no está en el catálogo",
      texto: [
        "Tocá «+ Otro», escribí «Qué es» y el «Precio», y tocá «Agregar».",
        "Sirve para algo que se vende una sola vez. No descuenta stock.",
      ],
    },
    {
      titulo: "Elegí el cliente (si corresponde)",
      texto: [
        "En «Buscar cliente» escribí nombre, apellido, DNI, teléfono o correo y elegilo de la lista.",
        "Si es la primera vez que viene, tocá «Cliente nuevo», completá Nombre, Apellido, DNI, «Teléfono o WhatsApp» y Correo, y tocá «Guardar y usar».",
        "En una venta común el cliente es opcional. Para un trabajo que queda para retirar es obligatorio (ver «Tomar un trabajo para retirar»).",
      ],
      sistema: [
        "Si el DNI, el teléfono o el correo ya están cargados, usa esa ficha en vez de crear un cliente repetido.",
        "Si el cliente tiene trabajos en curso, aparecen debajo con lo que debe.",
      ],
    },
    {
      titulo: "Descuento o nota",
      texto: [
        "Abrí «Descuento o nota». En «Descuento» escribí el importe en pesos (no el porcentaje). El «Total» se recalcula.",
        "En «Nota (opcional)» podés dejar un comentario sobre la venta.",
      ],
    },
    {
      titulo: "Elegí cómo paga",
      texto: [
        "Tocá el medio: «Efectivo», «Mercado Pago», «Transferencia», «Tarjeta» u «Otro».",
        "Si paga en efectivo, en «Paga con» tocá «Justo» o el billete con el que paga (los botones ya vienen redondeados). Si no está, usá «Otro monto».",
        "Aparece «Vuelto $…» con lo que tenés que devolver. Si dice «Faltan $…» en rojo, lo que entregó no alcanza y el botón de cobrar queda bloqueado.",
        "Para transferencia y Mercado Pago mirá la guía «Cobrar por transferencia o con el QR».",
      ],
      imagen: "/instructivos/ventas-mostrador/03-paga-con-y-vuelto.jpg",
      imagenAlt:
        "Medio Efectivo con el bloque Paga con: botones Justo, $ 3.000, $ 4.000, $ 10.000 y $ 20.000, el monto elegido y el vuelto de $ 900 en verde.",
    },
    {
      titulo: "Cobrá",
      texto: [
        "Tocá «Cobrar $…» (o apretá Ctrl+Enter; en Mac, ⌘+Enter). Mientras procesa dice «Cobrando…».",
        "Aparece «Venta #… cobrada» y, si hay vuelto, «Dar de vuelto $…». El ticket queda vacío para la próxima venta.",
      ],
      sistema: [
        "Registra la venta con número y baja el stock de cada producto.",
        "Anota el ingreso en Caja con la categoría «Ventas»: el efectivo va a la caja del mostrador (y al turno abierto) y Mercado Pago, transferencia y tarjeta van a la cuenta digital.",
        "Escribe en la venta con cuánto pagó y cuánto vuelto se dio, para que el cierre de caja se pueda explicar.",
      ],
      nota: "Si después de cobrar aparece «No se depositó en Caja: no va a aparecer en el libro.», la venta quedó hecha pero la plata no se anotó. Avisale a quien administra la Caja.",
    },
    {
      titulo: "Atajos de teclado",
      texto: [
        "+ y − cambian la cantidad del último renglón; escribir un número (por ejemplo 10) la fija.",
        "↑ ↓ y Enter recorren y suman del catálogo. Esc vacía el ticket.",
        "Ctrl+Z (⌘+Z en Mac) deshace el último cambio, mientras no hayas cobrado. Ctrl+Enter (⌘+Enter) cobra.",
      ],
    },
  ],
};
