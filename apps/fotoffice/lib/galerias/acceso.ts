import { puedeEnContexto } from "@/lib/access/policy";
import type { CtxConsultas } from "@/lib/consultas/catalogo";

/**
 * Permisos de Galería (etapa 7) sobre el adaptador de main, igual que `lib/proyectos/acceso.ts`.
 * Ver = leer; Gestionar = crear, subir, ordenar, publicar. Sin base ni sesión.
 */
export const GALLERY_MODULE_KEY = "gallery";

export type CtxGalerias = CtxConsultas;

export function puedeVerGalerias(ctx: CtxGalerias): boolean {
  return ctx.userId !== null && puedeEnContexto(ctx, "ver", GALLERY_MODULE_KEY);
}

export function puedeGestionarGalerias(ctx: CtxGalerias): boolean {
  return ctx.userId !== null && puedeEnContexto(ctx, "operar", GALLERY_MODULE_KEY);
}

export const MENSAJES_GALERIA = {
  sinPermiso: "No tenés permiso para hacer esto.",
  datosInvalidos: "Los datos no son válidos.",
  noExiste: "No encontramos esa galería.",
  fotoNoExiste: "No encontramos esa foto.",
  archivada: "La galería está archivada: no se le agregan fotos.",
  topeFotos: "La galería ya tiene el máximo de 3.000 fotos.",
  tipo: "Sólo se pueden subir fotos JPG o PNG.",
  tamano: "Cada foto puede pesar hasta 50 MB.",
  nombre: "El archivo tiene que tener nombre.",
  preparar: "No pudimos preparar la subida. Probá de nuevo.",
  subidaIncompleta: "La subida no se completó. Probá de nuevo.",
  verificar: "No pudimos verificar la subida. Probá de nuevo.",
  guardar: "No se pudo guardar el cambio.",
  portada: "Elegí una foto lista de esta galería.",
  orden: "El orden indicado no es válido.",
} as const;
