import { describe, expect, it } from "vitest";
import { dayEndAr, dayStartAr } from "./dates";
import {
  barChart, dailySeries, dayRange, isBotUserAgent, isPrefetch, metricForQrKind, perWorkTotals, scanPath, scanUrl,
  statTotals, statsWindow, type StatRow,
} from "./stats";

const h = (o: Record<string, string>) => ({ get: (n: string) => o[n.toLowerCase()] ?? null });

describe("robots y precargas", () => {
  it("un navegador común no es robot", () => {
    expect(isBotUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1")).toBe(false);
    expect(isBotUserAgent("Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36")).toBe(false);
  });
  it("un teléfono Cubot no es robot", () => {
    expect(isBotUserAgent("Mozilla/5.0 (Linux; Android 12; Cubot X30) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36")).toBe(false);
  });
  it("robots, vistas previas y clientes de consola sí", () => {
    for (const ua of [
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "facebookexternalhit/1.1", "WhatsApp/2.24.1 A", "TelegramBot (like TwitterBot)", "Slackbot-LinkExpanding 1.0",
      "curl/8.4.0", "python-requests/2.31", "Mozilla/5.0 HeadlessChrome/120", "", null,
    ]) expect(isBotUserAgent(ua), String(ua)).toBe(true);
  });
  it("precargas del navegador o de Next", () => {
    expect(isPrefetch(h({ "sec-purpose": "prefetch;prerender" }))).toBe(true);
    expect(isPrefetch(h({ purpose: "prefetch" }))).toBe(true);
    expect(isPrefetch(h({ "next-router-prefetch": "1" }))).toBe(true);
    expect(isPrefetch(h({}))).toBe(false);
  });
});

describe("QR con conteo", () => {
  it("direcciones cortas por tipo", () => {
    expect(scanPath("o", "ckobra1")).toBe("/q/o/ckobra1");
    expect(scanUrl("https://muestrasfotograficas.com/", "l", "ckm")).toBe("https://muestrasfotograficas.com/q/l/ckm");
  });
  it("qué métrica suma cada tipo", () => {
    expect(metricForQrKind("o")).toBe("SCAN");
    expect(metricForQrKind("m")).toBe("SCAN");
    expect(metricForQrKind("l")).toBe("GUESTBOOK_SCAN");
  });
});

describe("ventana del gráfico", () => {
  const a = { startsAt: dayStartAr("2026-11-01"), endsAt: dayEndAr("2026-11-30") };
  it("60 días que terminan hoy", () => {
    expect(statsWindow(a, new Date("2026-11-15T15:00:00Z"))).toEqual({ from: "2026-09-17", to: "2026-11-15" });
  });
  it("una muestra que cerró hace mucho termina 30 días después del cierre", () => {
    expect(statsWindow(a, new Date("2027-05-01T15:00:00Z"))).toEqual({ from: "2026-11-01", to: "2026-12-30" });
  });
  it("rango de días inclusive", () => {
    expect(dayRange("2026-12-30", "2027-01-02")).toEqual(["2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02"]);
  });
});

const filas: StatRow[] = [
  { workId: "", day: "2026-11-02", metric: "VIEW", count: 10 },
  { workId: "w1", day: "2026-11-02", metric: "VIEW", count: 4 },
  { workId: "w1", day: "2026-11-02", metric: "SCAN", count: 3 },
  { workId: "w2", day: "2026-11-03", metric: "SCAN", count: 2 },
  { workId: "", day: "2026-11-03", metric: "SCAN", count: 1 },
  { workId: "", day: "2026-11-03", metric: "GUESTBOOK_SCAN", count: 5 },
  { workId: "borrada", day: "2026-11-03", metric: "VIEW", count: 7 },
];

describe("series y totales", () => {
  it("una serie por día, con ceros donde no hubo nada", () => {
    expect(dailySeries(filas, "2026-11-01", "2026-11-03", (r) => r.metric === "VIEW")).toEqual([
      { day: "2026-11-01", count: 0 }, { day: "2026-11-02", count: 14 }, { day: "2026-11-03", count: 7 },
    ]);
  });
  it("totales por tipo", () => {
    expect(statTotals(filas)).toEqual({ activityViews: 10, workViews: 11, workScans: 5, activityScans: 1, guestbookScans: 5 });
  });
  it("por obra en el orden de la muestra, y lo de obras quitadas aparte", () => {
    expect(perWorkTotals(filas, [{ id: "w2", title: "Dos" }, { id: "w1", title: "Uno" }])).toEqual({
      works: [{ id: "w2", title: "Dos", views: 0, scans: 2 }, { id: "w1", title: "Uno", views: 4, scans: 3 }],
      removed: { views: 7, scans: 0 },
    });
  });
});

describe("barChart", () => {
  it("barras proporcionales al máximo, desde abajo", () => {
    const c = barChart([{ day: "a", count: 0 }, { day: "b", count: 5 }, { day: "c", count: 10 }], { width: 32, height: 100, gap: 1 });
    expect(c.max).toBe(10);
    expect(c.bars.map((b) => [b.x, b.width, b.y, b.height])).toEqual([[0, 10, 100, 0], [11, 10, 50, 50], [22, 10, 0, 100]]);
  });
  it("sin datos no divide por cero", () => {
    expect(barChart([{ day: "a", count: 0 }], { width: 10, height: 10 }).max).toBe(0);
  });
});
