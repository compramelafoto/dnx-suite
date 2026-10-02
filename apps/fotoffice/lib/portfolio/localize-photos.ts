import "server-only";
import { prisma } from "@repo/db";
import {
  generateFotofficeR2Key,
  getFotofficeR2PublicUrl,
  isFotofficeR2Configured,
  uploadToFotofficeR2,
} from "@/lib/images/r2-client";
import { FOTOFFICE_R2_PREFIXES } from "@/lib/images/r2-key-policy";
import { sniffImageFormat } from "@/lib/images/validation";
import {
  MARCA_EXTERNA,
  direccionDeOrigen,
  nombreDeArchivo,
  pendientesRestantes,
} from "./localize-photos-core";

/**
 * Trae a nuestro bucket las fotos del portfolio que todavía viven en el servidor del sitio viejo.
 *
 * ── Por qué existe ──
 *
 * La migración del sitio anterior de SFPR cargó la obra de siete socios apuntando a las fotos
 * donde estaban, en el CDN de Alboom. Así se vieron bien desde el primer minuto y nadie tuvo que
 * volver a subir nada. El precio es que esas fotos no son nuestras: el día que la institución deje
 * de pagar ese sitio, o que Alboom cambie una dirección, el portfolio se vacía solo.
 *
 * ── Por qué corre en el servidor y no en una máquina ──
 *
 * Subir a R2 exige las claves de escritura, y en Vercel están marcadas como sensibles: no se
 * pueden volver a leer. La app desplegada, en cambio, **ya las tiene en su entorno**. Haciendo el
 * realojado acá, las claves nunca salen de Vercel y no hace falta emitir un token nuevo.
 *
 * ── Por tandas ──
 *
 * Cada foto se baja entera y se sube entera, y una función del servidor tiene un tiempo máximo.
 * Quien llama repite hasta que no queden pendientes.
 */

/** Techo por foto. Es el mismo del preset `memberPortfolioPhoto`: lo que no entraría subiendo a mano, tampoco acá. */
const MAX_BYTES = 10 * 1024 * 1024;

/** Si el origen no contesta en 20 segundos, es mejor dejarla para la próxima tanda que agotar la función. */
const ESPERA_MS = 20_000;

export type PortfolioLocalizeReport = {
  traidas: number;
  fallidas: { url: string; motivo: string }[];
  pendientes: number;
  /** `false` cuando faltan las variables R2_*: sin eso no hay nada que intentar. */
  r2Configurado: boolean;
};

/** Cuántas fotos de este workspace siguen alojadas afuera. */
export async function countExternalPortfolioPhotos(workspaceId: string): Promise<number> {
  return prisma.fotofficeMemberPortfolioPhoto.count({
    where: { r2Key: { startsWith: MARCA_EXTERNA }, portfolio: { workspaceId } },
  });
}

async function bajar(url: string): Promise<{ bytes: Uint8Array; tipo: string }> {
  const res = await fetch(url, { signal: AbortSignal.timeout(ESPERA_MS), redirect: "follow" });
  if (!res.ok) throw new Error(`el origen respondió ${res.status}`);

  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength === 0) throw new Error("llegó vacía");
  if (bytes.byteLength > MAX_BYTES) throw new Error("pesa más de 10 MB");

  // Se decide por la firma binaria, no por el `Content-Type` que declara el otro servidor: es el
  // mismo criterio con el que se verifica una subida directa, y por las mismas razones.
  const tipo = sniffImageFormat(bytes);
  if (!tipo) throw new Error("no es un JPG, PNG ni WebP");

  return { bytes, tipo };
}

/**
 * Copia una tanda y deja cada foto apuntando a la copia.
 *
 * Es seguro repetirlo: busca sólo las que siguen marcadas como externas, y cada una que logra
 * traer deja de estarlo. Una que falla queda marcada y se reintenta en la tanda siguiente.
 *
 * **No se revalidan las medidas.** Estas fotos ya estaban publicadas en el sitio viejo; aplicarles
 * el mínimo de 1000 px del preset ahora rechazaría obra que ya está a la vista, que es justo lo
 * contrario de lo que este realojado tiene que hacer.
 */
export async function localizePortfolioPhotos(
  workspaceId: string,
  opts: { limit?: number } = {},
): Promise<PortfolioLocalizeReport> {
  if (!isFotofficeR2Configured()) {
    return { traidas: 0, fallidas: [], pendientes: 0, r2Configurado: false };
  }

  const limite = opts.limit ?? 8;
  const totalAntes = await countExternalPortfolioPhotos(workspaceId);

  const tanda = await prisma.fotofficeMemberPortfolioPhoto.findMany({
    where: { r2Key: { startsWith: MARCA_EXTERNA }, portfolio: { workspaceId } },
    select: { id: true, r2Key: true },
    orderBy: { createdAt: "asc" },
    take: limite,
  });

  const fallidas: PortfolioLocalizeReport["fallidas"] = [];
  let traidas = 0;

  for (const foto of tanda) {
    const origen = direccionDeOrigen(foto.r2Key);
    if (!origen) {
      fallidas.push({ url: foto.r2Key, motivo: "la marca no tiene dirección de origen" });
      continue;
    }

    try {
      const { bytes, tipo } = await bajar(origen);
      const key = generateFotofficeR2Key(
        nombreDeArchivo(origen),
        `${FOTOFFICE_R2_PREFIXES.memberPortfolioPhoto}/${workspaceId}`,
      );
      await uploadToFotofficeR2(Buffer.from(bytes), key, tipo, { origen: "realojado" });

      // Recién acá deja de ser externa. Si la subida falló, la fila queda intacta y se reintenta.
      await prisma.fotofficeMemberPortfolioPhoto.update({
        where: { id: foto.id },
        data: {
          r2Key: key,
          url: getFotofficeR2PublicUrl(key),
          contentType: tipo,
          sizeBytes: bytes.byteLength,
        },
      });
      traidas += 1;
    } catch (error) {
      fallidas.push({ url: origen, motivo: error instanceof Error ? error.message : String(error) });
    }
  }

  return {
    traidas,
    fallidas,
    pendientes: pendientesRestantes(totalAntes, traidas, fallidas.length),
    r2Configurado: true,
  };
}
