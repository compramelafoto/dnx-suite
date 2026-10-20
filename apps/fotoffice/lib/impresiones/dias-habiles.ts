import { eventDayType } from "@repo/cuanto-cobro-core";

/** Suma días hábiles (sin sábados, domingos ni feriados nacionales). Fechas `AAAA-MM-DD`. */
export function sumarDiasHabiles(desdeYmd: string, dias: number): string {
  const d = new Date(`${desdeYmd}T12:00:00Z`);
  let restantes = Math.max(0, Math.floor(dias));
  while (restantes > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const ymd = d.toISOString().slice(0, 10);
    const info = eventDayType(ymd);
    if (info && !info.isSaturday && !info.isSunday && !info.nonWorkingDay && info.dayType !== "holiday") restantes--;
  }
  return d.toISOString().slice(0, 10);
}
