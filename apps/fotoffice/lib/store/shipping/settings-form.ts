import { parseArsToMinor } from "@/lib/membership/money";
import { CORREO_MAX_SIDE_CM, CORREO_MAX_WEIGHT_GRAMS, normalizePostalCode } from "./package";
import type { ShippingSource } from "./repository";
import type { Surcharge } from "./surcharge";

/**
 * El formulario de la configuración de envíos (`StoreShippingSettings`). Módulo PURO.
 *
 * Las reglas viven acá y no en el componente: una acción del servidor se puede llamar a mano y
 * tiene que quedar igual de protegida. Si Correo Argentino está conectado lo sabe la acción
 * (necesita la base), y lo pasa en `ctx.correoActive` junto con lo guardado antes (`ctx.previous`).
 *
 * - Al menos una forma de entrega activa (retiro, domicilio o sucursal).
 * - Domicilio o sucursal exigen el código postal de origen.
 * - Sucursal sólo con Correo Argentino como fuente (E9).
 * - La conexión activa se exige sólo al CAMBIAR a Correo o al PRENDER sucursal. Si ya estaba así
 *   guardado y la conexión pide reconexión, se puede seguir guardando lo demás (la cotización
 *   cae en el respaldo mientras tanto); si no, una credencial vencida bloquearía toda la pantalla.
 * - Recargo (E3): el porcentaje se escribe como "10" o "10,5" y se guarda en bps; el monto fijo
 *   se escribe en pesos y se guarda en centavos.
 */

export const MAX_HANDLING_NOTE = 300;
/** Recargo porcentual máximo: 100 % (10000 bps). */
const MAX_PERCENT_BPS = 10_000;
/** Recargo fijo máximo: $ 10.000.000. */
const MAX_FIXED_MINOR = 1_000_000_000;

export type ShippingSettingsValues = {
  pickupEnabled: boolean;
  homeDeliveryEnabled: boolean;
  branchDeliveryEnabled: boolean;
  source: ShippingSource;
  tableAsFallback: boolean;
  originPostalCode: string | null;
  surchargeKind: Surcharge["kind"];
  /** bps si es PERCENT, centavos si es FIXED, 0 si es NONE. */
  surchargeValue: number;
  packagingGrams: number;
  defaultUnitGrams: number;
  boxLengthCm: number;
  boxWidthCm: number;
  boxHeightCm: number;
  handlingNote: string | null;
};

export type ShippingSettingsFormResult =
  | { ok: true; values: ShippingSettingsValues }
  | { ok: false; error: string };

function texto(fd: FormData, campo: string): string {
  const v = fd.get(campo);
  return typeof v === "string" ? v.trim() : "";
}

/** Casilla con respaldo oculto después: `FormData.get` devuelve la primera coincidencia. */
function casilla(fd: FormData, campo: string): boolean {
  return fd.get(campo) === "on";
}

/**
 * Pesos → centavos para los importes de envíos. Igual que `parseArsToMinor` ("1.500,50",
 * "$ 1500"), salvo un caso: sin coma, un punto seguido de 1 o 2 dígitos al final es la coma
 * decimal ("3500.50" → 350050, como lo escribe mucha gente). "3.500" (punto + 3 dígitos)
 * sigue siendo separador de miles. No se toca `parseArsToMinor`, que se usa en otros módulos.
 */
export function parseShippingArsToMinor(raw: string): number | null {
  let s = raw.replace(/[$\s]/g, "");
  if (!s.includes(",") && /\.\d{1,2}$/.test(s)) {
    const i = s.lastIndexOf(".");
    s = `${s.slice(0, i).replace(/\./g, "")},${s.slice(i + 1)}`;
  }
  return parseArsToMinor(s);
}

/**
 * Qué cambiar en la configuración al desconectar Correo Argentino: fuente a la tabla y sucursal
 * apagada. Si así quedaran las tres formas de entrega apagadas, se prende el retiro.
 * `null` = no hace falta tocar nada.
 */
