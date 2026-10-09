import type { Instructivo } from "../tipos";
import { MEMBERSHIP_DUES_MODULE_KEY } from "@/lib/membership/constants";

export const guia: Instructivo = {
  slug: "cuotas-registrar-pago",
  titulo: "Ver quién debe y registrar un pago de cuota",
  resumen:
    "Cómo saber qué socios tienen cuotas impagas y cómo anotar un pago que te hicieron en efectivo o por transferencia.",
  seccion: "Dinero",
  moduleKey: MEMBERSHIP_DUES_MODULE_KEY,
  minutos: 5,
  pasos: [
    {
      titulo: "Entrá a Cuotas",
      texto: [
        "En el menú de la izquierda abrí Socios y elegí Cuotas.",
        "Arriba vas a ver tres números: «Deuda total» (cuánto se debe entre todos), «Cobrado en 30 días» (lo que ya entró) y «Pagos pendientes» (pagos que todavía no se acreditaron; el sistema los revisa solo cada hora).",
      ],
    },
    {
      titulo: "Mirá quién debe",
      texto: [
        "Bajá hasta «Socios con saldo». Ahí está cada socio que debe algo, con su número, desde qué mes debe («Desde»), cuántas cuotas tiene abiertas y cuántas ya están vencidas, y el total que debe («Saldo»).",
        "Si dice «Nadie debe cuotas. Toda la institución está al día.», no hay nada pendiente.",
      ],
    },
    {
      titulo: "Abrí la ficha del socio que te pagó",
      texto: [
        "Hacé clic en el nombre del socio. Se abre su ficha.",
        "Si el socio no está en la lista (por ejemplo, pagó por adelantado), buscalo en Socios → Padrón y abrí su ficha desde ahí.",
      ],
    },
    {
      titulo: "Completá el pago cobrado en mano",
      texto: [
        "En la ficha buscá el recuadro «Registrar un pago cobrado en mano».",
        "En «Importe cobrado» escribí cuánto te pagó, sin el signo $ (por ejemplo, 8000).",
        "En «Cómo pagó» elegí Efectivo, Transferencia o «Mercado Pago (link anterior)». Esta última opción es sólo para lo que el socio pagó con un link de Mercado Pago propio de la institución; lo que paga desde su portal entra solo y no hay que cargarlo.",
        "En «Cuándo pagó» dejá la fecha de hoy o poné la del día en que te pagó. No acepta fechas futuras.",
        "En «Comprobante» podés anotar el número de transferencia o de recibo. No es obligatorio.",
      ],
      nota: "Si no ves este recuadro, tu usuario no tiene permiso para administrar las cuotas. Pedíselo a quien administra el panel.",
    },
    {
      titulo: "Tocá «Registrar pago»",
      texto: [
        "Aparece en verde «Pago de $… registrado.». Si el socio pagó de más, el mensaje también te dice cuánto quedó a su favor.",
        "El mensaje avisa además la comisión de la plataforma: como ese dinero no pasó por el cobro en línea, la comisión no se pudo descontar en el momento y se descuenta del próximo pago que entre por Mercado Pago.",
      ],
    },
    {
      titulo: "Qué pasa después, solo",
      texto: [
        "El pago se descuenta de las cuotas impagas, empezando por la más vieja. El socio deja de figurar como deudor (o figura con menos saldo) y lo ve así en su portal.",
        "El pago aparece en el recuadro «Pagos» de la ficha y en «Últimos pagos» de la pantalla de Cuotas, como «Acreditado».",
        "Si la institución usa Caja, el pago se anota solo como ingreso en la categoría «Cuotas»: no lo cargues de nuevo en Caja.",
        "Si el socio tenía un carnet impreso esperando el pago, pasa a la lista para imprimir. Y si era un socio nuevo que debía la cuota de ingreso, con este pago se completa su alta y le llega el correo de bienvenida.",
      ],
    },
    {
      titulo: "Si te equivocaste",
      texto: [
        "Hoy el panel no tiene un botón para anular un pago de cuota ya registrado. Revisá bien el importe y el socio antes de tocar «Registrar pago».",
        "Si cargaste algo mal, no lo corrijas cargando un pago negativo ni anulando el movimiento en Caja: avisale a quien administra el sistema para que lo corrija.",
      ],
      nota: "Anular en Caja el ingreso de una cuota saca el dinero del libro pero deja la cuota como pagada. Los dos registros quedarían contradiciéndose.",
    },
  ],
};
