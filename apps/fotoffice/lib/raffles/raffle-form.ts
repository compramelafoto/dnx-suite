import { parseLocalDateTime } from "@/lib/bookings/local-datetime";
import { DEFAULT_ENTRIES_CLOSE_HOURS, RAFFLES_TIME_ZONE } from "./constants";

/**
 * El formulario de alta y edición del sorteo, parseado.
 *
 * Módulo PURO: recibe un `FormData` y devuelve valores o un motivo en castellano. La acción
 * de servidor sólo escribe; no decide si algo es válido.
 *
 * Las dos fechas se escriben en hora argentina y se guardan en UTC. La zona no puede salir
 * del servidor: en Vercel el servidor está en UTC y "las 20:00" quedarían tres horas corridas.
 * La conversión ya está resuelta y probada en `lib/bookings/local-datetime.ts`; acá se reusa.
 */

export type RaffleFormValues = {
  title: string;
  description: string | null;
  entriesCloseAt: Date;
  drawsAt: Date;
};

export type RaffleFormResult =
  | { ok: true; values: RaffleFormValues }
  | { ok: false; error: string };

const texto = (fd: FormData, campo: string) => String(fd.get(campo) ?? "").trim();

export function parseRaffleForm(formData: FormData): RaffleFormResult {
  const title = texto(formData, "title");
  if (title === "") return { ok: false, error: "Poné un título." };

  const crudoActo = texto(formData, "drawsAt");
  if (crudoActo === "") return { ok: false, error: "Poné la fecha y la hora del acto." };

  const drawsAt = parseLocalDateTime(crudoActo, RAFFLES_TIME_ZONE);
  if (!drawsAt) return { ok: false, error: "La fecha del acto no se entiende." };

  const crudoCierre = texto(formData, "entriesCloseAt");
  // Sin cierre explícito, veinticuatro horas antes. Ese margen elimina toda carrera de
  // tiempos y no exige una tarea programada de precisión de minutos.
  const entriesCloseAt =
    crudoCierre === ""
      ? new Date(drawsAt.getTime() - DEFAULT_ENTRIES_CLOSE_HOURS * 3_600_000)
      : parseLocalDateTime(crudoCierre, RAFFLES_TIME_ZONE);

  if (!entriesCloseAt) return { ok: false, error: "La fecha de cierre del padrón no se entiende." };
  if (entriesCloseAt.getTime() >= drawsAt.getTime()) {
    return { ok: false, error: "El padrón tiene que cerrar antes del acto." };
  }

  const description = texto(formData, "description");

  return {
    ok: true,
    values: { title, description: description === "" ? null : description, entriesCloseAt, drawsAt },
  };
}
