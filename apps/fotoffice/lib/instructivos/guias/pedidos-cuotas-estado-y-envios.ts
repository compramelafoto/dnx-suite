import type { Instructivo } from "../tipos";
import { ORDERS_MODULE_KEY } from "@/lib/pedidos/acceso";

export const guia: Instructivo = {
  slug: "pedidos-cuotas-estado-y-envios",
  titulo: "Cuotas, tareas, avisos al cliente y cierre del pedido",
  resumen:
    "Ajustar el plan de cuotas, usar la lista de tareas, mandarle el pedido o un recibo al cliente y completar o cancelar el pedido.",
  seccion: "Clientes y pedidos",
  moduleKey: ORDERS_MODULE_KEY,
  minutos: 6,
  pasos: [
    {
      titulo: "Ajustá el plan de cuotas",
      texto: [
        "En «Plan de cuotas» está cada cuota con su vencimiento, importe, lo cobrado, el saldo y el estado (Pagada, Parcial, Vencida, Pendiente).",
        "Para cambiarlo tocá «Editar plan»: modificá «Vence», «Importe» o «Medio sugerido», sumá con «Agregar cuota» o quitá una. Abajo dice si las cuotas suman el total («faltan» o «sobran»). Terminá con «Guardar plan».",
      ],
      sistema: [
        "Un día antes de cada vencimiento (o lo que se haya configurado), a las 10 de la mañana, le manda al cliente el recordatorio de la cuota. Si cambiás el vencimiento, el recordatorio vuelve a salir.",
      ],
      nota: "Una cuota que ya tiene cobros no se puede quitar ni dejar por debajo de lo cobrado.",
    },
    {
      titulo: "Usá la lista de tareas",
      texto: [
        "En «Checklist» están las tareas del pedido (por ejemplo: enviar contrato, cobrar seña, confirmar horario y lugar, entregar material). Tildalas a medida que se hacen: queda quién y cuándo.",
        "Para algo que no está en la lista, escribilo en «Agregar una tarea» y tocá «Agregar». Si el pedido no tiene tareas, elegí una plantilla y tocá «Aplicar plantilla».",
      ],
    },
    {
      titulo: "Mandale el pedido o un recibo",
      texto: [
        "Tocá «Enviar por correo» o «WhatsApp».",
        "Elegí la «Plantilla» (por ejemplo «Tu pedido») o «Sin plantilla», revisá el «Asunto» y el «Mensaje» y tocá «Enviar» o «Abrir WhatsApp».",
        "«Copiar enlace del cliente» copia el enlace donde el cliente ve su pedido y paga.",
      ],
      sistema: ["Todo lo que se manda queda en el «Historial» del pedido."],
    },
    {
      titulo: "Completá el pedido",
      texto: [
        "Cuando está todo entregado y pagado, tocá «Marcar completado».",
        "El sistema no lo completa solo, ni siquiera cuando se cobra el saldo o se entrega el último trabajo.",
      ],
    },
    {
      titulo: "Cancelá un pedido",
      texto: [
        "Tocá «Cancelar pedido», escribí el «Motivo (obligatorio)» y tocá «Pasar a cancelado».",
        "Las cuotas pendientes quedan canceladas. Los cobros hechos quedan: si hay que devolver plata, anulá el cobro.",
      ],
      nota: "Un pedido cancelado no se puede reactivar.",
    },
  ],
};
