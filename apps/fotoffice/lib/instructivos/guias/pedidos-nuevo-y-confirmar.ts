import type { Instructivo } from "../tipos";
import { ORDERS_MODULE_KEY } from "@/lib/pedidos/acceso";

export const guia: Instructivo = {
  slug: "pedidos-nuevo-y-confirmar",
  titulo: "Crear un pedido o confirmar uno que viene de un presupuesto",
  resumen:
    "Cargar un pedido para un evento o una sesión, con sus cuotas, o confirmar el pedido de un presupuesto que el cliente aceptó.",
  seccion: "Clientes y pedidos",
  moduleKey: ORDERS_MODULE_KEY,
  minutos: 7,
  pasos: [
    {
      titulo: "¿Cobrador o pedido?",
      texto: [
        "Para copias, fotolibros o digitalizaciones que se cobran en el mostrador, usá el Cobrador: el pedido se crea solo (guía «Tomar un trabajo para retirar»).",
        "Para un evento, una sesión o algo que se paga en cuotas, cargá el pedido desde la ficha del cliente, como se explica acá.",
      ],
    },
    {
      titulo: "Empezá desde la ficha del cliente",
      texto: [
        "Abrí la ficha del cliente y, en la tarjeta «Pedidos», tocá «Nuevo pedido».",
      ],
    },
    {
      titulo: "Cargá lo que contrató",
      texto: [
        "En «Ítems» buscá en el catálogo o tocá «Agregar ítem libre». En cada renglón ajustá la Cantidad y el Precio unitario. Abajo se ve el Total.",
      ],
    },
    {
      titulo: "Pago, evento y tareas",
      texto: [
        "En «Forma de pago» elegí «Contado» (una cuota que vence hoy) o «En N cuotas mensuales».",
        "Cargá la «Fecha del evento» y una descripción en «Evento» (por ejemplo «Casamiento en Estancia La Pradera»).",
        "En «Checklist del pedido» elegí la plantilla de tareas.",
        "Tocá «Crear pedido».",
      ],
      sistema: [
        "Le da número al pedido, arma las cuotas (una por mes desde hoy; si el evento es antes, se reparten hasta esa fecha) y copia las tareas.",
        "Crea los trabajos y las citas que tengan configurados los productos, y las cuentas a pagar a proveedores.",
        "Le manda al cliente el correo «Recibimos tu pedido».",
      ],
    },
    {
      titulo: "Confirmar un presupuesto aceptado",
      texto: [
        "Cuando el cliente acepta un presupuesto, al responsable le llega una tarea «Presupuesto aceptado: confirmar el pedido» y el presupuesto dice «Pedido por confirmar».",
        "Abrí el presupuesto y tocá «Confirmar pedido». Revisá la opción de pago, el total y las cuotas (se pueden ajustar), la plantilla de tareas, y los trabajos y citas que se van a crear (destildá lo que no corresponda).",
        "Tocá «Confirmar el pedido».",
      ],
      nota: "Si el estudio tiene encendido «Crear el pedido solo cuando el cliente acepta», el pedido ya aparece creado y el cliente va directo a pagar la seña.",
    },
  ],
};