export function settingsAfterCorreoDisconnect(prev: {
  source: ShippingSource;
  branchDeliveryEnabled: boolean;
  pickupEnabled: boolean;
  homeDeliveryEnabled: boolean;
}): { data: { source: "TABLE"; branchDeliveryEnabled: false; pickupEnabled?: true }; pickupForced: boolean } | null {
  if (prev.source !== "CORREO_ARGENTINO" && !prev.branchDeliveryEnabled) return null;
  const pickupForced = !prev.pickupEnabled && !prev.homeDeliveryEnabled;
  return {
    data: { source: "TABLE", branchDeliveryEnabled: false, ...(pickupForced ? { pickupEnabled: true as const } : {}) },
    pickupForced,
  };
}

/** Entero escrito sólo con dígitos, dentro de [min, max]. */
function entero(raw: string, min: number, max: number): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n >= min && n <= max ? n : null;
}

/**
 * "10" → 1000, "10,5" → 1050, "7.25 %" → 725. Hasta dos decimales, coma o punto. `null` si no
 * es un número válido o es negativo. No aplica el máximo: eso lo decide quien llama.
 */
export function parsePercentToBps(raw: string): number | null {
  const limpio = raw.replace(/[%\s]/g, "").replace(",", ".");
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(limpio);
  if (!m) return null;
  const entera = Number(m[1]);
  const decimales = Number(`${m[2] ?? ""}00`.slice(0, 2));
  const bps = entera * 100 + decimales;
  return Number.isSafeInteger(bps) ? bps : null;
}

const ENTEROS = [
  ["packagingGrams", 0, CORREO_MAX_WEIGHT_GRAMS, "El peso del embalaje tiene que ser un número entero de gramos, de 0 a 25000."],
  ["defaultUnitGrams", 1, CORREO_MAX_WEIGHT_GRAMS, "El peso por unidad por defecto tiene que ser un número entero de gramos, de 1 a 25000."],
  ["boxLengthCm", 1, CORREO_MAX_SIDE_CM, "El largo de la caja tiene que ser un número entero de 1 a 150 cm."],
  ["boxWidthCm", 1, CORREO_MAX_SIDE_CM, "El ancho de la caja tiene que ser un número entero de 1 a 150 cm."],
  ["boxHeightCm", 1, CORREO_MAX_SIDE_CM, "El alto de la caja tiene que ser un número entero de 1 a 150 cm."],
] as const;

export type ShippingSettingsFormContext = {
  correoActive: boolean;
  /** Lo guardado hasta ahora, o `null` si la institución nunca guardó la configuración. */
  previous: { source: ShippingSource; branchDeliveryEnabled: boolean } | null;
};

