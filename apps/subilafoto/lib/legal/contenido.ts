/**
 * Los textos legales de SubiLaFoto.
 *
 * Viven acá y no dentro de las pantallas porque se revisan por su contenido, no
 * por su maquetado, y porque los lee más de una página. Cada sección es un
 * título con sus párrafos; la pantalla decide cómo se ve.
 *
 * **Están atados a lo que la plataforma hace de verdad.** Si cambia la
 * retención de 30 días, el proveedor de moderación o dónde se guardan los
 * archivos, hay que cambiarlos acá el mismo día. Un texto legal que describe
 * otro producto es peor que no tener ninguno.
 */

export const ULTIMA_ACTUALIZACION = "16 de septiembre de 2026";

/** A dónde escribe alguien que quiere ejercer sus derechos o pedir que bajemos una foto. */
export const EMAIL_LEGAL = "dnxfotografia@gmail.com";

/**
 * Quién vende.
 *
 * No es un dato de contacto más: la Resolución 424/2020 y el artículo 4 de la Ley 24.240
 * exigen que el consumidor pueda saber **con quién contrató** sin tener que buscarlo. Por
 * eso va en el pie de todas las páginas y no en una sección de "quiénes somos".
 *
 * El CUIT empieza con 20, así que es una persona física: el responsable es Daniel Andrés
 * Cuart, no una sociedad. Por eso dice "Responsable" y no "Razón social".
 */
export const RESPONSABLE = {
  nombre: "Daniel Andrés Cuart",
  cuit: "20-31973378-8",
  domicilio: "San José 1672, Local 5, Funes (CP 2132), Santa Fe, Argentina",
} as const;

/**
 * Se guarda en cada consentimiento aceptado. Cambiala cuando cambie el texto.
 *
 * Subió a `2026-09-16` por el renombre de la marca dentro de los textos. El fondo no
 * cambió, pero el texto guardado sí, y un consentimiento tiene que poder mostrar
 * exactamente lo que la persona aceptó.
 *
 * No costó nada hacerlo: al 16/9 no había ningún consentimiento registrado. Si los
 * hubiera, subir la versión obliga a todos a volver a aceptar — por eso se sube cuando el
 * texto cambia y no cuando a uno le parece.
 *
 * **Revisados y aprobados sin cambios**, según confirmó el titular el 2026-09-16.
 */
export const VERSION_DE_TERMINOS = "2026-09-16";

export type SeccionLegal = {
  titulo: string;
  parrafos: readonly string[];
  puntos?: readonly string[];
};

