/**
 * Curso de fotografía escolar: las clases son fijas (salen de los guiones de
 * docs/demos/tutoriales/escolar) y los links de YouTube se cargan desde
 * /admin/tutoriales, en el ajuste ESCOLAR_COURSE_SETTINGS_KEY.
 */

export const ESCOLAR_COURSE_PATH = "/tutoriales/fotografia-escolar";
export const ESCOLAR_COURSE_SETTINGS_KEY = "tutorials_escolar_course";
export const ESCOLAR_COURSE_TAGLINE = "La herramienta definitiva para organizar tu fotografía escolar";

export type EscolarCourseLesson = {
  number: number;
  title: string;
  summary: string;
  audience: "Fotógrafo" | "Fotógrafo y colegio" | "Colegio" | "Familia";
};

export type EscolarCourseBlock = {
  title: string;
  lessons: EscolarCourseLesson[];
};

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
      { number: 7, title: "La comisión del colegio", audience: "Fotógrafo", summary: "El porcentaje del colegio se calcula solo en cada compra, sin cuentas a fin de mes." },
    ],
  },
  {
    title: "Preparar la venta y el día de la toma",
    lessons: [
      { number: 8, title: "Los packs de preventa", audience: "Fotógrafo", summary: "Armás lo que vas a vender y las familias lo pagan por la plataforma antes de la sesión." },
      { number: 9, title: "Elegir el diseño del librito", audience: "Fotógrafo", summary: "La plantilla es un molde: la elegís una vez y sirve para todo el colegio." },
      { number: 10, title: "Probar el librito con el listado real", audience: "Fotógrafo", summary: "Antes de abrir la venta, ves cómo queda la plantilla con los nombres del colegio." },
      { number: 11, title: "El día de la toma: subir las fotos", audience: "Fotógrafo", summary: "Subís todas las fotos juntas, sin separarlas chico por chico." },
    ],
  },
  {
    title: "Producción y entrega",
    lessons: [
      { number: 12, title: "La línea de producción", audience: "Fotógrafo", summary: "Los pedidos pagados y elegidos llegan a una sola pantalla, etapa por etapa." },
      { number: 13, title: "Revisar los diseños de corrido", audience: "Fotógrafo", summary: "Revisás muchos libritos seguidos, sin abrirlos uno por uno." },
      { number: 14, title: "Mandar a la imprenta por lotes", audience: "Fotógrafo", summary: "Juntás los libritos aprobados en lotes listos para imprimir." },
      { number: 15, title: "Sobres con QR y entrega", audience: "Fotógrafo", summary: "Etiquetas con código para que cada sobre sepa a quién pertenece." },
      { number: 16, title: "La pantalla de pedidos del estudio", audience: "Fotógrafo", summary: "Una vista para el televisor del estudio, con todos los pedidos a la vista." },
      { number: 17, title: "El mosaico del curso", audience: "Fotógrafo y colegio", summary: "La hoja con todo el grado, cada chico con su foto y su nombre, armada sola." },
    ],
  },
  {
    title: "El colegio",
    lessons: [
      { number: 18, title: "El panel del colegio", audience: "Colegio", summary: "Lo que ve el colegio: ventas, comisión y alumnos, sin pedir planillas." },
      { number: 19, title: "Compartir la preventa y cobrar la comisión", audience: "Colegio", summary: "El colegio comparte su link con las familias y pide su parte de la venta." },
    ],
  },
  {
    title: "La familia",
    lessons: [
      { number: 20, title: "Comprar en la preventa", audience: "Familia", summary: "Con el link del colegio, la familia deja resuelta la foto en un par de minutos." },
      { number: 21, title: "Encontrar las fotos con una selfie", audience: "Familia", summary: "Nadie recorre el álbum: cada familia encuentra a su hijo con una selfie." },
      { number: 22, title: "Elegir las fotos y aprobar el librito", audience: "Familia", summary: "La familia elige sus fotos y aprueba el librito antes de imprimirlo." },
      { number: 23, title: "Recuperar el pack", audience: "Familia", summary: "Si se perdió el correo, el link del pack se recupera en un minuto." },
    ],
  },
];

export const ESCOLAR_COURSE_LESSON_COUNT = ESCOLAR_COURSE_BLOCKS.reduce(
  (total, block) => total + block.lessons.length,
  0
);

/** Número de clase → link de YouTube, tal como se guarda en SystemSettings. */
export type EscolarCourseVideos = Record<number, string>;

export function extractYoutubeId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    const host = url.hostname.replace("www.", "");
    if (host === "youtu.be") {
      return url.pathname.split("/").filter(Boolean)[0] || null;
    }
    if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
      if (url.pathname.startsWith("/watch")) {
        return url.searchParams.get("v");
      }
      if (url.pathname.startsWith("/embed/") || url.pathname.startsWith("/shorts/")) {
        return url.pathname.split("/")[2] || null;
      }
    }
    return null;
  } catch {
    if (/^[a-zA-Z0-9_-]{6,}$/.test(trimmed)) return trimmed;
    return null;
  }
}

function isLessonNumber(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= ESCOLAR_COURSE_LESSON_COUNT;
}

/** Lee el ajuste guardado; descarta clases inexistentes y links que no son de YouTube. */
export function parseEscolarCourseVideos(value: string | null | undefined): EscolarCourseVideos {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as { videos?: unknown };
    const raw = parsed?.videos;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    const videos: EscolarCourseVideos = {};
    for (const [key, url] of Object.entries(raw as Record<string, unknown>)) {
      const number = Number(key);
      if (!isLessonNumber(number) || typeof url !== "string") continue;
      if (extractYoutubeId(url)) videos[number] = url.trim();
    }
    return videos;
  } catch {
    return {};
  }
}

/** Valida lo que manda el admin. Un link vacío saca el video de esa clase. */
export function validateEscolarCourseVideos(
  input: unknown
): { videos: EscolarCourseVideos } | { error: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { error: "Body debe incluir { videos: { número: link } }" };
  }
  const videos: EscolarCourseVideos = {};
  for (const [key, url] of Object.entries(input as Record<string, unknown>)) {
    const number = Number(key);
    if (!isLessonNumber(number)) {
      return { error: `La clase ${key} no existe` };
    }
    const trimmed = typeof url === "string" ? url.trim() : "";
    if (!trimmed) continue;
    if (!extractYoutubeId(trimmed)) {
      return { error: `La clase ${number} debe tener un link de YouTube válido` };
    }
    videos[number] = trimmed;
  }
  return { videos };
}
