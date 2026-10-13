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

export const pasos = [
  {
    titulo: "Coordinamos con el colegio",
    texto: "Acordamos fecha, cursos, espacios y autorizaciones con la administración.",
  },
  {
    titulo: "DNX hace las fotos",
    texto: "Retratos, fotos grupales y/o la cobertura que se haya acordado.",
  },
  {
    titulo: "Cada familia accede a su galería",
    texto: "Por un enlace que también compartimos como código QR, en pantalla o en un cartel impreso.",
  },
  {
    titulo: "La familia elige y compra",
    texto: "Lo hace por su cuenta y paga exclusivamente online, a través de Mercado Pago.",
  },
  {
    titulo: "El sistema registra pago y pedido",
    texto: "DNX atiende las consultas de las familias y entrega según el producto acordado.",
  },
  {
    titulo: "El colegio ve sus números",
    texto:
      "En su panel consulta las ventas atribuidas y el beneficio acumulado. DNX lo liquida según lo acordado.",
  },
] as const;

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
    q: "¿Quién cobra?",
    a: "Las familias pagan online, a través de Mercado Pago, dentro del sistema. El colegio no maneja dinero ni tiene que cobrar a nadie.",
  },
  {
    q: "¿Cómo se calcula el beneficio del colegio?",
    a: "Es un porcentaje que se acuerda antes de empezar. Se calcula sobre el valor del servicio de cada venta pagada, sin incluir la comisión de la plataforma. El colegio ve el detalle en su panel y DNX lo liquida según lo acordado.",
  },
  {
    q: "¿Qué tiene que hacer el colegio?",
    a: "La coordinación institucional: definir fechas y espacios, indicar cursos y gestionar las autorizaciones. Después, compartir el enlace de la galería con las familias. Cobros, pedidos y entregas los resuelven DNX y el sistema.",
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
