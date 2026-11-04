/**
 * Curso de fotografía escolar: las clases son fijas (salen de los guiones de
 * docs/demos/tutoriales/escolar) y los links de YouTube se cargan desde
 * /admin/tutoriales, en el ajuste ESCOLAR_COURSE_SETTINGS_KEY.
 */

import {
  countLessons,
  extractYoutubeId,
  formatLessonDuration,
  parseCourseVideos,
  validateCourseVideos,
  type CourseBlock,
  type CourseLesson,
  type CourseLessonDetail,
  type CourseVideos,
} from "./course";

export const ESCOLAR_COURSE_PATH = "/tutoriales/fotografia-escolar";
export const ESCOLAR_COURSE_SETTINGS_KEY = "tutorials_escolar_course";
export const ESCOLAR_COURSE_TAGLINE = "La herramienta definitiva para organizar tu fotografía escolar";

export type EscolarCourseLesson = CourseLesson;
export type EscolarCourseLessonDetail = CourseLessonDetail;
export type EscolarCourseBlock = CourseBlock;
export type EscolarCourseVideos = CourseVideos;
export { extractYoutubeId, formatLessonDuration };

export const ESCOLAR_COURSE_BLOCKS: EscolarCourseBlock[] = [
  {
    title: "Conseguir el colegio y acordar con él",
    lessons: [
      { number: 1, title: "La venta escolar de punta a punta", audience: "Fotógrafo", summary: "El recorrido completo en siete etapas: primero se vende y se cobra, después se saca la foto." },
      { number: 2, title: "Tu página de venta para colegios", audience: "Fotógrafo", summary: "Una página con tu marca para mostrarle al directivo cómo trabajás, y dónde te llegan sus consultas." },
      { number: 3, title: "Dar de alta un colegio", audience: "Fotógrafo", summary: "Logo, contacto, dirección en el mapa y tus notas internas, en un minuto." },
      { number: 4, title: "Cursos y listado de alumnos", audience: "Fotógrafo", summary: "Importás el Excel del colegio y cada chico queda en su curso, con el nombre bien escrito." },
      { number: 5, title: "El usuario del colegio", audience: "Fotógrafo", summary: "El colegio sigue sus ventas, su comisión y sus alumnos con su propio usuario." },
      { number: 6, title: "El álbum del colegio y las fotos ocultas", audience: "Fotógrafo", summary: "El asistente del álbum escolar y la privacidad: cada familia ve solo las fotos de su hijo." },
      { number: 7, title: "La comisión del colegio", audience: "Fotógrafo", summary: "El porcentaje del colegio se calcula solo y Mercado Pago le deposita su parte en cada compra." },
    ],
  },
  {
    title: "Preparar la venta y el día de la toma",
    lessons: [
      { number: 8, title: "Los packs de preventa", audience: "Fotógrafo", summary: "Armás lo que vas a vender y las familias lo pagan por la plataforma antes de la sesión." },
      { number: 9, title: "Elegir el diseño de la carpeta escolar", audience: "Fotógrafo", summary: "La plantilla es un molde: la elegís una vez y sirve para todo el colegio." },
      { number: 10, title: "Probar la carpeta escolar con el listado real", audience: "Fotógrafo", summary: "Antes de abrir la venta, ves cómo queda la plantilla con los nombres del colegio." },
      { number: 11, title: "El día de la toma: subir las fotos", audience: "Fotógrafo", summary: "Subís todas las fotos juntas, sin separarlas chico por chico." },
    ],
  },
  {
    title: "Producción y entrega",
    lessons: [
      { number: 12, title: "La línea de producción", audience: "Fotógrafo", summary: "Los pedidos pagados y elegidos llegan a una sola pantalla, etapa por etapa." },
      { number: 13, title: "Revisar los diseños de corrido", audience: "Fotógrafo", summary: "Revisás muchas carpetas seguidas, sin abrirlas una por una." },
      { number: 14, title: "Mandar a la imprenta por lotes", audience: "Fotógrafo", summary: "Juntás las carpetas aprobadas en lotes listos para imprimir." },
      { number: 15, title: "Sobres con QR y entrega", audience: "Fotógrafo", summary: "Etiquetas con código para que cada sobre sepa a quién pertenece." },
      { number: 16, title: "La pantalla de pedidos del estudio", audience: "Fotógrafo", summary: "Una vista para el televisor del estudio, con todos los pedidos a la vista." },
      { number: 17, title: "El mosaico del curso", audience: "Fotógrafo y colegio", summary: "La hoja con todo el grado, cada chico con su foto y su nombre, armada sola." },
    ],
  },
  {
    title: "El colegio",
    lessons: [
      { number: 18, title: "El panel del colegio", audience: "Colegio", summary: "Lo que ve el colegio: ventas, comisión y alumnos, sin pedir planillas." },
      { number: 19, title: "Compartir la preventa y recibir la comisión", audience: "Colegio", summary: "El colegio comparte su link con las familias y su parte le llega sola por Mercado Pago." },
    ],
  },
  {
    title: "La familia",
    lessons: [
      { number: 20, title: "Comprar en la preventa", audience: "Familia", summary: "Con el link del colegio, la familia deja resuelta la foto en un par de minutos." },
      { number: 21, title: "Encontrar las fotos con una selfie", audience: "Familia", summary: "Nadie recorre el álbum: cada familia encuentra a su hijo con una selfie." },
      { number: 22, title: "Elegir las fotos y aprobar la carpeta escolar", audience: "Familia", summary: "La familia elige sus fotos y aprueba la carpeta escolar antes de imprimirla." },
      { number: 23, title: "Recuperar el pack", audience: "Familia", summary: "Si se perdió el correo, el link del pack se recupera en un minuto." },
    ],
  },
];

export const ESCOLAR_COURSE_LESSON_COUNT = countLessons(ESCOLAR_COURSE_BLOCKS);

export function parseEscolarCourseVideos(value: string | null | undefined): CourseVideos {
  return parseCourseVideos(value, ESCOLAR_COURSE_LESSON_COUNT);
}

export function validateEscolarCourseVideos(input: unknown): { videos: CourseVideos } | { error: string } {
  return validateCourseVideos(input, ESCOLAR_COURSE_LESSON_COUNT);
}
