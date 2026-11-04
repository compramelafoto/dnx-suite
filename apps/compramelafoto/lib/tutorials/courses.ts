import type { TutorialCourse } from "./course";
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

/** Los cursos en video de /tutoriales, en el orden en que se muestran. */
export const TUTORIAL_COURSES: TutorialCourse[] = [
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
    closing: {
      title: "Probalo en tu próximo paseo",
      text: "Creá tu cuenta, armá el álbum de la excursión y poné el QR en el punto de encuentro.",
    },
  },
];

export function getTutorialCourse(slug: string): TutorialCourse | null {
  return TUTORIAL_COURSES.find((course) => course.slug === slug) ?? null;
}
