/**
 * La propuesta para sociedades, asociaciones y fotoclubes.
 *
 * Es lo que se le muestra a una institución que eligió «sociedad» (o que llegó por el enlace
 * que se le manda por correo). Los módulos del catálogo dicen QUÉ hace cada pieza; esto dice
 * para qué le sirve a una comisión directiva, agrupado por la tarea que le saca de encima.
 *
 * Regla: cada punto se apoya en algo que el sistema hace hoy. Lo que todavía no existe se dice
 * en `pendiente`, en la misma tarjeta, y no se esconde. `instituciones.test.ts` ata cada clave
 * al catálogo para que ningún punto quede apuntando a un módulo inventado.
 */

export type PuntoInstitucional = {
  id: string;
  titulo: string;
  texto: string;
  /** Claves del catálogo (FOTOFFICE o de la suite) que lo resuelven. */
  claves: string[];
  /** Lo que de este punto todavía no está construido. Se muestra tal cual. */
  pendiente?: string;
};

export const PUNTOS_INSTITUCIONALES: PuntoInstitucional[] = [
  {
    id: "socios",
    titulo: "Alta y gestión de socios",
    texto:
      "Quien quiere asociarse completa la solicitud desde el sitio y llega a la comisión para aprobarla o rechazarla. El padrón queda en una pantalla, con categorías propias, y cada socio actualiza sus datos desde su portal en vez de pedírselo a Secretaría.",
    claves: ["members", "portal"],
  },
  {
    id: "cuotas",
    titulo: "Cuotas societarias y su seguimiento",
    texto:
      "La cuota de cada mes se genera sola según el estado del socio, se paga con Mercado Pago desde el portal y el dinero entra a la cuenta de la institución. Lo que se cobra en efectivo o por transferencia se registra en el mismo historial, así Tesorería ve qué debe cada uno sin cruzar planillas.",
    claves: ["membership-dues", "cobros", "cash"],
  },
  {
    id: "carnets",
    titulo: "Carnets que se pueden comprobar",
    texto:
      "El carnet lleva un código que, al escanearlo, dice si la persona es socia y está al día. Frente y dorso se diseñan con la identidad de la institución, y un carnet perdido se anula y se vuelve a emitir.",
    claves: ["carnets"],
  },
  {
    id: "modulos",
    titulo: "Cada módulo, a medida de la institución",
    texto:
      "Nada viene encendido: se prende lo que la institución usa y el resto no aparece ni en el menú ni en el portal. Cada módulo tiene su configuración —valores de cuota, categorías, diseño del carnet, reglas de los sorteos, espacios y tarifas— y se puede apagar sin perder lo cargado.",
    claves: ["equipo"],
  },
  {
    id: "sorteos",
    titulo: "Sorteos para socios, con sponsors",
    texto:
      "Se sortea entre los socios al día, con premios que aportan las marcas aliadas. Cada sorteo publica antes su descripción, el cierre de la inscripción, la fecha del sorteo y el plazo para retirar el premio, y la lista de participantes se sella antes de sortear. El número ganador sale de una fuente pública de azar y cualquier socio puede comprobar el resultado.",
    claves: ["raffles", "sponsors"],
  },
  {
    id: "beneficios",
    titulo: "Sponsors, convenios y beneficios",
    texto:
      "Cada marca carga sus propios datos —logo, redes, contacto y el beneficio que ofrece a los socios— desde un enlace que le manda la institución. Ustedes eligen dónde aparece (el sitio, el portal, el aviso al entrar) y hasta cuándo; al vencer, el logo se baja solo.",
    claves: ["sponsors"],
    pendiente:
      "la sección «Beneficios» del portal, con todos los convenios juntos. Hoy el beneficio queda cargado en la ficha de cada sponsor.",
  },
  {
    id: "transparencia",
    titulo: "Gestión ordenada y con registro",
    texto:
      "Cada integrante de la comisión entra con su rol —Presidencia, Secretaría, Tesorería, Revisor de cuentas y otros— y ve o gestiona sólo lo que le toca. Los cambios en el padrón y los pagos quedan firmados con quién y cuándo, y los proyectos de la comisión guardan sus tareas, archivos y decisiones.",
    claves: ["equipo", "governance"],
    pendiente:
      "publicar el balance y la rendición para los socios, ni llevar actas y votaciones dentro del sistema.",
  },
  {
    id: "participacion",
    titulo: "Actividades, comunicación y participación",
    texto:
      "Cursos con inscripción y pago, reserva del salón o el estudio con precio de socio, portfolios de los socios publicados en el sitio, placas de bienvenida para redes y un sitio propio armado por bloques. Todo sale con el nombre y la firma de la institución.",
    claves: ["courses-sales", "bookings", "portfolio", "communications", "website", "correos"],
    pendiente: "salidas y encuentros con inscripción y lista de asistencia.",
  },
  {
    id: "acompanamiento",
    titulo: "Acompañamiento en la puesta en marcha",
    texto:
      "No queda librado a que lo descubran solos: acompañamos la configuración inicial, la carga del padrón, el encendido de los módulos que elijan y las primeras semanas de uso, hasta que la comisión lo maneje por su cuenta.",
    claves: [],
  },
];

/**
 * Lo que la propuesta le cambia a una comisión. Sin cifras ni promesas de crecimiento:
 * es lo que deja de hacer a mano.
 */
export const PARA_LA_COMISION = [
  "Menos tiempo persiguiendo cuotas y cruzando planillas: el estado de cada socio está a la vista.",
  "Sumarse es más simple: la solicitud se completa en línea y el alta no depende de una reunión.",
  "Más motivos para participar: sorteos, cursos, concursos, muestras y beneficios en un mismo lugar.",
] as const;
