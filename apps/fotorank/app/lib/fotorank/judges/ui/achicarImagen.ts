/**
 * Achica una foto en el navegador antes de subirla.
 *
 * Una foto de cámara profesional pesa entre 8 y 40 MB; el tope de una acción
 * de servidor en Vercel es 4,5 MB. La alternativa sería la subida directa al
 * bucket, que existe pero necesita habilitar CORS en `fotorank-private-prod`
 * —pendiente hace semanas—, así que se achica acá.
 *
 * A 2000px de lado largo una foto pesa entre 300 KB y 1 MB, y se ve impecable
 * en una ficha o una galería.
 *
 * Usa `canvas`, que trae el navegador: ninguna dependencia nueva. El lockfile
 * es de toda la suite y agregarle un paquete a una app ya rompió el build de
 * otra.
 */
export const LADO_LARGO_MAXIMO = 2000;
export const CALIDAD_JPEG = 0.85;

export type Medidas = { ancho: number; alto: number };

/** Aritmética pura, para poder probarla sin navegador. */
export function medidasDeDestino(ancho: number, alto: number): Medidas {
  if (!Number.isFinite(ancho) || !Number.isFinite(alto) || ancho <= 0 || alto <= 0) {
    return { ancho: 0, alto: 0 };
  }

  const ladoLargo = Math.max(ancho, alto);
  if (ladoLargo <= LADO_LARGO_MAXIMO) {
    return { ancho: Math.round(ancho), alto: Math.round(alto) };
  }

  const factor = LADO_LARGO_MAXIMO / ladoLargo;
  return {
    // El mínimo de 1 píxel evita que una panorámica extrema quede con altura
    // cero, que es una imagen que no se puede dibujar.
    ancho: Math.max(1, Math.round(ancho * factor)),
    alto: Math.max(1, Math.round(alto * factor)),
  };
}

export type ImagenAchicada = { archivo: File; ancho: number; alto: number };

/**
 * Devuelve la foto achicada. Si el navegador no puede, devuelve la original:
 * el servidor la rechazará con un mensaje claro si excede el tope, y eso es
 * mejor que romper la pantalla.
 */
export async function achicarImagen(archivo: File): Promise<ImagenAchicada> {
  try {
    const bitmap = await createImageBitmap(archivo);
    const medidas = medidasDeDestino(bitmap.width, bitmap.height);

    if (medidas.ancho === 0 || (medidas.ancho === bitmap.width && medidas.alto === bitmap.height)) {
      bitmap.close();
      return { archivo, ancho: bitmap.width, alto: bitmap.height };
    }

    const lienzo = document.createElement("canvas");
    lienzo.width = medidas.ancho;
    lienzo.height = medidas.alto;

    const contexto = lienzo.getContext("2d");
    if (!contexto) {
      bitmap.close();
      return { archivo, ancho: bitmap.width, alto: bitmap.height };
    }
    contexto.drawImage(bitmap, 0, 0, medidas.ancho, medidas.alto);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      lienzo.toBlob(resolve, "image/jpeg", CALIDAD_JPEG),
    );
    if (!blob) return { archivo, ancho: medidas.ancho, alto: medidas.alto };

    const nombre = archivo.name.replace(/\.[^.]+$/, "") + ".jpg";
    return {
      archivo: new File([blob], nombre, { type: "image/jpeg" }),
      ancho: medidas.ancho,
      alto: medidas.alto,
    };
  } catch {
    return { archivo, ancho: 0, alto: 0 };
  }
}