export const SECCIONES_PRIVACIDAD: readonly SeccionLegal[] = [
  {
    titulo: "En una línea",
    parrafos: [
      "Las fotos que subís a un evento se analizan automáticamente, se muestran en ese evento y se borran solas a los 30 días. No las vendemos, no las usamos para publicidad y no entrenamos ninguna inteligencia artificial con ellas.",
    ],
  },
  {
    titulo: "Quién trata tus datos",
    parrafos: [
      "SubiLaFoto es una plataforma de DNX Suite. Un profesional —un fotógrafo, un DJ, un salón, una productora— la contrata y se la vende a quien organiza el evento. Por eso, en la pantalla y en el álbum vas a ver la marca de ese profesional y no la nuestra.",
      "Quien organiza el evento decide qué evento es, quién entra, qué se proyecta y quién recibe el álbum: es el responsable de esos datos. Nosotros los tratamos por encargo suyo y no los usamos para ningún fin propio.",
      `Si querés ejercer alguno de tus derechos, escribinos a ${EMAIL_LEGAL}. Si el pedido le corresponde a quien organizó el evento, te ponemos en contacto.`,
    ],
  },
  {
    titulo: "Si sos invitado a un evento",
    parrafos: [
      "No te pedimos que crees una cuenta ni que nos des tu nombre real. Lo que tratamos es:",
    ],
    puntos: [
      "Las fotos y los mensajes que subís, con la fecha y la hora.",
      "El nombre que elegís mostrar, si escribís alguno. Podés dejarlo vacío.",
      "Una identificación anónima de tu teléfono, guardada en una cookie, para que puedas ver y borrar lo que subiste vos.",
      "Una versión cifrada de tu dirección IP, que no permite reconstruirla, para poder frenar abusos.",
      "El registro de que aceptaste estas condiciones, con la fecha y la versión del texto.",
    ],
  },
  {
    titulo: "Si vendés el servicio o comprás un evento",
    parrafos: [
      "Tratamos los datos de tu cuenta de DNX Suite —nombre y correo—, los datos de tu empresa y tu logo, el precio que elegís y los eventos que creás.",
      "Cuando estén habilitados los pagos, tratamos también los datos de la compra y la vinculación con Mercado Pago. Nunca vemos ni guardamos los datos de ninguna tarjeta: eso ocurre entero dentro de Mercado Pago.",
    ],
  },
  {
    titulo: "Cada foto se analiza automáticamente antes de mostrarse",
    parrafos: [
      "Ninguna foto llega a la pantalla ni al álbum sin pasar por un análisis automático de contenido. Es obligatorio y no se puede desactivar.",
      "Para hacerlo, la imagen se envía a Amazon Rekognition, un servicio de Amazon Web Services alojado en los Estados Unidos, que devuelve categorías de riesgo. Amazon no la conserva ni la usa para entrenar sus modelos.",
      "El análisis puede retener una foto para que la revise una persona, o bloquearla. Si creés que se equivocó con una foto tuya, pedile a quien organiza el evento que la revise; también podés escribirnos.",
    ],
  },
  {
    titulo: "Fotos de otras personas",
    parrafos: [
      "Si subís una foto en la que aparecen otras personas, estás diciendo que tenés derecho a hacerlo. En la Argentina, publicar el retrato de alguien necesita su consentimiento (artículo 53 del Código Civil y Comercial y artículo 31 de la Ley 11.723), y si es menor de edad, el de quien lo tiene a cargo.",
      `Cualquiera que aparezca en una foto puede pedir que la bajemos, sin dar explicaciones. Escribí a ${EMAIL_LEGAL} contando de qué evento se trata; la sacamos de la pantalla y del álbum lo antes posible.`,
    ],
  },
  {
    titulo: "Dónde se guardan y por cuánto tiempo",
    parrafos: [
      "Las fotos se guardan en Cloudflare R2 y **se borran solas a los 30 días** de subidas. No es una promesa de que las vamos a borrar: es una regla automática del almacenamiento, que se aplica sin que intervenga nadie.",
      "Si comprás la descarga del evento, el archivo que te llevás es tuyo y no lo alcanza ese borrado. Lo que se borra es lo que queda en la plataforma.",
      "Los datos de las cuentas profesionales y los registros de facturación se conservan mientras la cuenta exista y después el tiempo que exijan las obligaciones legales.",
    ],
  },
  {
    titulo: "Con quién los compartimos",
    parrafos: [
      "Con nadie que no sea necesario para que el servicio funcione. No vendemos datos, no hacemos publicidad y no armamos perfiles de comportamiento.",
      "Los proveedores que intervienen son:",
    ],
    puntos: [
      "Vercel — alojamiento de la aplicación (Estados Unidos).",
      "Neon — base de datos (Estados Unidos).",
      "Cloudflare R2 — almacenamiento de las fotos.",
      "Amazon Web Services — análisis automático de contenido (Estados Unidos).",
      "Google — únicamente para el inicio de sesión de los profesionales.",
      "Mercado Pago — cobros, cuando estén habilitados.",
      "Resend — envío de correos, cuando estén habilitados.",
    ],
  },
  {
    titulo: "Tus datos salen del país",
    parrafos: [
      "Los proveedores de arriba están fuera de la Argentina, principalmente en los Estados Unidos. Al usar la plataforma aceptás esa transferencia internacional, que hacemos amparados en el artículo 12 de la Ley 25.326 por ser necesaria para prestar el servicio que pediste.",
    ],
  },
  {
    titulo: "Tus derechos",
    parrafos: [
      "Podés pedir acceder a tus datos, corregirlos, actualizarlos o suprimirlos, según la Ley 25.326 de Protección de los Datos Personales.",
      `Escribinos a ${EMAIL_LEGAL}. El titular de los datos tiene derecho a un acceso gratuito cada seis meses, salvo que acredite un interés legítimo.`,
      "La Agencia de Acceso a la Información Pública, órgano de control de la Ley 25.326, atiende las denuncias y reclamos de quien vea afectados sus derechos.",
    ],
  },
  {
    titulo: "Cambios en esta política",
    parrafos: [
      "Si la cambiamos, actualizamos la fecha de arriba. Si el cambio es importante, lo avisamos en la plataforma antes de aplicarlo.",
    ],
  },
];

