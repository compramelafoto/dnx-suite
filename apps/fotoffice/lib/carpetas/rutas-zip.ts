/**
 * Las carpetas del ZIP de «Descargar todo» del laboratorio cuando la carpeta del trabajo tiene archivos
 * sueltos (subidos a mano): Trabajo > Tamaño > Acabado > Copias > el archivo con su nombre original,
 * como el ZIP que arma el pedido para laboratorio. Módulo PURO.
 */

const limpio = (s: string) => s.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim();
const MEDIDA = /(\d{1,3}(?:[.,]\d)?)\s?x\s?(\d{1,3}(?:[.,]\d)?)/i;

/** «Impresión en plotter 60x100» → tamaño «60x100», acabado «Impresión en plotter». Sin medida: todo es acabado. */
export function tamanoYAcabado(producto: string | null): { tamano: string; acabado: string } {
  const p = limpio(producto ?? "");
  const m = p.match(MEDIDA);
  if (!m) return { tamano: "Sin medida", acabado: p || "Trabajo" };
  const tamano = `${m[1]!.replace(",", ".")}x${m[2]!.replace(",", ".")}`;
  const acabado = limpio(p.replace(m[0], "").replace(/\s[·\-–]\s*$/, "")) || "Sin acabado";
  return { tamano, acabado };
}

export function rutasDeArchivosSueltos(d: {
  numero: string;
  cliente: string;
  producto: string | null;
  copias: number;
  archivos: { id: string; nombre: string }[];
}): { id: string; ruta: string }[] {
  const raiz = limpio(`Trabajo ${d.numero} - ${d.cliente || "Cliente"}`).slice(0, 60);
  const { tamano, acabado } = tamanoYAcabado(d.producto);
  const n = Math.max(1, Math.round(d.copias));
  const carpeta = `${raiz}/${tamano}/${acabado}/${n} ${n === 1 ? "copia" : "copias"}`;
  return d.archivos.map((a) => ({ id: a.id, ruta: `${carpeta}/${limpio(a.nombre) || "archivo"}` }));
}
