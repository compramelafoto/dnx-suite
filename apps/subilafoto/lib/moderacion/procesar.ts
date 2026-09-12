import { decidirDesdeElAnalisis, type Decision, type Etiqueta, type Perfil } from "./reglas";
import { codigoDeError, type ProveedorDeModeracion } from "./proveedor";

/**
 * El paso que convierte una foto subida en una foto decidida.
 *
 * No conoce Prisma ni Amazon: recibe las dos cosas por parámetro. Así se puede
 * probar la parte difícil —que no se publique dos veces— sin base de datos y
 * sin gastar llamadas a la nube.
 */

export type FotoParaModerar = {
  id: string;
  eventId: string;
  originalKey: string;
  perfil: Perfil;
};

export type EntradaDeGuardado = {
  mediaId: string;
  perfil: Perfil;
  estado: Decision["estado"];
  /** Verdadero sólo si además hay que poner `publishedAt`. */
  publicar: boolean;
  proveedor: string;
  modelo: string | null;
  versionDePolitica: string;
  etiquetas: readonly Etiqueta[];
  motivo: string | null;
  confianza: number | null;
  latenciaMs: number;
  codigoDeError: string | null;
};

export type Dependencias = {
  obtenerFoto(mediaId: string): Promise<FotoParaModerar | null>;
  descargar(clave: string): Promise<Uint8Array>;
  proveedor: ProveedorDeModeracion;
  /**
   * Guarda la decisión y cambia el estado, **sólo si la foto sigue en
   * `PROCESSING`**. Devuelve `false` si otro proceso llegó primero.
   *
   * Ahí vive la idempotencia: la condición la resuelve la base, no este código.
   */
  guardar(entrada: EntradaDeGuardado): Promise<boolean>;
};

export type ResultadoDelProceso =
  | { estado: "decidida"; decision: Decision }
  | { estado: "ya-decidida" }
  | { estado: "no-existe" };

export async function procesarFoto(
  deps: Dependencias,
  mediaId: string,
): Promise<ResultadoDelProceso> {
  const foto = await deps.obtenerFoto(mediaId);
  if (!foto) return { estado: "no-existe" };

  const arranque = Date.now();
  let analisis: Awaited<ReturnType<ProveedorDeModeracion["analizar"]>>;

  try {
    const imagen = await deps.descargar(foto.originalKey);
    analisis = await deps.proveedor.analizar(imagen);
  } catch (error) {
    // Que no se pueda bajar el archivo es tan "no la miramos" como que falle
    // Amazon. Mismo camino: la foto queda retenida.
    analisis = {
      ok: false,
      codigoDeError: codigoDeError(error),
      latenciaMs: Date.now() - arranque,
    };
  }

  const decision = decidirDesdeElAnalisis(analisis, foto.perfil);

  const guardada = await deps.guardar({
    mediaId: foto.id,
    perfil: foto.perfil,
    estado: decision.estado,
    // Publicar es poner `publishedAt`, y es lo único que hace que una foto
    // llegue a la pantalla. Sólo pasa con APPROVED.
    publicar: decision.estado === "APPROVED",
    proveedor: deps.proveedor.nombre,
    modelo: analisis.ok ? (analisis.modelo ?? null) : null,
    versionDePolitica: decision.versionDePolitica,
    etiquetas: analisis.ok ? analisis.etiquetas : [],
    motivo: decision.motivo,
    confianza: decision.confianza,
    latenciaMs: analisis.latenciaMs,
    codigoDeError: analisis.ok ? null : analisis.codigoDeError,
  });

  return guardada ? { estado: "decidida", decision } : { estado: "ya-decidida" };
}
