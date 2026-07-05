import { article, ORGANIZER_INTENTS, PHOTOGRAPHER_INTENTS, SUPPORT_INTENTS } from "@/data/blog/phase7/helpers";
import type { Phase7ArticleDraft } from "@/data/blog/phase7/types";

const CAT = "guias";

const FOTOGRAFOS: Phase7ArticleDraft[] = [
  article({
    title: "Cómo registrarte en ComprameLaFoto",
    slug: "como-registrarte-en-compramelafoto",
    categorySlug: CAT,
    excerpt:
      "Guía paso a paso para crear tu cuenta de fotógrafo en ComprameLaFoto, verificar tu email y completar tu perfil.",
    audience: ["fotografos"],
    intents: PHOTOGRAPHER_INTENTS,
    tags: ["Fotógrafos", "Álbumes"],
    intro:
      "Si sos fotógrafo y querés vender fotografías digitales e impresiones online, el primer paso es crear tu cuenta en ComprameLaFoto.",
    sections: [
      "Requisitos previos",
      "Crear tu cuenta desde el registro",
      "Verificar tu email",
      "Completar tu perfil de fotógrafo",
      "Conectar Mercado Pago",
      "Primeros pasos después del alta",
      "Preguntas frecuentes",
    ],
    imageScene:
      "Professional photographer at a laptop completing online registration in a bright home studio, notebook and camera on desk",
  }),
  article({
    title: "Cómo crear tu primer álbum",
    slug: "como-crear-tu-primer-album",
    categorySlug: CAT,
    excerpt:
      "Aprendé a crear tu primer álbum en ComprameLaFoto: subir fotos, organizar la galería y prepararla para la venta.",
    audience: ["fotografos"],
    intents: PHOTOGRAPHER_INTENTS,
    tags: ["Fotógrafos", "Álbumes"],
    intro: "Un álbum es el contenedor donde publicás las fotografías de un evento, escuela o sesión.",
    sections: [
      "Qué es un álbum en ComprameLaFoto",
      "Crear un álbum nuevo",
      "Subir y ordenar fotografías",
      "Configurar portada y datos básicos",
      "Revisar antes de publicar",
      "Errores comunes",
    ],
    imageScene:
      "Photographer uploading event photos to a laptop, camera memory cards on table, school sports event thumbnails on screen",
  }),
  article({
    title: "Cómo configurar los precios de tus fotografías",
    slug: "como-configurar-precios-fotografias",
    categorySlug: CAT,
    excerpt:
      "Definí precios de fotos digitales e impresiones, descuentos por cantidad y bandas de precio en tus galerías.",
    audience: ["fotografos"],
    intents: PHOTOGRAPHER_INTENTS,
    tags: ["Fotógrafos", "Digitales", "Impresiones"],
    intro: "Configurar bien tus precios impacta directamente en tus ventas y en la percepción de valor.",
    sections: [
      "Tipos de precio en la plataforma",
      "Precio digital uniforme",
      "Descuentos por cantidad",
      "Precios de impresiones",
      "Buenas prácticas de pricing",
      "Ejemplos por tipo de evento",
    ],
    imageScene:
      "Photographer reviewing pricing spreadsheet beside camera gear, natural window light, focused expression",
  }),
  article({
    title: "Cómo vender fotos digitales",
    slug: "como-vender-fotos-digitales",
    categorySlug: CAT,
    excerpt:
      "Tutorial para activar y optimizar la venta de fotografías digitales en tus álbumes y galerías.",
    audience: ["fotografos"],
    intents: PHOTOGRAPHER_INTENTS,
    tags: ["Fotógrafos", "Digitales"],
    intro: "La venta digital permite que tus clientes descarguen fotografías en alta resolución tras el pago.",
    sections: [
      "Activar venta digital en el álbum",
      "Formatos y resolución entregada",
      "Protección con marca de agua en vista previa",
      "Flujo de compra del cliente",
      "Entrega y descarga automática",
      "Consejos para aumentar conversiones",
    ],
    imageScene:
      "Customer on smartphone browsing a photo gallery while photographer edits on desktop in background",
  }),
  article({
    title: "Cómo vender impresiones",
    slug: "como-vender-impresiones",
    categorySlug: CAT,
    excerpt:
      "Configurá la venta de impresiones fotográficas: tamaños, acabados y envío a través de ComprameLaFoto.",
    audience: ["fotografos"],
    intents: PHOTOGRAPHER_INTENTS,
    tags: ["Fotógrafos", "Impresiones"],
    intro: "Las impresiones son un complemento clave de ingresos para muchos fotógrafos de eventos y escuelas.",
    sections: [
      "Habilitar impresiones en tu galería",
      "Tamaños y productos disponibles",
      "Laboratorio y producción",
      "Experiencia de compra del cliente",
      "Seguimiento de pedidos",
      "Recomendaciones comerciales",
    ],
    imageScene:
      "Photographer holding printed photos over a light table, lab prints stacked neatly, warm studio lighting",
  }),
  article({
    title: "Cómo crear packs de fotografías",
    slug: "como-crear-packs-fotografias",
    categorySlug: CAT,
    excerpt:
      "Armá packs y combos de fotografías digitales o impresas para aumentar el ticket promedio de cada venta.",
    audience: ["fotografos"],
    intents: PHOTOGRAPHER_INTENTS,
    tags: ["Fotógrafos", "Packs", "Digitales"],
    intro: "Los packs facilitan que el cliente compre más fotografías en una sola transacción.",
    sections: [
      "Qué es un pack en ComprameLaFoto",
      "Crear un pack nuevo",
      "Combinar digitales e impresiones",
      "Precio sugerido y descuentos",
      "Comunicar el pack al cliente",
      "Ejemplos de packs efectivos",
    ],
    imageScene:
      "Photographer arranging a printed photo bundle for school parents, cheerful packaging on wooden desk",
  }),
  article({
    title: "Cómo crear una preventa",
    slug: "como-crear-una-preventa",
    categorySlug: CAT,
    excerpt:
      "Guía para configurar preventas escolares o de eventos: fechas, precios anticipados y comunicación a familias.",
    audience: ["fotografos", "escuelas"],
    intents: PHOTOGRAPHER_INTENTS,
    tags: ["Fotógrafos", "Preventa", "Escuelas"],
    intro: "La preventa permite cobrar antes de la entrega final de las fotografías.",
    sections: [
      "Cuándo conviene una preventa",
      "Crear la preventa en el álbum",
      "Definir plazos y condiciones",
      "Compartir el link con padres o clientes",
      "Seguimiento de pedidos de preventa",
      "Cierre y entrega",
    ],
    imageScene:
      "School photographer showing presale flyer to parents at school entrance, morning natural light",
  }),
  article({
    title: "Cómo publicar una galería",
    slug: "como-publicar-una-galeria",
    categorySlug: CAT,
    excerpt:
      "Publicá tu galería para que los clientes puedan ver, buscar y comprar tus fotografías de forma segura.",
    audience: ["fotografos"],
    intents: PHOTOGRAPHER_INTENTS,
    tags: ["Fotógrafos", "Álbumes", "Marketplace"],
    intro: "Publicar la galería es el paso final para poner tus fotografías a disposición de compradores.",
    sections: [
      "Revisión previa a la publicación",
      "Estados del álbum: borrador y publicado",
      "Link público y privacidad",
      "Compartir por WhatsApp y redes",
      "Indexación y visibilidad",
      "Despublicar o archivar",
    ],
    imageScene:
      "Photographer clicking publish on gallery software, sports stadium photos visible on monitor",
  }),
  article({
    title: "Cómo descargar tus ventas",
    slug: "como-descargar-tus-ventas",
    categorySlug: CAT,
    excerpt:
      "Accedé al detalle de tus ventas, exportá reportes y descargá archivos asociados a cada pedido.",
    audience: ["fotografos"],
    intents: [...SUPPORT_INTENTS, "feature-adoption"],
    tags: ["Fotógrafos"],
    intro: "El panel de ventas te permite controlar qué se vendió, cuándo y en qué formato.",
    sections: [
      "Dónde ver tus ventas",
      "Detalle de cada pedido",
      "Exportar información",
      "Descargar archivos del pedido",
      "Ventas digitales vs impresiones",
      "Soporte ante dudas",
    ],
    imageScene:
      "Photographer reviewing sales dashboard on laptop, printed order summary beside coffee cup",
  }),
  article({
    title: "Cómo retirar tus ganancias",
    slug: "como-retirar-tus-ganancias",
    categorySlug: CAT,
    excerpt:
      "Entendé cómo se acreditan tus ventas con Mercado Pago y cuándo podés retirar tus ganancias.",
    audience: ["fotografos"],
    intents: [...SUPPORT_INTENTS, "feature-adoption"],
    tags: ["Fotógrafos"],
    intro: "Tus ganancias se acreditan según el flujo de pagos configurado con Mercado Pago.",
    sections: [
      "Cómo llega el dinero de una venta",
      "Mercado Pago conectado",
      "Plazos de acreditación",
      "Comisiones de la plataforma",
      "Retiros y transferencias",
      "Preguntas frecuentes",
    ],
    imageScene:
      "Photographer checking mobile banking app after event shoot, camera bag on bench, urban park setting",
  }),
];

