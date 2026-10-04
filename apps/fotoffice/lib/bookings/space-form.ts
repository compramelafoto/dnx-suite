import type { WeeklyHour } from "./availability";
import type { PricingMode } from "./pricing";

// Se reexporta porque `lib/bookings/extra-form.ts` importa `parseArsToMinor` desde acá, y
// `parseSpaceForm` (más abajo) también lo usa: un `export ... from` puro no deja un
// identificador local, así que hace falta importarlo además de reexportarlo.
import { parseArsToMinor } from "@/lib/membership/money";
export { parseArsToMinor };

/**
 * Validación del formulario de un espacio. Módulo PURO: sin base y sin red.
 *
 * Vive fuera de la acción del servidor para poder probar las reglas —incluidas las de la
 * grilla, que son las que más se equivocan— sin levantar Next ni tocar la base.
 */

export type SpaceFormValues = {
  name: string;
  description: string | null;
  slotMinutes: number;
  minBookingMinutes: number;
  maxBookingMinutes: number | null;
  bufferMinutes: number;
  minAdvanceHours: number;
  maxAdvanceDays: number;
  requiresApproval: boolean;
  memberHourlyPriceMinor: number;
  nonMemberHourlyPriceMinor: number;
  pricingMode: PricingMode;
  /** Con `BLOCK`: minutos del bloque, o `null` = precio plano por jornada. */
  blockMinutes: number | null;
  memberBlockPriceMinor: number;
  nonMemberBlockPriceMinor: number;
  memberFreeHoursPerMonth: number;
  allowsNonMembers: boolean;
  weeklyHours: WeeklyHour[];
  compatibleWith: string[];
};

export type SpaceFormResult = { ok: true; values: SpaceFormValues } | { ok: false; error: string };

function entero(raw: string | null, porDefecto: number): number {
  const n = Number((raw ?? "").trim());
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : porDefecto;
}

/** "09:00" → 540. Devuelve null si no es una hora. */
function minutoDelDia(texto: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(texto.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 24 || min > 59) return null;
  return h * 60 + min;
}

