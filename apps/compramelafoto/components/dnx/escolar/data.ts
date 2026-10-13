/**
 * Contenido de /dnx/escolar. Cada afirmación sobre el sistema está respaldada por una
 * capacidad real de ComprameLaFoto (ver el informe del PR); no agregar promesas sin verificar.
 */

export const FORM_SECTION_ID = "propuesta";

export const DNX_CONTACTO = {
  estudio: "DNX Estudio",
  responsable: "Daniel A. Cuart",
  descripcion: "Fotógrafo profesional y docente",
  direccion: "San José 1672, Local 5",
  localidad: "Funes, Santa Fe",
  telefonoVisible: "341 374-8324",
  email: "dnxfotografia@gmail.com",
} as const;

export const WHATSAPP_URL = `https://wa.me/5493413748324?text=${encodeURIComponent(
  "Hola DNX, escribo desde un colegio y quiero consultar por fotografía escolar.",
)}`;

export const MAILTO_URL = `mailto:${DNX_CONTACTO.email}?subject=${encodeURIComponent(
  "Consulta fotografía escolar",
)}`;

/** Recorrido recomendado: preventa. Respaldado por /album/[slug]/preventa, el email con el enlace de canje
 * (lib/preventa-canjeable/pack-access-email-content.ts) y los estados de entrega en el colegio. */
export const pasos = [
  {
    titulo: "Coordinamos con el colegio",
    texto: "Fecha de la jornada, cursos, lista de alumnos, autorizaciones y qué incluye cada pack (digitales y/o impresas).",
  },
  {
    titulo: "El colegio comparte la preventa",
    texto:
      "Antes de la jornada, envía a las familias el enlace de preventa con su enlace propio del panel (también como QR). Así esas ventas quedan registradas a favor del colegio.",
  },
  {
    titulo: "Cada familia reserva y paga",
    texto:
      "Elige el pack, indica alumno y curso desde la lista del colegio y paga online por Mercado Pago. Recibe por email su enlace personal.",
  },
  {
    titulo: "DNX hace las fotos",
    texto: "La jornada se trabaja sabiendo de antemano qué pidió cada familia y cuántos impresos preparar.",
  },
  {
    titulo: "La familia elige sus fotos",
    texto:
      "Con las fotos listas, entra con su enlace (sin crear cuenta) y elige las que incluye su pack. Las digitales se descargan; los impresos se preparan por alumno.",
  },
  {
    titulo: "Entrega y rendición",
    texto:
      "Los impresos llegan al colegio identificados por alumno y curso. El colegio ve en su panel las ventas y su beneficio; DNX lo liquida según lo acordado.",
  },
] as const;

export const razonesPreventa = [
  { titulo: "Sin sobres ni dinero en el aula", texto: "Cada familia paga online antes de la jornada. Nadie del colegio recauda." },
  { titulo: "Impresos justos", texto: "Se imprime lo que se vendió, sin copias de más ni listas a mano." },
  { titulo: "Entrega ordenada", texto: "Cada impreso sale identificado por alumno y curso, con su estado registrado hasta la entrega." },
  { titulo: "Beneficio claro para el colegio", texto: "Las compras hechas con el enlace del colegio quedan atribuidas a la institución." },
] as const;

export const ventaPosterior = {
  titulo: "Y después de la jornada, la galería",
  texto:
    "Además de la preventa, las fotos quedan en una galería por enlace: las familias que no reservaron, o que quieren más fotos, pueden comprarlas ahí, también pagando online.",
} as const;

export const beneficios = [
  { titulo: "Menos trabajo administrativo", texto: "No hay que juntar sobres, armar listas de pedidos ni perseguir pagos." },
  { titulo: "Sin manejo de efectivo", texto: "Las familias pagan online. El colegio no recibe ni guarda dinero." },
  { titulo: "Sin planillas de cobro", texto: "Cada compra queda registrada en el sistema, con su pedido y su estado." },
  { titulo: "Compra y entrega centralizadas", texto: "Todo pasa por un mismo lugar, para el colegio y para las familias." },
  { titulo: "Beneficio para la institución", texto: "Un porcentaje acordado sobre las ventas, con reporte en su panel." },
  { titulo: "Atención directa a las familias", texto: "Las consultas las responde DNX, no la secretaría." },
  { titulo: "Fotografía profesional", texto: "Un fotógrafo con experiencia en retratos, grupos y eventos." },
  { titulo: "Servicio local", texto: "Estudio con lugar de atención en Funes, cerca de Rosario y Roldán." },
] as const;

export const faqs = [
  {
    q: "¿Qué es la preventa y por qué la recomendamos?",
    a: "Las familias reservan y pagan su pack antes de la jornada de fotos. Con eso sabemos cuántos impresos preparar, nadie tiene que juntar dinero y la entrega en el colegio sale ordenada por alumno. Después de la jornada cada familia elige sus fotos con el enlace que recibió por email.",
  },
  {
    q: "¿Quién cobra?",
    a: "Las familias pagan online, a través de Mercado Pago, dentro del sistema. El colegio no maneja dinero ni tiene que cobrar a nadie.",
  },
  {
    q: "¿Cómo se calcula el beneficio del colegio?",
    a: "Es un porcentaje que se acuerda antes de empezar, sobre cada venta pagada y sin incluir la comisión de la plataforma. En la preventa cuentan las compras hechas con el enlace propio del colegio; en la galería posterior, las ventas del álbum del colegio. El detalle está en su panel y DNX lo liquida según lo acordado.",
  },
  {
    q: "¿Qué tiene que hacer el colegio?",
    a: "La coordinación institucional: definir fechas y espacios, pasar la lista de cursos y alumnos y gestionar las autorizaciones. Después, compartir con las familias el enlace de preventa y, más tarde, el de la galería. Cobros, pedidos y entregas los resuelven DNX y el sistema.",
  },
  {
    q: "¿Qué pasa si una familia cancela o pide una devolución?",
    a: "Las ventas anuladas o reembolsadas no generan beneficio para el colegio: si un pago se revierte, el beneficio de esa venta queda cancelado.",
  },
  {
    q: "¿Las fotos de los chicos quedan públicas?",
    a: "La galería se puede configurar como privada: no aparece en los listados públicos del sitio y sólo se entra con el enlace directo. Las vistas previas se muestran con marca de agua y el archivo original se entrega únicamente después de la compra. Las tomas se hacen con las autorizaciones que gestiona el colegio.",
  },
] as const;
