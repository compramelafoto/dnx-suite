/**
 * Cursos en video de /tutoriales: los videos propios de FOTOFFICE, grabados sobre las pantallas
 * reales con datos de demo. Misma idea que los cursos de ComprameLaFoto
 * (apps/compramelafoto/lib/tutorials/course.ts), adaptada al panel de FOTOFFICE.
 *
 * Las clases y su texto viven en el código; los links de YouTube, en `SystemSettings` (una fila
 * por curso, `claveAjuste`), así se suman a medida que se suben sin volver a desplegar.
 */

export type CapituloClase = { en: number; texto: string };

/** Lo que muestra la página al reproducir una clase (sale de detalles.ts, generado). */
export type DetalleClase = {
  duracionSegundos: number;
  descripcion: string;
  capitulos: CapituloClase[];
};

export type ClaseTutorial = {
  /** Va en el ancla (#clase-1b) y es la clave del link guardado. */
  clave: string;
  /** Lo que se lee en lugar del número: «3», «1-B». */
  etiqueta: string;
  titulo: string;
  resumen: string;
};

export type BloqueTutorial = { titulo: string; clases: ClaseTutorial[] };

/** Clave de la clase → link de YouTube, tal como se guarda en SystemSettings. */
export type VideosDelCurso = Record<string, string>;

export type CursoTutorial = {
  slug: string;
  claveAjuste: string;
  titulo: string;
  lema: string;
  /** Aclaración que va debajo del lema (qué es la demo). */
  intro: string;
  bloques: BloqueTutorial[];
  detalles: Record<string, DetalleClase>;
  /** Cuadro de la tarjeta del curso en /tutoriales (en /public). */
  portada: { src: string; alt: string };
  /** El recuadro del final de la página. */
  cierre: { titulo: string; texto: string };
};

export function rutaDelCurso(curso: Pick<CursoTutorial, "slug">): string {
  return `/tutoriales/${curso.slug}`;
}

export function clasesDelCurso(curso: Pick<CursoTutorial, "bloques">): ClaseTutorial[] {
  return curso.bloques.flatMap((b) => b.clases);
}

/** 144 → "2:24". */
export function formatearDuracion(segundos: number): string {
  const total = Math.max(0, Math.round(segundos));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function idDeYoutube(entrada: string): string | null {
  const texto = entrada.trim();
  if (!texto) return null;
  try {
    const url = new URL(texto.startsWith("http") ? texto : `https://${texto}`);
    const host = url.hostname.replace("www.", "");
    if (host === "youtu.be") return url.pathname.split("/").filter(Boolean)[0] || null;
    if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
      if (url.pathname.startsWith("/watch")) return url.searchParams.get("v");
      if (url.pathname.startsWith("/embed/") || url.pathname.startsWith("/shorts/")) {
        return url.pathname.split("/")[2] || null;
      }
    }
    return null;
  } catch {
    return /^[a-zA-Z0-9_-]{6,}$/.test(texto) ? texto : null;
  }
}

/** Lee el ajuste guardado; descarta clases que no existen y links que no son de YouTube. */
export function leerVideos(valor: string | null | undefined, claves: readonly string[]): VideosDelCurso {
  if (!valor) return {};
  try {
    const crudo = (JSON.parse(valor) as { videos?: unknown })?.videos;
    if (!crudo || typeof crudo !== "object" || Array.isArray(crudo)) return {};
    const videos: VideosDelCurso = {};
    for (const [clave, url] of Object.entries(crudo as Record<string, unknown>)) {
      if (!claves.includes(clave) || typeof url !== "string") continue;
      if (idDeYoutube(url)) videos[clave] = url.trim();
    }
    return videos;
  } catch {
    return {};
  }
}

/** Valida lo que manda el administrador. Un link vacío saca el video de esa clase. */
export function validarVideos(
  entrada: Record<string, string>,
  clases: readonly ClaseTutorial[],
): { videos: VideosDelCurso } | { error: string } {
  const videos: VideosDelCurso = {};
  for (const clase of clases) {
    const url = (entrada[clase.clave] ?? "").trim();
    if (!url) continue;
    if (!idDeYoutube(url)) return { error: `La clase ${clase.etiqueta} necesita un link de YouTube válido.` };
    videos[clase.clave] = url;
  }
  return { videos };
}
