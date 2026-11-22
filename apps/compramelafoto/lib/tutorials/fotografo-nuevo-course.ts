/**
 * Curso «Empezá a vender en ComprameLaFoto», para fotógrafos nuevos: las clases salen del guion de
 * docs/demos/tutoriales/curso-fotografo-nuevo y los links de YouTube se cargan desde /admin/tutoriales,
 * en FOTOGRAFO_NUEVO_COURSE_SETTINGS_KEY.
 */

import { countLessons, type CourseBlock } from "./course";

export const FOTOGRAFO_NUEVO_COURSE_PATH = "/tutoriales/empeza-a-vender";
export const FOTOGRAFO_NUEVO_COURSE_SETTINGS_KEY = "tutorials_fotografo_nuevo_course";
export const FOTOGRAFO_NUEVO_COURSE_TAGLINE =
  "Desde crear tu cuenta hasta entregar el pedido: tu primer álbum de eventos o deportes, a la venta";

export const FOTOGRAFO_NUEVO_COURSE_BLOCKS: CourseBlock[] = [
  {
    title: "Tu cuenta",
    lessons: [
      { number: 1, title: "Bienvenida: creá tu cuenta de fotógrafo", audience: "Fotógrafo", summary: "Del registro al panel: tu cuenta de fotógrafo, con correo o con Google." },
      { number: 2, title: "Tu perfil y tu marca", audience: "Fotógrafo", summary: "Tus datos, tu estudio, tu página con tu nombre, tu logo y tus colores." },
    ],
  },
  {
    title: "Mercado Pago",
    lessons: [
      { number: 3, title: "Conectar tu cuenta de Mercado Pago", audience: "Fotógrafo", summary: "Sin Mercado Pago no se vende: cómo conectarlo y qué hacer si se vence." },
    ],
  },
  {
    title: "Cobro dividido",
    lessons: [
      { number: 4, title: "Qué es el cobro dividido", audience: "Fotógrafo", summary: "Mercado Pago reparte cada pago en el momento: tu parte, directo a tu cuenta." },
      { number: 5, title: "Quién lo autoriza en cada tipo de venta", audience: "Fotógrafo", summary: "Quién autoriza en cada tipo de venta, y por qué conviene activarlo siempre." },
      { number: 6, title: "Activar el cobro dividido paso a paso", audience: "Fotógrafo", summary: "Los dos pasos para activarlo, una sola vez." },
    ],
  },
  {
    title: "Tu primer álbum con el asistente",
    lessons: [
      { number: 7, title: "Abrir el asistente: tipo de álbum y datos", audience: "Fotógrafo", summary: "El asistente paso a paso: el tipo de álbum, el título, el lugar y la fecha." },
      { number: 8, title: "Ventas digitales: el precio de tus fotos", audience: "Fotógrafo", summary: "El precio de cada foto digital y cuánto recibís vos." },
      { number: 9, title: "Impresiones: vender fotos en papel", audience: "Fotógrafo", summary: "Impresiones: lista propia o de un laboratorio, tu margen y quién retira." },
      { number: 10, title: "Seguridad y privacidad del álbum", audience: "Fotógrafo", summary: "Público, no listado o privado con selfie." },
      { number: 11, title: "Revisar y crear el álbum", audience: "Fotógrafo", summary: "El resumen final, los términos y el álbum creado." },
    ],
  },
  {
    title: "Subir, publicar y difundir",
    lessons: [
      { number: 12, title: "Subir las fotos", audience: "Fotógrafo", summary: "Fotos sueltas o carpetas enteras, con la marca de agua puesta sola." },
      { number: 13, title: "Vender más: descuentos y packs", audience: "Fotógrafo", summary: "Descuentos por cantidad y el pack «Todas mis fotos»." },
      { number: 14, title: "Selfie, dorsal y aviso de fotos nuevas", audience: "Fotógrafo", summary: "Selfie, dorsal, la marca de agua dinámica y los interesados." },
      { number: 15, title: "Publicar y difundir tu álbum", audience: "Fotógrafo", summary: "El enlace, el QR, el instructivo y los carteles para el evento." },
      { number: 16, title: "Cómo compra tu cliente", audience: "Cliente", summary: "Así encuentra, elige y paga sus fotos tu cliente desde el celular." },
    ],
  },
  {
    title: "Pedidos y entrega",
    lessons: [
      { number: 17, title: "Te llegó una venta: la pantalla de pedidos", audience: "Fotógrafo", summary: "El aviso de venta y la pantalla de pedidos." },
      { number: 18, title: "La ficha del pedido", audience: "Fotógrafo", summary: "Todo lo que pasó con un pedido, en su ficha." },
      { number: 19, title: "La entrega de las fotos digitales", audience: "Fotógrafo", summary: "La entrega digital es automática." },
      { number: 20, title: "La entrega de las fotos impresas", audience: "Fotógrafo", summary: "Lotes, laboratorio, sobres con QR y entregado." },
      { number: 21, title: "Cuánto ganaste y cierre del curso", audience: "Fotógrafo", summary: "Cuánto ganaste, y el cierre del recorrido." },
    ],
  },
  {
    title: "La gestión de impresiones",
    lessons: [
      { number: 22, title: "Tus laboratorios", audience: "Fotógrafo", summary: "Cargá tus laboratorios y marcá dónde retiran tus clientes." },
      { number: 23, title: "Precios de impresión y quién entrega", audience: "Fotógrafo", summary: "Precios de impresión y quién le entrega las copias al cliente." },
      { number: 24, title: "Cómo pide tu cliente las fotos impresas", audience: "Cliente", summary: "Qué elige tu cliente al pedir fotos impresas." },
      { number: 25, title: "Del lote al laboratorio, y el pago al laboratorio", audience: "Fotógrafo", summary: "El lote al laboratorio, el aviso al cliente y el pago al laboratorio." },
    ],
  },
  {
    title: "Tu álbum en Instagram",
    lessons: [
      { number: 26, title: "Que ComprameLaFoto publique historias de tu álbum", audience: "Fotógrafo", summary: "Activá las historias de tu álbum en el Instagram de ComprameLaFoto y sumá etiquetas." },
    ],
  },
];

export const FOTOGRAFO_NUEVO_COURSE_LESSON_COUNT = countLessons(FOTOGRAFO_NUEVO_COURSE_BLOCKS);
