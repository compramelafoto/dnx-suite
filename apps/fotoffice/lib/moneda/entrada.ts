/**
 * Lo que necesita el campo de moneda (`InputMoneda`) para mostrar "200.000,50" mientras la gente
 * escribe y, al mismo tiempo, entregarle al resto del sistema el número sin adornos.
 *
 * Hay dos textos:
 *  - el que se ve: punto de miles y coma decimal ("200.000,50");
 *  - el que se envía: sin separador de miles y con el decimal que espera quien lo lee
 *    ("200000,50" para los parsers argentinos como `parseArsToMinor`, "200000.50" para los que
 *    usan `Number(...)`).
 */

export type SeparadorEnvio = "coma" | "punto";

/** Un importe partido en su parte entera (sólo dígitos) y su parte decimal (null si no hay coma). */
export type ImporteEnPartes = { entero: string; decimal: string | null };

const VACIO: ImporteEnPartes = { entero: "", decimal: null };

function soloDigitos(s: string): string {
  return s.replace(/\D/g, "");
}

/** Saca ceros a la izquierda sin dejar la parte entera vacía si había un cero ("007" → "7", "0" → "0"). */
function sinCerosIniciales(entero: string): string {
  const s = entero.replace(/^0+(?=\d)/, "");
  return s;
}

/**
 * Lo que escribió la persona en el campo visible → partes.
 * El punto es separador de miles y se ignora; la coma separa los decimales. Si la persona escribe
 * un punto al final (como en la calculadora), se toma como coma: `InputMoneda` lo resuelve antes
 * de llamar acá con `puntoFinalEsComa`.
 */
export function leerEscrito(texto: string, decimales: boolean, puntoFinalEsComa = false): ImporteEnPartes {
  let t = texto.replace(/[$\s]/g, "");
  if (puntoFinalEsComa && decimales && !t.includes(",") && t.endsWith(".")) t = `${t.slice(0, -1)},`;
  const i = t.indexOf(",");
  if (i === -1 || !decimales) return { entero: sinCerosIniciales(soloDigitos(i === -1 ? t : t.slice(0, i))), decimal: null };
  const entero = sinCerosIniciales(soloDigitos(t.slice(0, i)));
  const decimal = soloDigitos(t.slice(i + 1)).slice(0, 2);
  return { entero: entero === "" ? "0" : entero, decimal };
}

/**
 * Un valor que llega desde afuera (base de datos, estado del formulario) → partes.
 * Acepta tanto "200000.50" / 200000.5 (formato de máquina) como "200.000,50" / "47.000"
 * (formato argentino). "1.500" con tres dígitos tras el punto se lee como miles.
 */
export function leerValor(valor: string | number | null | undefined, decimales: boolean): ImporteEnPartes {
  if (valor === null || valor === undefined) return VACIO;
  if (typeof valor === "number") {
    if (!Number.isFinite(valor)) return VACIO;
    valor = String(Math.abs(valor));
  }
  const t = valor.replace(/[$\s]/g, "");
  if (t === "") return VACIO;
  if (t.includes(",")) return leerEscrito(t, decimales);
  const maquina = /^(\d+)\.(\d{1,2})$/.exec(t);
  if (maquina) {
    if (!decimales) return { entero: sinCerosIniciales(maquina[1]), decimal: null };
    return { entero: sinCerosIniciales(maquina[1]), decimal: maquina[2] };
  }
  return { entero: sinCerosIniciales(soloDigitos(t)), decimal: null };
}

/** "200000" → "200.000". */
export function conPuntoDeMiles(entero: string): string {
  return entero.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Partes → lo que se ve en el campo ("200.000,5" mientras escribe; la coma sola también se respeta). */
export function textoVisible(p: ImporteEnPartes): string {
  if (p.entero === "" && p.decimal === null) return "";
  const entero = conPuntoDeMiles(p.entero === "" ? "0" : p.entero);
  return p.decimal === null ? entero : `${entero},${p.decimal}`;
}

/** Partes → lo que se envía ("200000,5" o "200000.5"). Vacío si no hay número. */
export function textoEnvio(p: ImporteEnPartes, separador: SeparadorEnvio): string {
  if (p.entero === "" && p.decimal === null) return "";
  const entero = p.entero === "" ? "0" : p.entero;
  if (p.decimal === null || p.decimal === "") return entero;
  return `${entero}${separador === "coma" ? "," : "."}${p.decimal}`;
}

/**
 * Dónde dejar el cursor después de reformatear: la misma cantidad de dígitos (y coma) a su
 * izquierda que había antes. Así, borrar o escribir en el medio no tira el cursor al final.
 */
export function posicionCursor(visibleNuevo: string, significativosAntes: number): number {
  if (significativosAntes <= 0) return 0;
  let vistos = 0;
  for (let i = 0; i < visibleNuevo.length; i++) {
    if (/[\d,]/.test(visibleNuevo[i])) vistos++;
    if (vistos === significativosAntes) return i + 1;
  }
  return visibleNuevo.length;
}

/** Cuántos dígitos y comas hay antes de la posición `pos` del texto. */
export function significativosAntesDe(texto: string, pos: number): number {
  return (texto.slice(0, pos).match(/[\d,]/g) ?? []).length;
}