const ORGANIZADORES: Phase7ArticleDraft[] = [
  article({
    title: "Cómo registrarte como organizador",
    slug: "como-registrarte-como-organizador",
    categorySlug: CAT,
    excerpt:
      "Creá tu cuenta de organizador de eventos en ComprameLaFoto y empezá a convocar fotógrafos.",
    audience: ["organizadores"],
    intents: ORGANIZER_INTENTS,
    tags: ["Organizadores", "Eventos colaborativos"],
    intro: "Los organizadores coordinan eventos y pueden generar ingresos por comisiones de las ventas.",
    sections: [
      "Perfil de organizador",
      "Registro paso a paso",
      "Verificación de cuenta",
      "Configuración inicial",
      "Diferencias con cuenta de fotógrafo",
      "Próximos pasos",
    ],
    imageScene:
      "Event organizer with clipboard and headset at race expo desk, runners registering in background",
  }),
  article({
    title: "Cómo crear tu primer evento",
    slug: "como-crear-tu-primer-evento",
    categorySlug: CAT,
    excerpt:
      "Configurá tu primer evento colaborativo: datos, fechas, fotógrafos y link público.",
    audience: ["organizadores"],
    intents: ORGANIZER_INTENTS,
    tags: ["Organizadores", "Eventos colaborativos"],
    intro: "Un evento agrupa a varios fotógrafos bajo una misma convocatoria y landing.",
    sections: [
      "Crear el evento",
      "Datos y fechas",
      "Configurar comisiones",
      "Invitar fotógrafos",
      "Publicar el evento",
      "Checklist previo al día del evento",
    ],
    imageScene:
      "Organizer creating event on laptop at community sports club office, medals on shelf",
  }),
  article({
    title: "Cómo convocar fotógrafos",
    slug: "como-convocar-fotografos",
    categorySlug: CAT,
    excerpt:
      "Estrategias y pasos para invitar fotógrafos a cubrir tu evento en ComprameLaFoto.",
    audience: ["organizadores"],
    intents: ORGANIZER_INTENTS,
    tags: ["Organizadores", "Fotógrafos", "Eventos colaborativos"],
    intro: "Convocar fotógrafos es clave para tener buena cobertura y más ventas.",
    sections: [
      "Definir cupos y zonas",
      "Enviar invitaciones",
      "Comunicar condiciones",
      "Confirmar asistencia",
      "Coordinación el día del evento",
      "Buenas prácticas",
    ],
    imageScene:
      "Group of sports photographers receiving briefing from organizer before marathon start line",
  }),
  article({
    title: "Cómo generar ingresos con las comisiones para organizadores",
    slug: "como-generar-ingresos-comisiones-organizadores",
    categorySlug: CAT,
    excerpt:
      "Entendé cómo funcionan las comisiones de organizador y cómo maximizar ingresos por evento.",
    audience: ["organizadores"],
    intents: ORGANIZER_INTENTS,
    tags: ["Organizadores", "Comisiones"],
    intro: "Como organizador podés recibir un porcentaje de las ventas generadas en tu evento.",
    sections: [
      "Modelo de comisiones",
      "Configurar el porcentaje",
      "Qué ventas generan comisión",
      "Seguimiento en el panel",
      "Cobro y liquidación",
      "Ejemplos por tipo de evento",
    ],
    imageScene:
      "Event organizer reviewing commission report on tablet after local football tournament",
  }),
  article({
    title: "Cómo gestionar fotógrafos colaboradores",
    slug: "como-gestionar-fotografos-colaboradores",
    categorySlug: CAT,
    excerpt:
      "Administrá fotógrafos invitados, permisos y cobertura dentro de un evento colaborativo.",
    audience: ["organizadores"],
    intents: ORGANIZER_INTENTS,
    tags: ["Organizadores", "Fotógrafos", "Eventos colaborativos"],
    intro: "Gestionar colaboradores bien mejora la calidad del material y la experiencia del cliente.",
    sections: [
      "Roles en un evento",
      "Aprobar o rechazar colaboradores",
      "Asignar zonas o categorías",
      "Comunicación durante el evento",
      "Resolución de incidencias",
      "Post-evento",
    ],
    imageScene:
      "Organizer coordinating photographers with walkie-talkies at outdoor cycling race",
  }),
  article({
    title: "Cómo compartir el link de tu evento",
    slug: "como-compartir-link-de-tu-evento",
    categorySlug: CAT,
    excerpt:
      "Compartí la landing de tu evento por WhatsApp, redes y email para que los participantes encuentren sus fotos.",
    audience: ["organizadores"],
    intents: ORGANIZER_INTENTS,
    tags: ["Organizadores", "Eventos colaborativos"],
    intro: "El link del evento es la puerta de entrada para que corredores, padres o asistentes compren fotos.",
    sections: [
      "Obtener el link público",
      "Mensajes sugeridos para WhatsApp",
      "Redes sociales y QR",
      "Email a participantes",
      "Momento ideal para compartir",
      "Medir resultados",
    ],
    imageScene:
      "Organizer sharing event QR code on phone with marathon runners at finish area",
  }),
];

