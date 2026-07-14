/**
 * Fuente de verdad del manual operativo “Cómo publicar una historia”.
 * Copy de producto (no doc técnica). La UI vive en EditorialPublishManual.
 */

export type ManualAudience = "redactor" | "director" | "both";

export type ManualOriginId =
  | "web-intake"
  | "clf-event"
  | "clf-coverage"
  | "from-scratch";

export type ManualStep = {
  text: string;
  /** Ruta interna del panel (opcional). */
  href?: string;
  /** Quién actúa en este paso (para distinguir público / redacción). */
  actor?: "publico" | "clf" | "redaccion" | "direccion";
};

export type ManualOrigin = {
  id: ManualOriginId;
  title: string;
  short: string;
  summary: string;
  steps: ManualStep[];
};

export type ManualLink = {
  label: string;
  href: string;
};

export const PUBLISH_MANUAL = {
  eyebrow: "Manual de procedimiento",
  title: "Cómo publicar una historia",
  dek: "Elegí el origen de la pieza y seguí el camino. En menos de dos minutos sabés qué hacer hoy.",
  createCta: { label: "Crear historia", href: "/redaccion/asistente" },

  intro: {
    whatIs:
      "Una historia (también la llamamos nota o pieza) es el contenido editorial que, al publicarse, aparece en el sitio como noticia.",
    eventVsNote:
      "Un evento es agenda (fecha, lugar, convocatoria). Una nota es la historia publicada. Promocionar un evento desde la web no crea una nota sola: primero entra el evento a revisión.",
    statesLabel: "Camino de estados",
    states: [
      { id: "draft", label: "Borrador" },
      { id: "review", label: "En revisión" },
      { id: "published", label: "Publicado" },
    ],
    statesExtra:
      "También podés despublicar o archivar una pieza ya trabajada.",
    checklistTitle: "Checklist mínimo antes de publicar",
    checklist: [
      "Título claro",
      "Slug",
      "Bajada (excerpt)",
      "Contenido completo",
      "Categoría",
      "Portada con crédito",
      "Fotos editoriales procesadas y con licencia en regla",
    ],
  },

  warning: {
    title: "Promoción desde la web ≠ nota automática",
    body: "Si alguien carga datos en Publicar evento, Info Spot crea un evento en revisión. La nota la arma la redacción después, si el tema lo merece.",
    href: "/publicar-evento",
    hrefLabel: "Ver formulario público",
  },

  originsTitle: "¿De dónde viene la nota?",
  origins: [
    {
      id: "web-intake",
      title: "Promoción desde la web",
      short: "Web",
      summary:
        "Alguien quiere visibilidad y carga el evento desde el sitio. Después la redacción decide si hay historia.",
      steps: [
        {
          actor: "publico",
          text: "La persona entra a Publicar evento y carga los datos.",
          href: "/publicar-evento",
        },
        {
          actor: "publico",
          text: "Eso crea un evento en revisión: no genera una nota automática.",
        },
        {
          actor: "direccion",
          text: "Dirección (o redacción) modera el evento en Eventos admin o en Agenda.",
          href: "/admin/eventos",
        },
        {
          actor: "redaccion",
          text: "Si vale la pena una nota, abrí el Asistente y elegí “Un evento próximo”.",
          href: "/redaccion/asistente?intent=event",
        },
        {
          actor: "redaccion",
          text: "Elegí el evento y el material disponible, prepará el borrador y editalo.",
        },
        {
          actor: "redaccion",
          text: "Completá el checklist y enviá a revisión o publicá según tu permiso.",
        },
        {
          actor: "direccion",
          text: "Si hace falta aprobación, el Director publica o devuelve desde Aprobaciones.",
          href: "/admin/aprobaciones",
        },
      ],
    },
    {
      id: "clf-event",
      title: "Evento de ComprameLaFoto",
      short: "CLF",
      summary:
        "El Director importa candidatos desde ComprameLaFoto y la redacción termina la historia.",
      steps: [
        {
          actor: "direccion",
          text: "Entrá a Importar desde ComprameLaFoto.",
          href: "/redaccion/desde-clf",
        },
        {
          actor: "direccion",
          text: "Revisá candidatos y su prioridad (alta, media o descartar).",
        },
        {
          actor: "direccion",
          text: "Creá un borrador (o varios de prioridad alta) desde el evento CLF.",
        },
        {
          actor: "clf",
          text: "El sistema deja la historia en Borrador, vinculada al evento y al álbum de CLF.",
        },
        {
          actor: "redaccion",
          text: "Abrí el editor, completá la redacción, fotos y créditos.",
        },
        {
          actor: "redaccion",
          text: "Enviá a revisión o publicá según tu permiso.",
        },
        {
          actor: "direccion",
          text: "El Director publica o devuelve con observación desde Aprobaciones.",
          href: "/admin/aprobaciones",
        },
      ],
    },
    {
      id: "clf-coverage",
      title: "Desde una cobertura de CLF",
      short: "Cobertura",
      summary:
        "Partís de material fotográfico ya sincronizado y armás la historia en el Asistente.",
      steps: [
        {
          actor: "redaccion",
          text: "Asegurá el material en Coberturas. Si hace falta, actualizá material.",
          href: "/redaccion/coberturas",
        },
        {
          actor: "redaccion",
          text: "Abrí el Asistente y elegí “Una cobertura de un evento”.",
          href: "/redaccion/asistente?intent=coverage",
        },
        {
          actor: "redaccion",
          text: "Seleccioná cobertura(s) y fotos editoriales (no los originales crudos de CLF).",
        },
        {
          actor: "redaccion",
          text: "Prepará el borrador y seguí en el editor.",
        },
        {
          actor: "redaccion",
          text: "Si faltan fotos después, volvé al Asistente en modo fotos con el id de la nota.",
          href: "/redaccion/asistente?mode=photos",
        },
        {
          actor: "redaccion",
          text: "Completá checklist → revisión o publicación.",
        },
      ],
    },
    {
      id: "from-scratch",
      title: "Desde cero",
      short: "Cero",
      summary:
        "Sin evento ni cobertura previa: solo el texto y lo que sumes después.",
      steps: [
        {
          actor: "redaccion",
          text: "Abrí Crear historia o el Asistente con noticia independiente.",
          href: "/redaccion/asistente?intent=independent",
        },
        {
          actor: "redaccion",
          text: "Definí título y tipo de historia sin material obligatorio.",
        },
        {
          actor: "redaccion",
          text: "Escribí, sumá multimedia si aplica y completá metadatos.",
        },
        {
          actor: "redaccion",
          text: "Checklist → revisión o publicación.",
        },
      ],
    },
  ] as const satisfies readonly ManualOrigin[],

  commonTitle: "Paso común: cerrar y publicar",
  commonSteps: [
    {
      text: "Editá la historia en el editor hasta que esté completa.",
    },
    {
      text: "Revisá el checklist de publicación (título, slug, bajada, contenido, categoría, portada y créditos).",
    },
    {
      text: "Si no tenés permiso de publicación, “Publicar ahora” envía la pieza a aprobación del Director (En revisión).",
      href: "/redaccion/bandeja?vista=en-revision",
    },
    {
      text: "Si sos Director o tenés publicación directa, la pieza pasa a Publicado y queda en el sitio.",
    },
    {
      text: "Si te la devuelven, aparece en Para corregir con la observación: corregí y reenviá.",
      href: "/redaccion/bandeja?vista=devueltas",
    },
    {
      text: "Después de publicar podés despublicar, archivar o destacar en Portada.",
      href: "/redaccion/distribucion",
    },
  ] as const satisfies readonly ManualStep[],

  redactorTitle: "Hoy, como redactor",
  redactorChecklist: [
    {
      label: "Mirar la Bandeja (inbox, borradores, devoluciones)",
      href: "/redaccion/bandeja",
    },
    {
      label: "Crear o continuar una historia con el Asistente",
      href: "/redaccion/asistente",
    },
    {
      label: "Revisar material disponible en Coberturas",
      href: "/redaccion/coberturas",
    },
    {
      label: "Completar checklist y enviar a revisión",
      href: "/redaccion/bandeja?vista=en-revision",
    },
  ] as const satisfies readonly ManualLink[],

  directorTitle: "Hoy, en la mesa de dirección",
  directorChecklist: [
    {
      label: "Moderar intake público de eventos",
      href: "/admin/eventos",
    },
    {
      label: "Importar candidatos desde ComprameLaFoto",
      href: "/redaccion/desde-clf",
    },
    {
      label: "Revisar cola de Aprobaciones",
      href: "/admin/aprobaciones",
    },
    {
      label: "Publicar o devolver con observación clara",
      href: "/admin/aprobaciones",
    },
    {
      label: "Ajustar qué se destaca en Portada",
      href: "/redaccion/distribucion",
    },
  ] as const satisfies readonly ManualLink[],

  footnote:
    "Tip avanzado: `/redaccion/nueva?directo=1` abre el formulario vacío sin Asistente. Es para power users; el camino recomendado es el Asistente Editorial.",
} as const;

export type PublishManualOrigin = (typeof PUBLISH_MANUAL.origins)[number];

export function getPublishManualOrigin(
  id: ManualOriginId,
): PublishManualOrigin | undefined {
  return PUBLISH_MANUAL.origins.find((o) => o.id === id);
}
