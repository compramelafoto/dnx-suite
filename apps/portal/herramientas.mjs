// Datos de cada herramienta de DNX Suite. Los textos salen de lo que cada
// sitio ya promete en su portada: si una función no está abierta al público,
// no se nombra acá.

export const herramientas = [
  {
    slug: "compramelafoto",
    para: "Para fotógrafos de eventos y para sus clientes.",
    // Alto del logo en la lista: los originales traen distinto margen.
    altoLogo: 50,
    nombre: "ComprameLaFoto",
    color: "#C47A3F",
    tinta: "#8E4F1C",
    dominio: "compramelafoto.com",
    url: "https://compramelafoto.com",
    registro: { texto: "Crear cuenta de fotógrafo", url: "https://compramelafoto.com/fotografo/registro" },
    secundario: { texto: "Buscar mis fotos", url: "https://compramelafoto.com" },
    frase: "Vendé las fotos de tus eventos, digitales e impresas.",
    resumen:
      "Subís el álbum del evento, compartís el link y tus clientes eligen sus fotos, pagan con Mercado Pago y las descargan o las reciben impresas. Los precios salen de tu lista y del margen que le pongas a cada álbum.",
    paraQuien: [
      "Fotógrafos de eventos sociales, deportivos y escolares",
      "Laboratorios que imprimen para fotógrafos",
      "Organizadores de eventos",
      "Quien busca sus fotos de un evento",
    ],
    funciones: [
      {
        titulo: "Vender",
        items: [
          "Álbumes por evento con su propio link",
          "Fotos digitales e impresas en el mismo carrito",
          "Tu lista de precios y un sobreprecio por autoría en cada álbum",
          "Cobro con Mercado Pago",
        ],
      },
      {
        titulo: "Entregar",
        items: [
          "Descarga digital después del pago",
          "Impresiones con seguimiento del pedido",
          "Foto carnet y polaroids",
        ],
      },
      {
        titulo: "Hacerse ver",
        items: [
          "Página propia para tu marca",
          "Directorio de fotógrafos, laboratorios, organizadores y proveedores",
          "Buscador de eventos cerca de cada cliente",
        ],
      },
    ],
    pasos: [
      "Creá tu cuenta de fotógrafo.",
      "Conectá Mercado Pago y cargá tu lista de precios.",
      "Subí el álbum y compartí el link con tus clientes.",
      "Ellos eligen, pagan y reciben sus fotos.",
    ],
    cuenta: "La cuenta de ComprameLaFoto también te sirve para entrar a ¿Cuánto Cobro?.",
  },
  {
    slug: "cuanto-cobro",
    para: "Para fotógrafos que quieren poner precio con números.",
    altoLogo: 52,
    nombre: "¿Cuánto Cobro?",
    color: "#17804F",
    tinta: "#0F5E39",
    dominio: "compramelafoto.com/cuantocobro",
    url: "https://compramelafoto.com/cuantocobro",
    registro: { texto: "Calcular mi tarifa", url: "https://compramelafoto.com/cuantocobro/login" },
    frase: "Calculá cuánto cobrar para que la fotografía te deje ganancia.",
    resumen:
      "Cargás tus gastos personales, los del negocio y el tiempo que tenés para trabajar, y la herramienta te dice cuánto cobrar cada tipo de trabajo. Con esa tarifa armás presupuestos y se los mandás a tus clientes con un link.",
    paraQuien: [
      "Fotógrafos que ponen precio a ojo o copiando a la competencia",
      "Quien arranca y no sabe cuánto pedir",
      "Estudios que quieren revisar si sus precios cubren los costos",
    ],
    funciones: [
      {
        titulo: "Tus números",
        items: [
          "Gastos personales y gastos del negocio",
          "Horas y días disponibles para trabajar",
          "Tarifa mínima para cada actividad fotográfica",
        ],
      },
      {
        titulo: "Tus clientes",
        items: [
          "Cotizar un trabajo en el momento",
          "Presupuestos que el cliente abre con un link",
          "Registro de las consultas que te llegan",
        ],
      },
    ],
    pasos: [
      "Entrá con tu cuenta de ComprameLaFoto, o creala.",
      "Cargá tus gastos y tu disponibilidad.",
      "Mirá la tarifa de cada actividad.",
      "Cotizá y mandá el presupuesto.",
    ],
    cuenta: "Usa la misma cuenta que ComprameLaFoto. Si ya la tenés, no hace falta registrarse de nuevo.",
  },
  {
    slug: "fotoffice",
    para: "Para fotógrafos, estudios, escuelas e instituciones.",
    altoLogo: 66,
    nombre: "FOTOFFICE",
    color: "#1593F0",
    tinta: "#0B62A8",
    dominio: "fotoffice.com",
    url: "https://fotoffice.com",
    registro: { texto: "Empezar con FOTOFFICE", url: "https://fotoffice.com" },
    secundario: { texto: "Ya tengo cuenta", url: "https://fotoffice.com/login" },
    frase: "El sistema para la parte del oficio que no es sacar fotos.",
    resumen:
      "Consultas, presupuestos, agenda, caja, pedidos, cursos, socios y sitio web en un mismo lugar. Encendés sólo los módulos que usás y el resto ni aparece en el menú.",
    paraQuien: [
      "Fotógrafos freelance",
      "Locales y estudios a la calle",
      "Estudios y productoras con equipo",
      "Escuelas y academias de fotografía",
      "Sociedades, asociaciones y fotoclubes",
      "Quien alquila un estudio, un salón o un coworking",
    ],
    funciones: [
      {
        titulo: "Clientes y ventas",
        items: [
          "Consultas y presupuestos",
          "Clientes, contratos y proyectos",
          "Pedidos de impresión, fotolibros y galerías",
          "Caja del día y cobros con Mercado Pago",
        ],
      },
      {
        titulo: "Tiempo y espacios",
        items: [
          "Agenda del estudio",
          "Reservas de espacios por hora o por día",
          "Cursos con inscripción y cobro",
        ],
      },
      {
        titulo: "Instituciones",
        items: [
          "Padrón de socios y cuotas",
          "Carnet digital",
          "Portal del socio, blog y sitio web propio",
        ],
      },
    ],
    pasos: [
      "Elegí qué tipo de negocio o institución tenés.",
      "Mirá los módulos que te sugiere y encendé los que necesites.",
      "Cargá tus datos y empezá a usarlo.",
    ],
    cuenta: "FOTOFFICE tiene su propia cuenta. Podés invitar a tu equipo para que trabaje en el mismo espacio.",
  },
  {
    slug: "fotofluxx",
    para: "Para fotógrafos de eventos.",
    altoLogo: 66,
    nombre: "FotoFluxx",
    color: "#D9136F",
    tinta: "#A50E54",
    dominio: "En desarrollo",
    estado: "En desarrollo",
    frase: "Elegí y revelá las fotos de un evento sin pasar la noche frente a la pantalla.",
    resumen:
      "FotoFluxx agrupa las fotos repetidas, propone la mejor de cada momento y las revela con tu estilo. Hoy se usa en los eventos de DNX Estudio y todavía no está abierto a otros fotógrafos.",
    paraQuien: [
      "Fotógrafos de eventos que entregan cientos de fotos por fiesta",
      "Quien quiere publicar más rápido en ComprameLaFoto",
    ],
    funciones: [
      {
        titulo: "Elegir",
        items: [
          "Agrupa las ráfagas y las fotos repetidas",
          "Propone la mejor de cada momento",
          "Una revisión rápida para confirmar o cambiar la elección",
        ],
      },
      {
        titulo: "Revelar",
        items: [
          "Revelado con tu estilo, a partir de tus ajustes",
          "Corrección de exposición y balance foto por foto",
        ],
      },
    ],
    pasos: [
      "Bajás las tarjetas de memoria.",
      "FotoFluxx agrupa y propone una selección.",
      "Revisás la selección.",
      "Las fotos elegidas salen reveladas.",
    ],
    cuenta: "Todavía no hay registro abierto. Cuando abra, lo vas a ver en esta página.",
  },
  {
    slug: "fotorank",
    para: "Para organizadores, participantes y jurados.",
    altoLogo: 66,
    nombre: "FotoRank",
    color: "#E0A10F",
    tinta: "#7F5A00",
    dominio: "fotorank.com",
    url: "https://fotorank.com",
    registro: { texto: "Crear cuenta en FotoRank", url: "https://fotorank.com/crear-cuenta" },
    secundario: { texto: "Quiero ser jurado", url: "https://fotorank.com/jurado/registro" },
    frase: "Concursos fotográficos, de la convocatoria al ranking.",
    resumen:
      "Las organizaciones publican su concurso gratis, con categorías, bases y fechas. Los fotógrafos se inscriben, cargan su obra y siguen el estado de su participación. El jurado califica en línea y los resultados se publican en la misma plataforma.",
    paraQuien: [
      "Fotoclubes, sociedades e instituciones que organizan concursos",
      "Fotógrafos que quieren participar",
      "Fotógrafos con experiencia que quieren ser jurado",
    ],
    funciones: [
      {
        titulo: "Para organizar",
        items: [
          "Publicar una convocatoria sin costo",
          "Categorías, bases y fechas en un solo lugar",
          "Inscripciones ordenadas y jurado en línea",
          "Resultados presentados con el nombre de la institución",
        ],
      },
      {
        titulo: "Para participar",
        items: [
          "Concursos y maratones con inscripción abierta",
          "Bases y privacidad visibles antes de confirmar",
          "Carga de la obra cuando el concurso lo habilita",
          "Estado de tu inscripción en lenguaje claro",
        ],
      },
    ],
    pasos: [
      "Elegí un concurso publicado y leé las bases.",
      "Creá tu cuenta o iniciá sesión.",
      "Completá la inscripción y los consentimientos.",
      "Cuando se habilite, cargá y confirmá tu fotografía.",
    ],
    cuenta: "FotoRank tiene su propia cuenta, para participar y para organizar.",
  },
  {
    slug: "muestras-fotograficas",
    para: "Para quien expone, organiza o quiere ir a ver.",
    altoLogo: 48,
    nombre: "Muestras Fotográficas",
    color: "#17707C",
    tinta: "#105761",
    dominio: "muestrasfotograficas.com",
    url: "https://muestrasfotograficas.com",
    registro: { texto: "Proponer mi muestra", url: "https://muestrasfotograficas.com/login" },
    secundario: { texto: "Ver muestras cerca", url: "https://muestrasfotograficas.com" },
    frase: "Muestras de fotografía para ver en persona, en todo el país.",
    resumen:
      "Un mapa de las muestras abiertas, con fechas, horarios y cómo llegar. Quien organiza tiene todo para armar la muestra, convocar obras, montarla en la sala y llevar gente a verla.",
    paraQuien: [
      "Quien quiere ver fotografía cerca de su casa",
      "Fotógrafos que exponen",
      "Organizadores, fotoclubes, galerías e instituciones",
    ],
    funciones: [
      {
        titulo: "Armar la muestra",
        items: [
          "Ficha con la sede en el mapa, fechas, horarios y entrada",
          "Muestras itinerantes en varias sedes",
          "Coorganizadores y curadores",
        ],
      },
      {
        titulo: "Convocar y seleccionar",
        items: [
          "Convocatorias abiertas a fotógrafos de cualquier lugar",
          "Curaduría a distancia y anónima",
          "Los ganadores de un concurso de FotoRank como punto de partida",
        ],
      },
      {
        titulo: "Montar y difundir",
        items: [
          "Fichas de sala con código QR",
          "Plano y lista de montaje",
          "Invitación a la inauguración y resumen semanal a quienes viven cerca",
        ],
      },
    ],
    pasos: [
      "Ingresá con tu cuenta.",
      "Cargá la muestra con su sede y sus fechas.",
      "Sumá las obras y los artistas.",
      "Compartí la ficha y recibí visitas.",
    ],
    cuenta: "Muestras Fotográficas tiene su propia cuenta. Para ver las muestras no hace falta registrarse.",
  },
];

