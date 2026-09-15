import { BOOKINGS_MODULE_KEY } from "@/lib/bookings/constants";
import { CASH_MODULE_KEY } from "@/lib/cash/constants";
import { CLIENTS_MODULE_KEY } from "@/lib/clients/constants";
import { COURSES_SALES_MODULE_KEY } from "@/lib/courses-sales/constants";
import { COVERAGES_MODULE_KEY } from "@/lib/coverages/constants";
import { EVALUACIONES_MODULE_KEY } from "@/lib/evaluaciones/constants";
import { MEMBERS_MODULE_KEY } from "@/lib/members/constants";
import { MEMBERSHIP_DUES_MODULE_KEY } from "@/lib/membership/constants";
import { RAFFLES_MODULE_KEY } from "@/lib/raffles/constants";
import { WEBSITE_MODULE_KEY } from "@/lib/website/constants";

/**
 * El catálogo contado para afuera.
 *
 * `lib/modules/registry.ts` dice qué módulos EXISTEN y con qué clave; este archivo dice cómo se
 * los explica a alguien que todavía no usa el sistema. Son dos cosas distintas a propósito: la
 * descripción del registro está escrita para quien administra un workspace y ya sabe de qué se
 * habla, y la de acá para quien entra por primera vez.
 *
 * La única regla que las ata está en `catalogo.test.ts`: todo módulo AVAILABLE del registro
 * tiene que tener su ficha acá, y ninguna ficha puede apuntar a una clave que no exista. Sin
 * eso, encender un módulo nuevo lo dejaría invisible en la portada y nadie se enteraría.
 */

export type FichaModulo = {
  /** Misma clave que en el registro de módulos. */
  key: string;
  /** Número de fotograma en la hoja de contactos. */
  cuadro: string;
  nombre: string;
  /** Qué resuelve, en la lengua de quien lo va a usar. */
  resuelve: string;
  /** Las pantallas que trae. Es lo que se ve en el menú una vez encendido. */
  pantallas: string[];
};

