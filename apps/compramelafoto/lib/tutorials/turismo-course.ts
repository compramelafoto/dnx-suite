/**
 * Curso de fotografía de turismo: las clases salen del plan de docs/demos/tutoriales/turismo
 * y los links de YouTube se cargan desde /admin/tutoriales, en TURISMO_COURSE_SETTINGS_KEY.
 */

import { countLessons, type CourseBlock } from "./course";

export const TURISMO_COURSE_PATH = "/tutoriales/fotografia-de-turismo";
export const TURISMO_COURSE_SETTINGS_KEY = "tutorials_turismo_course";
export const TURISMO_COURSE_TAGLINE =
  "Vendé las fotos de cada paseo: el turista las encuentra con una selfie y las paga en el momento";

export const TURISMO_COURSE_BLOCKS: CourseBlock[] = [
  {
    title: "Preparar el álbum del paseo",
    lessons: [
      { number: 1, title: "La fotografía de turismo de punta a punta", audience: "Fotógrafo", summary: "El recorrido completo: del álbum del paseo a la descarga del turista." },
      { number: 2, title: "Crear el álbum de la excursión", audience: "Fotógrafo", summary: "Un álbum por paseo, con el lugar en el mapa, la fecha y la venta de fotos digitales." },
      { number: 3, title: "Precios y packs para turistas", audience: "Fotógrafo", summary: "Un precio accesible por foto, descuentos por cantidad y el pack «Todas mis fotos»." },
      { number: 4, title: "Fotos ocultas hasta la selfie", audience: "Fotógrafo", summary: "El paseo es público, pero cada turista ve solo las fotos donde aparece." },
      { number: 5, title: "El QR para el punto turístico", audience: "Fotógrafo", summary: "El código del álbum, listo para un cartel en el punto de encuentro o en la combi." },
    ],
  },
  {
    title: "El día del paseo y la venta",
    lessons: [
      { number: 6, title: "Los interesados: el turista deja su contacto", audience: "Fotógrafo y turista", summary: "El turista deja su contacto y le avisás cuando las fotos están listas." },
      { number: 7, title: "Subir las fotos del día", audience: "Fotógrafo", summary: "Subís toda la jornada junta, sin separar las fotos por persona." },
      { number: 8, title: "El turista encuentra sus fotos con una selfie", audience: "Turista", summary: "Desde el celular, una selfie y aparecen solo sus fotos." },
      { number: 9, title: "El turista compra y descarga", audience: "Turista", summary: "Elige, paga por Mercado Pago y descarga sus fotos en el momento." },
    ],
  },
  {
    title: "Con una empresa de turismo",
    lessons: [
      { number: 10, title: "La empresa de turismo crea el viaje y convoca fotógrafos", audience: "Empresa de turismo", summary: "La empresa arma el viaje en ocho pasos y suma a los fotógrafos." },
      { number: 11, title: "La comisión de la empresa de turismo", audience: "Empresa de turismo", summary: "La empresa conecta su Mercado Pago y su parte le llega sola en cada compra." },
      { number: 12, title: "Postularte a un viaje como fotógrafo", audience: "Fotógrafo", summary: "Te inscribís al viaje de una empresa y vendés las fotos desde tu cuenta." },
    ],
  },
];

export const TURISMO_COURSE_LESSON_COUNT = countLessons(TURISMO_COURSE_BLOCKS);
