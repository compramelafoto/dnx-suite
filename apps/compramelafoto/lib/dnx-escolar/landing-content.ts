/**
 * Textos de la landing escolar (/dnx/escolar y /<handler>/escolar).
 *
 * Cada afirmación está respaldada por una capacidad real de ComprameLaFoto; no agregar
 * promesas sin verificarlas en el código. Referencias:
 * - Preventa: /album/[slug]/preventa y lib/preventa-canjeable.
 * - Galería privada: lib/album-helpers.ts (isPublic=false: no listada, sólo con enlace).
 * - Fotos ocultas + selfie: Album.hiddenPhotosEnabled, app/api/albums/[id]/hidden/selfie,
 *   consentimiento en /consentimiento-biometrico.
 * - Vistas previas: variantes con marca de agua y lado máximo (lib/images/generate-photo-variants.ts)
 *   y protección de escaneo (lib/photo/scan-protection.ts, encendida por defecto).
 * - Vencimiento de galerías: lib/album-cleanup.
 *
 * Puro (sin React ni red) para poder probarlo con node:test.
 */

import type { EscolarBrand } from "./landing-brand";

export const FORM_SECTION_ID = "propuesta";
export const CUIDADO_SECTION_ID = "datos-y-fotos";

/** Política de privacidad específica para escuelas (ya publicada en el sitio). */
export const PRIVACIDAD_ESCUELAS_URL = "/privacidad/escuelas";

export type TextoItem = { titulo: string; texto: string };
export type Faq = { q: string; a: string };

export type EscolarContent = {
  pasos: TextoItem[];
  razonesPreventa: TextoItem[];
  ventaPosterior: TextoItem;
  beneficios: TextoItem[];
  cuidado: TextoItem[];
  faqs: Faq[];
};

/** Texto fijo de la selfie (acordado con DNX; acompaña el tope de 90 días y el enlace de borrado). */
export const SELFIE_TEXTO =
  "La selfie no se guarda: se usa sólo para buscar las fotos y se descarta (si el fotógrafo configura un plazo de conservación, se borra sola al vencer, como máximo a los 90 días, y la familia puede borrarla antes con un enlace).";

export function buildCuidadoItems(nombre: string): TextoItem[] {
  return [
    { titulo: "La selfie, sólo para buscar", texto: SELFIE_TEXTO },
    {
      titulo: "Galería privada, sólo con enlace",
      texto:
        "La galería del colegio se puede configurar como privada: no aparece en los listados públicos del sitio y sólo se entra con el enlace directo.",
    },
    {
      titulo: "Cada familia ve sólo sus fotos",
      texto:
        "Con el modo de fotos ocultas, la galería no muestra nada hasta que la familia se identifica con una selfie tomada en el momento con el celular, después de aceptar el consentimiento biométrico. Entonces ve sólo las fotos de su hijo o hija, incluidas las grupales en las que aparece.",
    },
    {
      titulo: "Vistas previas protegidas",
      texto:
        "Antes de comprar, las fotos se ven en tamaño reducido y con marca de agua. Al ampliarlas se muestran desenfocadas y sólo una franja nítida recorre la imagen; además se bloquean el clic derecho y el arrastre. Ninguna protección evita del todo una captura de pantalla, pero así la copia no sirve como foto final.",
    },
    {
      titulo: "El original, sólo después de la compra",
      texto:
        "El archivo en alta resolución y sin marca de agua se entrega únicamente a quien lo pagó, con su enlace personal de descarga.",
    },
    {
      titulo: "Las galerías vencen",
      texto: `Las galerías tienen fecha de vencimiento: pasado el plazo se ocultan y las fotos se borran del sistema. ${nombre} puede extenderlo si el colegio lo necesita.`,
    },
    {
      titulo: "Pagos sin datos de tarjeta a la vista",
      texto: `Las familias pagan por Mercado Pago. Ni el colegio ni ${nombre} ven los datos de la tarjeta.`,
    },
    {
      titulo: "La lista de alumnos, sólo para organizar",
      texto:
        "Según la política de privacidad escolar, la lista de alumnos la ven sólo el fotógrafo del álbum, el organizador autorizado del colegio y la administración de la plataforma, y no se usa para publicidad.",
    },
    {
      titulo: "Dentro de la ley",
      texto:
        "El tratamiento de datos se rige por la Ley 25.326 de Protección de Datos Personales. Cualquier persona puede pedir acceso, corrección o borrado de sus datos.",
    },
  ];
}