/** Los módulos que hoy se pueden encender de verdad. */
export const MODULOS_DISPONIBLES: FichaModulo[] = [
  {
    key: MEMBERS_MODULE_KEY,
    cuadro: "01",
    nombre: "Socios",
    resuelve:
      "El padrón completo en una pantalla: quién es socio, desde cuándo, en qué categoría y cómo viene su cuenta. Quien quiere asociarse llena un formulario y la solicitud te llega acá para aprobarla o rechazarla.",
    pantallas: [
      "Padrón",
      "Solicitudes de ingreso",
      "Categorías",
      "Carnets",
      "Diseñador de credenciales",
      "Invitaciones por tandas",
      "Historial de cambios",
    ],
  },
  {
    key: MEMBERSHIP_DUES_MODULE_KEY,
    cuadro: "02",
    nombre: "Cuotas societarias",
    resuelve:
      "La cuota de cada mes se genera sola según el estado del socio el día 1. Se cobra con Mercado Pago desde el portal, y la que se paga en mano se registra a mano sin romper el historial. Quien recomienda a un socio nuevo se lleva un descuento en la suya.",
    pantallas: [
      "Qué se debe y qué se cobró",
      "Valores y calendario de vencimiento",
      "Pagos registrados a mano",
      "Deuda por socio",
      "Recomendados y bonificaciones",
    ],
  },
  {
    key: RAFFLES_MODULE_KEY,
    cuadro: "03",
    nombre: "Sorteos",
    resuelve:
      "Sorteás entre los socios que están al día, con premios de las marcas aliadas. El número ganador no lo elige el sistema: sale de una baliza pública de azar que se consulta en varios servidores a la vez. Cualquier socio puede rehacer la cuenta después y comprobar que salió así.",
    pantallas: ["Sorteos y participantes", "Entregas de premios", "Comprobación pública del resultado"],
  },
  {
    key: BOOKINGS_MODULE_KEY,
    cuadro: "04",
    nombre: "Reservas de espacios",
    resuelve:
      "Salón, estudio, aula o coworking por hora o por día, con un precio para socios y otro para el público. Sumás el equipamiento que se alquila aparte, cobrás la seña, ponés el plazo de cancelación y cerrás los feriados. Dos reservas no pueden pisarse: lo impide la base, no un aviso en pantalla.",
    pantallas: [
      "Agenda por semana y por mes",
      "Espacios y tarifas",
      "Extras y equipamiento",
      "Plazos de pago y cancelación",
      "Carga de reservas por teléfono",
      "Sincronización con Google Calendar",
    ],
  },
  {
    key: COURSES_SALES_MODULE_KEY,
    cuadro: "05",
    nombre: "Cursos presenciales",
    resuelve:
      "Publicás el curso con su docente, su cupo y su precio. La gente se anota desde el sitio y paga con Mercado Pago. Te queda la lista de vendidos, la de quienes se anotaron y todavía hay que contactar, y cuánto entró.",
    pantallas: ["Cursos y ediciones", "Docentes", "Inscripciones a contactar", "Ventas y estado de cobro"],
  },
  {
    key: EVALUACIONES_MODULE_KEY,
    cuadro: "06",
    nombre: "Evaluaciones",
    resuelve:
      "Las evaluaciones que acompañan a cada curso, para saber quién las hizo y cómo le fue sin llevarlo en una planilla aparte.",
    pantallas: ["Evaluaciones por curso", "Resultados"],
  },
  {
    key: CLIENTS_MODULE_KEY,
    cuadro: "07",
    nombre: "Clientes",
    resuelve:
      "El padrón de quien te compra, sea socio o no: su ficha, cómo contactarlo, sus datos fiscales y lo que consumió hasta hoy. Si además es socio, las dos fichas quedan enlazadas y la misma persona no aparece dos veces.",
    pantallas: [
      "Padrón de clientes",
      "Ficha, contacto y datos fiscales",
      "Historial de consumo",
      "Alta de un cliente nuevo",
      "Enlace con su ficha de socio",
    ],
  },
  {
    key: CASH_MODULE_KEY,
    cuadro: "08",
    nombre: "Caja",
    resuelve:
      "Lo que entra y lo que sale del negocio, con las cuentas separadas —mostrador, caja fuerte, banco— y el pase de una a otra. Cada turno se abre y se cierra con su arqueo: si la cuenta no da, la diferencia queda escrita con su explicación y no se tapa.",
    pantallas: [
      "Panorama de cuentas",
      "Libro de movimientos",
      "Arqueo por turno",
      "Pases entre cuentas",
      "Reportes por período",
      "Cuentas y categorías",
    ],
  },
  {
    key: WEBSITE_MODULE_KEY,
    cuadro: "09",
    nombre: "Sitio web",
    resuelve:
      "Tu sitio público armado por bloques, sin tocar código: portada con galería que pasa sola, textos, imágenes y botones. Elegís el estilo de menú, la tipografía, la forma de los botones y cuánto se mueve al hacer scroll. Guardás el borrador todas las veces que quieras y publicás cuando está.",
    pantallas: [
      "Páginas y bloques",
      "Portada con varias imágenes",
      "Cinco estilos de menú",
      "Tipografías y botones",
      "Borrador y publicación por versiones",
    ],
  },
  {
    key: COVERAGES_MODULE_KEY,
    cuadro: "10",
    nombre: "Solicitudes y Coberturas",
    resuelve:
      "Alguien te pide una cobertura por un formulario público y el pedido entra acá con todo: qué actividad es, cuándo, dónde y qué necesitan. Lo evaluás, pedís lo que falte y decidís. Quien lo pidió sigue su pedido por un enlace privado, sin tener que crearse una cuenta ni llamar para preguntar cómo viene.",
    pantallas: [
      "Formulario público de pedidos",
      "Bandeja de solicitudes",
      "Evaluación con notas internas",
      "Seguimiento por enlace privado",
      "Historial de cada cambio",
    ],
  },
];

