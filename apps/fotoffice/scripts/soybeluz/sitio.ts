import type { WebsiteColors } from "@/lib/website/branding-defaults";
import type { WebsiteBlock, WebsiteSections } from "@/lib/website/blocks";
import { DEFAULT_DESIGN_PRESETS, type WebsiteDesignPresets } from "@/lib/website/design-presets";
import { SITE_MENU_VERSION, type SiteMenu, type SiteMenuEntry } from "@/lib/website/site-menu";
import { bloque, enOrden, hero, placa } from "@/lib/website/templates/tipos";

/**
 * La web de SOYBELUZ como datos: lo que carga `alta-soybeluz.ts` en el borrador del sitio.
 *
 * Fuentes: el brief de Belén (`docs/proyecto-soybeluz.md`) y el manual de marca V1.1 (paleta,
 * DejaVu Sans, voz "personas / participantes", accesibilidad). Lo que Belén todavía no definió
 * va como «a confirmar»: lo completa ella desde el constructor antes de publicar. Una vez dado el
 * alta, el sitio es de Belén: este archivo no se vuelve a aplicar sobre un sitio con páginas.
 */

/** La paleta del manual (página 06): cacao y marfil sostienen la lectura, el rosa acompaña. */
/**
 * El tema dibuja texto BLANCO sobre el secundario (portada sin foto) y sobre el acento (botones y
 * «Mi cuenta»). Rosa viejo (2,4:1) y terracota (3,5:1) no llegan al 4,5:1 de lectura, así que los
 * dos van en cacao: es la versión negativa del manual (marfil sobre cacao). El rosa sigue en el
 * logo, que es donde «acompaña sin dominar».
 */
export const SOYBELUZ_COLORES: WebsiteColors & { panelColor: string } = {
  primaryColor: "#60433A", // Cacao
  secondaryColor: "#60433A", // Cacao (fondo de la portada sin foto)
  backgroundColor: "#FAF6EF", // Marfil
  textColor: "#60433A", // Cacao
  accentColor: "#60433A", // Cacao (botones)
  panelColor: "#E5D4C2", // Arena
};

const A_CONFIRMAR = "a confirmar";
const INSTAGRAM = "https://instagram.com/soybeluz";

/** La línea de accesibilidad que el manual pide para cada propuesta (página 12). */
function fichaDeLaPropuesta(datos: { edad: string; nivel: string; modalidad: string; materiales: string; duracion: string; apoyos: string }): string {
  return [
    `Edad sugerida: ${datos.edad}.`,
    `Nivel: ${datos.nivel}.`,
    `Modalidad: ${datos.modalidad}.`,
    `Materiales: ${datos.materiales}.`,
    `Duración: ${datos.duracion}.`,
    `Apoyos: ${datos.apoyos}.`,
  ].join("\n");
}

const inicio: WebsiteBlock[] = enOrden([
  hero(
    "beluz-portada",
    [
      placa("beluz-portada-1", {
        title: "Aprender, crear y compartir.",
        subtitle: "Un espacio para aprender y compartir el dibujo creativo, desde cero y a tu ritmo.",
        showButton: true,
        // Contorno blanco: un botón sólido sería cacao sobre el fondo cacao de la portada.
        buttonStyle: "outline",
        buttonLabel: "Clases creativas gratuitas",
        buttonUrl: "/clases-creativas-gratuitas",
      }),
    ],
    { heightPreset: "normal" },
  ),
  bloque("beluz-dos-puertas", "FEATURES", {
    title: "Dos maneras de participar",
    items: [
      {
        id: "gratis",
        icon: "sparkles",
        title: "Clases creativas gratuitas",
        text: "Un vivo por semana en Instagram, con una propuesta distinta cada vez. Sin experiencia previa y con lo que tengas a mano. Con su grupo gratuito de WhatsApp para compartir lo que hacemos.",
      },
      {
        id: "club",
        icon: "heart",
        title: "El Club de Beluz",
        text: "Una suscripción mensual con cursos grabados, ejercicios y plantillas para descargar, dos encuentros en vivo por mes y una comunidad privada.",
      },
    ],
  }),
  bloque("beluz-enfoque", "TEXT", {
    title: "Cada persona encuentra su manera de crear",
    content:
      "En SOYBELUZ aprendemos a dibujar desde la experimentación, la intuición y la confianza. No buscamos que el dibujo salga «correcto»: buscamos soltar la mano, perder el miedo a equivocarnos y descubrir nuevas posibilidades creativas.\n\nEs una comunidad abierta a todas las edades, para quienes nunca dibujaron y para quienes quieren volver a hacerlo.",
    align: "center",
  }),
  bloque("beluz-invitacion", "CTA", {
    title: "Vení a crear con Beluz",
    text: "Empezá por una clase gratuita y, si querés profundizar, sumate al Club.",
    buttonLabel: "Conocé el Espacio creativo",
    buttonUrl: "/espacio-creativo",
    stylePreset: "solid",
  }),
]);

