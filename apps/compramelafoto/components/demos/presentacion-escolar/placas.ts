/** Dibujo que acompaña a cada placa (ver `Visuales.tsx`). */
export type VisualPlaca =
  | "portada"
  | "landing"
  | "ficha"
  | "listado"
  | "bot"
  | "comision"
  | "panelEscuela"
  | "packs"
  | "plantillas"
  | "disenador"
  | "variables"
  | "probar"
  | "preventa"
  | "subida"
  | "selfie"
  | "elegir"
  | "libro3d"
  | "aprobar"
  | "mosaico"
  | "embudo"
  | "imprenta"
  | "etiquetas"
  | "entrega"
  | "pantalla"
  | "ventaColegio";

export type Placa = {
  /** Etapa del recorrido; las que empiezan con número arman la barra de progreso. */
  etapa: string;
  titulo: string;
  bajada: string;
  puntos?: Array<{ titulo: string; texto?: string }>;
  numerados?: boolean;
  visual?: VisualPlaca;
  /**
   * Captura real de la pantalla (en `public/demos/escolar/`), sacada de la demo escolar con datos
   * de prueba. Si está, se muestra en lugar del dibujo.
   */
  captura?: string;
  /**
   * Placa con el librito real en 3D (id de una plantilla del sistema), sin otra cosa: «Siguiente»
   * pasa sus páginas y, en la última, sigue con la placa de después.
   */
  libro3d?: string;
  /** Placa de cierre con las apps de DNX y el QR a dnx-suite.com. */
  apps?: boolean;
  /** Placa ancha, sin dibujo: los puntos ocupan todo el ancho. */
  ancha?: boolean;
};

