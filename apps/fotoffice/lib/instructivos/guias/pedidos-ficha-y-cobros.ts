import type { Instructivo } from "../tipos";
import { ORDERS_MODULE_KEY } from "@/lib/pedidos/acceso";

export const guia: Instructivo = {
  slug: "pedidos-ficha-y-cobros",
  titulo: "La ficha del pedido: cobrar una seña o una cuota y dar el recibo",
  resumen:
    "Encontrar un pedido, leer lo que se debe, registrar lo que paga el cliente con su recibo y anular un cobro mal cargado.",
  seccion: "Clientes y pedidos",
  moduleKey: ORDERS_MODULE_KEY,
  minutos: 7,
  pasos: [
    {
      titulo: "Encontrá el pedido",
      texto: [
        "En el menú abrí Consultas y elegí «Pedidos». Están todos, con N°, Contacto, Evento, Estado, Total, Cobrado, Saldo y Próximo vencimiento.",
        "Filtrá por Estado, por «Con saldo» o por «Con vencidas» para ver lo que hay que cobrar.",
        "También se llega desde la ficha del cliente (tarjeta Pedidos) o desde el Cobrador, tocando «Pedido N» debajo del cliente.",
      ],
      imagen: "/instructivos/pedidos-ficha-y-cobros/01-pedidos.jpg",
      imagenAlt:
        "Pantalla Pedidos con los botones Informes, A pagar y Nuevo pedido, el buscador y los filtros Estado, Saldo y Cuotas vencidas.",
    },
    {
      titulo: "Leé la ficha del pedido",
      texto: [
        "Arriba: el número, el estado (Confirmado, En curso, Completado o Cancelado) y botones para ir al contacto, al presupuesto o a la consulta.",
        "«Evento y pago»: fecha y descripción del evento, la opción de pago, el Total, lo Cobrado, el Saldo y, en rojo, lo «Vencido».",
        "Más abajo: «Cobros y recibos», «Plan de cuotas», «Checklist», «Proyectos» (los trabajos), «Citas», «Ítems» e «Historial».",
      ],
    },
    {
      titulo: "Registrá un cobro",
      texto: [
        "Tocá «Registrar cobro». Arriba dice el «Saldo del pedido».",
        "Completá el «Importe», la «Fecha» (no puede ser futura) y el «Medio». Si te mandó un comprobante, subilo en «Comprobante (opcional)».",
        "Dejá sin marcar «Repartir entre las cuotas a mano»: el sistema lo imputa solo, de la cuota más vieja a la más nueva.",
        "Tocá «Registrar cobro».",
      ],
      sistema: [
        "Arma el recibo numerado y lo anota en Caja, en la cuenta que corresponde al medio (en efectivo, entra al turno abierto).",
        "Si es el primer cobro, el pedido pasa solo a «En curso» y los trabajos que esperaban la seña avanzan.",
        "Si el cliente tiene correo y el recibo automático está encendido, se lo manda.",
      ],
      nota: "Un pedido que viene de un presupuesto aceptado se paga por transferencia desde su enlace, pero FOTOFFICE todavía no reconoce las transferencias solo: cuando veas la plata en la cuenta, registrá el cobro acá.",
    },
    {
      titulo: "Entregá el recibo",
      texto: [
        "Aparece «Cobro registrado» con el número de recibo. Tocá «Imprimir» para darlo en papel, o mandalo por correo o WhatsApp.",
        "Después, «Cerrar». El cobro queda en «Cobros y recibos», con «Ver recibo».",
      ],
    },
    {
      titulo: "Si aparece un aviso",
      texto: [
        "«El importe supera el saldo del pedido»: está cobrando de más; revisá el importe.",
        "«Para registrar cobros encendé el módulo Caja» o «hace falta una cuenta de Caja»: avisale a quien administra FOTOFFICE.",
        "«El pedido está cancelado: no admite cobros.»",
      ],
    },
    {
      titulo: "Anulá un cobro mal cargado",
      texto: [
        "En «Cobros y recibos», tocá «Anular cobro» en el que está mal, escribí el «Motivo (obligatorio)» y confirmá.",
        "Después registrá el cobro correcto.",
      ],
      sistema: ["Saca la plata de Caja con un movimiento opuesto, marca el recibo como ANULADO y la cuota vuelve a tener saldo."],
    },
  ],
};