const clasesGratuitas: WebsiteBlock[] = enOrden([
  bloque("beluz-clases-que-son", "TEXT", {
    title: "Clases creativas gratuitas",
    content:
      "Una vez por semana nos encontramos en un vivo de Instagram para dibujar un rato. Cada semana hay una propuesta distinta: yo voy guiando paso a paso y cada persona dibuja al mismo tiempo, a su manera.\n\nNo son clases para aprender una técnica ni siguen un programa: son un momento para sentarnos a dibujar, explorar y experimentar. Por eso se llaman Clases Creativas.",
    align: "left",
  }),
  bloque("beluz-clases-dinamica", "FEATURES", {
    title: "Cómo es la dinámica",
    items: [
      { id: "propuesta", icon: "sparkles", title: "Una propuesta nueva", text: "Cada semana presento una propuesta diferente y empezamos a dibujar durante el vivo." },
      { id: "guia", icon: "users", title: "Paso a paso", text: "Voy guiando el proceso; cada persona sigue las indicaciones con libertad." },
      { id: "sin-errores", icon: "heart", title: "Sin resultados correctos", text: "No hay dibujos correctos o incorrectos. La idea es animarse, probar y disfrutar." },
      { id: "materiales", icon: "check", title: "Con lo que tengas", text: "Una fibra, una microfibra, una lapicera y una hoja. No hace falta comprar nada." },
    ],
  }),
  bloque("beluz-clases-ficha", "TEXT", {
    title: "Datos de las clases",
    content: [
      `Día y horario: ${A_CONFIRMAR}.`,
      fichaDeLaPropuesta({
        edad: "abierta a todas las edades; infancias acompañadas por una persona adulta",
        nivel: "sin experiencia previa",
        modalidad: "en vivo por Instagram (@soybeluz), gratuita",
        materiales: "una fibra, microfibra o lapicera y una hoja blanca",
        duracion: A_CONFIRMAR,
        apoyos: "contanos si necesitás algún apoyo para participar y lo pensamos con vos",
      }),
    ].join("\n"),
    align: "left",
  }),
  bloque("beluz-clases-proximas", "FAQ", {
    title: "Próximas propuestas",
    items: [{ id: "proxima-1", question: `Próxima clase: ${A_CONFIRMAR}`, answer: "Acá se anuncia la propuesta de cada semana." }],
  }),
  bloque("beluz-clases-instagram", "CTA", {
    title: "Seguinos en Instagram",
    text: "Los vivos son en @soybeluz.",
    buttonLabel: "Ir a Instagram",
    buttonUrl: INSTAGRAM,
    stylePreset: "outline",
  }),
  // Un grupo se comparte con su enlace de invitación (chat.whatsapp.com), no con un teléfono: por
  // eso va un CTA y no WHATSAPP_BUTTON (que además desaparece entero si no tiene número).
  bloque("beluz-clases-whatsapp", "CTA", {
    title: "Grupo gratuito de WhatsApp",
    text: `Para compartir los dibujos de cada vivo, intercambiar experiencias y seguir en contacto entre una clase y otra. Enlace de invitación: ${A_CONFIRMAR}.`,
    buttonLabel: "Sumate al grupo gratuito",
    buttonUrl: "",
    stylePreset: "solid",
  }),
]);