export const PLACAS: Placa[] = [
  {
    etapa: "ComprameLaFoto",
    titulo: "¿Qué es ComprameLaFoto?",
    bajada: "La plataforma donde el fotógrafo vende sus fotos en línea: cada persona se encuentra con una selfie, paga con Mercado Pago y recibe sus fotos.",
    visual: "portada",
  },
  {
    etapa: "ComprameLaFoto",
    titulo: "ComprameLaFoto en una placa",
    bajada: "La plataforma para vender fotografía de eventos, deportes y colegios, cobrando directo en tu cuenta.",
    ancha: true,
    puntos: [
      { titulo: "Álbumes en línea", texto: "Publicás las fotos y se venden solas, con marca de agua." },
      { titulo: "Reconocimiento facial", texto: "Cada persona se encuentra con una selfie." },
      { titulo: "Búsqueda por dorsal", texto: "En carreras, por el número de la remera." },
      { titulo: "Cobro con Mercado Pago", texto: "El dinero entra directo a tu cuenta." },
      { titulo: "Digitales e impresiones", texto: "Descarga en alta o copias con laboratorio." },
      { titulo: "Videos del evento", texto: "Clips con marca de agua, listos para vender." },
      { titulo: "DNX Bot", texto: "Configurás todo conversando, en tus palabras." },
      { titulo: "Foto escolar", texto: "Preventa, diseños automáticos, imprenta y entrega." },
    ],
  },
  {
    etapa: "Foto escolar",
    titulo: "Lo que hoy complica la foto escolar",
    bajada: "Cuatro tareas que se comen el tiempo del fotógrafo y no suman a la foto.",
    ancha: true,
    puntos: [
      { titulo: "Listados en papel", texto: "Nombres mal escritos y cursos mezclados." },
      { titulo: "Cobros en efectivo", texto: "El colegio junta dinero y vos rendís cuentas." },
      { titulo: "Fotos sin dueño", texto: "Separar cientos de fotos por chico lleva días." },
      { titulo: "Sobres a mano", texto: "Armar, rotular y entregar uno por uno." },
    ],
  },
  {
    etapa: "Foto escolar",
    titulo: "El recorrido en siete etapas",
    bajada: "Desde conseguir el colegio hasta entregar los sobres. Cada placa que sigue es una funcionalidad.",
    ancha: true,
    numerados: true,
    puntos: [
      { titulo: "Conseguir el colegio", texto: "Tu página de venta escolar." },
      { titulo: "Acordar con el colegio", texto: "Alta, listado y comisión." },
      { titulo: "Preparar la venta", texto: "Packs, plantillas y diseñador." },
      { titulo: "Preventa", texto: "La familia paga antes de la toma." },
      { titulo: "Día de la toma", texto: "Subís todo junto." },
      { titulo: "La familia elige", texto: "Selfie, fotos y librito en 3D." },
      { titulo: "Producción y entrega", texto: "Imprenta, sobres con QR y entrega." },
    ],
  },

  // 1 · Conseguir el colegio
  {
    etapa: "1 · Conseguir el colegio",
    titulo: "Tu página de venta escolar",
    bajada: "Una página propia para presentarte a los colegios, con tu marca, tus trabajos y un botón para pedir propuesta.",
    captura: "/demos/escolar/landing.jpg",
    visual: "landing",
    puntos: [
      { titulo: "Dirección y QR propios", texto: "Para mandar por WhatsApp o imprimir." },
      { titulo: "Pedido de propuesta", texto: "El colegio completa un formulario corto." },
      { titulo: "Consultas ordenadas", texto: "Te llegan todas al mismo lugar." },
    ],
  },

  {
    etapa: "1 · Conseguir el colegio",
    titulo: "Lo que ve el colegio",
    bajada: "Tu página, tal como la ve la dirección: cómo funciona, la preventa y el botón para pedirte una propuesta.",
    captura: "/demos/escolar/landing-publica.jpg",
  },

  // 2 · Acordar con el colegio
  {
    etapa: "2 · Acordar con el colegio",
    titulo: "El alta del colegio",
    bajada: "La ficha del colegio reúne todo: datos de la institución, sus administradores, la gestión escolar y sus álbumes.",
    captura: "/demos/escolar/colegio.jpg",
    visual: "ficha",
    puntos: [
      { titulo: "Datos y logo", texto: "Se usan solos en los diseños." },
      { titulo: "Administradores", texto: "La dirección entra con su propio usuario." },
      { titulo: "Niveles y turnos", texto: "Jardín, primaria, secundaria." },
    ],
  },
  {
    etapa: "2 · Acordar con el colegio",
    titulo: "El listado de alumnos",
    bajada: "Importás el padrón del colegio una vez y queda armado por curso. Los nombres salen de la lista oficial, no se escriben a mano.",
    captura: "/demos/escolar/mosaico-listado.jpg",
    visual: "listado",
    puntos: [
      { titulo: "Desde Excel", texto: "Pegás o subís la planilla del colegio." },
      { titulo: "Por curso y turno", texto: "Cada chico en su grado." },
      { titulo: "Sin errores de tipeo", texto: "El nombre viaja hasta el diseño impreso." },
    ],
  },
  {
    etapa: "2 · Acordar con el colegio",
    titulo: "Todo esto lo configura el bot",
    bajada: "Le pedís a DNX Bot lo que necesitás, en tus palabras, y lo hace por vos. Nada se guarda sin tu aprobación.",
    visual: "bot",
    numerados: true,
    puntos: [
      { titulo: "Le pedís", texto: "Como a un asistente." },
      { titulo: "El bot lo hace", texto: "Crea el colegio, los cursos e importa el listado." },
      { titulo: "Vos confirmás", texto: "Revisás antes de guardar." },
    ],
  },
  {
    etapa: "2 · Acordar con el colegio",
    titulo: "La comisión del colegio",
    bajada: "El colegio gana un porcentaje de cada venta, acordado una sola vez entre vos y la institución.",
    captura: "/demos/escolar/comision.jpg",
    visual: "comision",
    puntos: [
      { titulo: "Lo acordás una vez", texto: "El porcentaje que quieras." },
      { titulo: "Se calcula solo", texto: "En cada compra, sin planillas." },
      { titulo: "Sin rendir efectivo", texto: "El colegio no junta dinero." },
    ],
  },
  {
    etapa: "2 · Acordar con el colegio",
    titulo: "El panel del colegio",
    bajada: "La dirección entra con su usuario y ve, en tiempo real, cómo va la venta de su colegio y cuánto le corresponde.",
    captura: "/demos/escolar/panel-colegio.jpg",
    visual: "panelEscuela",
    puntos: [
      { titulo: "Ventas por curso", texto: "Cuántas familias ya compraron." },
      { titulo: "Su comisión", texto: "Calculada al día." },
      { titulo: "Transparencia total", texto: "Sin pedirle números al fotógrafo." },
    ],
  },

  // 3 · Preparar la venta
  {
    etapa: "3 · Preparar la venta",
    titulo: "Los packs de preventa",
    bajada: "Primero definís qué vendés: qué incluye cada pack y cuánto cuesta. La familia compra antes de la sesión.",
    captura: "/demos/escolar/packs.jpg",
    visual: "packs",
    puntos: [
      { titulo: "Librito + digitales", texto: "Impreso, con el nombre del chico." },
      { titulo: "Solo digitales", texto: "Descarga en alta calidad." },
      { titulo: "Vos ponés las reglas", texto: "Contenido, precio y vigencia." },
    ],
  },
  {
    etapa: "3 · Preparar la venta",
    titulo: "La página de plantillas",
    bajada: "Un catálogo de diseños listos para usar: arriba tus plantillas, abajo las del sistema, con filtros para encontrar la indicada.",
    captura: "/demos/escolar/plantillas-filtros.jpg",
    visual: "plantillas",
    puntos: [
      { titulo: "Nueve tipos de producto", texto: "Librito, diploma, calendario, anuario, figuritas, señalador, portarretrato, tarjeta y póster del curso." },
      { titulo: "Filtros", texto: "Por nivel, estilo, cantidad de fotos, con logo o con listado." },
      { titulo: "Copiás y adaptás", texto: "Una plantilla del sistema pasa a ser tuya." },
    ],
  },
  {
    etapa: "3 · Preparar la venta",
    titulo: "El diseñador",
    bajada: "Un editor en el navegador para crear o retocar cualquier plantilla: páginas, fotos, textos, fondos y logos, en medidas reales de imprenta.",
    captura: "/demos/escolar/disenador.jpg",
    visual: "disenador",
    puntos: [
      { titulo: "Bloques", texto: "Foto, texto, imagen, fondo, mosaico y listado." },
      { titulo: "Medidas reales", texto: "Centímetros, sangrado y márgenes de imprenta." },
      { titulo: "Varias páginas", texto: "Tapa, interiores y contratapa." },
      { titulo: "Fuentes y colores", texto: "Tu identidad o la del colegio." },
    ],
  },
  {
    etapa: "3 · Preparar la venta",
    titulo: "Se completa solo, para cada chico",
    bajada: "Los textos y las fotos del diseño son variables: el sistema los llena con los datos de cada alumno. Diseñás una vez, sale para todo el colegio.",
    captura: "/demos/escolar/probar.jpg",
    visual: "variables",
    puntos: [
      { titulo: "Nombre y curso", texto: "Del listado oficial." },
      { titulo: "Colegio, logo y año", texto: "De la ficha del colegio." },
      { titulo: "Fotos elegidas", texto: "Las que eligió la familia." },
    ],
  },
  {
    etapa: "3 · Preparar la venta",
    titulo: "Probar la plantilla antes de vender",
    bajada: "Elegís fotos de prueba y un curso, y ves el librito armado tal como va a salir. Sin sorpresas en la imprenta.",
    captura: "/demos/escolar/plantillas.jpg",
    visual: "probar",
    puntos: [
      { titulo: "Con fotos de prueba", texto: "De cualquier álbum." },
      { titulo: "Con el listado real", texto: "Nombres largos, cursos, mosaico." },
      { titulo: "Ajustás y listo", texto: "Volvés al diseñador si algo no entra." },
    ],
  },

  // 4 · Preventa
  {
    etapa: "4 · Preventa",
    titulo: "La familia compra en preventa",
    bajada: "El colegio comparte un link y cada familia elige su pack y paga con Mercado Pago, antes de la sesión.",
    captura: "/demos/escolar/preventa.jpg",
    visual: "preventa",
    puntos: [
      { titulo: "Directo a tu cuenta", texto: "El dinero entra por Mercado Pago." },
      { titulo: "Sin efectivo", texto: "El colegio no junta ni rinde dinero." },
      { titulo: "Sin listas de quién pagó", texto: "El sistema sabe qué compró cada familia." },
    ],
  },

  // 5 · Día de la toma
  {
    etapa: "5 · Día de la toma",
    titulo: "Subís todas las fotos juntas",
    bajada: "El día de la toma no separás nada: subís la carpeta completa y el sistema reconoce quién está en cada foto.",
    captura: "/demos/escolar/subida.jpg",
    visual: "subida",
    puntos: [
      { titulo: "Una carpeta por jornada", texto: "Todas las fotos de una vez." },
      { titulo: "Reconocimiento de caras", texto: "Automático, en segundo plano." },
      { titulo: "Cero clasificación a mano", texto: "Cada familia encuentra lo suyo." },
    ],
  },

  // 6 · La familia elige
  {
    etapa: "6 · La familia elige",
    titulo: "Galería privada y búsqueda por selfie",
    bajada: "La galería del colegio está cerrada. Cada familia se saca una selfie y ve solo las fotos de su hijo y las grupales.",
    captura: "/demos/escolar/selfie.jpg",
    visual: "selfie",
    puntos: [
      { titulo: "Galería oculta", texto: "Nadie recorre el álbum completo." },
      { titulo: "Selfie con consentimiento", texto: "Se usa solo para buscar." },
      { titulo: "Se borra", texto: "Cuando la familia quiere o en el plazo que fijes." },
    ],
  },
  {
    etapa: "6 · La familia elige",
    titulo: "Elige las fotos de su pack",
    bajada: "Desde el celular, la familia marca las fotos que entran en su pack. El contador le avisa cuántas le faltan.",
    captura: "/demos/escolar/galeria.jpg",
    visual: "elegir",
    puntos: [
      { titulo: "Desde el celular", texto: "Sin instalar nada." },
      { titulo: "Solo sus fotos", texto: "Las del chico y las del grado." },
      { titulo: "Puede cambiar de idea", texto: "Hasta confirmar el pack." },
    ],
  },
  {
    etapa: "6 · La familia elige",
    titulo: "El librito en 3D",
    bajada: "Antes de confirmar, la familia ve su librito ya armado, en 3D: lo da vuelta, lo abre y recorre página por página.",
    captura: "/demos/escolar/librito-3d-tapa.jpg",
    visual: "libro3d",
    puntos: [
      { titulo: "Ya armado", texto: "Con sus fotos, el nombre y el curso." },
      { titulo: "Página por página", texto: "Tapa, interiores y contratapa." },
      { titulo: "Igual al impreso", texto: "Lo que ve es lo que recibe." },
    ],
  },
  {
    etapa: "6 · La familia elige",
    titulo: "Así lo ve la familia",
    bajada: "El librito real en 3D. Con «Siguiente» se pasan sus páginas.",
    libro3d: "sys_librito_mosaico_primaria_fin_de_ano",
  },
  {
    etapa: "6 · La familia elige",
    titulo: "La familia aprueba antes de imprimir",
    bajada: "Cambia o acomoda fotos y confirma. Si algo no le gusta, pide un cambio. No hay reclamos después de la imprenta.",
    visual: "aprobar",
    puntos: [
      { titulo: "Acomoda sus fotos", texto: "En cada lugar del diseño." },
      { titulo: "Pide cambios", texto: "Te llega el pedido con su comentario." },
      { titulo: "Confirma", texto: "Y queda listo para imprimir." },
    ],
  },
  {
    etapa: "6 · La familia elige",
    titulo: "El mosaico de compañeros",
    bajada: "La hoja de adentro del librito con todo el grado: cada chico con su foto y su nombre. Ningún chico queda afuera.",
    captura: "/demos/escolar/librito-3d-mosaico.jpg",
    visual: "mosaico",
    puntos: [
      { titulo: "Nombres del padrón", texto: "La lista oficial del colegio." },
      { titulo: "Retrato elegido", texto: "Al canjear queda atado al chico." },
      { titulo: "Quien no compró, aparece igual", texto: "Con su retrato de la toma." },
      { titulo: "El colegio completa", texto: "Con un enlace, eligiendo de la lista." },
    ],
  },

  // 7 · Producción y entrega
  {
    etapa: "7 · Producción y entrega",
    titulo: "La línea de producción",
    bajada: "Cada pedido avanza por siete etapas, y ves de un vistazo en qué está cada uno.",
    captura: "/demos/escolar/pedidos.jpg",
    visual: "embudo",
    numerados: true,
    puntos: [
      { titulo: "Por canjear" },
      { titulo: "Revisar diseño" },
      { titulo: "Cambios pedidos" },
      { titulo: "Para imprimir" },
      { titulo: "En imprenta" },
      { titulo: "Para entregar" },
      { titulo: "Entregado" },
    ],
  },
  {
    etapa: "7 · Producción y entrega",
    titulo: "Todo a la imprenta, en un clic",
    bajada: "Juntás los pedidos aprobados en un lote de impresión y descargás los archivos listos para la imprenta, ordenados por curso.",
    visual: "imprenta",
    puntos: [
      { titulo: "Lotes de impresión", texto: "Por colegio, curso o producto." },
      { titulo: "Archivos de imprenta", texto: "En alta, con sangrado y medidas reales." },
      { titulo: "Ordenados", texto: "Curso por curso, alumno por alumno." },
    ],
  },
  {
    etapa: "7 · Producción y entrega",
    titulo: "Los sobres con QR",
    bajada: "Imprimís una etiqueta por pedido. Cada sobre sabe de quién es.",
    visual: "etiquetas",
    puntos: [
      { titulo: "Etiqueta con QR", texto: "Alumno, curso, colegio y pedido." },
      { titulo: "Ordenadas por curso", texto: "Para armar las cajas del colegio." },
      { titulo: "Sin rotular a mano", texto: "Se imprimen todas juntas." },
    ],
  },
  {
    etapa: "7 · Producción y entrega",
    titulo: "La entrega en el colegio",
    bajada: "En el colegio escaneás el QR del sobre con el celular, ves la ficha de entrega de ese chico y lo marcás entregado.",
    visual: "entrega",
    numerados: true,
    puntos: [
      { titulo: "Escaneás el sobre", texto: "Con la cámara del celular." },
      { titulo: "Ves la ficha", texto: "Alumno, curso y lo que compró." },
      { titulo: "Marcás entregado", texto: "Y el pedido queda cerrado." },
    ],
  },
  {
    etapa: "7 · Producción y entrega",
    titulo: "La pantalla de pedidos",
    bajada: "Una pantalla para el taller: las siete etapas y las tarjetas de cada pedido, para seguir la producción en una tele o un monitor.",
    captura: "/demos/escolar/pantalla.jpg",
    visual: "pantalla",
    puntos: [
      { titulo: "Para el equipo", texto: "Todos ven en qué está cada pedido." },
      { titulo: "Se actualiza sola", texto: "Sin recargar." },
      { titulo: "Nada se pierde", texto: "Lo atrasado salta a la vista." },
    ],
  },
  {
    etapa: "Cierre",
    titulo: "El colegio ve su venta",
    bajada: "Al terminar, la dirección ve en su panel la venta completa y la comisión que le corresponde, sin pedir planillas.",
    captura: "/demos/escolar/venta-colegio.jpg",
    visual: "ventaColegio",
  },
  {
    etapa: "Cierre",
    titulo: "Sin listados ni cobros a mano",
    bajada: "Todo el circuito escolar en un solo lugar, y configurable conversando con el bot.",
    ancha: true,
    puntos: [
      { titulo: "Página de venta propia", texto: "Los colegios te piden propuesta solos." },
      { titulo: "Preventa con Mercado Pago", texto: "Cobrás antes de sacar la foto." },
      { titulo: "Búsqueda por selfie", texto: "Cada familia se encuentra sola." },
      { titulo: "Plantillas y diseñador", texto: "Librito, diploma o anuario, automáticos." },
      { titulo: "Librito en 3D", texto: "La familia aprueba antes de imprimir." },
      { titulo: "Imprenta y sobres con QR", texto: "Producción y entrega ordenadas." },
      { titulo: "Panel del colegio", texto: "Comisión transparente." },
      { titulo: "Todo con el bot", texto: "Lo configurás conversando." },
    ],
  },
  {
    etapa: "Cierre",
    titulo: "Todo el ecosistema DNX",
    bajada: "Herramientas para fotógrafos, estudios e instituciones, conectadas entre sí.",
    apps: true,
  },
];
