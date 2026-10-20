/**
 * Nombres de los archivos dentro de los ZIP de descarga (etapa 7, Entrega B). Módulo aparte y sin `node:*` para
 * que lo puedan importar las reglas que también usan las pantallas del navegador (`descargas-reglas.ts`).
 */

/** Nombre seguro para dentro del ZIP: sin carpetas ni caracteres de control, con un largo razonable. Nunca vacío. */
export function nombreDentroDelZip(nombre: string, alternativo = "archivo"): string {
  const limpio = String(nombre ?? "")
    .replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, "_")
    .replace(/^[.\s]+/, "")
    .trim()
    .slice(0, 150);
  return limpio || alternativo;
}

/** Nombres sin repetirse (sin distinguir mayúsculas): el segundo "IMG_1.jpg" pasa a "IMG_1 (2).jpg". Conserva el orden. */
export function nombresUnicos(nombres: readonly string[]): string[] {
  return unicos(nombres, (n) => nombreDentroDelZip(n));
}

/**
 * Rutas con carpetas (`Pedido 8/10x15 Brillo/2 copias/foto.jpg`): cada parte se limpia como un nombre (así no
 * quedan `..` ni caracteres de control) y la ruta completa no se repite.
 */
export function rutasUnicas(rutas: readonly string[]): string[] {
  return unicos(rutas, (r) => {
    const partes = String(r ?? "").split("/").filter((p) => p.length > 0);
    return (partes.length ? partes : [""]).map((p) => nombreDentroDelZip(p)).join("/");
  });
}

function unicos(nombres: readonly string[], limpiar: (n: string) => string): string[] {
  const usados = new Set<string>();
  // Próximo número a probar por nombre base: evita recorrer desde (2) cada vez cuando hay miles de repetidos.
  const siguiente = new Map<string, number>();
  return nombres.map((original) => {
    const base = limpiar(original);
    let candidato = base;
    if (usados.has(candidato.toLowerCase())) {
      const punto = base.lastIndexOf(".");
      const cuerpo = punto > 0 ? base.slice(0, punto) : base;
      const ext = punto > 0 ? base.slice(punto) : "";
      let n = siguiente.get(base.toLowerCase()) ?? 2;
      candidato = `${cuerpo} (${n})${ext}`;
      while (usados.has(candidato.toLowerCase())) candidato = `${cuerpo} (${++n})${ext}`;
      siguiente.set(base.toLowerCase(), n + 1);
    }
    usados.add(candidato.toLowerCase());
    return candidato;
  });
}