const espacioCreativo: WebsiteBlock[] = enOrden([
  bloque("beluz-club-intro", "TEXT", {
    title: "El Club de Beluz",
    content:
      "El espacio creativo por suscripción mensual: una experiencia más completa para quienes quieren profundizar, aprender a su ritmo y elegir qué temática trabajar.",
    align: "center",
  }),
  bloque("beluz-club-incluye", "FEATURES", {
    title: "Qué incluye la suscripción",
    items: [
      { id: "cursos", icon: "video", title: "Todos los cursos", text: "Clases grabadas, disponibles cuando quieras y tantas veces como necesites." },
      { id: "descargables", icon: "printer", title: "Plantillas y ejercicios", text: "Material para descargar y actividades prácticas guiadas." },
      { id: "encuentros", icon: "calendar", title: "Dos encuentros por mes", text: "Encuentros en vivo cada quince días para crear en compañía." },
      { id: "devoluciones", icon: "star", title: "Consultas y devoluciones", text: "Un espacio para mostrar lo que hacés y recibir orientación." },
      { id: "comunidad", icon: "users", title: "Comunidad privada", text: "Un grupo para compartir avances, dudas e ideas con otras personas." },
      { id: "caja", icon: "gift", title: "La Caja de Beluz", text: `El kit del mes con materiales, enviado a todo el país (detalles ${A_CONFIRMAR}).` },
    ],
  }),
  bloque("beluz-club-casa", "TEXT", {
    title: "Dibujar con lo que tenemos en casa",
    content:
      "Las propuestas están pensadas para hacerse con una fibra, una microfibra negra y papel blanco. Los materiales especiales son opcionales: en la sección Materiales te contamos cuáles existen y para qué sirve cada uno.",
    align: "left",
  }),
  bloque("beluz-club-cta", "CTA", {
    title: "¿Te sumás?",
    text: "Mirá precios, medios de pago, renovación y cancelación.",
    buttonLabel: "Ver la suscripción",
    buttonUrl: "/suscripcion",
    stylePreset: "solid",
  }),
]);

const materiales: WebsiteBlock[] = enOrden([
  bloque("beluz-materiales-intro", "TEXT", {
    title: "Materiales",
    content:
      "Para empezar no hace falta comprar nada. Esta sección es complementaria: te ayuda a conocer los materiales de dibujo y a elegir, si un día querés probar algo nuevo.",
    align: "left",
  }),
  bloque("beluz-materiales-guia", "FAQ", {
    title: "Guía de materiales",
    items: [
      { id: "existen", question: "¿Qué materiales existen para dibujar?", answer: A_CONFIRMAR },
      { id: "sirve", question: "¿Para qué sirve cada uno?", answer: A_CONFIRMAR },
      { id: "diferencias", question: "¿Qué diferencias hay entre ellos?", answer: A_CONFIRMAR },
      { id: "usar", question: "¿Cómo se usan?", answer: A_CONFIRMAR },
      { id: "comprar", question: "¿Qué conviene comprar según lo que quiero hacer?", answer: A_CONFIRMAR },
      { id: "marcas", question: "¿Qué marcas y productos recomendás?", answer: A_CONFIRMAR },
    ],
  }),
]);

