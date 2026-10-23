/**
 * El texto largo de un curso, como lo escribe el dueño, convertido en bloques para mostrar.
 * Puro: sin base ni red.
 *
 * Sin editor de formato: alcanza con escribir como en un mensaje. Un renglón que empieza con
 * «•», «-» o «*» es un punto de una lista; un renglón corto que termina en «:» es un subtítulo
 * («Qué vas a aprender:»); el resto son párrafos, separados por renglones en blanco.
 */
export type BloqueDeVenta =
  | { tipo: "subtitulo"; texto: string }
  | { tipo: "parrafo"; texto: string }
  | { tipo: "lista"; items: string[] };

const VINETA = /^\s*[•\-*]\s+/;

export function bloquesDeVenta(texto: string): BloqueDeVenta[] {
  const bloques: BloqueDeVenta[] = [];
  let parrafo: string[] = [];
  const cerrarParrafo = () => {
    if (parrafo.length) bloques.push({ tipo: "parrafo", texto: parrafo.join(" ") });
    parrafo = [];
  };

  for (const crudo of texto.split(/\r?\n/)) {
    const renglon = crudo.trim();
    if (!renglon) {
      cerrarParrafo();
      continue;
    }
    if (VINETA.test(renglon)) {
      cerrarParrafo();
      const item = renglon.replace(VINETA, "");
      const ultimo = bloques[bloques.length - 1];
      if (ultimo?.tipo === "lista") ultimo.items.push(item);
      else bloques.push({ tipo: "lista", items: [item] });
      continue;
    }
    if (renglon.endsWith(":") && renglon.length <= 60 && parrafo.length === 0) {
      bloques.push({ tipo: "subtitulo", texto: renglon.slice(0, -1) });
      continue;
    }
    parrafo.push(renglon);
  }
  cerrarParrafo();
  return bloques;
}
