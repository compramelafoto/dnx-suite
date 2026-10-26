import "server-only";
import { prisma } from "@repo/db";
import { deleteFotofficeR2Object, getFotofficeR2PublicUrl, isFotofficeR2Configured } from "@/lib/images/r2-client";
import { createFotofficeUploadUrl, verifyUploadedImage } from "@/lib/images/r2-presign";
import { agregarFotos, type Resultado } from "./repositorio";
import { FORMATOS_FOTO_TRABAJO, MAX_BYTES_FOTO_TRABAJO, MAX_FOTOS_POR_TRABAJO, prefijoFotosTrabajo } from "./reglas";

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

const MB = 1024 * 1024;
const fallo = (error: string): Resultado<never> => ({ ok: false, error });

function mensajeTope(existentes: number): string {
  const quedan = Math.max(0, MAX_FOTOS_POR_TRABAJO - existentes);
  return `Cada trabajo admite hasta ${MAX_FOTOS_POR_TRABAJO} fotos. Te ${quedan === 1 ? "queda 1 lugar" : `quedan ${quedan} lugares`}.`;
}

export async function prepararSubida(
  workspaceId: string,
  trabajoId: string,
  archivos: ArchivoAPreparar[],
): Promise<Resultado<SubidaPreparada[]>> {
  if (archivos.length === 0) return fallo("Elegí al menos una foto");
  if (!isFotofficeR2Configured()) {
    return fallo("El almacenamiento de fotos no está configurado. Avisale a la administración.");
  }
  const t = await prisma.fotofficeTrabajo.findFirst({ where: { id: trabajoId, workspaceId }, select: { id: true } });
  if (!t) return fallo("El trabajo no existe");

  // El tope se mira antes de firmar: mejor decirlo ahora que subir de más y borrar después.
  const existentes = await prisma.fotofficeTrabajoFoto.count({ where: { trabajoId, workspaceId } });
  if (existentes + archivos.length > MAX_FOTOS_POR_TRABAJO) return fallo(mensajeTope(existentes));

  for (const a of archivos) {
    if (!(FORMATOS_FOTO_TRABAJO as readonly string[]).includes(a.tipo)) {
      return fallo(`«${a.nombre}» no es una foto JPG, PNG o WebP`);
    }
    if (!Number.isFinite(a.bytes) || a.bytes <= 0) return fallo(`«${a.nombre}» está vacía`);
    if (a.bytes > MAX_BYTES_FOTO_TRABAJO) {
      return fallo(`«${a.nombre}» pesa más de ${MAX_BYTES_FOTO_TRABAJO / MB} MB`);
    }
  }

  const prefix = prefijoFotosTrabajo(workspaceId, trabajoId);
  const preparadas: SubidaPreparada[] = [];
  for (const a of archivos) {
    const { uploadUrl, key } = await createFotofficeUploadUrl({ prefix, originalFilename: a.nombre, contentType: a.tipo });
    preparadas.push({ nombre: a.nombre, uploadUrl, key });
  }
  return { ok: true, valor: preparadas };
}

function medidaValida(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n > 0 && n < 100_000;
}

async function borrarDeR2(key: string, motivo: string) {
  const r = await deleteFotofficeR2Object(key);
  if (!r.ok) console.error(`[fotoffice][trabajos] no se pudo borrar de R2 (${motivo}):`, key, r.error);
}

/**
 * `keys` en el orden en que la persona eligió las fotos (así quedan en el trabajo). `medidas`
 * (ancho y alto que leyó el navegador) son opcionales: sin ellas la galería sólo no reserva lugar.
 */
export async function confirmarSubida(
  workspaceId: string,
  trabajoId: string,
  keys: string[],
  medidas: Record<string, MedidasFoto> = {},
): Promise<Resultado<{ agregadas: number; rechazadas: { key: string; error: string }[] }>> {
  if (keys.length === 0) return fallo("No llegó ninguna foto");
  const prefijo = prefijoFotosTrabajo(workspaceId, trabajoId);
  const propia = (k: string) => typeof k === "string" && k.startsWith(prefijo) && !k.includes("..");

  const t = await prisma.fotofficeTrabajo.findFirst({ where: { id: trabajoId, workspaceId }, select: { id: true } });
  if (!t) {
    // El trabajo se borró mientras subían: lo que quedó bajo su prefijo no tiene dueño.
    for (const k of keys.filter(propia)) await borrarDeR2(k, "trabajo inexistente");
    return fallo("El trabajo no existe");
  }

  const rechazadas: { key: string; error: string }[] = [];
  const validas: string[] = [];
  for (const key of keys) {
    // Una key fuera de este trabajo no se registra ni se borra: no es nuestra.
    if (!propia(key)) {
      rechazadas.push({ key, error: "La foto no es de este trabajo" });
      continue;
    }
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
    if (!verificacion.ok) {
      await borrarDeR2(key, "foto inválida");
      rechazadas.push({ key, error: verificacion.error });
      continue;
    }
    validas.push(key);
  }

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
      // Sin fila no hay forma de llegar a esos archivos: se borran.
      for (const k of validas) await borrarDeR2(k, "no se pudo registrar");
      return fallo(r.error);
    }
  }
  return { ok: true, valor: { agregadas: validas.length, rechazadas } };
}
