import { GetObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "@repo/db";
import {
  deleteFotofficeR2Object,
  getFotofficeR2Bucket,
  getFotofficeR2Client,
  isFotofficeR2Configured,
  uploadToFotofficeR2,
} from "@/lib/images/r2-client";

/**
 * Miniaturas de las fotos de Trabajos.
 *
 * El sitio servía la foto original (de 200 KB a más de 1 MB) en cada tarjeta y en cada cuadro del
 * mosaico, y el dominio público de R2 (`r2.dev`) la entrega lento: con una docena de tarjetas, la
 * página de Trabajos quedaba en gris un buen rato. La miniatura es un WebP de 800 px del lado
 * largo (~60–120 KB) que vive al lado de la original, en `…/<trabajo>/miniaturas/`, así que se
 * borra junto con el trabajo. La original queda para el visor a pantalla completa.
 *
 * La key de la miniatura sale de la de la original, siempre la misma: generarla dos veces la pisa,
 * y al borrar la foto se sabe qué borrar sin guardarla aparte.
 *
 * R2 y sharp entran como dependencias para poder probarlo sin nada de eso.
 */

export const LADO_MINIATURA_PX = 800;
const CALIDAD_WEBP = 74;
const CARPETA = "miniaturas";

/** `…/<trabajo>/abc.jpg` → `…/<trabajo>/miniaturas/abc.webp`. Null si la key no sirve (sin carpeta, o ya es una miniatura). */
export function claveMiniatura(r2Key: string): string | null {
  const corte = r2Key.lastIndexOf("/");
  if (corte <= 0 || corte === r2Key.length - 1) return null;
  const carpeta = r2Key.slice(0, corte);
  if (carpeta.endsWith(`/${CARPETA}`)) return null;
  const archivo = r2Key.slice(corte + 1);
  const punto = archivo.lastIndexOf(".");
  const nombre = punto > 0 ? archivo.slice(0, punto) : archivo;
  return `${carpeta}/${CARPETA}/${nombre}.webp`;
}

/** WebP del lado largo pedido (nunca agranda), respetando la orientación EXIF. */
export async function achicarAMiniatura(bytes: Buffer, lado = LADO_MINIATURA_PX): Promise<Buffer> {
  const { default: sharp } = await import("sharp");
  return sharp(bytes)
    .rotate()
    .resize({ width: lado, height: lado, fit: "inside", withoutEnlargement: true })
    .webp({ quality: CALIDAD_WEBP })
    .toBuffer();
}

export type FotoParaMiniatura = { id: string; r2Key: string | null; tipo: string };

export type DepsMiniatura = {
  bajar: (key: string) => Promise<Buffer>;
  achicar: (bytes: Buffer) => Promise<Buffer>;
  subir: (bytes: Buffer, key: string) => Promise<{ url: string }>;
  guardar: (fotoId: string, miniaturaUrl: string) => Promise<void>;
};

export type ResultadoMiniaturas = { hechas: number; salteadas: number; fallidas: { id: string; error: string }[] };

/**
 * Genera y registra la miniatura de cada foto, de a `simultaneas` por vez. Los videos y las fotos
 * que no viven en R2 se saltean (se siguen mostrando como antes). Un error en una foto no frena
 * las demás: se devuelve en `fallidas` y esa foto sigue mostrando la original.
 */
export async function generarMiniaturas(
  fotos: FotoParaMiniatura[],
  deps: DepsMiniatura,
  simultaneas = 4,
): Promise<ResultadoMiniaturas> {
  const resultado: ResultadoMiniaturas = { hechas: 0, salteadas: 0, fallidas: [] };
  const cola = [...fotos];
  async function trabajar() {
    for (let foto = cola.shift(); foto; foto = cola.shift()) {
      const destino = foto.tipo === "FOTO" && foto.r2Key ? claveMiniatura(foto.r2Key) : null;
      if (!foto.r2Key || !destino) {
        resultado.salteadas++;
        continue;
      }
      try {
        const chica = await deps.achicar(await deps.bajar(foto.r2Key));
        const { url } = await deps.subir(chica, destino);
        await deps.guardar(foto.id, url);
        resultado.hechas++;
      } catch (err) {
        resultado.fallidas.push({ id: foto.id, error: err instanceof Error ? err.message : String(err) });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, simultaneas) }, trabajar));
  return resultado;
}

export function depsMiniaturaReales(): DepsMiniatura {
  return {
    bajar: async (key) => {
      const r = await getFotofficeR2Client().send(new GetObjectCommand({ Bucket: getFotofficeR2Bucket(), Key: key }));
      const bytes = await (r.Body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray();
      return Buffer.from(bytes);
    },
    achicar: (bytes) => achicarAMiniatura(bytes),
    subir: (bytes, key) => uploadToFotofficeR2(bytes, key, "image/webp"),
    guardar: async (fotoId, miniaturaUrl) => {
      await prisma.fotofficeTrabajoFoto.update({ where: { id: fotoId }, data: { miniaturaUrl } });
    },
  };
}

/**
 * Miniaturas de las fotos recién subidas a un trabajo. Nunca falla hacia afuera: sin miniatura la
 * foto igual se ve (la original), así que un error sólo se anota.
 */
export async function miniaturasDeFotosNuevas(workspaceId: string, trabajoId: string, keys: string[]): Promise<void> {
  if (keys.length === 0 || !isFotofficeR2Configured()) return;
  try {
    const fotos = await prisma.fotofficeTrabajoFoto.findMany({
      where: { workspaceId, trabajoId, r2Key: { in: keys }, miniaturaUrl: null },
      select: { id: true, r2Key: true, tipo: true },
    });
    const r = await generarMiniaturas(fotos, depsMiniaturaReales());
    if (r.fallidas.length > 0) console.error("[fotoffice][trabajos] miniaturas que no se pudieron generar:", r.fallidas);
  } catch (err) {
    console.error("[fotoffice][trabajos] no se pudieron generar las miniaturas:", err);
  }
}

/** Borra la miniatura de una foto que se borra. Devuelve la key si quedó colgada en R2. */
export async function borrarMiniatura(r2Key: string | null): Promise<string | null> {
  const key = r2Key ? claveMiniatura(r2Key) : null;
  if (!key) return null;
  const r = await deleteFotofficeR2Object(key).catch(() => ({ ok: false as const }));
  return r.ok ? null : key;
}
