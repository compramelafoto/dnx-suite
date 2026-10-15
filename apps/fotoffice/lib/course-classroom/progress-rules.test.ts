import { describe, expect, it } from "vitest";
import { aplicarReporte, type AvanceGuardado } from "./progress-rules";

const t0 = new Date(Date.UTC(2026, 9, 3, 12, 0, 0));
const mas = (segundos: number) => new Date(t0.getTime() + segundos * 1000);

describe("cuánto suma un reporte", () => {
  it("el primer reporte suma lo mirado", () => {
    const r = aplicarReporte({
      previo: null,
      reporte: { positionSeconds: 15, watchedSinceLastReport: 15 },
      ahora: t0,
      duracionSegundos: 600,
    });
    expect(r.secondsWatched).toBe(15);
    expect(r.lastPositionSeconds).toBe(15);
    expect(r.lastReportAt).toEqual(t0);
    expect(r.completedAt).toBeNull();
  });

  it("arrastrar la barra al final no marca la clase como vista", () => {
    const r = aplicarReporte({
      previo: null,
      reporte: { positionSeconds: 600, watchedSinceLastReport: 600 },
      ahora: t0,
      duracionSegundos: 600,
    });
    expect(r.secondsWatched).toBe(35); // intervalo a 2x + tolerancia, nunca más
    expect(r.completedAt).toBeNull();
  });

  it("dos reportes seguidos no suman más que el tiempo real que pasó entre ellos", () => {
    const previo: AvanceGuardado = {
      secondsWatched: 100,
      lastPositionSeconds: 100,
      lastReportAt: t0,
      completedAt: null,
    };
    const r = aplicarReporte({
      previo,
      reporte: { positionSeconds: 115, watchedSinceLastReport: 15 },
      ahora: mas(1),
      duracionSegundos: 600,
    });
    expect(r.secondsWatched).toBe(107); // 1 segundo real a 2x + 5 de tolerancia
  });

  it("valores negativos o rotos no restan ni rompen", () => {
    const r = aplicarReporte({
      previo: null,
      reporte: { positionSeconds: -4, watchedSinceLastReport: Number.NaN },
      ahora: t0,
      duracionSegundos: 600,
    });
    expect(r.secondsWatched).toBe(0);
    expect(r.lastPositionSeconds).toBe(0);
  });

  it("se completa al 90% de la duración", () => {
    const previo: AvanceGuardado = {
      secondsWatched: 530,
      lastPositionSeconds: 530,
      lastReportAt: t0,
      completedAt: null,
    };
    const r = aplicarReporte({
      previo,
      reporte: { positionSeconds: 545, watchedSinceLastReport: 15 },
      ahora: mas(15),
      duracionSegundos: 600,
    });
    expect(r.secondsWatched).toBe(545);
    expect(r.completedAt).toEqual(mas(15));
  });

  it("una clase completa no se descompleta", () => {
    const previo: AvanceGuardado = {
      secondsWatched: 600,
      lastPositionSeconds: 10,
      lastReportAt: t0,
      completedAt: t0,
    };
    const r = aplicarReporte({
      previo,
      reporte: { positionSeconds: 25, watchedSinceLastReport: 15 },
      ahora: mas(15),
      duracionSegundos: 600,
    });
    expect(r.completedAt).toEqual(t0);
    expect(r.secondsWatched).toBe(600); // tope en la duración
  });

  it("mirar una clase entera a 2x la completa", () => {
    let avance: AvanceGuardado | null = null;
    for (let i = 0; i < 20; i++) {
      avance = aplicarReporte({
        previo: avance,
        reporte: { positionSeconds: (i + 1) * 30, watchedSinceLastReport: 30 },
        ahora: mas((i + 1) * 15),
        duracionSegundos: 600,
      });
    }
    expect(avance!.secondsWatched).toBe(600);
    expect(avance!.completedAt).not.toBeNull();
  });

  it("sin duración conocida suma pero no completa", () => {
    const r = aplicarReporte({
      previo: null,
      reporte: { positionSeconds: 15, watchedSinceLastReport: 15 },
      ahora: t0,
      duracionSegundos: null,
    });
    expect(r.secondsWatched).toBe(15);
    expect(r.completedAt).toBeNull();
  });
});