export const SECCIONES_TERMINOS: readonly SeccionLegal[] = [
  {
    titulo: "Qué es SubiLaFoto",
    parrafos: [
      "Un servicio para que los invitados de un evento suban sus fotos desde el celular, sin instalar nada y sin crearse una cuenta, y para que esas fotos aparezcan en la pantalla del salón y en un álbum digital.",
      "Lo contrata un profesional —fotógrafo, DJ, salón, productora, organizador— y se lo vende a su cliente con su propia marca.",
    ],
  },
  {
    titulo: "Si sos invitado",
    parrafos: [
      "Escaneás el código, aceptás estas condiciones y subís tus fotos. No necesitás cuenta.",
      "Al subir una foto declarás que es tuya o que tenés derecho a compartirla, y que quienes aparecen en ella están de acuerdo. Si aparece un menor de edad, que tenés la autorización de quien lo tiene a cargo.",
      "Podés borrar lo que subiste vos mientras el evento siga abierto.",
    ],
  },
  {
    titulo: "Qué no se puede subir",
    parrafos: ["No se admite contenido que:"],
    puntos: [
      "Sea sexual o muestre desnudez.",
      "Muestre violencia o resulte perturbador.",
      "Incite al odio o exhiba símbolos de odio.",
      "Exponga a alguien sin su consentimiento o busque hostigarlo.",
      "Infrinja derechos de autor o de imagen de terceros.",
      "Sea publicidad no acordada con quien organiza el evento.",
    ],
  },
  {
    titulo: "Toda foto se revisa antes de mostrarse",
    parrafos: [
      "El análisis automático es obligatorio y no se puede desactivar. Una foto puede quedar retenida para revisión humana o bloqueada.",
      "Quien organiza el evento puede además ocultar cualquier foto en cualquier momento, sin dar explicaciones. Es su evento.",
      "Si el análisis automático no se puede hacer —porque falla el servicio, por ejemplo—, la foto queda retenida y no se publica. Preferimos que falte una foto antes que proyectar algo que nadie revisó.",
    ],
  },
  {
    titulo: "La ventana del evento",
    parrafos: [
      "Cada evento se abre a la hora que elige quien lo organiza y se cierra automáticamente 12 horas después. Cerrado el evento, no se pueden subir más fotos.",
      "Las fotos se borran automáticamente a los 30 días de subidas. Quien compró el evento puede descargarlas antes; después de ese plazo, no hay forma de recuperarlas.",
    ],
  },
  {
    titulo: "Si vendés el servicio",
    parrafos: [
      "Necesitás una cuenta de DNX Suite. Sos responsable de lo que se haga desde ella.",
      "Vos ponés el precio que le cobrás a tu cliente. Nosotros no fijamos ninguno.",
      "**Nuestra comisión es el 15% del precio que vos definas.** No hay abono mensual, ni costo de alta, ni mínimo de eventos.",
      "Tu cliente ve tu marca y no la nuestra. A cambio, sos vos quien responde ante él por el servicio que le vendiste; nosotros respondemos ante vos por la plataforma.",
      "Te comprometés a cargar datos de empresa y un logo que sean tuyos y que tengas derecho a usar.",
    ],
  },
  {
    titulo: "Pagos",
    parrafos: [
      "Los cobros se procesan a través de Mercado Pago. No vemos ni guardamos datos de tarjetas.",
      "La comisión de la plataforma se descuenta en el mismo momento del cobro.",
    ],
  },
  {
    titulo: "Lo que no podemos garantizar",
    parrafos: [
      "La plataforma depende de la conexión a internet del salón y del celular de cada invitado. Un wifi saturado o una señal pobre pueden hacer que una foto tarde o no llegue, y eso no está bajo nuestro control.",
      "Hacemos lo razonable para que el servicio esté disponible durante el evento, pero no podemos comprometer una disponibilidad ininterrumpida.",
      "No respondemos por el contenido que suben los invitados, más allá de la revisión automática y de las herramientas que le damos a quien organiza para ocultar lo que no quiera.",
    ],
  },
  {
    titulo: "Baja",
    parrafos: [
      `Podés dar de baja tu cuenta profesional cuando quieras escribiéndonos a ${EMAIL_LEGAL}. Los eventos ya vendidos siguen su curso hasta cerrarse.`,
    ],
  },
  {
    titulo: "Ley aplicable",
    parrafos: [
      "Estos términos se rigen por las leyes de la República Argentina. Ante cualquier controversia se someten a los tribunales ordinarios de la ciudad de Rosario, provincia de Santa Fe.",
    ],
  },
];