export function buildEscolarContent(brand: Pick<EscolarBrand, "nombre" | "beneficioLocal">): EscolarContent {
  const n = brand.nombre;

  const pasos: TextoItem[] = [
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
      titulo: `${n} hace las fotos`,
      texto: "La jornada se trabaja sabiendo de antemano qué pidió cada familia y cuántos impresos preparar.",
    },
    {
      titulo: "La familia elige sus fotos",
      texto:
        "Con las fotos listas, entra con su enlace (sin crear cuenta) y elige las que incluye su pack. Las digitales se descargan; los impresos se preparan por alumno.",
    },
    {
      titulo: "Entrega y rendición",
      texto: `Los impresos llegan al colegio identificados por alumno y curso. El colegio ve en su panel las ventas y su beneficio; ${n} lo liquida según lo acordado.`,
    },
  ];

  const razonesPreventa: TextoItem[] = [
    { titulo: "Sin sobres ni dinero en el aula", texto: "Cada familia paga online antes de la jornada. Nadie del colegio recauda." },
    { titulo: "Impresos justos", texto: "Se imprime lo que se vendió, sin copias de más ni listas a mano." },
    { titulo: "Entrega ordenada", texto: "Cada impreso sale identificado por alumno y curso, con su estado registrado hasta la entrega." },
    { titulo: "Beneficio claro para el colegio", texto: "Las compras hechas con el enlace del colegio quedan atribuidas a la institución." },
  ];

  const ventaPosterior: TextoItem = {
    titulo: "Y después de la jornada, la galería",
    texto:
      "Además de la preventa, las fotos quedan en una galería por enlace: las familias que no reservaron, o que quieren más fotos, pueden comprarlas ahí, también pagando online.",
  };

  const beneficios: TextoItem[] = [
    { titulo: "Menos trabajo administrativo", texto: "No hay que juntar sobres, armar listas de pedidos ni perseguir pagos." },
    { titulo: "Sin manejo de efectivo", texto: "Las familias pagan online. El colegio no recibe ni guarda dinero." },
    { titulo: "Sin planillas de cobro", texto: "Cada compra queda registrada en el sistema, con su pedido y su estado." },
    { titulo: "Compra y entrega centralizadas", texto: "Todo pasa por un mismo lugar, para el colegio y para las familias." },
    { titulo: "Beneficio para la institución", texto: "Un porcentaje acordado sobre las ventas, con reporte en su panel." },
    {
      titulo: "Atención a las familias, a toda hora",
      texto: `Un asistente virtual (DNX Bot) responde las dudas de las familias en el momento, de día o de noche. Lo que necesite una persona lo atiende ${n}. La secretaría no recibe consultas.`,
    },
    { titulo: "Fotografía profesional", texto: "Un fotógrafo con experiencia en retratos, grupos y eventos." },
  ];
  if (brand.beneficioLocal) beneficios.push(brand.beneficioLocal);

  const faqs: Faq[] = [
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
      a: `Es un porcentaje que se acuerda antes de empezar, sobre cada venta pagada y sin incluir la comisión de la plataforma. En la preventa cuentan las compras hechas con el enlace propio del colegio; en la galería posterior, las ventas del álbum del colegio. El detalle está en su panel y ${n} lo liquida según lo acordado.`,
    },
    {
      q: "¿Qué tiene que hacer el colegio?",
      a: `La coordinación institucional: definir fechas y espacios, pasar la lista de cursos y alumnos y gestionar las autorizaciones. Después, compartir con las familias el enlace de preventa y, más tarde, el de la galería. Cobros, pedidos y entregas los resuelven ${n} y el sistema.`,
    },
    {
      q: "¿Qué pasa si una familia cancela o pide una devolución?",
      a: "Las ventas anuladas o reembolsadas no generan beneficio para el colegio: si un pago se revierte, el beneficio de esa venta queda cancelado.",
    },
    {
      q: "¿Las fotos de los chicos quedan públicas?",
      a: "No hace falta: la galería se puede configurar como privada, sin aparecer en los listados del sitio, y sólo se entra con el enlace directo. Las vistas previas se muestran con marca de agua y el archivo original se entrega únicamente después de la compra. Las tomas se hacen con las autorizaciones que gestiona el colegio.",
    },
    {
      q: "¿Qué pasa con la selfie que sube una familia?",
      a: SELFIE_TEXTO,
    },
    {
      q: "¿Una familia puede ver las fotos de otros chicos?",
      a: "Con el modo de fotos ocultas, no: cada familia se identifica con una selfie y ve sólo las fotos de su hijo o hija, incluidas las grupales en las que aparece (con sus compañeros, como en cualquier foto de curso). Sin ese modo, la galería privada la ve quien tenga el enlace, siempre con vistas previas protegidas.",
    },
    {
      q: "¿Qué es ComprameLaFoto?",
      a: `Es el sistema con el que ${n} gestiona las galerías, los pagos online y los pedidos. Tiene su propia comisión, separada del beneficio del colegio y del costo de Mercado Pago.`,
    },
  ];

  return { pasos, razonesPreventa, ventaPosterior, beneficios, cuidado: buildCuidadoItems(n), faqs };
}
