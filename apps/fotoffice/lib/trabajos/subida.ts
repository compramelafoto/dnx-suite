import "server-only";
import { prisma } from "@repo/db";
import { deleteFotofficeR2Object, getFotofficeR2PublicUrl, isFotofficeR2Configured } from "@/lib/images/r2-client";
import { createFotofficeUploadUrl, verifyUploadedImage } from "@/lib/images/r2-presign";
import { agregarFotos } from "./repositorio";
import {
  FORMATOS_FOTO_TRABAJO,
  MAX_BYTES_FOTO_TRABAJO,
  MAX_FOTOS_POR_TRABAJO,
  esIdTrabajoValido,
  nombreParaKey,
  prefijoFotosTrabajo,
} from "./reglas";

/**
 * Subida de fotos a un trabajo, directo del navegador a R2 (mismo camino que el portfolio de
 * socios): las funciones de Vercel no aceptan pedidos de más de 4,5 MB y una foto de cobertura
 * pesa más.
 *
 * 1. `prepararSubida`: el servidor revisa tope, formato y peso DECLARADOS y firma una URL por
 *    archivo, siempre bajo el prefijo del trabajo (lo arma el servidor, nunca el navegador).
 * 2. El navegador sube cada archivo con PUT.
 * 3. `confirmarSubida`: se mira cada objeto ya subido (peso real y firma binaria). Lo que no es
 *    JPG/PNG/WebP o pesa de más se borra de R2 y no queda fila; lo que pasa se registra.
 *
 * Quién puede llamar a esto lo decide el guardián de la acción o de la ruta.
 */

export type ArchivoAPreparar = { nombre: string; tipo: string; bytes: number };
export type SubidaPreparada = { nombre: string; uploadUrl: string; key: string };
export type MedidasFoto = { ancho: number; alto: number };

/** Por qué no se pudo: la ruta lo traduce a un estado HTTP sin mirar el texto del mensaje. */
export type CodigoSubida = "ID_INVALIDO" | "NO_EXISTE" | "SIN_R2" | "TOPE" | "ARCHIVO_INVALIDO" | "NO_REGISTRADA";
export type ResultadoSubida<T> = { ok: true; valor: T } | { ok: false; error: string; codigo: CodigoSubida };

const MB = 1024 * 1024;
const fallo = (codigo: CodigoSubida, error: string): ResultadoSubida<never> => ({ ok: false, error, codigo });
const ID_INVALIDO = "El trabajo no existe";

function mensajeTope(existentes: number): string {
  const quedan = Math.max(0, MAX_FOTOS_POR_TRABAJO - existentes);
  return `Cada trabajo admite hasta ${MAX_FOTOS_POR_TRABAJO} fotos. Te ${quedan === 1 ? "queda 1 lugar" : `quedan ${quedan} lugares`}.`;
}

export async function prepararSubida(
  workspaceId: string,
  trabajoId: string,
  archivos: ArchivoAPreparar[],
): Promise<ResultadoSubida<SubidaPreparada[]>> {
  // Antes que nada: con este id se arma un prefijo de R2.
  if (!esIdTrabajoValido(trabajoId)) return fallo("ID_INVALIDO", ID_INVALIDO);
  if (archivos.length === 0) return fallo("ARCHIVO_INVALIDO", "Elegí al menos una foto");
  if (!isFotofficeR2Configured()) {
    return fallo("SIN_R2", "El almacenamiento de fotos no está configurado. Avisale a la administración.");
  }
  const t = await prisma.fotofficeTrabajo.findFirst({ where: { id: trabajoId, workspaceId }, select: { id: true } });
  if (!t) return fallo("NO_EXISTE", "El trabajo no existe");

  // El tope se mira antes de firmar: mejor decirlo ahora que subir de más y borrar después.
  const existentes = await prisma.fotofficeTrabajoFoto.count({ where: { trabajoId, workspaceId } });
  if (existentes + archivos.length > MAX_FOTOS_POR_TRABAJO) return fallo("TOPE", mensajeTope(existentes));

  for (const a of archivos) {
    if (!(FORMATOS_FOTO_TRABAJO as readonly string[]).includes(a.tipo)) {
      return fallo("ARCHIVO_INVALIDO", `«${a.nombre}» no es una foto JPG, PNG o WebP`);
    }
    if (!Number.isFinite(a.bytes) || a.bytes <= 0) return fallo("ARCHIVO_INVALIDO", `«${a.nombre}» está vacía`);
    if (a.bytes > MAX_BYTES_FOTO_TRABAJO) {
      return fallo("ARCHIVO_INVALIDO", `«${a.nombre}» pesa más de ${MAX_BYTES_FOTO_TRABAJO / MB} MB`);
    }
  }

  const prefix = prefijoFotosTrabajo(workspaceId, trabajoId);
  const preparadas: SubidaPreparada[] = [];
  for (const a of archivos) {
    // La extensión de la key sale del tipo, no del nombre que manda el navegador.
    const { uploadUrl, key } = await createFotofficeUploadUrl({
      prefix,
      originalFilename: nombreParaKey(a.tipo),
      contentType: a.tipo,
    });
    preparadas.push({ nombre: a.nombre, uploadUrl, key });
  }
  return { ok: true, valor: preparadas };
}

function medidaValida(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n > 0 && n < 100_000;
}

