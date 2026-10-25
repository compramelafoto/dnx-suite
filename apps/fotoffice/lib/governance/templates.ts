/**
 * Tipos de proyecto: las plantillas sembradas y el formato de texto con que se editan.
 *
 * Módulo PURO.
 *
 * ── El formato ──
 *
 * Las etapas y tareas de un tipo se escriben como un texto, una línea por renglón: la etapa sola,
 * y debajo sus tareas empezando con un guion.
 *
 * ```
 * Difusión
 * - Diseñar el flyer
 * - Publicar en redes
 * Impresión de obras
 * - Pedir presupuestos
 * ```
 *
 * Se eligió esto y no una grilla con botones de agregar, subir y bajar: la comisión ya escribe
 * así sus listas en WhatsApp, se reordena cortando y pegando, y una plantilla entera se copia de
 * un lado a otro sin perder nada.
 */

export type TemplateStage = { title: string; tasks: string[] };
export type ProjectTemplate = { key: string; name: string; description: string; stages: TemplateStage[] };

/** Viñetas que se aceptan delante de una tarea: guion, guion largo, asterisco o punto. */
const VINETA = /^\s*[-–—*•·]\s*/;

const MAX_TITULO = 160;

export function parseStagesText(text: string): { ok: true; stages: TemplateStage[] } | { ok: false; error: string } {
  const stages: TemplateStage[] = [];
  const lineas = text.replace(/\r\n?/g, "\n").split("\n");
  for (const [i, cruda] of lineas.entries()) {
    if (cruda.trim() === "") continue;
    if (VINETA.test(cruda)) {
      const tarea = cruda.replace(VINETA, "").trim();
      if (tarea === "") continue;
      if (stages.length === 0) {
        return {
          ok: false,
          error: `La línea ${i + 1} es una tarea, pero todavía no hay ninguna etapa arriba. Escribí primero el nombre de la etapa.`,
        };
      }
      stages[stages.length - 1]!.tasks.push(tarea.slice(0, MAX_TITULO));
    } else {
      stages.push({ title: cruda.trim().slice(0, MAX_TITULO), tasks: [] });
    }
  }
  return { ok: true, stages };
}

export function stagesToText(stages: readonly TemplateStage[]): string {
  return stages.map((s) => [s.title, ...s.tasks.map((t) => `- ${t}`)].join("\n")).join("\n");
}

/** Los tipos con que arranca cada institución (diseño §5.3). Se pueden editar y archivar. */
export const DEFAULT_PROJECT_TEMPLATES: readonly ProjectTemplate[] = [
  {
    key: "exhibition",
    name: "Muestra fotográfica",
    description: "Una muestra de obras: convocatoria, impresión, montaje e inauguración.",
    stages: [
      { title: "Convocatoria y selección", tasks: ["Definir tema y bases", "Difundir la convocatoria", "Seleccionar las obras"] },
      { title: "Impresión de obras", tasks: ["Pedir cotizaciones de impresión", "Enviar los archivos", "Retirar las impresiones"] },
      { title: "Difusión", tasks: ["Diseñar el flyer", "Publicar en redes", "Avisar a la prensa"] },
      { title: "Montaje", tasks: ["Confirmar el espacio", "Montar las obras", "Preparar los textos de sala"] },
      { title: "Inauguración", tasks: ["Organizar el brindis", "Desmontar al cierre"] },
    ],
  },
  {
    key: "event",
    name: "Evento o celebración",
    description: "Un encuentro, aniversario o festejo de la institución.",
    stages: [
      { title: "Organización", tasks: ["Definir fecha y lugar", "Armar el presupuesto"] },
      { title: "Difusión", tasks: ["Diseñar la invitación", "Publicar en redes"] },
      { title: "Logística", tasks: ["Contratar el catering", "Conseguir el sonido", "Armar el lugar"] },
      { title: "Cierre", tasks: ["Agradecer a quienes ayudaron", "Rendir los gastos"] },
    ],
  },
  {
    key: "course",
    name: "Curso o taller",
    description: "Un curso, taller o charla que organiza la institución.",
    stages: [
      { title: "Armado", tasks: ["Acordar con el docente", "Definir fechas y cupo", "Fijar el precio"] },
      { title: "Difusión", tasks: ["Publicar el curso", "Abrir la inscripción"] },
      { title: "Dictado", tasks: ["Preparar el espacio", "Tomar asistencia"] },
      { title: "Cierre", tasks: ["Entregar certificados", "Pagarle al docente"] },
    ],
  },
  {
    key: "purchase",
    name: "Compra u obra",
    description: "Una compra de equipamiento o un arreglo en la sede.",
    stages: [
      { title: "Cotizaciones", tasks: ["Pedir al menos tres cotizaciones", "Comparar y elegir"] },
      { title: "Compra o contratación", tasks: ["Pagar o firmar", "Recibir o controlar el trabajo"] },
      { title: "Cierre", tasks: ["Guardar la factura", "Registrar en el inventario"] },
    ],
  },
  {
    key: "blank",
    name: "En blanco",
    description: "Sin etapas: se arman a mano.",
    stages: [],
  },
];
