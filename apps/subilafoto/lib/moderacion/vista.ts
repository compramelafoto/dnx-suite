import "server-only";

import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { almacenamiento, bucket } from "@/lib/almacenamiento";

/**
 * Enlaces para *mirar* una foto en el panel, no para bajarla.
 *
 * El bucket es privado: sin firma no se ve nada. La firma dura un minuto, lo que
 * alcanza para pintar la pantalla y no para pasarle el enlace a nadie.
 *
 * **Deuda conocida:** hoy apunta al original porque todavía no se generan
 * variantes. El documento 03 dice que el profesional ve el contenido "en calidad
 * de pantalla", así que cuando exista `SubilafotoMediaVariant` esto tiene que
 * apuntar a la versión reducida. No es paranoia: la regla anti-bypass existe
 * porque si el fotógrafo se lleva los originales, el adicional de descarga —que
 * es 100% ingreso de la plataforma— no se vende nunca.
 */
/**
 * Cuánto vale una firma, según para qué es.
 *
 * No es lo mismo el panel que la pantalla del salón. En el panel el enlace se
 * usa al instante y no tiene por qué sobrevivir; la pantalla queda encendida
 * seis horas y si la firma vence a mitad de la fiesta, las fotos que el
 * navegador tenga que volver a pedir se caen.
 */
export const DURACION = {
  /** Panel de revisión: lo justo para pintar la grilla. */
  panel: 60,
  /** Álbum y pantalla del salón: lo que dura un evento, con margen. */
  proyeccion: 6 * 60 * 60,
} as const;

export async function enlaceParaMirar(
  clave: string,
  segundos: number = DURACION.panel,
): Promise<string> {
  return getSignedUrl(
    almacenamiento(),
    new GetObjectCommand({ Bucket: bucket(), Key: clave }),
    { expiresIn: segundos },
  );
}

/** Firma varias de una, que es lo que hace el panel al pintar la grilla. */
export async function enlacesParaMirar(
  claves: readonly string[],
  segundos: number = DURACION.panel,
): Promise<string[]> {
  return Promise.all(claves.map((c) => enlaceParaMirar(c, segundos)));
}
