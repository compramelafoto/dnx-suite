import type { Instructivo } from "../tipos";
import { BOOKINGS_MODULE_KEY } from "@/lib/bookings/constants";

export const guia: Instructivo = {
  slug: "reservas-cargar-y-confirmar",
  titulo: "Reservas: cargar, aprobar y confirmar",
  resumen:
    "Ver quién ocupa cada espacio, cargar una reserva que llegó por teléfono y resolver las que están pendientes.",
  seccion: "Actividades",
  moduleKey: BOOKINGS_MODULE_KEY,
  minutos: 6,
  pasos: [
    {
      titulo: "Abrí la agenda",
      texto: [
        "En el menú, entrá a Reservas → Agenda. Vas a ver un calendario con las reservas de todos los espacios, cada espacio con su color.",
        "Arriba podés pasar de Día a Semana o Mes, moverte con las flechas y volver a hoy con el botón Hoy. Si hay reservas sin resolver, al lado aparece un aviso amarillo con la cantidad de pendientes.",
      ],
    },
    {
      titulo: "Filtrá por espacio si hace falta",
      texto: [
        "En el panel de la izquierda, en Espacios, tocá el nombre de un espacio para ocultarlo o volver a mostrarlo. Sirve para mirar un solo salón sin el ruido de los demás.",
        "Las reservas con borde punteado son las que están a aprobar o esperando pago. Las canceladas y vencidas no se ven, salvo que marques Mostrar canceladas y vencidas.",
      ],
    },
    {
      titulo: "Cargá una reserva que llegó por teléfono",
      texto: [
        "Tocá Cargar reserva. Elegí el Espacio, completá Desde y Hasta (en hora de Rosario) y escribí A nombre de quién va.",
        "Si los tenés, sumá Email y Teléfono. En Quién reserva marcá Socio o No socio: cambia el precio. Al final, tocá Cargar reserva.",
      ],
      nota:
        "Si el horario choca con otra reserva, con un cierre o queda fuera del horario del espacio, el sistema no la deja cargar y te dice por qué.",
    },
    {
      titulo: "Revisá que haya quedado",
      texto: [
        "Si todo salió bien, volvés a la agenda con el mensaje «Listo, la reserva quedó cargada.» y la reserva aparece en el calendario.",
        "La reserva cargada a mano queda Confirmada en el acto: se entiende que el dinero se cobra en la sede.",
      ],
      nota:
        "Cargar la reserva no anota el cobro en Caja. Si cobraste en el mostrador, registralo vos en Caja.",
    },
    {
      titulo: "Abrí una reserva para ver el detalle",
      texto: [
        "Tocá cualquier reserva del calendario. Se abre una ficha con el Espacio, Quién (socio o no socio), el Estado, el Total y los Extras pedidos.",
        "Los estados posibles son: Esperando pago, A aprobar, Confirmada, Cancelada y Vencida.",
      ],
    },
    {
      titulo: "Aprobá o rechazá las que están «A aprobar»",
      texto: [
        "Algunos espacios o extras necesitan que alguien de la institución dé el visto bueno. En esas reservas aparece el botón Aprobar.",
        "Si un extra no se pudo conseguir, marcá la casilla «No se pudo conseguir» antes de aprobar: se descuenta del total. Al aprobar, a la persona le llega el enlace de pago con el total definitivo.",
        "Si no se puede, escribí el Motivo del rechazo y tocá Rechazar.",
      ],
    },
    {
      titulo: "Confirmá una transferencia cuando llegó el dinero",
      texto: [
        "Si alguien eligió pagar por transferencia, su reserva queda Esperando pago y tiene un vencimiento. Cuando veas el dinero en la cuenta, abrí la reserva y tocá Confirmar transferencia.",
        "La reserva pasa a Confirmada y verás el mensaje «Listo, el pago quedó confirmado.» Si la institución usa Caja, el cobro se anota solo.",
      ],
      nota:
        "Las reservas pagadas con Mercado Pago se confirman solas: no hace falta tocar nada.",
    },
    {
      titulo: "Cancelá una reserva",
      texto: [
        "Abrí la reserva y tocá Cancelar reserva. El espacio queda libre para otra persona.",
        "Una cancelada no se puede volver a activar: si la persona cambia de idea, cargá una reserva nueva.",
      ],
    },
  ],
};
