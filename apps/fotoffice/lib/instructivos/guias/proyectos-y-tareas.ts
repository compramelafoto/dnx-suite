import type { Instructivo } from "../tipos";
import { GOVERNANCE_MODULE_KEY } from "@/lib/governance/constants";

export const guia: Instructivo = {
  slug: "proyectos-y-tareas",
  titulo: "Proyectos y tareas de la comisión",
  resumen: "Cargar un proyecto, dividirlo en etapas, repartir las tareas con responsable y fecha, y seguir cómo avanza cada una.",
  seccion: "Comisión",
  moduleKey: GOVERNANCE_MODULE_KEY,
  minutos: 10,
  pasos: [
    {
      titulo: "Entrá a la lista de proyectos",
      texto: [
        "En el menú, abrí «Proyectos de la comisión» y elegí «Proyectos».",
        "Vas a ver todos los proyectos ordenados por prioridad: primero lo que vence antes. Arriba podés filtrar entre «En curso», «Cerrados» y «Todos».",
      ],
    },
    {
      titulo: "Revisá los tipos de proyecto (una sola vez)",
      texto: [
        "Cada proyecto arranca desde un tipo (por ejemplo, una muestra o un curso) que ya trae sus etapas y tareas armadas. Se editan en «Tipos de proyecto».",
        "Para crear uno, abrí «+ Nuevo tipo de proyecto», poné el «Nombre» y, en «Etapas y tareas», escribí una etapa por renglón y debajo sus tareas empezando con un guion (-). Terminá con «Crear tipo».",
      ],
      nota: "Cambiar un tipo no modifica los proyectos que ya existen: sólo vale para los que se creen después.",
    },
    {
      titulo: "Creá el proyecto",
      texto: [
        "En «Proyectos», tocá «Nuevo proyecto». Completá el «Título», elegí el «Tipo de proyecto» y escribí una «Descripción». Si hay una idea de cómo conseguir el dinero, anotala en su campo.",
        "Elegí el «Responsable general» y, si hay, la «Fecha límite». En «¿En qué estado está?» dejá «Es una propuesta nueva» o, si ya venía en marcha antes de usar el sistema, marcá que ya estaba aprobado o en ejecución. Tocá «Crear proyecto».",
      ],
      nota: "Marcá «Visible para socios» sólo si querés que los socios lo vean. Si no, queda interno de la comisión.",
    },
    {
      titulo: "Ajustá las etapas",
      texto: [
        "Dentro del proyecto, abrí «Etapas y tareas». Ahí están las etapas que trajo el tipo.",
        "Para sumar una, escribila en «Nueva etapa» y tocá «Agregar etapa». Con las flechas la subís o la bajas. En «Renombrar o quitar la etapa» le cambiás el nombre o la sacás (sólo si no tiene tareas).",
      ],
    },
    {
      titulo: "Repartí las tareas",
      texto: [
        "Debajo de cada etapa, tocá «+ Agregar tarea». Escribí «Qué hay que hacer», elegí el «Responsable» y la fecha en «Para cuándo». Tocá «Agregar tarea».",
        "En la lista de responsables aparece primero la comisión, con su cargo, y después el resto de los socios.",
      ],
      nota: "Las tareas se pueden armar y repartir desde el principio, pero se dan por hechas recién cuando el proyecto está aprobado.",
    },
    {
      titulo: "Seguí cada tarea",
      texto: [
        "Tocá el nombre de una tarea para abrirla. En «Contar un avance» quien la tiene a cargo escribe qué hizo, puede sumar «Archivos (opcional)» y toca «Guardar avance».",
        "Con «Marcar en curso» y «Marcar hecha» se cambia el estado. Si no se pudo hacer, abrí «No se hizo…», explicá por qué y confirmá. Para cambiar responsable o fecha, usá «Editar la tarea».",
      ],
    },
    {
      titulo: "Subí los archivos del proyecto",
      texto: [
        "Abrí «Archivos» y tocá «Adjuntar archivos». Sirve cualquier tipo de archivo (presupuestos, planos, fotos, planillas), de hasta 25 MB cada uno.",
        "Todos quedan como «Interno». Si querés que un archivo lo vean los socios, tocá el botón de ese archivo y pasa a «Visible para socios».",
      ],
    },
    {
      titulo: "Opiná y compartí el proyecto",
      texto: [
        "En «Opiniones de la comisión» cada integrante puede escribir qué piensa y tocar «Publicar opinión». Las opiniones no cuentan como voto y sólo las ve la comisión.",
        "Arriba, debajo del título, están «Copiar enlace» y «Compartir por WhatsApp» para mandarle el proyecto al grupo de la comisión. Si el proyecto es visible para socios, aparece también «WhatsApp a los socios».",
      ],
      nota: "Todo lo que pasa queda en «Historial». Ahí también podés usar «Agregar una nota» para dejar una aclaración.",
    },
    {
      titulo: "Mirá todas las tareas juntas",
      texto: [
        "En el menú, elegí «Tareas». Ves todo lo repartido entre la comisión y los socios: qué es, de qué proyecto, quién la tiene y para cuándo. Primero lo que vence antes.",
        "Usá «Las mías» para ver sólo las tuyas o «Sin responsable» para encontrar lo que falta asignar. Las vencidas aparecen en rojo.",
      ],
    },
  ],
};
