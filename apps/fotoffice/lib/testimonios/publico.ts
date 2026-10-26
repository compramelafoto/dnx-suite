import "server-only";
import { prisma } from "@repo/db";
import { esTablaFaltante, ordenarParaPublico } from "./dominio";

/**
 * Lecturas públicas de Testimonios (bloque TESTIMONIALS y página `/testimonios`). Todo lo que sale
 * de acá está PUBLICADO y con permiso del autor. El correo del autor ni se lee: la consulta elige
 * campo por campo. Si las tablas todavía no existen (el SQL se aplica a mano) se devuelve vacío.
 */

export type TestimonioPublico = {
  id: string;
  texto: string;
  extracto: string | null;
  autorNombre: string;
  autorDetalle: string | null;
  autorFotoUrl: string | null;
  autorEnlace: string | null;
  calificacion: number | null;
};

/** Tope de seguridad para «todos»: una página pública no dibuja más que esto. */
const TOPE_PUBLICO = 200;

const WHERE_PUBLICO = (workspaceId: string) => ({ workspaceId, estado: "PUBLICADO", consentimiento: true });

export async function listarTestimoniosPublicos(
  workspaceId: string,
  opciones: {
    /** 0 o ausente = todos (hasta `TOPE_PUBLICO`). */
    limite?: number;
    /** Mezcla los no destacados: para leerlos todos hace falta traerlos y después cortar. */
    barajar?: boolean;
  } = {},
): Promise<TestimonioPublico[]> {
  const limite = opciones.limite && opciones.limite > 0 ? Math.min(opciones.limite, TOPE_PUBLICO) : TOPE_PUBLICO;
  const barajar = opciones.barajar === true;
  try {
    const filas = await prisma.fotofficeTestimonio.findMany({
      where: WHERE_PUBLICO(workspaceId),
      orderBy: [{ destacado: "desc" }, { orden: "asc" }, { createdAt: "desc" }],
      take: barajar ? TOPE_PUBLICO : limite,
      select: {
        id: true,
        texto: true,
        extracto: true,
        autorNombre: true,
        autorDetalle: true,
        autorFotoUrl: true,
        autorEnlace: true,
        calificacion: true,
        destacado: true,
      },
    });
    return ordenarParaPublico(filas, barajar)
      .slice(0, limite)
      .map((f) => ({
        id: f.id,
        texto: f.texto,
        extracto: f.extracto,
        autorNombre: f.autorNombre,
        autorDetalle: f.autorDetalle,
        autorFotoUrl: f.autorFotoUrl,
        autorEnlace: f.autorEnlace,
        calificacion: f.calificacion,
      }));
  } catch (err) {
    if (esTablaFaltante(err)) return [];
    throw err;
  }
}

/**
 * Si hay al menos un testimonio publicado: decide si «Testimonios» entra al menú. Corre en cada
 * página del sitio, por eso es una sola consulta que corta en la primera fila.
 */
export async function hayTestimoniosPublicados(workspaceId: string): Promise<boolean> {
  try {
    const uno = await prisma.fotofficeTestimonio.findFirst({ where: WHERE_PUBLICO(workspaceId), select: { id: true } });
    return uno !== null;
  } catch (err) {
    if (esTablaFaltante(err)) return false;
    throw err;
  }
}
