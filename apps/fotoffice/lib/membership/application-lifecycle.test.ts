import { describe, expect, it } from "vitest";
import {
  APPLICATION_REMINDER_DAYS,
  applicationDeadlineStage,
  daysUntil,
} from "./application-lifecycle";

const DIA = 24 * 60 * 60 * 1000;
const AHORA = new Date("2026-09-06T12:00:00.000Z");
const en = (dias: number) => new Date(AHORA.getTime() + dias * DIA);

describe("applicationDeadlineStage", () => {
  it("recién aprobada, con el plazo entero por delante, no dispara nada", () => {
    expect(applicationDeadlineStage({ expiresAt: en(30), now: AHORA })).toBe("VIGENTE");
  });

  it("vence cuando el plazo se cumplió", () => {
    expect(applicationDeadlineStage({ expiresAt: en(-1), now: AHORA })).toBe("VENCIDA");
  });

  it("vence exactamente al llegar la fecha, no un instante después", () => {
    expect(applicationDeadlineStage({ expiresAt: AHORA, now: AHORA })).toBe("VENCIDA");
  });

  it("recuerda cuando faltan siete días", () => {
    expect(applicationDeadlineStage({ expiresAt: en(APPLICATION_REMINDER_DAYS), now: AHORA })).toBe(
      "RECORDAR",
    );
  });

  /**
   * El recordatorio sale UNA vez: la ventana es de 24 horas y la tarea corre una vez por día.
   * Sin esta ventana habría que guardar en algún lado que ya se mandó, y la persona recibiría
   * el mismo aviso siete días seguidos.
   */
  it("la ventana del recordatorio dura un día y no más", () => {
    expect(applicationDeadlineStage({ expiresAt: en(6.5), now: AHORA })).toBe("RECORDAR");
    expect(applicationDeadlineStage({ expiresAt: en(6.01), now: AHORA })).toBe("RECORDAR");
    // Justo por debajo del piso de la ventana: ya se le avisó ayer.
    expect(applicationDeadlineStage({ expiresAt: en(5.99), now: AHORA })).toBe("VIGENTE");
    // Justo por encima del techo: le toca mañana.
    expect(applicationDeadlineStage({ expiresAt: en(7.01), now: AHORA })).toBe("VIGENTE");
  });

  it("sin plazo no hay nada que vencer", () => {
    expect(applicationDeadlineStage({ expiresAt: null, now: AHORA })).toBe("VIGENTE");
  });
});

describe("daysUntil", () => {
  it("redondea hacia arriba: día y medio se le dice como dos días", () => {
    expect(daysUntil(en(1.5), AHORA)).toBe(2);
  });

  it("un plazo ya cumplido son cero días, nunca negativos", () => {
    expect(daysUntil(en(-3), AHORA)).toBe(0);
  });
});
