/**
 * Los tipos de organización que la portada sabe contestar.
 *
 * La portada abre con una sola pregunta —qué sos— y hasta que no se contesta no muestra nada
 * más. La razón es que el sistema tiene quince módulos y ninguna organización usa los quince:
 * mostrarlos todos de entrada obliga a cada visitante a hacer el trabajo de descartar. Esta
 * lista es ese descarte hecho de antemano.
 *
 * Cada tipo declara TRES destacados y nada más. Tres es lo que alguien retiene de una pantalla
 * nueva; con cinco la respuesta vuelve a ser una lista y se pierde el sentido de haber
 * preguntado. Lo demás va abajo, como "y además tenés".
 *
 * Las claves son las mismas del catálogo (`catalogo.ts`), y `tipos.test.ts` no deja que ninguna
 * apunte a un módulo que no exista.
 */

export type TipoDeOrganizacion = {
  id: string;
  /** Cómo se nombra a sí misma la persona, en primera persona. */
  label: string;
  /** Una línea para reconocerse. Si no se reconoce, elige mal. */
  resumen: string;
  icono: string;
  /** Los tres que más va a usar, en orden, con el motivo escrito para este caso. */
  destacados: { key: string; porque: string }[];
  /** El resto de lo que le sirve. Mismo catálogo, menos peso. */
  ademas: string[];
  /** El cuadro sin revelar que más le interesa. Se muestra siempre como "todavía no". */
  proximo: string;
};