const ESCUELAS: Phase7ArticleDraft[] = [
  article({
    title: "Cómo crear una galería escolar",
    slug: "como-crear-galeria-escolar",
    categorySlug: CAT,
    excerpt:
      "Pasos para armar una galería escolar con privacidad, preventa y venta a familias.",
    audience: ["fotografos", "escuelas"],
    intents: PHOTOGRAPHER_INTENTS,
    tags: ["Escuelas", "Fotógrafos", "Álbumes"],
    intro: "Las galerías escolares requieren cuidado extra en privacidad y comunicación con padres.",
    sections: [
      "Estructura de un proyecto escolar",
      "Crear el álbum institucional",
      "Cursos y divisiones",
      "Privacidad y consentimiento",
      "Preventa escolar",
      "Publicación a familias",
    ],
    imageScene:
      "School photographer organizing class group photos in elementary school courtyard",
  }),
  article({
    title: "Cómo compartir fotografías con los padres",
    slug: "como-compartir-fotografias-con-padres",
    categorySlug: CAT,
    excerpt:
      "Canales y buenas prácticas para que las familias accedan y compren las fotos escolares.",
    audience: ["fotografos", "escuelas"],
    intents: PHOTOGRAPHER_INTENTS,
    tags: ["Escuelas", "Fotógrafos"],
    intro: "Compartir correctamente con padres reduce consultas y acelera las ventas.",
    sections: [
      "Link privado de la galería",
      "Comunicación con la institución",
      "Mensajes para grupos de padres",
      "Búsqueda por curso o alumno",
      "Plazos de venta",
      "Soporte a familias",
    ],
    imageScene:
      "Parents viewing school photos on phone while picking up children at school gate",
  }),
  article({
    title: "Cómo funciona la privacidad de las fotografías escolares",
    slug: "como-funciona-privacidad-fotografias-escolares",
    categorySlug: CAT,
    excerpt:
      "Políticas de privacidad, acceso restringido y buenas prácticas para fotografía escolar en Argentina.",
    audience: ["fotografos", "escuelas", "clientes"],
    intents: [...SUPPORT_INTENTS, "feature-adoption"],
    tags: ["Escuelas", "Privacidad escolar"],
    intro: "La privacidad es central en fotografía escolar: familias deben sentirse seguras al comprar.",
    sections: [
      "Principios de privacidad en CLF",
      "Acceso a galerías",
      "Datos de menores",
      "Marcas de agua y vistas previas",
      "Solicitudes de baja de imagen",
      "Recursos y políticas",
    ],
    imageScene:
      "School principal and photographer discussing privacy documents in school office, respectful tone",
  }),
];

