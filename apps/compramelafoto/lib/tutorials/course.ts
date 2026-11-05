/**
 * Lo común a los cursos en video de /tutoriales (escolar, turismo…): cada curso tiene clases
 * fijas en bloques, un detalle generado por clase (descripción, duración, capítulos) y los
 * links de YouTube cargados desde /admin/tutoriales en su ajuste de SystemSettings.
 */

export type CourseLesson = {
  number: number;
  title: string;
  summary: string;
  /** A quién está dirigida, como se lee en la página: «Fotógrafo», «Colegio», «Turista»… */
  audience: string;
};

export type CourseBlock = {
  title: string;
  lessons: CourseLesson[];
};

/** Lo que la página muestra al reproducir una clase (sale del archivo *-details.ts, generado). */
export type CourseLessonDetail = {
  durationSeconds: number;
  description: string;
  chapters: { at: number; label: string }[];
};

/**
 * Un video que no es una clase numerada y va igual en todos los cursos (el 1-B, «¿Cuánto cuesta
 * ComprameLaFoto?»). Se sube una sola vez a YouTube, así que su link vive en el código y no en el
 * ajuste de cada curso.
 */
export type CourseExtraLesson = Omit<CourseLesson, "number"> & {
  /** Lo que se lee en lugar del número («1-B») y el ancla del link (#clase-1b). */
  label: string;
  /** La clase numerada después de la cual se muestra. */
  afterLesson: number;
  videoUrl: string | null;
  detail: CourseLessonDetail;
};

/** Número de clase → link de YouTube, tal como se guarda en SystemSettings. */
export type CourseVideos = Record<number, string>;

export type TutorialCourse = {
  slug: string;
  path: string;
  settingsKey: string;
  title: string;
  tagline: string;
  /** Aclaración que va debajo del lema (qué es la demo). */
  intro: string;
  blocks: CourseBlock[];
  details: Record<number, CourseLessonDetail>;
  lessonCount: number;
  /** Videos comunes a todos los cursos, intercalados entre las clases. */
  extras: CourseExtraLesson[];
  /** Foto de la tarjeta del curso en /tutoriales (en /public). */
  cover: { src: string; alt: string };
  /** El recuadro del final de la página, antes de los botones. */
  closing: { title: string; text: string };
  /** Segundo botón del cierre, además de crear la cuenta. */
  secondaryCta?: { href: string; label: string };
};

export function countLessons(blocks: CourseBlock[]): number {
  return blocks.reduce((total, block) => total + block.lessons.length, 0);
}

/** 144 → "2:24". */
export function formatLessonDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

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

function isLessonNumber(value: number, lessonCount: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= lessonCount;
}

/** Lee el ajuste guardado; descarta clases inexistentes y links que no son de YouTube. */
export function parseCourseVideos(value: string | null | undefined, lessonCount: number): CourseVideos {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as { videos?: unknown };
    const raw = parsed?.videos;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    const videos: CourseVideos = {};
    for (const [key, url] of Object.entries(raw as Record<string, unknown>)) {
      const number = Number(key);
      if (!isLessonNumber(number, lessonCount) || typeof url !== "string") continue;
      if (extractYoutubeId(url)) videos[number] = url.trim();
    }
    return videos;
  } catch {
    return {};
  }
}

/** Valida lo que manda el admin. Un link vacío saca el video de esa clase. */
export function validateCourseVideos(
  input: unknown,
  lessonCount: number
): { videos: CourseVideos } | { error: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { error: "Body debe incluir { videos: { número: link } }" };
  }
  const videos: CourseVideos = {};
  for (const [key, url] of Object.entries(input as Record<string, unknown>)) {
    const number = Number(key);
    if (!isLessonNumber(number, lessonCount)) {
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

/** Cada video del curso tal como se lista en la página: las clases numeradas y los comunes, en orden. */
export type CourseEntry = Omit<CourseLesson, "number"> & {
  /** Lo que va en el ancla (#clase-3, #clase-1b). */
  key: string;
  /** Lo que se lee en lugar del número: «3», «1-B». */
  label: string;
  /** El número de la clase; null en los videos comunes. */
  number: number | null;
  blockIndex: number;
  detail: CourseLessonDetail | undefined;
  videoUrl: string | null;
};

export function courseEntries(
  course: Pick<TutorialCourse, "blocks" | "details" | "extras">,
  videos: CourseVideos
): CourseEntry[] {
  return course.blocks.flatMap((block, blockIndex) =>
    block.lessons.flatMap((lesson) => [
      {
        ...lesson,
        key: String(lesson.number),
        label: String(lesson.number),
        blockIndex,
        detail: course.details[lesson.number],
        videoUrl: videos[lesson.number] ?? null,
      },
      ...course.extras
        .filter((extra) => extra.afterLesson === lesson.number)
        .map((extra) => ({
          title: extra.title,
          summary: extra.summary,
          audience: extra.audience,
          key: extra.label.toLowerCase().replace(/[^a-z0-9]/g, ""),
          label: extra.label,
          number: null,
          blockIndex,
          detail: extra.detail,
          videoUrl: extra.videoUrl,
        })),
    ])
  );
}
