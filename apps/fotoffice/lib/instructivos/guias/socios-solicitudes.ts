import type { Instructivo } from "../tipos";
import { MEMBERS_MODULE_KEY } from "@/lib/members/constants";

export const guia: Instructivo = {
  slug: "socios-solicitudes",
  titulo: "Aprobar o rechazar solicitudes de asociación",
  resumen: "Cómo revisar a quien pidió asociarse y aprobar o rechazar su solicitud.",
  seccion: "Socios",
  moduleKey: MEMBERS_MODULE_KEY,
  minutos: 5,
  pasos: [
    {
      titulo: "Abrí las Solicitudes",
      texto: [
        "En el menú de la izquierda, desplegá “Socios” y tocá “Solicitudes”. Se abre la pantalla “Solicitudes de asociación”.",
        "Si no hay nadie esperando, dice “No hay solicitudes pendientes”. Si hay, arriba de la lista dice cuántas son.",
      ],
      nota: "Sólo la ve quien puede gestionar socios. Si tu rol sólo permite ver, el menú no la muestra.",
    },
    {
      titulo: "Revisá los avisos en rojo antes de empezar",
      texto: [
        "Si arriba aparece “Todavía no podés cobrar cuotas” o “Todavía no configuraste el valor de la cuota”, no apruebes todavía: avisale a quien administra la institución.",
        "Sin eso, aprobar generaría cuotas que nadie puede pagar o cuotas en cero.",
      ],
    },
    {
      titulo: "Leé la tarjeta de cada persona",
      texto: [
        "Cada solicitud muestra el nombre, el correo, la escala de cuota que declaró (Profesional, Estudiante o Exenta), la categoría y, si corresponde, qué socio la recomendó.",
        "Más abajo: documento, teléfono, domicilio de notificaciones, la fecha de la solicitud y su presencia profesional (sitio, redes).",
      ],
    },
    {
      titulo: "Prestá atención a las advertencias",
      texto: [
        "“Declara condición de estudiante”: verificá el certificado antes de aprobar, porque paga el 50%.",
        "“Ya fue socio N° …”: la persona estuvo antes en el padrón. Te muestra cuándo fue la baja y si quedó deuda registrada.",
      ],
    },
    {
      titulo: "Aprobá",
      texto: [
        "Tocá “Aprobar”. Se crea el socio con su número, se generan sus cuotas de ingreso y se le manda por correo el acceso para activar su cuenta y pagar.",
        "Arriba de los botones aparece la confirmación, por ejemplo: “Socio N° 740 creado. Se generaron 2 cuotas por $…”.",
      ],
      nota: "Si aparece un aviso de que el correo con el acceso no salió, reenviáselo desde la ficha del socio, en la tarjeta “Acceso a FotoOffice”, con “Reenviar invitación” o “Invitar a FotoOffice”: sin acceso no puede pagar su ingreso.",
    },
    {
      titulo: "O rechazá, con un motivo",
      texto: [
        "Tocá “Rechazar”. Aparece el campo “Motivo del rechazo”: escribilo con claridad, porque se le manda a la persona por correo.",
        "Tocá “Confirmar rechazo”. Si el correo no sale, la pantalla te avisa para que le escribas a mano.",
      ],
    },
    {
      titulo: "Seguí a los aprobados que todavía no pagaron",
      texto: [
        "Al final de la pantalla está “Aprobadas, esperando el pago”. El ingreso se cierra solo cuando se acredita el pago.",
        "Al lado de cada persona ves hasta cuándo tiene plazo. Si no paga a tiempo, el alta queda sin efecto y se da de baja automáticamente.",
      ],
    },
  ],
};
