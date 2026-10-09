import type { Instructivo } from "../tipos";
import { GOVERNANCE_MODULE_KEY } from "@/lib/governance/constants";

export const guia: Instructivo = {
  slug: "votaciones",
  titulo: "Votar un proyecto y decidirlo",
  resumen: "Cómo vota la comisión cada proyecto, cómo se ve el apoyo de los socios y cómo se deja asentada la decisión.",
  seccion: "Comisión",
  moduleKey: GOVERNANCE_MODULE_KEY,
  minutos: 6,
  pasos: [
    {
      titulo: "Quiénes votan y cuándo",
      texto: [
        "Votan las personas con un cargo vigente en la comisión que tenga voto y que tengan su usuario vinculado. Si alguien tiene dos cargos, vota una sola vez.",
        "La votación está abierta mientras el proyecto espera una decisión: «Propuesto», «En tratamiento» o «Postergado». Sirve para medir el apoyo antes de la reunión; la aprobación formal se hace en la reunión.",
      ],
    },
    {
      titulo: "Abrí el proyecto",
      texto: [
        "En «Proyectos», la columna «Comisión» muestra cuántos votaron a favor (por ejemplo, «4 de 7 a favor»). Tocá el nombre del proyecto para abrirlo.",
        "Arriba de todo está el recuadro «Votación de la comisión» con lo que hay a favor, en contra y sin votar.",
      ],
    },
    {
      titulo: "Votá",
      texto: [
        "Tocá «A favor» o «En contra». Aparece el aviso «Tu voto quedó registrado» y tu botón queda pintado.",
        "Podés cambiar el voto tocando el otro botón hasta que el proyecto se trate en reunión. El voto es nominal: la comisión ve quién votó qué; los socios sólo ven el total.",
      ],
    },
    {
      titulo: "Contá por qué",
      texto: [
        "Si querés explicar tu voto o poner una condición, escribila en «Opiniones de la comisión» y tocá «Publicar opinión». Las opiniones no cuentan como voto, pero se ven en el temario cuando se trata el proyecto.",
      ],
      nota: "Podés tocar «Retirar» en tu opinión para sacarla. Queda la marca de que fue retirada, con la fecha.",
    },
    {
      titulo: "Mirá lo que piensan los socios",
      texto: [
        "Si el proyecto está marcado como «Visible para socios», los socios pueden decir en su portal si lo apoyan o no. Es una encuesta privada: sólo se ven los totales.",
        "El resultado aparece en el recuadro «Lo que piensan los socios», y en la lista de proyectos, en «Lo que más apoyan los socios». Para invitarlos a opinar, usá «WhatsApp a los socios».",
      ],
      nota: "La encuesta de los socios no reemplaza la votación de la comisión: es una referencia más.",
    },
    {
      titulo: "Dejá asentada la decisión",
      texto: [
        "Lo habitual es decidirlo en una reunión de comisión: queda en el acta (ver la guía «Reuniones de comisión y actas»).",
        "Si se decidió afuera de una reunión cargada en el sistema, usá el recuadro «Decidir» del proyecto. «Aprobar», «Rechazar» y «Postergar» piden la «Fecha de la reunión» y «Qué se decidió»; «Rechazar» pide además el «Motivo». Confirmá con el botón «Confirmar».",
      ],
      nota: "Cuando el proyecto sale de «Propuesto», «En tratamiento» o «Postergado», la votación se cierra.",
    },
    {
      titulo: "Respondé las propuestas de socios",
      texto: [
        "Cuando un socio propone un proyecto desde su portal, en «Proyectos» aparece un aviso. Abrí la propuesta y, en «Responder la propuesta», elegí «Aceptar la propuesta» (pasa al temario de la próxima reunión) o «Archivar» con el motivo, que el socio puede ver.",
      ],
    },
  ],
};
