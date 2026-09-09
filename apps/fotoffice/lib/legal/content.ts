/**
 * Texto legal de FotoOffice.
 *
 * Vive acá y no dentro de las pantallas porque lo leen dos páginas y porque el texto se
 * revisa por su contenido, no por su maquetado. Cada sección es un título y sus párrafos;
 * la pantalla decide cómo se ven.
 *
 * La sección de datos de Google no es decorativa: Google exige, para verificar la app,
 * que la política declare qué permisos se piden, para qué se usan y que no se transfieren.
 * Si algún día cambian los permisos en `lib/integrations/registry.ts`, hay que cambiarla acá.
 */

export const LEGAL_LAST_UPDATED = "9 de septiembre de 2026";

/** A dónde escribe alguien que quiere ejercer sus derechos o preguntar algo. */
export const LEGAL_CONTACT_EMAIL = "dnxfotografia@gmail.com";

export type LegalSection = {
  title: string;
  paragraphs: readonly string[];
  /** Lista opcional que va después de los párrafos. */
  bullets?: readonly string[];
};

export const PRIVACY_SECTIONS: readonly LegalSection[] = [
  {
    title: "Quién trata tus datos",
    paragraphs: [
      "FotoOffice es una plataforma de DNX Suite que las instituciones usan para administrar su padrón de socios, sus cuotas, sus carnets, sus cursos y la reserva de sus espacios.",
      `Cada institución decide qué datos carga y para qué los usa: es ella la responsable de los datos de sus socios. FotoOffice los trata por encargo suyo y no los usa para ningún fin propio. Si querés ejercer alguno de tus derechos, escribinos a ${LEGAL_CONTACT_EMAIL} y, si hace falta, te ponemos en contacto con tu institución.`,
    ],
  },
  {
    title: "Qué datos tratamos",
    paragraphs: [
      "Depende de para qué uses FotoOffice. Si sos socio de una institución, tratamos lo que ella carga en tu ficha y lo que vos completás en tu portal:",
    ],
    bullets: [
      "Nombre, apellido y número de socio.",
      "Documento, fecha de nacimiento y datos de contacto: email, teléfono y domicilio.",
      "Tu foto de perfil y la foto del carnet, si la institución emite carnets.",
      "Tus cuotas, tus pagos y tu estado de deuda.",
      "Las reservas de espacios que hacés y lo que agregás a cada una.",
    ],
  },
  {
    title: "Si administrás una institución",
    paragraphs: [
      "Además de lo anterior, tratamos los datos de tu cuenta y las credenciales que hacen falta para que la institución cobre: la vinculación con Mercado Pago y, si la usás, la vinculación con tu cuenta de Google.",
      "Nunca vemos ni guardamos los datos de las tarjetas con las que pagan tus socios. Eso ocurre entero dentro de Mercado Pago.",
    ],
  },
  {
    title: "Para qué los usamos",
    paragraphs: [
      "Para hacer funcionar lo que la institución contrató: mantener el padrón, emitir carnets, generar y cobrar cuotas, administrar la reserva de espacios y avisarte por email de lo que te toca.",
      "No hacemos publicidad, no armamos perfiles de comportamiento y no vendemos datos a nadie.",
    ],
  },
  {
    title: "Datos de tu cuenta de Google",
    paragraphs: [
      "Si la institución conecta su cuenta de Google, FotoOffice pide dos permisos y ningunos más:",
    ],
    bullets: [
      "Ver los calendarios de la cuenta (calendar.readonly), para leer lo que se cargó a mano en el calendario y que esos horarios queden bloqueados en FotoOffice.",
      "Crear y borrar eventos (calendar.events), para que cada reserva confirmada aparezca en el calendario de la institución y desaparezca si se cancela.",
    ],
  },
  {
    title: "Uso limitado de los datos de Google",
    paragraphs: [
      "El uso que FotoOffice hace de la información recibida de las APIs de Google se ajusta a la Política de Datos de Usuario de los Servicios de las APIs de Google, incluidos sus requisitos de uso limitado.",
      "En concreto: los datos del calendario los usa únicamente el módulo de Reservas, para mostrar y bloquear horarios. No se los transferimos a terceros, no se usan para publicidad y ninguna persona de nuestro equipo los lee, salvo que vos nos lo pidas por escrito para resolver un problema o que la ley nos obligue.",
      "El permiso que da la institución se guarda cifrado y se puede revocar cuando quiera, desde Configuración → Integraciones en FotoOffice o desde la página de permisos de la cuenta de Google. Al revocarlo dejamos de escribir y de leer el calendario de inmediato.",
    ],
  },
  {
    title: "Con quién los compartimos",
    paragraphs: [
      "Solo con los servicios que hacen falta para que la plataforma funcione, y solo con el dato que cada uno necesita:",
    ],
    bullets: [
      "Mercado Pago, para cobrar cuotas y reservas.",
      "Resend, para enviar los emails de la institución.",
      "Cloudflare R2, donde se guardan las fotos y los archivos.",
      "Vercel y Neon, donde corre la aplicación y vive la base de datos.",
    ],
  },
  {
    title: "Cuánto tiempo los guardamos",
    paragraphs: [
      "Mientras la institución te tenga en su padrón y por el plazo que después le exijan sus obligaciones contables y legales. Si la institución deja de usar FotoOffice, sus datos se eliminan a su pedido.",
    ],
  },
  {
    title: "Tus derechos",
    paragraphs: [
      "Podés pedir acceder a tus datos, corregirlos, actualizarlos o suprimirlos, según la Ley 25.326 de Protección de los Datos Personales.",
      `Escribinos a ${LEGAL_CONTACT_EMAIL}. La Agencia de Acceso a la Información Pública es el órgano de control de esa ley y tiene atribuciones para atender denuncias sobre el incumplimiento de las normas de protección de datos personales.`,
    ],
  },
  {
    title: "Cambios en esta política",
    paragraphs: [
      "Si la cambiamos, actualizamos la fecha del encabezado. Cuando el cambio afecte de verdad cómo tratamos tus datos, además te lo avisamos por email.",
    ],
  },
];

