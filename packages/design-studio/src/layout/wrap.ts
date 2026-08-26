/**
 * Corte de líneas. Recibe la función de medida en vez de la fuente: así esta capa no depende
 * de pdf-lib y se puede probar con un medidor de mentira.
 */
export function wrapText(
  texto: string,
  anchoMax: number,
  medir: (t: string) => number,
  _maxLines: number | undefined,
): string[] {
  const lineas: string[] = [];

  for (const parrafo of texto.split("\n")) {
    const palabras = parrafo.split(/\s+/).filter(Boolean);
    if (palabras.length === 0) {
      lineas.push("");
      continue;
    }
    let actual = "";
    for (const palabra of palabras) {
      const prueba = actual ? `${actual} ${palabra}` : palabra;
      // `!actual` deja pasar una palabra sola más ancha que la caja: cortarla por la mitad
      // sería peor, y el desbordamiento se informa aparte.
      if (medir(prueba) <= anchoMax || !actual) {
        actual = prueba;
      } else {
        lineas.push(actual);
        actual = palabra;
      }
    }
    if (actual) lineas.push(actual);
  }

  if (lineas.length === 0) return [""];
  // Se devuelven TODAS las líneas, incluso si superan `maxLines`: quien llama decide qué
  // hacer con el exceso. Recortar en silencio sería el problema que este módulo viene a
  // evitar.
  return lineas;
}