/** Lo que está siempre, se encienda lo que se encienda. No son módulos con interruptor. */
export const BASE_DEL_SISTEMA: FichaModulo[] = [
  {
    key: "consultas",
    cuadro: "A1",
    nombre: "Consultas y pedidos de presupuesto",
    resuelve:
      "Un formulario público que cambia según lo que te piden. Si es una boda pregunta por los novios y las tres fechas; si son XV, por la quinceañera y el salón; si es un show, por la duración. La consulta entra a un tablero y la vas moviendo: nueva, contactada, presupuestada, interesada, ganada o perdida.",
    pantallas: [
      "Nueve tipos de evento",
      "Sesiones: retrato, book, familia, embarazo, newborn, producto y once más",
      "Tablero con seis estados",
      "Contacto directo por WhatsApp",
    ],
  },
  {
    key: "cobros",
    cuadro: "A2",
    nombre: "Cobros con Mercado Pago",
    resuelve:
      "Conectás tu cuenta de Mercado Pago una vez y cobrás desde adentro del sistema: cuotas, reservas, cursos y carnets. El dinero va a tu cuenta, no a una intermedia, y cada pago queda pegado a lo que pagó.",
    pantallas: ["Conexión de tu cuenta", "Aviso automático cuando el pago acredita", "Pagos a mano para lo que se cobra en efectivo"],
  },
  {
    key: "portal",
    cuadro: "A3",
    nombre: "Portal de socios y clientes",
    resuelve:
      "La puerta privada de los tuyos. El socio entra con su cuenta y ve su número, su categoría, su carnet con el código que lo verifica, lo que debe y cómo pagarlo, sus reservas y los sorteos. Desde el teléfono, con la barra de abajo.",
    pantallas: ["Mi carnet", "Mis cuotas", "Mi perfil", "Mis reservas", "Sorteos", "Mis recomendados"],
  },
  {
    key: "carnets",
    cuadro: "A4",
    nombre: "Carnets con código verificable",
    resuelve:
      "Cada carnet lleva un código que, al escanearlo, abre una página que dice si esa persona es socia y está al día. El código es azaroso y se guarda cifrado: no sale del número de socio, no revela datos y se puede anular si el carnet se pierde. Diseñás el frente y el dorso con tus propios datos variables.",
    pantallas: ["Emisión y reemisión", "Diseñador de la credencial", "Pedidos de impresión", "Aviso de moroso al escanear"],
  },
  {
    key: "correos",
    cuadro: "A5",
    nombre: "Correos con tu firma",
    resuelve:
      "Los avisos que manda el sistema salen con el nombre y la firma de tu organización, no con la de la plataforma. Queda registro de cada envío, así sabés si el mail de la cuota realmente salió.",
    pantallas: ["Firma y remitente propios", "Registro de envíos", "Envío de prueba"],
  },
  {
    key: "equipo",
    cuadro: "A6",
    nombre: "Equipo y permisos",
    resuelve:
      "Sumás a quien te ayuda con el permiso justo. Quien administra los socios no toca por eso las reservas ni los cobros: el permiso es por módulo. Y una misma persona puede tener más de un espacio de trabajo y cambiar entre ellos.",
    pantallas: ["Roles por módulo", "Varios espacios por persona", "Ingreso con Google"],
  },
];

/** Lo que está previsto y todavía no se puede usar. Se muestra sin revelar, nunca como promesa. */
export const EN_CONSTRUCCION: {
  cuadro: string;
  nombre: string;
  resuelve: string;
  /** Nombre del ícono. Lo resuelve `components/landing/iconos.tsx`. */
  icono: string;
}[] = [
  {
    cuadro: "11",
    icono: "presupuestos",
    nombre: "Presupuestos",
    resuelve:
      "Armar el presupuesto con tus precios, mandárselo al cliente y seguir si lo aceptó. Hoy la consulta te llega con todos los datos del evento; el precio todavía lo ponés vos por afuera.",
  },
  {
    cuadro: "12",
    icono: "comunicacion",
    nombre: "Comunicación",
    resuelve: "Mandar un mensaje a todos los socios o a un grupo, desde adentro.",
  },
  {
    cuadro: "13",
    icono: "eventos",
    nombre: "Eventos",
    resuelve: "Salidas, charlas y encuentros con inscripción y lista de asistencia.",
  },
  {
    cuadro: "14",
    icono: "gobierno",
    nombre: "Gobierno institucional",
    resuelve: "Actas, votaciones y resoluciones de la comisión directiva.",
  },
  {
    cuadro: "15",
    icono: "muestras",
    nombre: "Muestras",
    resuelve: "Las muestras de la institución, con sus obras y sus autores.",
  },
  {
    cuadro: "16",
    icono: "transparencia",
    nombre: "Transparencia",
    resuelve: "Publicar el balance y la rendición para que el socio vea en qué se usó su cuota.",
  },
];

/** Cómo se empieza. Es una secuencia real: sin el paso anterior el siguiente no existe. */
export const PASOS = [
  {
    numero: "1",
    icono: "espacio",
    titulo: "Creás tu espacio",
    texto:
      "Entrás con tu cuenta y el sistema arma tu espacio de trabajo. Cargás el nombre, el logo, la ciudad y a qué te dedicás. Eso es lo que después se ve en tu sitio, en tus correos y en el carnet de tus socios.",
  },
  {
    numero: "2",
    icono: "interruptor",
    titulo: "Encendés lo que usás",
    texto:
      "Nada viene puesto. Un estudio prende Reservas y Cursos; una asociación prende Socios y Cuotas. Lo que está apagado no aparece en el menú ni en el portal: no hay pantallas a medio hacer esperándote cada mañana.",
  },
  {
    numero: "3",
    icono: "puerta",
    titulo: "Se abre la puerta de afuera",
    texto:
      "Tu espacio queda con un sitio público y un portal privado. Por el sitio entran los clientes a pedirte presupuesto o a anotarse a un curso; por el portal entran tus socios a ver su carnet y pagar la cuota.",
  },
] as const;
