import type { Instructivo } from "../tipos";
import { GOVERNANCE_MODULE_KEY } from "@/lib/governance/constants";

export const guia: Instructivo = {
  slug: "reuniones-y-actas",
  titulo: "Reuniones de comisión y actas",
  resumen: "Convocar una reunión, ordenar el temario, anotar lo que se resolvió en cada tema y dejar el acta aprobada.",
  seccion: "Comisión",
  moduleKey: GOVERNANCE_MODULE_KEY,
  minutos: 8,
  pasos: [
    {
      titulo: "Entrá a Reuniones",
      texto: [
        "En el menú, abrí «Proyectos de la comisión» y elegí «Reuniones». Ves todas las reuniones con su fecha, la cantidad de temas y en qué estado están: «Convocada», «Realizada» o «Acta aprobada».",
      ],
    },
    {
      titulo: "Convocá la reunión",
      texto: [
        "Abrí «+ Convocar una reunión». Poné un «Título» (si lo dejás vacío queda «Reunión de comisión»), la «Fecha y hora» en hora de Argentina y el «Lugar o enlace» (la sede o el enlace de Meet).",
        "Tocá «Convocar y armar el temario». El sistema arma solo el temario con los proyectos que esperan una decisión (propuestos, en tratamiento o postergados), ordenados por prioridad.",
      ],
    },
    {
      titulo: "Ordená el temario y mandá la convocatoria",
      texto: [
        "Con las flechas de cada tema lo subís o lo bajás; con «Quitar» lo sacás. Para sumar algo, escribilo en «Agregar un tema suelto» o elegí un proyecto en «…o un proyecto», y tocá «Agregar al temario».",
        "Cuando esté listo, tocá «Compartir por WhatsApp»: arma el mensaje con el día, el lugar y los temas para el grupo de la comisión. También está «Copiar enlace».",
      ],
      nota: "Si cambia la fecha o el lugar, usá «Editar fecha, lugar o título» al pie de la página.",
    },
    {
      titulo: "Tratá cada tema durante la reunión",
      texto: [
        "En cada tema ves cómo votó la comisión (por ejemplo, «Comisión: 4 de 7 a favor») y las opiniones que se dejaron antes.",
        "Abrí «Tratar el tema». Si es un proyecto, elegí el «Resultado»: «Aprobado», «Rechazado», «Postergado» o «Sigue en tratamiento». Escribí qué se resolvió (eso es lo que va al acta) y tocá «Guardar».",
      ],
      nota: "El resultado cambia solo el estado del proyecto y queda anotado en su historial. Si te equivocaste, usá «Corregir lo resuelto» mientras el acta no esté aprobada.",
    },
    {
      titulo: "Anotá quiénes estuvieron",
      texto: [
        "En «Asistentes», marcá a cada integrante de la comisión que participó. Si hubo gente de afuera, escribí sus nombres en «Invitados (opcional)», separados por coma. Tocá «Guardar asistentes».",
      ],
    },
    {
      titulo: "Marcala como realizada",
      texto: [
        "Al terminar, tocá «Marcar como realizada» en el recuadro de arriba. Ahí mismo te avisa si quedan temas sin tratar.",
      ],
    },
    {
      titulo: "Revisá el borrador del acta",
      texto: [
        "Tocá «Ver el borrador del acta». Se abre en otra pestaña con los presentes y, tema por tema, lo que se resolvió.",
        "Con «Descargar PDF» se abre la ventana de impresión: elegí «Guardar como PDF» para tener el archivo.",
      ],
    },
    {
      titulo: "Aprobá el acta",
      texto: [
        "Cuando el acta esté bien, tocá «Aprobar el acta». Para poder hacerlo, todos los temas tienen que estar tratados (o quitados) y tiene que haber asistentes cargados.",
        "Aprobada, el acta ya no se modifica. Si después aparece una corrección, escribila en «Notas agregadas al acta» y tocá «Agregar nota»: se suma sin reescribir lo aprobado.",
      ],
    },
  ],
};