/** Las keys de la lista que ya tienen fila en este trabajo. */
async function keysConFila(workspaceId: string, trabajoId: string, keys: string[]): Promise<Set<string>> {
  if (keys.length === 0) return new Set();
  const filas = await prisma.fotofficeTrabajoFoto.findMany({
    where: { trabajoId, workspaceId, r2Key: { in: keys } },
    select: { r2Key: true },
  });
  return new Set(filas.map((f) => f.r2Key).filter((k): k is string => typeof k === "string"));
}

/**
 * Borra de R2 sólo lo que NO tiene fila. Un objeto con fila es una foto del trabajo: borrarlo deja
 * la imagen rota. Se vuelve a mirar la base justo antes, por si otro pedido la registró.
 */
async function borrarSinFila(workspaceId: string, trabajoId: string, keys: string[], motivo: string) {
  const conFila = await keysConFila(workspaceId, trabajoId, keys);
  for (const key of keys) {
    if (conFila.has(key)) continue;
    const r = await deleteFotofficeR2Object(key);
    if (!r.ok) console.error(`[fotoffice][trabajos] no se pudo borrar de R2 (${motivo}):`, key, r.error);
  }
}

/**
 * `keys` en el orden en que la persona eligió las fotos (así quedan en el trabajo). `medidas`
 * (ancho y alto que leyó el navegador) son opcionales: sin ellas la galería sólo no reserva lugar.
 *
 * Idempotente: una key repetida en la lista cuenta una vez, y una que ya tiene fila (un reintento
 * después de un corte) se da por confirmada sin verificarla de nuevo ni tocarla.
 */
export async function confirmarSubida(
  workspaceId: string,
  trabajoId: string,
  keys: string[],
  medidas: Record<string, MedidasFoto> = {},
): Promise<ResultadoSubida<{ agregadas: number; yaEstaban: number; rechazadas: { key: string; error: string }[] }>> {
  // Antes de cualquier limpieza: con este id se arma el prefijo de lo que se puede borrar.
  if (!esIdTrabajoValido(trabajoId)) return fallo("ID_INVALIDO", ID_INVALIDO);
  const unicas = [...new Set(keys.filter((k): k is string => typeof k === "string"))];
  if (unicas.length === 0) return fallo("ARCHIVO_INVALIDO", "No llegó ninguna foto");
  const prefijo = prefijoFotosTrabajo(workspaceId, trabajoId);
  const propia = (k: string) => k.startsWith(prefijo) && !k.includes("..");

  const t = await prisma.fotofficeTrabajo.findFirst({ where: { id: trabajoId, workspaceId }, select: { id: true } });
  if (!t) {
    // El trabajo se borró mientras subían: lo que quedó bajo su prefijo no tiene dueño.
    await borrarSinFila(workspaceId, trabajoId, unicas.filter(propia), "trabajo inexistente");
    return fallo("NO_EXISTE", "El trabajo no existe");
  }

  const rechazadas: { key: string; error: string }[] = [];
  const nuevas: string[] = [];
  for (const key of unicas) {
    // Una key fuera de este trabajo no se registra ni se borra: no es nuestra.
    if (!propia(key)) rechazadas.push({ key, error: "La foto no es de este trabajo" });
    else nuevas.push(key);
  }
  const yaEstaban = await keysConFila(workspaceId, trabajoId, nuevas);

  const validas: string[] = [];
  const invalidas: string[] = [];
  for (const key of nuevas) {
    if (yaEstaban.has(key)) continue;
    let verificacion: Awaited<ReturnType<typeof verifyUploadedImage>>;
    try {
      verificacion = await verifyUploadedImage({
        key,
        maxFileSizeBytes: MAX_BYTES_FOTO_TRABAJO,
        acceptedFormats: FORMATOS_FOTO_TRABAJO,
      });
    } catch (err) {
      // Típicamente: el objeto no está (la subida no terminó).
      console.error("[fotoffice][trabajos] no se pudo verificar la foto subida:", key, err);
      verificacion = { ok: false, error: "No encontramos la foto subida. Probá de nuevo." };
    }
    if (verificacion.ok) validas.push(key);
    else {
      invalidas.push(key);
      rechazadas.push({ key, error: verificacion.error });
    }
  }
  if (invalidas.length > 0) await borrarSinFila(workspaceId, trabajoId, invalidas, "foto inválida");

  if (validas.length > 0) {
    const r = await agregarFotos(
      workspaceId,
      trabajoId,
      validas.map((key) => {
        const m = medidas[key];
        const conMedidas = m && medidaValida(m.ancho) && medidaValida(m.alto);
        return {
          url: getFotofficeR2PublicUrl(key),
          r2Key: key,
          ancho: conMedidas ? m.ancho : null,
          alto: conMedidas ? m.alto : null,
        };
      }),
    );
    if (!r.ok) {
      // Sin fila no hay forma de llegar a esos archivos: se borran (nunca los que ya tienen fila).
      await borrarSinFila(workspaceId, trabajoId, validas, "no se pudo registrar");
      return fallo("NO_REGISTRADA", r.error);
    }
    // Las que otro pedido registró en el medio ya estaban: no se borran ni son error.
    const agregadas = r.valor.agregadas;
    return { ok: true, valor: { agregadas, yaEstaban: yaEstaban.size + validas.length - agregadas, rechazadas } };
  }
  return { ok: true, valor: { agregadas: 0, yaEstaban: yaEstaban.size, rechazadas } };
}