export function parseShippingSettingsForm(
  fd: FormData,
  ctx: ShippingSettingsFormContext,
): ShippingSettingsFormResult {
  const pickupEnabled = casilla(fd, "pickupEnabled");
  const homeDeliveryEnabled = casilla(fd, "homeDeliveryEnabled");
  const branchDeliveryEnabled = casilla(fd, "branchDeliveryEnabled");
  const tableAsFallback = casilla(fd, "tableAsFallback");

  if (!pickupEnabled && !homeDeliveryEnabled && !branchDeliveryEnabled) {
    return { ok: false, error: "Dejá activa al menos una forma de entrega: retiro, domicilio o sucursal." };
  }

  const sourceRaw = texto(fd, "source");
  if (sourceRaw !== "TABLE" && sourceRaw !== "CORREO_ARGENTINO") {
    return { ok: false, error: "Elegí de dónde sale el precio del envío." };
  }
  const source: ShippingSource = sourceRaw;

  const cpCrudo = texto(fd, "originPostalCode");
  let originPostalCode: string | null = null;
  if (cpCrudo !== "") {
    originPostalCode = normalizePostalCode(cpCrudo);
    if (!originPostalCode) {
      return { ok: false, error: "El código postal de origen no es válido (son 4 números, por ejemplo 2000)." };
    }
  }
  if ((homeDeliveryEnabled || branchDeliveryEnabled) && !originPostalCode) {
    return { ok: false, error: "Para enviar a domicilio o a sucursal falta el código postal de origen." };
  }

  if (branchDeliveryEnabled && source !== "CORREO_ARGENTINO") {
    return { ok: false, error: "El envío a sucursal sólo funciona con Correo Argentino como fuente." };
  }
  const pasaACorreo = source === "CORREO_ARGENTINO" && ctx.previous?.source !== "CORREO_ARGENTINO";
  const prendeSucursal = branchDeliveryEnabled && !ctx.previous?.branchDeliveryEnabled;
  if ((pasaACorreo || prendeSucursal) && !ctx.correoActive) {
    return {
      ok: false,
      error: "Para usar Correo Argentino (y el envío a sucursal) primero conectá Correo Argentino más abajo.",
    };
  }

  const kindRaw = texto(fd, "surchargeKind");
  if (kindRaw !== "NONE" && kindRaw !== "PERCENT" && kindRaw !== "FIXED") {
    return { ok: false, error: "Elegí un tipo de recargo." };
  }
  let surchargeValue = 0;
  if (kindRaw === "PERCENT") {
    const bps = parsePercentToBps(texto(fd, "surchargeValue"));
    if (bps === null || bps > MAX_PERCENT_BPS) {
      return { ok: false, error: "El recargo en porcentaje tiene que ser un número de 0 a 100, con hasta dos decimales." };
    }
    surchargeValue = bps;
  } else if (kindRaw === "FIXED") {
    const minor = parseShippingArsToMinor(texto(fd, "surchargeValue"));
    if (minor === null || minor > MAX_FIXED_MINOR) {
      return { ok: false, error: "El recargo fijo tiene que ser un monto en pesos, por ejemplo 1500 o 1.500,50." };
    }
    surchargeValue = minor;
  }

  const numeros = {} as Record<(typeof ENTEROS)[number][0], number>;
  for (const [campo, min, max, error] of ENTEROS) {
    const n = entero(texto(fd, campo), min, max);
    if (n === null) return { ok: false, error };
    numeros[campo] = n;
  }

  const nota = texto(fd, "handlingNote");
  if (nota.length > MAX_HANDLING_NOTE) {
    return { ok: false, error: `El aviso para el comprador puede tener hasta ${MAX_HANDLING_NOTE} caracteres.` };
  }

  return {
    ok: true,
    values: {
      pickupEnabled,
      homeDeliveryEnabled,
      branchDeliveryEnabled,
      source,
      tableAsFallback,
      originPostalCode,
      surchargeKind: kindRaw,
      surchargeValue,
      ...numeros,
      handlingNote: nota || null,
    },
  };
}

/** Lo que vale sin fila guardada: los mismos defaults que el esquema de `StoreShippingSettings`. */
export const SHIPPING_SETTINGS_DEFAULTS: ShippingSettingsValues = {
  pickupEnabled: true,
  homeDeliveryEnabled: false,
  branchDeliveryEnabled: false,
  source: "TABLE",
  tableAsFallback: true,
  originPostalCode: null,
  surchargeKind: "NONE",
  surchargeValue: 0,
  packagingGrams: 0,
  defaultUnitGrams: 500,
  boxLengthCm: 30,
  boxWidthCm: 20,
  boxHeightCm: 10,
  handlingNote: null,
};

/** 1050 bps → "10,5". Para volver a mostrar en el formulario lo que se guardó. */
export function bpsToPercentText(bps: number): string {
  const entera = Math.trunc(bps / 100);
  const dec = String(Math.abs(bps % 100)).padStart(2, "0").replace(/0+$/, "");
  return dec ? `${entera},${dec}` : String(entera);
}

/** 150050 → "1500,50"; 150000 → "1500". Sin separador de miles, para editar. */
export function minorToEditableText(minor: number): string {
  const entera = Math.trunc(minor / 100);
  const cent = Math.abs(minor % 100);
  return cent === 0 ? String(entera) : `${entera},${String(cent).padStart(2, "0")}`;
}
