import "server-only";

import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { almacenamiento, bucket } from "@/lib/almacenamiento";
import { type Etiqueta, type VarianteGuardada, varianteParaMirar } from "@/lib/variantes/medidas";

/**
 * Enlaces para *mirar* una foto en el panel, no para bajarla.
 *
 * El bucket es privado: sin firma no se ve nada. La firma dura un minuto, lo que
 * alcanza para pintar la pantalla y no para pasarle el enlace a nadie.
 *
 * **Nunca apunta al original.** Es la regla anti-bypass del capítulo 12.4: si el fotógrafo
 * se lleva los originales, el adicional de descarga —que es 100% ingreso de la
 * plataforma— no se vende nunca, y un permiso no arregla eso mientras la pantalla le
 * muestre el archivo bueno. Lo que se firma es siempre una variante reducida.
 *
 * El original sale por un solo lado: adentro del ZIP que se paga.
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

/**
 * Enlaces para mirar una lista de fotos, cada una en su variante.
 *
 * Devuelve `null` en las que todavía no tienen ninguna variante generada. **Nunca cae al
 * original**: entre mostrar el archivo bueno y no mostrar nada, no se muestra nada. Cada
 * pantalla decide qué hacer con ese hueco.
 */
export async function enlacesDeVariantes(
  fotos: readonly { variants: readonly VarianteGuardada[] }[],
  quiero: Etiqueta,
  segundos: number = DURACION.panel,
): Promise<(string | null)[]> {
  return Promise.all(
    fotos.map(async (foto) => {
      const clave = varianteParaMirar(foto.variants, quiero);
      return clave ? enlaceParaMirar(clave, segundos) : null;
    }),
  );
}

/** Lo que hay que pedirle a Prisma para poder mirar una foto. */
export const SELECT_DE_VARIANTES = {
  select: { label: true, storageKey: true },
} as const;
