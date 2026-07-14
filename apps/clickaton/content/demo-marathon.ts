import type { PublicMarathon } from "@/types/marathon";

/**
 * Fixture técnico de ficha pública.
 * No es una edición anunciada. Ciudad, fechas, premios y personas son de ejemplo.
 */
export const demoMarathon: PublicMarathon = {
  id: "demo-marathon-001",
  slug: "demo",
  name: "Clickaton Demo",
  editionName: "Edición de referencia técnica",
  shortDescription:
    "Ficha pública de ejemplo para validar la presentación de una maratón antes de la integración con FotoRank.",
  fullDescription:
    "Esta página demuestra cómo Clickaton presentará una edición oficial: territorio, fechas, categorías, cronograma, bases, validaciones, premios, jurado, sponsors, organización y FAQ. Los datos son ficticios y solo sirven como contrato visual y tipado. Cuando exista una maratón real, FotoRank será la fuente de verdad y esta ficha se alimentará con datos públicos aprobados.",
  status: "announced",
  registrationStatus: "coming_soon",
  format: "individual",
  modality: "Presencial con entrega digital",
  featured: false,
  isDemo: true,
  city: "Ciudad Ejemplo",
  provinceOrRegion: "Provincia Demo",
  country: "Argentina",
  venueName: "Plaza de Encuentro (ejemplo)",
  meetingPoint: "Ingreso principal de la plaza de ejemplo, frente al reloj público.",
  timezone: "America/Argentina/Buenos_Aires",
  startAt: "2026-11-14T09:00:00-03:00",
  endAt: "2026-11-14T20:00:00-03:00",
  registrationOpenAt: "2026-09-01T10:00:00-03:00",
  registrationCloseAt: "2026-11-10T23:59:00-03:00",
  participantLimit: 120,
  minimumAge: 16,
  allowedDevices: ["smartphone", "camera"],
  galleryPreview: [],
  organizer: {
    name: "Organización Demo Clickaton",
    type: "producer",
    description:
      "Organizador de ejemplo. En ediciones reales, este bloque mostrará club, asociación, institución o productora responsable.",
    city: "Ciudad Ejemplo",
    country: "Argentina",
  },
  localVenue: {
    name: "Sede local de ejemplo",
    city: "Ciudad Ejemplo",
    provinceOrRegion: "Provincia Demo",
    country: "Argentina",
    coordinatorName: "Coordinación local (ejemplo)",
    description:
      "La sede local acompaña acreditación, punto de encuentro y comunicación territorial. Datos ficticios.",
  },
  categories: [
    {
      id: "cat-libre",
      name: "Mirada libre",
      description:
        "Categoría abierta a distintas formas de observar el territorio. Dispositivos según bases.",
      allowedDevices: ["smartphone", "camera"],
      ageRange: "16+",
    },
    {
      id: "cat-movil",
      name: "Solo celular",
      description: "Pensada para quienes participan exclusivamente con smartphone.",
      allowedDevices: ["smartphone"],
      ageRange: "16+",
      capacity: 60,
    },
    {
      id: "cat-joven",
      name: "Jóvenes",
      description: "Espacio orientado a participantes de 16 a 21 años.",
      allowedDevices: ["smartphone", "camera"],
      ageRange: "16–21",
      capacity: 40,
    },
  ],
  schedule: [
    {
      id: "sch-briefing",
      title: "Briefing y acreditación",
      description: "Encuentro inicial, revisión de bases y liberación del marco de la jornada.",
      startAt: "2026-11-14T09:00:00-03:00",
      endAt: "2026-11-14T09:45:00-03:00",
      location: "Plaza de Encuentro (ejemplo)",
      publicBeforeEvent: true,
      type: "briefing",
    },
    {
      id: "sch-start",
      title: "Inicio del recorrido",
      description: "Comienza el tiempo de la maratón. Las consignas se liberan según las bases.",
      startAt: "2026-11-14T10:00:00-03:00",
      location: "Territorio de ejemplo",
      publicBeforeEvent: true,
      type: "start",
    },
    {
      id: "sch-deadline",
      title: "Cierre de entrega",
      description: "Límite de carga de fotografías. Después de este horario no se aceptan envíos.",
      startAt: "2026-11-14T18:00:00-03:00",
      publicBeforeEvent: true,
      type: "deadline",
    },
    {
      id: "sch-ceremony",
      title: "Cierre comunitario",
      description: "Espacio de encuentro. Resultados y galería se publican según el estado de la edición.",
      startAt: "2026-11-14T19:00:00-03:00",
      endAt: "2026-11-14T20:00:00-03:00",
      location: "Plaza de Encuentro (ejemplo)",
      publicBeforeEvent: true,
      type: "ceremony",
    },
    {
      id: "sch-internal",
      title: "Punto operativo interno",
      description: "No debe mostrarse antes del evento.",
      startAt: "2026-11-14T12:00:00-03:00",
      publicBeforeEvent: false,
      type: "checkpoint",
    },
  ],
  prizes: [
    {
      id: "prize-1",
      title: "Mejor mirada de la edición",
      description:
        "Reconocimiento conceptual de ejemplo. Los premios reales se publican cuando estén confirmados.",
      position: 1,
      categoryId: "cat-libre",
    },
    {
      id: "prize-2",
      title: "Mejor trabajo con celular",
      description: "Premio de ejemplo para la categoría Solo celular.",
      position: 1,
      categoryId: "cat-movil",
    },
    {
      id: "prize-3",
      title: "Mención pedagógica",
      description:
        "Reconocimiento orientado al aprendizaje y a la exploración visual. Sin valor comercial inventado.",
      position: 0,
    },
  ],
  jury: [
    {
      id: "jury-1",
      name: "Persona Jurado A",
      role: "Jurado titular (ejemplo)",
      biography:
        "Perfil ficticio. En ediciones reales se publicará biografía breve y créditos aprobados.",
    },
    {
      id: "jury-2",
      name: "Persona Jurado B",
      role: "Jurado titular (ejemplo)",
      biography: "Perfil ficticio para validar la grilla de jurado.",
    },
    {
      id: "jury-3",
      name: "Persona Docente C",
      role: "Acompañamiento pedagógico (ejemplo)",
      biography:
        "Rol de ejemplo. No implica que todas las ediciones tengan devolución individual.",
    },
  ],
  sponsors: [
    {
      id: "sp-1",
      name: "Aliado Ejemplo Global",
      level: "Acompañamiento de ejemplo",
      description: "Sponsor ficticio para probar el bloque. Sin logos ni marcas reales.",
      localOrGlobal: "global",
    },
    {
      id: "sp-2",
      name: "Aliado Ejemplo Local",
      description: "Sponsor local ficticio. En producción solo aparecerán alianzas confirmadas.",
      localOrGlobal: "local",
    },
  ],
  faq: [
    {
      question: "¿Esta es una maratón real?",
      answer:
        "No. Es una ficha técnica de demostración. Las ediciones oficiales se anunciarán en /maratones cuando estén listas.",
    },
    {
      question: "¿Puedo inscribirme desde acá?",
      answer:
        "Todavía no. La inscripción real llegará con la integración a FotoRank y DNX Identity. Esta página solo muestra el contrato visual.",
    },
    {
      question: "¿Dónde están las consignas?",
      answer:
        "Las consignas no se publican anticipadamente. Cuando una edición esté en curso, FotoRank liberará las consignas autorizadas y Clickaton las mostrará solo si están reveladas.",
    },
    {
      question: "¿Las validaciones GPS y EXIF son obligatorias?",
      answer:
        "Depende de cada edición. Esta demo muestra una política de ejemplo: el tiempo se controla y GPS/EXIF pueden requerirse según las bases.",
    },
  ],
  rules: {
    title: "Bases de ejemplo — Clickaton Demo",
    summary:
      "Documento de referencia para mostrar cómo se presentarán las bases públicas. No tiene valor legal.",
    version: "0.1-demo",
    publishedAt: "2026-07-01",
    content:
      "1. Participación sujeta a inscripción oficial (aún no disponible).\n2. Cada categoría define dispositivos admitidos.\n3. Las fotografías deben respetar la autoría y el cuidado del espacio público.\n4. Las consignas se liberan en el momento definido por la edición.\n5. Las validaciones de tiempo, GPS y EXIF se aplican según esta política de ejemplo.\n6. El jurado evalúa con criterios publicados; no se revelan criterios internos no aprobados.\n7. Esta demo no genera derechos de inscripción ni premios reales.",
  },
  validationPolicy: {
    timeWindowEnforced: true,
    gpsMayBeRequired: true,
    exifMayBeRequired: true,
    summary:
      "En esta edición de ejemplo se controla la ventana de tiempo. GPS y EXIF pueden requerirse para validar recorrido y momento de captura.",
    notes: [
      "La obligatoriedad exacta la definen las bases de cada edición.",
      "Clickaton solo muestra la política pública aprobada; FotoRank ejecuta la validación.",
      "No se exponen datos crudos de ubicación de participantes en esta ficha.",
    ],
  },
  accessibilityNotes:
    "Punto de encuentro de ejemplo en espacio abierto. En ediciones reales se publicarán notas de accesibilidad específicas del territorio.",
  contactInfo:
    "Los canales oficiales de contacto de Clickaton se publicarán próximamente. Esta demo no incluye correo ni teléfono inventados.",
  resultsStatus: "not_available",
  galleryStatus: "coming_soon",
  challenges: [
    {
      id: "ch-1",
      order: 1,
      status: "scheduled",
      revealed: false,
      publicAfterEvent: false,
      releaseAt: "2026-11-14T10:00:00-03:00",
      // title/description intencionalmente ausentes: no deben filtrarse a la UI
    },
    {
      id: "ch-2",
      order: 2,
      status: "hidden",
      revealed: false,
      publicAfterEvent: true,
      title: "CONSIGNA SECRETA — NO MOSTRAR",
      description: "Si esto aparece en la UI, hay un bug de seguridad.",
    },
    {
      id: "ch-3",
      order: 3,
      status: "scheduled",
      revealed: false,
      publicAfterEvent: false,
      title: "Otra consigna oculta",
      description: "Tampoco debe renderizarse.",
    },
  ],
  createdAt: "2026-07-14T12:00:00.000Z",
  updatedAt: "2026-07-14T15:00:00.000Z",
};

export const marathonCatalog: readonly PublicMarathon[] = [demoMarathon];
