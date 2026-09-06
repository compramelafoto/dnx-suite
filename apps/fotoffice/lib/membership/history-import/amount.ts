/**
 * De un importe escrito a mano a centavos enteros.
 *
 * Es el punto más peligroso de toda la importación: confundir el separador de miles con el
 * de decimales registra un pago mil veces más grande o más chico que el real. Por eso la
 * regla es fija y no adivina nada.
 *
 * **La regla.** El último punto o coma del texto es decimal si lo siguen exactamente dos
 * dígitos, y separador de miles si lo siguen exactamente tres. Cualquier otra cosa es un
 * error, no una interpretación: `15.0000` no se resuelve, se rechaza.
 *
 * `1500` → 150000 · `15000.50` → 1500050 · `15.000,50` → 1500050 · `15.000` → 1500000
 *
 * Módulo PURO.
 */

export type AmountParse =
  | { ok: true; minor: number }
  | { ok: false; error: string };

export function parseAmountToMinor(raw: string): AmountParse {
  const texto = raw.trim().replace(/\s/g, "");
  if (texto === "") return { ok: false, error: "Falta el importe." };

  // Se rechaza el signo de moneda en vez de limpiarlo: la columna se pidió sin símbolo, y
  // limpiar en silencio esconde que la planilla no tiene el formato que se pidió.
  if (!/^-?[\d.,]+$/.test(texto)) {
    return { ok: false, error: `Importe inválido: «${raw.trim()}». Escribilo sin símbolos, por ejemplo 15000.50.` };
  }
  if (texto.startsWith("-")) {
    return { ok: false, error: "El importe no puede ser negativo. Un pago que se anuló no se importa." };
  }

  const ultimoPunto = texto.lastIndexOf(".");
  const ultimaComa = texto.lastIndexOf(",");
  const corte = Math.max(ultimoPunto, ultimaComa);

  let entero: string;
  let decimales: string;

  if (corte === -1) {
    entero = texto;
    decimales = "00";
  } else {
    const cola = texto.slice(corte + 1);
    if (cola.length === 2) {
      entero = texto.slice(0, corte);
      decimales = cola;
    } else if (cola.length === 3) {
      // Separador de miles: no hay decimales declarados.
      entero = texto;
      decimales = "00";
    } else {
      return {
        ok: false,
        error: `No podemos interpretar el importe «${raw.trim()}»: después del último punto o coma tiene que haber dos dígitos (decimales) o tres (miles).`,
      };
    }
  }

  const soloDigitos = entero.replace(/[.,]/g, "");
  if (soloDigitos === "" || !/^\d+$/.test(soloDigitos)) {
    return { ok: false, error: `Importe inválido: «${raw.trim()}».` };
  }

  const minor = Number(soloDigitos) * 100 + Number(decimales);
  if (!Number.isSafeInteger(minor)) {
    return { ok: false, error: `El importe «${raw.trim()}» es demasiado grande.` };
  }
  if (minor === 0) {
    return { ok: false, error: "El importe tiene que ser mayor que cero." };
  }
  return { ok: true, minor };
}
