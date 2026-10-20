import type { Instructivo } from "../tipos";
import { PROJECTS_MODULE_KEY } from "@/lib/proyectos/acceso";

export const guia: Instructivo = {
  slug: "trabajos-ficha-y-etapas",
  titulo: "La ficha del trabajo: etapas, tareas y laboratorio",
  resumen:
    "Qué hay dentro de cada trabajo, cómo se avanza de etapa, para qué sirven las tareas y qué hace el sistema solo en cada paso.",
  seccion: "Trabajos y entregas",
  moduleKey: PROJECTS_MODULE_KEY,
  minutos: 8,
  pasos: [
    {
      titulo: "Cómo nace un trabajo",
      texto: [
        "La mayoría nacen solos: al cobrar en el Cobrador un producto con proceso, o al confirmar un pedido que viene de un presupuesto.",
        "También se puede agregar a mano desde la ficha del pedido, en la tarjeta «Proyectos», con «Agregar proyecto».",
      ],
      sistema: [
        "Lo pone en la primera etapa de su tipo de trabajo (por ejemplo, «Impresiones a laboratorio» arranca en «Enviar pedido»).",
        "Le asigna el responsable y calcula las fechas de cada etapa.",
      ],
    },
    {
      titulo: "Abrí la ficha",
      texto: [
        "Desde cualquier tablero, tocá el nombre del trabajo. Arriba están el nombre, el número y el cliente.",
        "En «Datos» se ven el contacto, el pedido, el producto, el tipo de trabajo, las fechas, la etapa actual y el responsable. Si cambiás algo, tocá «Guardar».",
      ],
    },
    {
      titulo: "Cargá los datos del laboratorio",
      texto: [
        "En la tarjeta «Proveedor» elegí el laboratorio (o «Sin proveedor (se hace en el estudio)»).",
        "Anotá el «N° de pedido del proveedor» (el número que te da el laboratorio), el «Costo del proveedor», la «Entrega prometida al cliente» y las «Indicaciones para el proveedor» (por ejemplo: papel mate, cortar polaroid).",
        "Con «Enviar a … por correo» le llega todo eso al laboratorio. Si lo mandaste por otro lado, tocá «Marcar enviado a …».",
      ],
    },
    {
      titulo: "Mové el trabajo de etapa",
      texto: [
        "En «Recorrido» están todas las etapas del trabajo. Tocá «Mover a [etapa]» y, si querés, escribí una «Nota (opcional)».",
        "En el tablero por tipo de trabajo (Proyectos → «Tablero») también se puede arrastrar la tarjeta de una columna a otra, o usar «Mover a…».",
        "Cada etapa tiene su vencimiento. Si hace falta, cambialo en «Vencimiento de la etapa».",
      ],
      sistema: [
        "Guarda en el historial quién lo movió, cuándo, de qué etapa a cuál y la nota.",
        "Crea las tareas de la etapa nueva, con su fecha, para el responsable. Las tareas que quedaron sin hacer de la etapa anterior no se borran: siguen en «Mis tareas» con «Quedó de [etapa]».",
        "Calcula el vencimiento de la etapa: día de entrada + los días que tiene esa etapa.",
        "Si la etapa nueva es de «listo para retirar», le manda al cliente el aviso por correo.",
        "Algunas etapas avanzan solas: por ejemplo, cuando se cobra la seña del pedido.",
      ],
      nota: "Si una etapa exige terminar sus tareas, aparece «Faltan tareas obligatorias: …». Terminá esas tareas antes de mover. Sólo el dueño o un administrador pueden «Pasar igual».",
    },
    {
      titulo: "Hacé las tareas",
      texto: [
        "En «Tareas» están las de cada etapa (por ejemplo, en «Enviar pedido»: editar si hace falta, subir al Drive, enviar al laboratorio, cargar el enlace). Tocá «Tildar» cuando hagas cada una.",
        "Las vencidas dicen «Vencida». Para algo que no está en la lista, usá «Nueva tarea».",
        "Tus tareas de todos los trabajos aparecen en el inicio, en «Mis tareas»: vencidas, de hoy y de los próximos 7 días.",
      ],
    },
    {
      titulo: "Suspender, terminar o cancelar",
      texto: [
        "Si el cliente pide frenar el trabajo, tocá «Suspender» y escribí el motivo. Mientras está suspendido no cuenta como vencido ni aparece en «Mis tareas». Para seguir, «Reanudar».",
        "Al llegar al final, el trabajo se marca «Terminado». Si el cliente lo cancela, «Cancelar el proyecto». Las dos cosas no se pueden deshacer.",
      ],
    },
    {
      titulo: "Lo que el sistema NO hace solo",
      texto: [
        "No manda WhatsApp: arma el mensaje y vos lo enviás.",
        "No marca el trabajo como entregado cuando el cliente paga el saldo: hay que tocar «Entregado».",
        "No completa el pedido: hay que tocar «Marcar completado» en la ficha del pedido.",
        "No avisa al equipo cuando una etapa vence: los atrasos se ven en rojo en los tableros y en «Mis tareas». Conviene mirarlos al abrir y al cerrar el día.",
      ],
    },
  ],
};
