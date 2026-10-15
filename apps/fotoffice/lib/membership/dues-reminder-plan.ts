import { APERTURA_PERIOD } from "./charge-labels";

/**
 * A quién se le recuerda la cuota y qué se le dice. PURO.
 *
 * Entra en el recordatorio todo lo impago que vence hasta el vencimiento del mes en curso:
 * la cuota del mes y lo que quedó atrás. Lo que vence después —cuotas adelantadas, o una
 * cuota de ingreso de un mes que todavía no llegó— no se reclama.
 *
 * La deuda de apertura queda afuera a propósito, por la misma razón que no bloquea el sorteo
 * (`lib/raffles/eligibility.ts`): todavía hay 48 socios cuyo saldo heredado no se pudo
 * verificar, y un reclamo por una cifra que la propia institución no puede justificar es la
 * forma más rápida de que el recordatorio deje de leerse.
 */

export type ChargeForReminder = {
  period: string;
  concept: string;
  dueDate: Date;
  balanceMinor: number;
};

export type ReminderPlan = {
  /** La cuota mensual del período en curso, si sigue impaga. */
  current: ChargeForReminder | null;
  /** El resto de lo impago, de lo más viejo a lo más nuevo. */
  overdue: ChargeForReminder[];
};

export function planReminder(input: {
  charges: readonly ChargeForReminder[];
  /** `AAAA-MM` del mes en curso. */
  period: string;
  /** Vencimiento del mes en curso. */
  dueDate: Date;
}): ReminderPlan | null {
  const reclamables = input.charges
    .filter((c) => c.balanceMinor > 0)
    .filter((c) => c.period !== APERTURA_PERIOD)
    .filter((c) => c.dueDate.getTime() <= input.dueDate.getTime())
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

  if (reclamables.length === 0) return null;

  const current =
    reclamables.find((c) => c.concept === "MENSUAL" && c.period === input.period) ?? null;
  return { current, overdue: reclamables.filter((c) => c !== current) };
}

/** Días seguidos en los que la tarea diaria todavía intenta el recordatorio del mes. */
export const REMINDER_WINDOW_DAYS = 3;

/**
 * Si hoy toca recordar.
 *
 * El día configurado y los dos siguientes: una corrida perdida no deja el mes sin aviso, y el
 * registro de envíos hace que esos tres días no sean tres correos.
 */
export function reminderWindowOpen(input: { today: number; reminderDay: number }): boolean {
  return input.today >= input.reminderDay && input.today < input.reminderDay + REMINDER_WINDOW_DAYS;
}