const encuentros: WebsiteBlock[] = enOrden([
  bloque("beluz-encuentros-que-son", "TEXT", {
    title: "Encuentros en vivo",
    content:
      "Dos veces por mes nos encontramos online para trabajar en un proyecto creativo al mismo tiempo. Presento la propuesta, la desarrollamos en conjunto y hay espacio para consultas, para mostrar los trabajos y para recibir devoluciones.\n\nLa idea es que nadie se sienta sola ni solo frente a una clase grabada.",
    align: "left",
  }),
  bloque("beluz-encuentros-ficha", "TEXT", {
    title: "Datos de los encuentros",
    content: fichaDeLaPropuesta({
      edad: A_CONFIRMAR,
      nivel: "para todos los niveles, desde cero",
      modalidad: "online en vivo, cada quince días, para participantes con suscripción",
      materiales: "los de cada proyecto, siempre simples y caseros",
      duracion: A_CONFIRMAR,
      apoyos: "contanos si necesitás algún apoyo para participar y lo pensamos con vos",
    }),
    align: "left",
  }),
  bloque("beluz-encuentros-calendario", "CTA", {
    title: "El calendario es para participantes del Club",
    text: "Las fechas, los horarios y el enlace de cada encuentro se publican en Mi cuenta.",
    buttonLabel: "Ver la suscripción",
    buttonUrl: "/suscripcion",
    stylePreset: "solid",
  }),
]);

const comunidad: WebsiteBlock[] = enOrden([
  bloque("beluz-comunidad", "TEXT", {
    title: "Comunidad",
    content:
      "Además del grupo gratuito de las clases de Instagram, el Club tiene su comunidad privada por WhatsApp. Es un espacio para compartir dibujos y avances, consultar dudas, preguntar cómo seguir un trabajo, compartir materiales e ideas y conocer a otras personas con intereses parecidos.\n\nNo es un espacio de competencia ni de comparación de resultados: cada persona muestra lo que hace con confianza, aprende de las demás y disfruta del proceso.",
    align: "left",
  }),
  bloque("beluz-comunidad-cta", "CTA", {
    title: "El acceso es para participantes del Club",
    buttonLabel: "Ver la suscripción",
    buttonUrl: "/suscripcion",
    stylePreset: "outline",
  }),
]);

const sobre: WebsiteBlock[] = enOrden([
  bloque("beluz-sobre", "TEXT", {
    title: "Sobre SOYBELUZ",
    content:
      "Soy Belén (María Belén Saldaña), profesora de Historia y Artes Visuales, con experiencia docente. SOYBELUZ nace de una mirada artística y pedagógica: no se trata sólo de enseñar a hacer dibujos, sino de acompañar procesos creativos, estimular la observación y generar experiencias de aprendizaje.\n\nEs un universo creativo que empieza por el dibujo y va a ir sumando acuarela, pintura, técnicas mixtas y otras propuestas.",
    align: "left",
  }),
  // La foto («SOY BELUZ/web/foto-sobre-belen.webp» en el Escritorio de Daniel) se sube desde el editor.
  bloque("beluz-sobre-foto", "IMAGE", { alt: "María Belén Saldaña, docente de SOYBELUZ, sonriendo con un saco rosa", caption: "", widthPreset: "narrow" }),
]);

const suscripcion: WebsiteBlock[] = enOrden([
  bloque("beluz-suscripcion", "TEXT", {
    title: "Suscripción",
    content: [
      `Precio mensual: ${A_CONFIRMAR}.`,
      `Medios de pago: ${A_CONFIRMAR}.`,
      "Renovación: mensual.",
      "Cancelación: cuando quieras; el acceso sigue hasta el final del período pagado.",
    ].join("\n"),
    align: "left",
  }),
  bloque("beluz-lista-espera", "FORM", {
    title: "Avisame cuando abra la suscripción",
    intro: "Dejanos tus datos y te escribimos cuando abran las inscripciones al Club.",
    fields: [
      { id: "nombre", type: "text", label: "Nombre", required: true, help: "", options: [] },
      { id: "correo", type: "email", label: "Correo", required: true, help: "", options: [] },
      { id: "whatsapp", type: "phone", label: "WhatsApp", required: false, help: "", options: [] },
    ],
    buttonLabel: "Avisame",
    afterSubmit: "message",
    thanksMessage: "¡Gracias! Te avisamos apenas abra.",
    redirectUrl: "",
    revealText: "",
    revealLinkLabel: "",
    revealLinkUrl: "",
    createInquiry: false,
    categoryId: "",
    origenId: "",
  }),
]);

