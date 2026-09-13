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
const DURACION_DE_LA_FIRMA = 60;

export async function enlaceParaMirar(clave: string): Promise<string> {
  return getSignedUrl(
    almacenamiento(),
    new GetObjectCommand({ Bucket: bucket(), Key: clave }),
    { expiresIn: DURACION_DE_LA_FIRMA },
  );
}

/** Firma varias de una, que es lo que hace el panel al pintar la grilla. */
export async function enlacesParaMirar(claves: readonly string[]): Promise<string[]> {
  return Promise.all(claves.map(enlaceParaMirar));
}
