import { describe, expect, it } from "vitest";
import {
  FOTOFFICE_EVENT_PROPERTY,
  decideForEvent,
  isSyncTokenExpired,
  toBlockInterval,
} from "./sync-decisions";

const evento = (over: Record<string, unknown> = {}) => ({
  id: "ev-1",
  status: "confirmed",
  summary: "Muestra anual",
  start: { dateTime: "2026-09-19T17:00:00-03:00" },
  end: { dateTime: "2026-09-19T23:00:00-03:00" },
  extendedProperties: undefined,
  ...over,
});

describe("qué hacer con cada evento que llega de Google", () => {
  it("un evento cargado a mano se convierte en bloqueo", () => {
    expect(decideForEvent(evento()).kind).toBe("BLOCK");
  });

  it("un evento que creó FOTOFFICE se ignora, para que la sincronización no se muerda la cola", () => {
    // Sin esto: se crea el evento, se lee de vuelta, se toma como bloqueo externo y
    // termina tapando su propia reserva.
    const propio = evento({
      extendedProperties: { private: { [FOTOFFICE_EVENT_PROPERTY]: "booking-123" } },
    });
    expect(decideForEvent(propio).kind).toBe("IGNORE");
  });

  it("un evento borrado en Google borra su bloqueo", () => {
    expect(decideForEvent(evento({ status: "cancelled" })).kind).toBe("DELETE");
  });

  it("un evento de día completo bloquea el día entero", () => {
    const todoElDia = evento({
      start: { date: "2026-09-19" },
      end: { date: "2026-09-20" },
    });
    const d = decideForEvent(todoElDia);
    expect(d.kind).toBe("BLOCK");
    expect(d.kind === "BLOCK" && d.allDay).toBe(true);
  });

  it("un evento sin horas ni fechas se ignora en vez de romper la corrida", () => {
    expect(decideForEvent(evento({ start: undefined, end: undefined })).kind).toBe("IGNORE");
  });

  it("un evento que termina antes de empezar se ignora", () => {
    const alReves = evento({
      start: { dateTime: "2026-09-19T20:00:00-03:00" },
      end: { dateTime: "2026-09-19T18:00:00-03:00" },
    });
    expect(decideForEvent(alReves).kind).toBe("IGNORE");
  });

  it("un evento sin identificador no se puede seguir, así que se ignora", () => {
    expect(decideForEvent(evento({ id: undefined })).kind).toBe("IGNORE");
  });
});

describe("el rango que ocupa un bloqueo", () => {
  it("toma las horas exactas cuando el evento las tiene", () => {
    const r = toBlockInterval(evento())!;
    expect(r.startAt.toISOString()).toBe("2026-09-19T20:00:00.000Z");
    expect(r.endAt.toISOString()).toBe("2026-09-20T02:00:00.000Z");
  });

  it("un evento de día completo cubre desde su medianoche a la del día siguiente", () => {
    const r = toBlockInterval(
      evento({ start: { date: "2026-09-19" }, end: { date: "2026-09-20" } }),
    )!;
    expect(r.endAt.getTime() - r.startAt.getTime()).toBe(24 * 60 * 60 * 1000);
  });
});

describe("el token de sincronización", () => {
  it("un 410 significa que el token venció y hay que recargar todo", () => {
    expect(isSyncTokenExpired({ code: 410 })).toBe(true);
    expect(isSyncTokenExpired({ status: 410 })).toBe(true);
    expect(isSyncTokenExpired(new Error("Sync token is no longer valid"))).toBe(true);
  });

  it("cualquier otro error no borra el token: recargar de más cuesta caro", () => {
    expect(isSyncTokenExpired({ code: 500 })).toBe(false);
    expect(isSyncTokenExpired(new Error("network"))).toBe(false);
    expect(isSyncTokenExpired(null)).toBe(false);
  });
});