export const TIPOS: TipoDeOrganizacion[] = [
  {
    id: "freelance",
    label: "Soy fotógrafo o fotógrafa freelance",
    resumen: "Trabajo por mi cuenta: bodas, XV, sesiones y eventos. No tengo local.",
    icono: "tipo-freelance",
    destacados: [
      {
        key: "consultas",
        porque:
          "La consulta te llega armada: quién se casa, en qué salón y las tres fechas. Se acabó el ida y vuelta por WhatsApp para enterarte de qué se trata.",
      },
      {
        key: "website",
        porque:
          "Tu sitio con tu portada y tu formulario, publicado desde acá. Es la puerta por la que entra el pedido, y la armás sin tocar código.",
      },
      {
        key: "cobros",
        porque:
          "Cobrás la seña con Mercado Pago en el momento de cerrar. El dinero entra a tu cuenta, no a una intermedia.",
      },
    ],
    ademas: ["clients", "cash", "correos", "equipo", "courses-sales"],
    proximo: "11",
  },
  {
    id: "local",
    label: "Tengo un local o estudio a la calle",
    resumen: "Abro la puerta, entra gente, se atiende, se cobra y alguien tiene que anotarlo.",
    icono: "tipo-local",
    destacados: [
      {
        key: "cash",
        porque:
          "Abrís y cerrás el turno con su arqueo. Si el mostrador no da, la diferencia queda escrita con su explicación en vez de taparse.",
      },
      {
        key: "bookings",
        porque:
          "La sala por hora, con el equipamiento que se alquila aparte y cuánto hay de cada cosa. Dos reservas no pueden pisarse: lo impide la base.",
      },
      {
        key: "clients",
        porque:
          "Quién te compró qué, con su ficha, su contacto y sus datos fiscales. El que vuelve no se carga dos veces.",
      },
    ],
    ademas: ["cobros", "consultas", "website", "courses-sales", "correos", "equipo"],
    proximo: "11",
  },
  {
    id: "escuela",
    label: "Tengo una escuela o academia de fotografía",
    resumen: "Doy clases, cobro inscripciones y necesito saber quién cursó qué.",
    icono: "tipo-escuela",
    destacados: [
      {
        key: "courses-sales",
        porque:
          "El curso con su docente, su cupo y su precio. Se anotan y pagan desde el sitio, y te queda la lista de quién falta contactar.",
      },
      {
        key: "evaluaciones",
        porque:
          "Las evaluaciones de cada curso, para saber quién las hizo y cómo le fue, sin llevarlo en una planilla aparte.",
      },
      {
        key: "clients",
        porque:
          "El padrón de alumnos con su ficha y todo lo que cursó cada uno, aunque no sea socio de nada.",
      },
    ],
    ademas: ["cobros", "cash", "website", "bookings", "correos", "equipo", "consultas"],
    proximo: "12",
  },
  {
    id: "sociedad",
    label: "Soy una sociedad o asociación de fotógrafos",
    resumen: "Tengo socios, una cuota que vence todos los meses y carnets que emitir.",
    icono: "tipo-sociedad",
    destacados: [
      {
        key: "membership-dues",
        porque:
          "La cuota de cada mes se genera sola según el estado del socio el día 1 y se cobra desde su portal. La que se paga en mano se registra y entra al mismo historial.",
      },
      {
        key: "carnets",
        porque:
          "El carnet con un código que, al escanearlo, dice si esa persona es socia y está al día. Se puede anular si se pierde, y el frente y el dorso los diseñás vos.",
      },
      {
        key: "members",
        porque:
          "El padrón entero en una pantalla, las solicitudes de ingreso para aprobar o rechazar, y las categorías que definas.",
      },
    ],
    ademas: [
      "portal",
      "raffles",
      "bookings",
      "courses-sales",
      "website",
      "cash",
      "cobros",
      "correos",
      "equipo",
      "clients",
      "evaluaciones",
    ],
    proximo: "14",
  },
  {
    id: "agrupacion",
    label: "Somos una agrupación o comunidad de fotógrafos",
    resumen: "Nos juntamos, hacemos salidas y muestras. No cobramos una cuota formal.",
    icono: "tipo-agrupacion",
    destacados: [
      {
        key: "members",
        porque:
          "El padrón de quién forma parte, con su categoría y su ficha, sin obligación de cobrar nada.",
      },
      {
        key: "website",
        porque:
          "La vidriera de la agrupación: quiénes son, qué hacen y cómo sumarse. Armada por bloques y publicada cuando está.",
      },
      {
        key: "raffles",
        porque:
          "Sorteos entre los miembros con premios de marcas aliadas, y un resultado que cualquiera puede rehacer y comprobar.",
      },
    ],
    ademas: ["portal", "carnets", "courses-sales", "bookings", "correos", "equipo", "consultas"],
    proximo: "13",
  },
  {
    id: "ong",
    label: "Somos una ONG o entidad sin fines de lucro",
    resumen: "Damos servicios a la comunidad y rendimos cuentas de lo que entra y sale.",
    icono: "tipo-ong",
    destacados: [
      {
        key: "members",
        porque:
          "El padrón de socios, colaboradores y voluntarios, con su estado y su historia de cambios firmada.",
      },
      {
        key: "cash",
        porque:
          "Lo que entra y lo que sale, con las cuentas separadas y el arqueo de cada turno. Es la base de cualquier rendición.",
      },
      {
        key: "membership-dues",
        porque:
          "El aporte mensual de quien colabora, generado y cobrado solo, sin perseguir a nadie por mensaje.",
      },
    ],
    ademas: [
      "website",
      "portal",
      "carnets",
      "courses-sales",
      "correos",
      "equipo",
      "cobros",
      "bookings",
      "clients",
    ],
    proximo: "16",
  },
  {
    id: "espacio",
    label: "Alquilo un salón, un estudio o un coworking",
    resumen: "Lo mío es el espacio: se reserva por hora o por día, con o sin equipamiento.",
    icono: "tipo-espacio",
    destacados: [
      {
        key: "bookings",
        porque:
          "Cada espacio con su horario, su tarifa para socios y para el público, sus extras y sus feriados. Se sincroniza con Google Calendar.",
      },
      {
        key: "cobros",
        porque:
          "La seña y el saldo cobrados con Mercado Pago, con su plazo de pago y su regla de cancelación.",
      },
      {
        key: "cash",
        porque:
          "El movimiento del día con el arqueo del turno, para cerrar sabiendo cuánto entró de verdad.",
      },
    ],
    ademas: ["clients", "website", "consultas", "correos", "equipo", "members", "membership-dues"],
    proximo: "11",
  },
];

export function tipoPorId(id: string | null): TipoDeOrganizacion | undefined {
  return id ? TIPOS.find((t) => t.id === id) : undefined;
}

/** Todas las claves que le sirven a un tipo: los destacados primero. */
export function clavesDe(tipo: TipoDeOrganizacion): string[] {
  return [...tipo.destacados.map((d) => d.key), ...tipo.ademas];
}
