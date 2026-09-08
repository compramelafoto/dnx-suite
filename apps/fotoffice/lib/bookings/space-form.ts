import type { WeeklyHour } from "./availability";

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
  memberFreeHoursPerMonth: number;
  allowsNonMembers: boolean;
  weeklyHours: WeeklyHour[];
  compatibleWith: string[];
};

export type SpaceFormResult = { ok: true; values: SpaceFormValues } | { ok: false; error: string };

/**
 * "3.000,50" → 300050 centavos.
 *
 * Se acepta el formato que la gente escribe de verdad —con punto de miles, con coma
 * decimal, con signo pesos— porque rechazarlo obligaría a la Secretaría a aprender una
 * notación para que la computadora esté cómoda.
 */
export function parseArsToMinor(raw: string): number | null {
  const limpio = raw.replace(/[$\s]/g, "").replace(/\./g, "").replace(",", ".");
  if (limpio === "") return null;
  const numero = Number(limpio);
  if (!Number.isFinite(numero) || numero < 0) return null;
  return Math.round(numero * 100);
}

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

  const memberHourlyPriceMinor = parseArsToMinor(String(formData.get("memberHourlyPriceArs") ?? ""));
  if (memberHourlyPriceMinor === null) {
    return { ok: false, error: "El precio por hora para socios no se entiende." };
  }
  const nonMemberHourlyPriceMinor = parseArsToMinor(
    String(formData.get("nonMemberHourlyPriceArs") ?? ""),
  );
  if (nonMemberHourlyPriceMinor === null) {
    return { ok: false, error: "El precio por hora para no socios no se entiende." };
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
      memberFreeHoursPerMonth: entero(formData.get("memberFreeHoursPerMonth") as string | null, 0),
      allowsNonMembers: formData.get("allowsNonMembers") !== "off",
      weeklyHours,
      compatibleWith: formData.getAll("compatibleWith").map((v) => String(v)),
    },
  };
}
