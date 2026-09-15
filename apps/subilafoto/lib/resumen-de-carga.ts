/**
 * Lo que el cargador anuncia mientras el invitado sube fotos.
 *
 * Es lo único que lee un lector de pantalla: la lista de archivos de abajo no está en una
 * región viva. Y también es lo único que mira alguien que dejó el teléfono apoyado y
 * vuelve dos minutos después.
 *
 * Por eso **tiene que contar las que fallaron**. "3 fotos subidas" cuando dos se cayeron
 * es una mentira que el invitado descubre al otro día, mirando el álbum.
 */

export function resumenDeCarga(items: readonly { estado: string }[]): string {
  if (items.length === 0) return "";

  const enCurso = items.some((i) => i.estado === "subiendo" || i.estado === "esperando");
  // Una repetida ya estaba subida: para el invitado es una foto que está, no un problema.
  const listas = items.filter((i) => i.estado === "listo" || i.estado === "repetida").length;

  /*
    Mientras algo sigue en curso no se habla de las que fallaron. Interrumpir a alguien por
    un error que todavía no requiere hacer nada es ruido: cuando termine, el resumen final
    lo va a decir entero.
  */
  if (enCurso) return `Subiendo… ${listas} de ${items.length} listas`;

  const fallidas = items.length - listas;
  if (fallidas === 0) {
    return listas === 1 ? "1 foto subida" : `${listas} fotos subidas`;
  }

  if (listas === 0) {
    return `No se pudo subir ninguna de las ${items.length}. Probá de nuevo.`;
  }

  const parteBuena = listas === 1 ? "1 foto subida" : `${listas} fotos subidas`;
  const parteMala =
    fallidas === 1
      ? "1 no se pudo subir: probá de nuevo con esa."
      : `${fallidas} no se pudieron subir: probá de nuevo con esas.`;

  return `${parteBuena}. ${parteMala}`;
}