/** Claves de página (`PAGE_KEY_FORMAT`: sin guiones) y su dirección pública (`slug`). */
const PAGINAS = [
  { clave: "clases_gratuitas", slug: "clases-creativas-gratuitas", titulo: "Clases creativas gratuitas", bloques: clasesGratuitas },
  { clave: "espacio_creativo", slug: "espacio-creativo", titulo: "Espacio creativo", bloques: espacioCreativo },
  { clave: "materiales", slug: "materiales", titulo: "Materiales", bloques: materiales },
  { clave: "encuentros", slug: "encuentros-en-vivo", titulo: "Encuentros en vivo", bloques: encuentros },
  { clave: "comunidad", slug: "comunidad", titulo: "Comunidad", bloques: comunidad },
  { clave: "sobre", slug: "sobre-soybeluz", titulo: "Sobre SOYBELUZ", bloques: sobre },
  { clave: "suscripcion", slug: "suscripcion", titulo: "Suscripción", bloques: suscripcion },
] as const;

export const SOYBELUZ_SECCIONES: WebsiteSections = {
  pages: { home: inicio, ...Object.fromEntries(PAGINAS.map((p) => [p.clave, p.bloques])) },
  pageMeta: Object.fromEntries(PAGINAS.map((p) => [p.clave, { slug: p.slug, title: p.titulo }])),
};

const propia = (pageKey: string, label: string): SiteMenuEntry => ({ id: `custom:${pageKey}`, kind: "custom", pageKey, label, hidden: false });

/** El menú del brief (sección 9). "Mi cuenta" es el botón de ingreso del encabezado. */
export const SOYBELUZ_MENU: SiteMenu = {
  version: SITE_MENU_VERSION,
  items: [
    { id: "page:home", kind: "page", page: "home", label: "Inicio", hidden: false },
    propia("clases_gratuitas", "Clases creativas gratuitas"),
    propia("espacio_creativo", "Espacio creativo"),
    { id: "page:courses-sales", kind: "page", page: "courses-sales", label: "Cursos", hidden: false },
    propia("materiales", "Materiales"),
    propia("encuentros", "Encuentros en vivo"),
    propia("comunidad", "Comunidad"),
    propia("sobre", "Sobre SOYBELUZ"),
    propia("suscripcion", "Suscripción"),
    // La página de alta del módulo de participantes abre en la Etapa 2 (cobro con acceso).
    { id: "page:members", kind: "page", page: "members", label: null, hidden: true },
  ],
};

const NEGRITA = { font: "dejavu-sans", weight: 700 } as const;
const REGULAR = { font: "dejavu-sans", weight: 400 } as const;

export const SOYBELUZ_DISENO: WebsiteDesignPresets = {
  ...DEFAULT_DESIGN_PRESETS,
  loginButtonLabel: "Mi cuenta",
  // Nueve entradas con DejaVu Sans (letra ancha) no entran en la barra superior: un botón abre el
  // menú desde un costado, igual en celular y en computadora.
  menuLayout: "drawer",
  // El conjunto del logo mide 1,82:1 (trazado del manual): con 110 px de alto queda en ~200 px de
  // ancho, el mínimo del manual.
  logoSizePx: 110,
  buttonPreset: "rounded",
  footerPreset: "simple",
  typographyLevels: {
    title: NEGRITA,
    heading: NEGRITA,
    subtitle: REGULAR,
    body: { ...REGULAR, size: "md" },
    button: NEGRITA,
    menu: REGULAR,
  },
};
