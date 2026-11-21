import type { TutorialCourse } from "./course";
import { COSTO_LESSON } from "./costo-lesson";
import {
  ESCOLAR_COURSE_BLOCKS,
  ESCOLAR_COURSE_LESSON_COUNT,
  ESCOLAR_COURSE_PATH,
  ESCOLAR_COURSE_SETTINGS_KEY,
  ESCOLAR_COURSE_TAGLINE,
} from "./escolar-course";
import { ESCOLAR_COURSE_DETAILS } from "./escolar-course-details";
import {
  TURISMO_COURSE_BLOCKS,
  TURISMO_COURSE_LESSON_COUNT,
  TURISMO_COURSE_PATH,
  TURISMO_COURSE_SETTINGS_KEY,
  TURISMO_COURSE_TAGLINE,
} from "./turismo-course";
import { TURISMO_COURSE_DETAILS } from "./turismo-course-details";
import {
  FOTOGRAFO_NUEVO_COURSE_BLOCKS,
  FOTOGRAFO_NUEVO_COURSE_LESSON_COUNT,
  FOTOGRAFO_NUEVO_COURSE_PATH,
  FOTOGRAFO_NUEVO_COURSE_SETTINGS_KEY,
  FOTOGRAFO_NUEVO_COURSE_TAGLINE,
} from "./fotografo-nuevo-course";
import { FOTOGRAFO_NUEVO_COURSE_DETAILS } from "./fotografo-nuevo-course-details";

/** Los cursos en video de /tutoriales, en el orden en que se muestran. */
export const TUTORIAL_COURSES: TutorialCourse[] = [
  {
    slug: "empeza-a-vender",
    path: FOTOGRAFO_NUEVO_COURSE_PATH,
    settingsKey: FOTOGRAFO_NUEVO_COURSE_SETTINGS_KEY,
    title: "Empezá a vender en ComprameLaFoto",
    tagline: FOTOGRAFO_NUEVO_COURSE_TAGLINE,
    intro:
      "grabadas sobre las pantallas reales de ComprameLaFoto con una cuenta demo: los clientes son inventados y los pagos son de prueba.",
    blocks: FOTOGRAFO_NUEVO_COURSE_BLOCKS,
    details: FOTOGRAFO_NUEVO_COURSE_DETAILS,
    lessonCount: FOTOGRAFO_NUEVO_COURSE_LESSON_COUNT,
    extras: [COSTO_LESSON],
    cover: {
      src: "/images/organizador/hero-marketing.jpg",
      alt: "El panel de un evento de ComprameLaFoto, con sus carpetas, sus ventas y la galería en el celular",
    },
    closing: {
      title: "Subí tu primer evento",
      text: "Creá tu cuenta, conectá Mercado Pago y armá tu primer álbum con el asistente paso a paso.",
    },
  },
  {
    slug: "escolar",
    path: ESCOLAR_COURSE_PATH,
    settingsKey: ESCOLAR_COURSE_SETTINGS_KEY,
    title: "Curso de fotografía escolar",
    tagline: ESCOLAR_COURSE_TAGLINE,
    intro:
      "grabadas sobre las pantallas reales de ComprameLaFoto con una demo: el colegio, los chicos y las familias son inventados y los pagos son de prueba.",
    blocks: ESCOLAR_COURSE_BLOCKS,
    details: ESCOLAR_COURSE_DETAILS,
    lessonCount: ESCOLAR_COURSE_LESSON_COUNT,
    extras: [COSTO_LESSON],
    cover: {
      src: "/images/landescolar/fotografo-curso-bandera-argentina.jpg",
      alt: "Un fotógrafo saca la foto de un curso con la bandera argentina detrás",
    },
    closing: {
      title: "Probalo con tu primer colegio",
      text: "Primero se vende y se cobra, después se saca la foto. Creá tu cuenta y armá la preventa por la plataforma.",
    },
    secondaryCta: { href: "/landescolar", label: "Conocé el sistema escolar" },
  },
  {
    slug: "turismo",
    path: TURISMO_COURSE_PATH,
    settingsKey: TURISMO_COURSE_SETTINGS_KEY,
    title: "Curso de fotografía de turismo",
    tagline: TURISMO_COURSE_TAGLINE,
    intro:
      "grabadas sobre las pantallas reales de ComprameLaFoto con una demo: los turistas son inventados y los pagos son de prueba.",
    blocks: TURISMO_COURSE_BLOCKS,
    details: TURISMO_COURSE_DETAILS,
    lessonCount: TURISMO_COURSE_LESSON_COUNT,
    extras: [COSTO_LESSON],
    cover: {
      src: "/images/tutoriales/curso-turismo.jpg",
      alt: "Una turista recorre las paredes de colores de Caminito, en La Boca",
    },
    closing: {
      title: "Probalo en tu próximo paseo",
      text: "Creá tu cuenta, armá el álbum de la excursión y poné el QR en el punto de encuentro.",
    },
  },
];

export function getTutorialCourse(slug: string): TutorialCourse | null {
  return TUTORIAL_COURSES.find((course) => course.slug === slug) ?? null;
}
