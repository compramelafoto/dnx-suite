import { recomendarRefuerzo } from "./reinforcement";
import type { CoverageSettingsShape } from "./settings";

/**
 * De una solicitud aprobada a una cobertura con sus roles.
 *
 * Función pura, sin Prisma: lo que precarga el formulario y lo que decide si conviene sumar
 * gente se prueba sin levantar una base. Quien escribe la pantalla y la acción del servidor
 * llama a estas funciones; ninguna de las dos vuelve a inventar la regla por su cuenta.
 */

export type CoberturaSugerida = {
  title: string;
  startsAt: Date;
  endsAt: Date;
  addressLine: string | null;
  city: string | null;
  /**
   * El punto viaja con la dirección.
   *
   * Si se copiara la dirección pero no el punto, la cobertura quedaría con la parte ambigua del
   * dato y sin la parte que saca la duda — que es exactamente al revés de para qué se pidió el
   * pin. La coordinación puede corregirlo en la cobertura sin tocar lo que pidió la organización.
   */
  latitude: number | null;
  longitude: number | null;
};

/**
 * Los valores por omisión del formulario de "generar cobertura".
 *
 * Copia lo que ya escribió la organización: no tiene sentido pedirle a la coordinación que
 * vuelva a tipear el título, las fechas o el lugar de una actividad que ya está aprobada. Las
 * instrucciones (`Coverage.instructions`) no se sugieren: no hay ningún campo equivalente en la
 * solicitud del que copiarlas sin inventar contenido.
 */
export function sugerirCobertura(solicitud: {
  eventTitle: string;
  startsAt: Date;
  endsAt: Date;
  addressLine: string | null;
  city: string | null;
  latitude?: number | null;
  longitude?: number | null;
}): CoberturaSugerida {
  return {
    title: solicitud.eventTitle,
    startsAt: solicitud.startsAt,
    endsAt: solicitud.endsAt,
    addressLine: solicitud.addressLine,
    city: solicitud.city,
    latitude: solicitud.latitude ?? null,
    longitude: solicitud.longitude ?? null,
  };
}

export type RolSugerido = {
  name: string;
  vacancies: number;
};

const FOTOGRAFO_PRINCIPAL = "Fotógrafo principal";
const SEGUNDO_FOTOGRAFO = "Segundo fotógrafo";

/**
 * Qué roles proponer, a partir de cuántos fotógrafos pidió la organización y de si la duración
 * amerita refuerzo aunque haya pedido uno solo.
 *
 * Dos fotógrafos pedidos son dos roles, no un rol con dos vacantes: "Fotógrafo principal" y
 * "Segundo fotógrafo" son responsabilidades distintas dentro de la cobertura (ver el vocabulario
 * de la etapa en el plan), aunque después cada uno tenga una sola vacante. Si se piden tres o
 * más, el excedente se acumula en "Segundo fotógrafo" en vez de inventar un tercer nombre de rol
 * que nadie pidió.
 */
export function sugerirRoles(
  solicitud: { requestedPhotographers: number | null; startsAt: Date; endsAt: Date },
  settings: CoverageSettingsShape,
): RolSugerido[] {
  const pedidos = solicitud.requestedPhotographers ?? 1;

  if (pedidos >= 2) {
    return [
      { name: FOTOGRAFO_PRINCIPAL, vacancies: 1 },
      { name: SEGUNDO_FOTOGRAFO, vacancies: Math.max(1, pedidos - 1) },
    ];
  }

  // Pidieron uno solo: igual se propone el refuerzo si la duración supera el umbral del
  // workspace. `recomendarRefuerzo` es la misma función que ya usa la ficha de la solicitud
  // para el aviso — acá no se repite el umbral, se reutiliza la regla.
  const durationMinutes = Math.round(
    (solicitud.endsAt.getTime() - solicitud.startsAt.getTime()) / 60000,
  );
  const refuerzo = recomendarRefuerzo({ durationMinutes, assigned: pedidos, settings });

  return refuerzo
    ? [
        { name: FOTOGRAFO_PRINCIPAL, vacancies: 1 },
        { name: SEGUNDO_FOTOGRAFO, vacancies: 1 },
      ]
    : [{ name: FOTOGRAFO_PRINCIPAL, vacancies: 1 }];
}

export type PlanGenerarCobertura = { ok: true } | { ok: false; error: string };

/**
 * Los controles antes de escribir la cobertura, en el mismo espíritu que `planStatusChange`:
 * primero la pertenencia al workspace, después el estado de la solicitud, y recién ahí la forma
 * de los roles.
 *
 * Solo se genera desde una solicitud `APROBADA`. La solicitud no cambia de estado al generar
 * una cobertura —puede generar varias, una jornada de dos turnos son dos— así que esta función
 * no valida "que todavía no tenga cobertura", que no es una regla que exista.
 */
export function planGenerarCobertura(input: {
  solicitud: { id: string; workspaceId: string; status: string } | null;
  workspaceId: string;
  roles: { name: string; vacancies: number }[];
}): PlanGenerarCobertura {
  if (!input.solicitud || input.solicitud.workspaceId !== input.workspaceId) {
    return { ok: false, error: "No encontramos esa solicitud." };
  }
  if (input.solicitud.status !== "APROBADA") {
    return {
      ok: false,
      error: "Solo se puede generar una cobertura desde una solicitud aprobada.",
    };
  }
  // `Number.isInteger` y no sólo `> 0`: quien llama arma las vacantes con `Number(...)` sobre un
  // campo del formulario, y un texto que no es un número da `NaN`. `NaN <= 0` es `false`, así
  // que sin este control el `NaN` pasaba el filtro y llegaba hasta el `create` de Prisma, que
  // corta con un error de sistema en vez de con este aviso.
  const rolValido = (r: { name: string; vacancies: number }) =>
    r.name.trim().length > 0 && Number.isInteger(r.vacancies) && r.vacancies > 0;

  if (input.roles.length === 0 || !input.roles.every(rolValido)) {
    return { ok: false, error: "Agregá al menos un rol, con nombre y con una vacante." };
  }
  return { ok: true };
}

/**
 * El valor por omisión de un `<input type="datetime-local">`.
 *
 * A propósito NO convierte a la zona de Buenos Aires: ese input no puede decir con qué huso
 * horario se escribió, y `parseCoverageRequest` (`fecha()`, en `request-form.ts`) ya lee esos
 * campos sin conversión de zona del otro lado. Si acá se formateara con la zona AR, aceptar la
 * sugerencia sin tocarla correría la fecha guardada — la cobertura quedaría un rato antes o
 * después de lo que la organización pidió. Usar los componentes de la fecha tal cual, sin
 * conversión, mantiene la sugerencia idéntica al dato guardado.
 */
export function datetimeLocalValue(date: Date): string {
  return date.toISOString().slice(0, 16);
}