const CLIENTES: Phase7ArticleDraft[] = [
  article({
    title: "Cómo buscar tus fotografías",
    slug: "como-buscar-tus-fotografias",
    categorySlug: CAT,
    excerpt:
      "Encontrá tus fotos de un evento o escuela usando el link, número de dorsal o curso.",
    audience: ["clientes"],
    intents: SUPPORT_INTENTS,
    tags: ["Clientes", "Marketplace"],
    intro: "Si participaste de un evento o tu hijo tiene fotos escolares, podés buscarlas online.",
    sections: [
      "Ingresar con el link del evento",
      "Buscar por dorsal o categoría",
      "Buscar por curso o división",
      "Navegar la galería",
      "Agregar al carrito",
      "Ayuda si no encontrás tu foto",
    ],
    imageScene:
      "Parent searching race photos on smartphone at home living room, casual realistic setting",
  }),
  article({
    title: "Cómo comprar fotografías digitales",
    slug: "como-comprar-fotografias-digitales",
    categorySlug: CAT,
    excerpt:
      "Tutorial para clientes: elegir fotos digitales, pagar con Mercado Pago y recibir la descarga.",
    audience: ["clientes"],
    intents: SUPPORT_INTENTS,
    tags: ["Clientes", "Digitales"],
    intro: "Comprar fotos digitales en ComprameLaFoto es rápido y seguro.",
    sections: [
      "Seleccionar fotografías",
      "Carrito y packs",
      "Pago con Mercado Pago",
      "Confirmación del pedido",
      "Descarga de archivos",
      "Problemas frecuentes",
    ],
    imageScene:
      "Customer completing photo purchase on laptop, credit card and Mercado Pago on phone nearby",
  }),
  article({
    title: "Cómo comprar impresiones",
    slug: "como-comprar-impresiones",
    categorySlug: CAT,
    excerpt: "Guía para pedir impresiones fotográficas de eventos o escuelas con envío o retiro.",
    audience: ["clientes"],
    intents: SUPPORT_INTENTS,
    tags: ["Clientes", "Impresiones"],
    intro: "Además de lo digital, podés encargar impresiones de tus fotografías favoritas.",
    sections: [
      "Elegir tamaño y acabado",
      "Cantidad y packs",
      "Datos de envío",
      "Pago y confirmación",
      "Tiempos de producción",
      "Seguimiento del pedido",
    ],
    imageScene:
      "Family unboxing photo prints at dining table, genuine smiles, warm indoor light",
  }),
  article({
    title: "Cómo descargar las fotografías compradas",
    slug: "como-descargar-fotografias-compradas",
    categorySlug: CAT,
    excerpt:
      "Accedé a tus archivos digitales después de la compra: links, plazos y reintentos de descarga.",
    audience: ["clientes"],
    intents: SUPPORT_INTENTS,
    tags: ["Clientes", "Digitales"],
    intro: "Una vez aprobado el pago, tus fotografías digitales quedan disponibles para descargar.",
    sections: [
      "Email de confirmación",
      "Acceso desde el pedido",
      "Descarga individual o ZIP",
      "Plazos de disponibilidad",
      "Calidad del archivo",
      "Contactar soporte",
    ],
    imageScene:
      "Person downloading photos from email link on phone, progress bar visible, sofa background",
  }),
  article({
    title: "Cómo encontrar tus fotografías mediante selfie",
    slug: "como-encontrar-fotografias-mediante-selfie",
    categorySlug: CAT,
    excerpt:
      "Usá el reconocimiento por selfie para ubicar tus fotos en segundos en eventos masivos.",
    audience: ["clientes"],
    intents: [...SUPPORT_INTENTS, "feature-adoption"],
    tags: ["Clientes", "Selfie"],
    intro: "La búsqueda por selfie te ayuda a encontrar tus fotos sin recorrer toda la galería.",
    sections: [
      "Cuándo está disponible",
      "Tomar o subir una selfie",
      "Cómo funciona el reconocimiento",
      "Privacidad de la selfie",
      "Resultados y coincidencias",
      "Si no hay match",
    ],
    imageScene:
      "Runner taking selfie at marathon expo photo kiosk, bib number visible, realistic crowd",
  }),
];

export const TUTORIALES_ARTICLES: Phase7ArticleDraft[] = [
  ...FOTOGRAFOS,
  ...ORGANIZADORES,
  ...ESCUELAS,
  ...CLIENTES,
];