// Herramientas de la suite que no son para el fotógrafo en su día a día,
// o que no tienen logo propio todavía.
export const otras = [
  {
    nombre: "SubiLaFoto",
    url: "https://subilafoto.com",
    dominio: "subilafoto.com",
    texto:
      "Los invitados de un evento escanean un código, suben sus fotos y aparecen en la pantalla del salón y en el álbum. Lo vendés con tu marca.",
  },
  {
    nombre: "Info Spot",
    url: "https://infospot.com.ar",
    dominio: "infospot.com.ar",
    texto: "Medio digital con noticias y coberturas de eventos deportivos, culturales y sociales.",
  },
];

// "¿Por dónde empiezo?": lo que la persona quiere hacer, en sus palabras.
export const necesidades = [
  ["Vender las fotos de un evento", "compramelafoto"],
  ["Saber cuánto cobrar un trabajo", "cuanto-cobro"],
  ["Ordenar consultas, agenda y cobros", "fotoffice"],
  ["Administrar socios y cuotas", "fotoffice"],
  ["Elegir y revelar fotos más rápido", "fotofluxx"],
  ["Organizar un concurso o participar", "fotorank"],
  ["Difundir una muestra o encontrar una", "muestras-fotograficas"],
  ["Que los invitados suban fotos a la pantalla", "subilafoto"],
];