export function parseSpaceForm(formData: FormData): SpaceFormResult {
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) return { ok: false, error: "Poné un nombre para el espacio." };

  const pricingMode: PricingMode = formData.get("pricingMode") === "BLOCK" ? "BLOCK" : "HOURLY";
  const porBloque = pricingMode === "BLOCK";

  // Un precio que no se usa en el modo elegido puede quedar vacío: vale cero.
  const precio = (campo: string): number | null => {
    const crudo = String(formData.get(campo) ?? "").trim();
    return crudo === "" ? 0 : parseArsToMinor(crudo);
  };

  const memberHourlyPriceMinor = porBloque
    ? (precio("memberHourlyPriceArs") ?? 0)
    : parseArsToMinor(String(formData.get("memberHourlyPriceArs") ?? ""));
  if (memberHourlyPriceMinor === null) {
    return { ok: false, error: "El precio por hora para {personas} no se entiende." };
  }
  const nonMemberHourlyPriceMinor = porBloque
    ? (precio("nonMemberHourlyPriceArs") ?? 0)
    : parseArsToMinor(String(formData.get("nonMemberHourlyPriceArs") ?? ""));
  if (nonMemberHourlyPriceMinor === null) {
    return { ok: false, error: "El precio por hora para no {personas} no se entiende." };
  }

  const memberBlockPriceMinor = porBloque
    ? parseArsToMinor(String(formData.get("memberBlockPriceArs") ?? ""))
    : (precio("memberBlockPriceArs") ?? 0);
  if (memberBlockPriceMinor === null) {
    return { ok: false, error: "El precio del bloque para {personas} no se entiende." };
  }
  const nonMemberBlockPriceMinor = porBloque
    ? parseArsToMinor(String(formData.get("nonMemberBlockPriceArs") ?? ""))
    : (precio("nonMemberBlockPriceArs") ?? 0);
  if (nonMemberBlockPriceMinor === null) {
    return { ok: false, error: "El precio del bloque para no {personas} no se entiende." };
  }

  const slotMinutes = entero(formData.get("slotMinutes") as string | null, 60);
  if (slotMinutes <= 0) return { ok: false, error: "La grilla tiene que ser mayor que cero." };

  const minBookingMinutes = entero(formData.get("minBookingMinutes") as string | null, slotMinutes);
  if (minBookingMinutes <= 0 || minBookingMinutes % slotMinutes !== 0) {
    return { ok: false, error: "La duración mínima tiene que ser múltiplo de la grilla." };
  }

  const maxCrudo = String(formData.get("maxBookingMinutes") ?? "").trim();
  const maxBookingMinutes = maxCrudo === "" ? null : entero(maxCrudo, 0);
  if (maxBookingMinutes !== null && maxBookingMinutes < minBookingMinutes) {
    return { ok: false, error: "La duración máxima no puede ser menor que la mínima." };
  }

  // Vacío = un solo bloque por reserva, la "jornada".
  const bloqueCrudo = String(formData.get("blockMinutes") ?? "").trim();
  const blockMinutes = !porBloque || bloqueCrudo === "" ? null : entero(bloqueCrudo, 0);
  if (blockMinutes !== null && (blockMinutes <= 0 || blockMinutes % slotMinutes !== 0)) {
    return { ok: false, error: "El largo del bloque tiene que ser múltiplo de la grilla." };
  }

  const weeklyHours: WeeklyHour[] = [];
  for (let weekday = 0; weekday <= 6; weekday += 1) {
    // Cada recuadro puede traer varios tramos, uno por línea.
    const lineas = formData
      .getAll(`hours.${weekday}`)
      .flatMap((crudo) => String(crudo).split("\n"))
      .map((l) => l.trim())
      .filter((l) => l !== "");

    for (const texto of lineas) {
      const [desde, hasta] = texto.split("-");
      const startMinute = minutoDelDia(desde ?? "");
      const endMinute = minutoDelDia(hasta ?? "");
      if (startMinute === null || endMinute === null || endMinute <= startMinute) {
        return { ok: false, error: `Revisá el horario "${texto}": tiene que ser como 09:00-13:00.` };
      }

      // Estas dos reglas se validan acá y no al reservar porque el problema es del
      // espacio, no de quien intenta usarlo: un tramo que no arranca en la grilla no
      // ofrecería NINGÚN turno, y nadie sabría por qué.
      if (startMinute % slotMinutes !== 0) {
        return {
          ok: false,
          error: `El horario "${texto}" no arranca en la grilla de ${slotMinutes} minutos. Empezá en un múltiplo, o cambiá la grilla.`,
        };
      }
      if (endMinute - startMinute < minBookingMinutes) {
        return {
          ok: false,
          error: `El horario "${texto}" es más corto que la duración mínima de ${minBookingMinutes} minutos.`,
        };
      }

      weeklyHours.push({ weekday, startMinute, endMinute });
    }
  }
  if (weeklyHours.length === 0) {
    return {
      ok: false,
      error: "Cargá al menos un horario: sin horarios el espacio no se puede reservar.",
    };
  }

  return {
    ok: true,
    values: {
      name,
      description: String(formData.get("description") ?? "").trim() || null,
      slotMinutes,
      minBookingMinutes,
      maxBookingMinutes,
      bufferMinutes: entero(formData.get("bufferMinutes") as string | null, 0),
      minAdvanceHours: entero(formData.get("minAdvanceHours") as string | null, 2),
      maxAdvanceDays: entero(formData.get("maxAdvanceDays") as string | null, 90),
      requiresApproval: formData.get("requiresApproval") === "on",
      memberHourlyPriceMinor,
      nonMemberHourlyPriceMinor,
      pricingMode,
      blockMinutes,
      memberBlockPriceMinor,
      nonMemberBlockPriceMinor,
      memberFreeHoursPerMonth: entero(formData.get("memberFreeHoursPerMonth") as string | null, 0),
      allowsNonMembers: formData.get("allowsNonMembers") !== "off",
      weeklyHours,
      compatibleWith: formData.getAll("compatibleWith").map((v) => String(v)),
    },
  };
}
