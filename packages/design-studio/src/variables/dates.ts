import type { DateFormatId } from "./contract";

/**
 * Formateo propio a partir de componentes UTC.
 *
 * No se usa `toLocaleDateString` ni `Intl`: el resultado dependería de la zona horaria y de
 * los datos de localización del servidor que corra el render. Una pieza emitida hoy en Vercel
 * y reproducida mañana en otra máquina tiene que dar el mismo archivo.
 */

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
] as const;

function dosDigitos(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function formatDateUtc(date: Date, formato: DateFormatId): string {
  const dia = date.getUTCDate();
  const mes = date.getUTCMonth();
  const anio = date.getUTCFullYear();

  if (formato === "iso") {
    return `${anio}-${dosDigitos(mes + 1)}-${dosDigitos(dia)}`;
  }
  if (formato === "es-AR-long") {
    return `${dia} de ${MESES[mes] ?? ""} de ${anio}`;
  }
  return `${dosDigitos(dia)}/${dosDigitos(mes + 1)}/${anio}`;
}

/**
 * Acepta un Date o una fecha en texto. Para el texto solo se admite `AAAA-MM-DD` o un ISO
 * completo: cualquier otro formato es ambiguo (03/04 puede ser marzo o abril) y se rechaza.
 */
export function parseDateUtc(valor: string | Date): Date | null {
  if (valor instanceof Date) {
    return Number.isNaN(valor.getTime()) ? null : valor;
  }
  const texto = valor.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    const d = new Date(`${texto}T00:00:00.000Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (/^\d{4}-\d{2}-\d{2}T/.test(texto)) {
    const d = new Date(texto);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}