export const TERMS_SECTIONS: readonly LegalSection[] = [
  {
    title: "Qué es FotoOffice",
    paragraphs: [
      "FotoOffice es una plataforma de DNX Suite que una institución contrata para administrarse: su padrón de socios, sus cuotas, sus carnets, sus cursos, la reserva de sus espacios y su sitio público.",
      "Nosotros damos la herramienta. Lo que la institución decide hacer con ella —a quién acepta como socio, cuánto cobra, qué espacios alquila y con qué reglas— es de la institución.",
    ],
  },
  {
    title: "Tu cuenta",
    paragraphs: [
      "Para entrar necesitás una cuenta con tu email. Sos responsable de lo que se haga desde ella, así que no la compartas.",
      "Si detectamos un uso que pone en riesgo a otras personas o a la plataforma, podemos suspender una cuenta y avisarle a la institución.",
    ],
  },
  {
    title: "Pagos",
    paragraphs: [
      "Los cobros se hacen por Mercado Pago o por transferencia, y siempre los cobra la institución: el dinero va a su cuenta, no a la nuestra. FotoOffice retiene una comisión del 5% sobre cada cobro por el uso de la plataforma.",
      "Si un pago te fue mal imputado o pagaste de más, quien lo revisa y lo corrige es la institución.",
    ],
  },
  {
    title: "Reservas de espacios",
    paragraphs: [
      "Cada institución fija sus espacios, sus días y horarios, sus precios y sus plazos de cancelación. Esas reglas se muestran antes de confirmar, y son las que valen.",
      "Reservar y pagar da derecho a usar el espacio en el horario reservado. Si la institución tiene que cancelar por una razón de fuerza mayor, te devuelve lo pagado.",
    ],
  },
  {
    title: "Conexión con Google",
    paragraphs: [
      "La institución puede conectar su cuenta de Google para que las reservas se reflejen en su calendario. Esa conexión es opcional, la hace y la deshace ella, y lo que hacemos con esos datos está en la Política de Privacidad.",
    ],
  },
  {
    title: "Disponibilidad",
    paragraphs: [
      "Trabajamos para que la plataforma esté siempre disponible, pero no podemos prometerlo sin interrupciones: hay mantenimientos, y hay servicios de terceros de los que dependemos.",
      "No respondemos por el lucro cesante ni por daños indirectos derivados de una interrupción.",
    ],
  },
  {
    title: "Baja",
    paragraphs: [
      "Podés dejar de usar tu cuenta cuando quieras. La institución puede dar de baja su espacio en FotoOffice avisando, y en ese caso le entregamos sus datos y los eliminamos.",
    ],
  },
  {
    title: "Ley aplicable",
    paragraphs: [
      "Estos términos se rigen por las leyes de la República Argentina. Ante cualquier controversia se someten a los tribunales ordinarios de la ciudad de Rosario, provincia de Santa Fe.",
    ],
  },
];
