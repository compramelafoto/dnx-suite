/**
 * Cómo se encuaderna una plantilla de librito para mostrarla hoja por hoja.
 *
 * La plantilla guarda pliegos dobles: la cara 0 es el pliego exterior (contratapa a la
 * izquierda, tapa a la derecha, como se imprime una tapa envolvente) y cada cara siguiente es un
 * pliego interior abierto (página izquierda y derecha). El doblez va al medio del lienzo.
 *
 * Una hoja del libro tiene frente y dorso: el frente de la primera es la tapa y su dorso la
 * primera página interior izquierda; el dorso de la última es la contratapa.
 */

export type BookHalf = "left" | "right";
export type BookFace = { pageIndex: number; half: BookHalf };
export type BookLeaf = { front: BookFace; back: BookFace };

/** Es un librito si tiene tapa más al menos un interior, y cada cara es un pliego apaisado. */
export function isBookTemplate(input: { pageCount: number; canvas: { width: number; height: number } }): boolean {
  const width = Number(input.canvas.width) || 0;
  const height = Number(input.canvas.height) || 0;
  return input.pageCount >= 2 && width > height;
}

export function bookLeaves(pageCount: number): BookLeaf[] {
  if (pageCount < 2) return [];
  const faces: BookFace[] = [{ pageIndex: 0, half: "right" }];
  for (let page = 1; page < pageCount; page++) {
    faces.push({ pageIndex: page, half: "left" }, { pageIndex: page, half: "right" });
  }
  faces.push({ pageIndex: 0, half: "left" });
  const leaves: BookLeaf[] = [];
  for (let i = 0; i < faces.length; i += 2) leaves.push({ front: faces[i], back: faces[i + 1] });
  return leaves;
}

/**
 * Qué se ve con `flipped` hojas dadas vuelta: el nombre para el contador del visor.
 * Las páginas interiores se numeran de corrido desde 1.
 */
export function bookSpreadLabel(flipped: number, leafCount: number): string {
  if (flipped <= 0) return "Tapa";
  if (flipped >= leafCount) return "Contratapa";
  return `Páginas ${flipped * 2 - 1} y ${flipped * 2}`;
}
