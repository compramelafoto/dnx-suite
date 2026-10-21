import { ENCABEZADO_CSV, MAX_FILAS_CSV } from "./constantes";
import { normalizarNumero, type FilaImportada } from "./esquema";

/** Plantilla descargable: el encabezado y una fila de ejemplo. */
export const PLANTILLA_CSV = `${ENCABEZADO_CSV}\n7790000000001;K305;Kit Kodak 305 6R;2;kit;640;120000;21;INSUMO\n`;

/** Texto fijo para pedirle a cualquier asistente de IA que convierta una factura en la plantilla. */
export const PROMPT_EXTERNO = `Te paso una factura, remito o lista de precios de un comercio fotográfico argentino. Devolvé SOLAMENTE un CSV, sin explicaciones ni texto antes o después, con este encabezado exacto en la primera línea:

${ENCABEZADO_CSV}

Reglas:
- Separador punto y coma (;).
- Una fila por artículo.
- Decimales con coma (por ejemplo 1234,50).
- No incluyas totales, envíos, descuentos generales ni renglones que no sean artículos.
- Si un dato no figura en el documento, dejá el campo vacío. No inventes códigos ni precios.
- cantidad es lo comprado tal como dice el documento; si el artículo viene en cajas o packs de N unidades, poné N en unidades_por_paquete.
- costo_unitario tal como figura; alicuota_iva es el porcentaje (por ejemplo 21).
- tipo: INSUMO o PRODUCTO si se nota; si no, vacío.`;

const COLUMNAS = ENCABEZADO_CSV.split(";");

/** Parte el texto en filas de celdas respetando comillas dobles (con separador o salto de línea adentro). */
function partir(texto: string, sep: string): string[][] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = "";
  let entre = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (entre) {
      if (c === '"') {
        if (texto[i + 1] === '"') {
          celda += '"';
          i++;
        } else entre = false;
      } else celda += c;
    } else if (c === '"') {
      entre = true;
    } else if (c === sep) {
      fila.push(celda);
      celda = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      fila.push(celda);
      filas.push(fila);
      fila = [];
      celda = "";
    } else celda += c;
  }
  if (celda !== "" || fila.length > 0) {
    fila.push(celda);
    filas.push(fila);
  }
  return filas;
}

const vacia = (f: string[]) => f.every((c) => c.trim() === "");
const ELIGE_ENCABEZADO = "El archivo no tiene el encabezado de la plantilla.";

/** Saca las líneas de cierre ``` o ```csv que ponen los asistentes de IA alrededor del CSV. */
function sinCercos(texto: string): string {
  const lineas = texto.split(/\r\n|\n|\r/);
  while (lineas.length && lineas[0].trim() === "") lineas.shift();
  while (lineas.length && lineas[lineas.length - 1].trim() === "") lineas.pop();
  if (lineas.length && /^```\w*\s*$/.test(lineas[0].trim())) lineas.shift();
  if (lineas.length && /^```\s*$/.test(lineas[lineas.length - 1].trim())) lineas.pop();
  return lineas.join("\n");
}

const TIPOS = ["INSUMO", "PRODUCTO"];

export function leerCsv(
  texto: string,
): { ok: true; filas: FilaImportada[] } | { ok: false; error: string } {
  const limpio = sinCercos(texto.replace(/^\uFEFF/, ""));
  if ((limpio.match(/"/g)?.length ?? 0) % 2 === 1) {
    return { ok: false, error: "El archivo tiene comillas sin cerrar." };
  }
  const primera = limpio.split(/\r\n|\n|\r/).find((l) => l.trim() !== "") ?? "";
  const sep = primera.split(";").length >= primera.split(",").length ? ";" : ",";

  const todas = partir(limpio, sep);
  const iEnc = todas.findIndex((f) => !vacia(f));
  if (iEnc === -1) return { ok: false, error: ELIGE_ENCABEZADO };
  const enc = todas[iEnc].map((c) => c.trim().toLowerCase());
  while (enc.length > COLUMNAS.length && enc[enc.length - 1] === "") enc.pop();
  if (enc.length !== COLUMNAS.length || enc.some((c, i) => c !== COLUMNAS[i])) {
    return { ok: false, error: ELIGE_ENCABEZADO };
  }

  const datos = todas.slice(iEnc + 1);
  const conContenido = datos.filter((f) => !vacia(f));
  if (conContenido.length > MAX_FILAS_CSV) {
    return { ok: false, error: `El archivo tiene más de ${MAX_FILAS_CSV} filas.` };
  }

  const filas: FilaImportada[] = [];
  for (let i = 0; i < datos.length; i++) {
    const c = datos[i];
    if (vacia(c)) continue;
    if (c.slice(COLUMNAS.length).some((x) => x.trim() !== "")) {
      return { ok: false, error: `La fila ${iEnc + i + 2} tiene más columnas que la plantilla.` };
    }
    const g = (k: number) => (c[k] ?? "").trim();
    // `escribirCsv` antepone ' a lo que una planilla tomaría por fórmula: al leer se saca.
    const t = (k: number) => g(k).replace(/^'(?=[=+\-@])/, "");
    const texto_o_nulo = (k: number) => t(k) || null;
    const num = (k: number) => (g(k) === "" ? null : normalizarNumero(g(k)));

    const cantidad = num(3);
    // Número de fila como lo ve la persona en la planilla (el encabezado es la fila 1).
    if (cantidad === null) {
      return { ok: false, error: `La fila ${iEnc + i + 2} tiene una cantidad que no se entiende.` };
    }
    const upp = num(5);
    filas.push({
      codigo_barras: texto_o_nulo(0),
      codigo_proveedor: texto_o_nulo(1),
      descripcion: t(2),
      cantidad,
      unidad: texto_o_nulo(4),
      unidades_por_paquete: upp === null ? null : Math.round(upp),
      costo_unitario: num(6),
      alicuota_iva: num(7),
      subtotal: null,
      tipo: TIPOS.includes(g(8).toUpperCase()) ? g(8).toUpperCase() : null,
    });
  }
  return { ok: true, filas };
}

const num = (n: number | null) => (n === null ? "" : String(n).replace(".", ","));
const campo = (t: string | null | undefined) => {
  let s = t ?? "";
  // Evita que una planilla lo interprete como fórmula.
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Escribe las filas con la plantilla (separador `;`, decimales con coma). */
export function escribirCsv(filas: FilaImportada[]): string {
  const lineas = filas.map((f) =>
    [
      campo(f.codigo_barras),
      campo(f.codigo_proveedor),
      campo(f.descripcion),
      num(f.cantidad),
      campo(f.unidad),
      num(f.unidades_por_paquete),
      num(f.costo_unitario),
      num(f.alicuota_iva),
      campo(f.tipo),
    ].join(";"),
  );
  return [ENCABEZADO_CSV, ...lineas].join("\n") + "\n";
}
