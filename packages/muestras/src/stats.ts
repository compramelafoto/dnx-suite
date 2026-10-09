import { addArDays, toArDay } from "./dates";

/**
 * Estadísticas de la sala (etapa 4). Sólo contadores diarios agregados por muestra, obra, día y
 * métrica: nada de IP, user-agent, cookies ni usuarios (decisión D15).
 */
export const STAT_METRICS = ["VIEW", "SCAN", "GUESTBOOK_SCAN"] as const;
export type StatMetric = (typeof STAT_METRICS)[number];
export const isStatMetric = (v: unknown): v is StatMetric => (STAT_METRICS as readonly unknown[]).includes(v);

/** `workId` de las filas que cuentan la muestra entera (no una obra). */
export const ACTIVITY_LEVEL = "";

const BOT_UA = new RegExp(
  [
    "bot\\b", "bot/", "crawl", "spider", "slurp", "archiver", "facebookexternalhit", "facebookcatalog", "whatsapp",
    "telegram", "preview", "embedly", "headless", "lighthouse", "pagespeed", "pingdom", "uptime", "monitor",
    "curl/", "wget/", "python", "httpclient", "okhttp", "go-http-client", "java/", "node-fetch", "undici", "axios",
    "postman", "insomnia", "scrapy", "ahrefs", "semrush", "petalbot", "yandex", "baidu", "bytespider", "gptbot",
    "chatgpt", "claude", "anthropic", "perplexity", "ccbot", "applebot", "googleother", "google-inspectiontool",
  ].join("|"),
  "i",
);

/** Robots, vistas previas de enlaces y clientes de consola. Sin user-agent (o muy corto), también. */
export function isBotUserAgent(ua: string | null | undefined): boolean {
  const s = (ua ?? "").trim();
  return s.length < 10 || BOT_UA.test(s);
}

/** El navegador o Next precargan la página sin que nadie la abra: no es una visita. */
export function isPrefetch(h: { get(name: string): string | null }): boolean {
  const proposito = `${h.get("sec-purpose") ?? ""} ${h.get("purpose") ?? ""}`;
  return /prefetch|prerender/i.test(proposito) || h.get("next-router-prefetch") === "1" || h.get("x-middleware-prefetch") === "1";
}

/** `o`: ficha de una obra; `m`: cartel y catálogo (la muestra); `l`: afiche del libro de visitas. */
export const QR_KINDS = ["o", "m", "l"] as const;
export type QrKind = (typeof QR_KINDS)[number];
export const isQrKind = (v: unknown): v is QrKind => (QR_KINDS as readonly unknown[]).includes(v);

export function metricForQrKind(kind: QrKind): StatMetric {
  return kind === "l" ? "GUESTBOOK_SCAN" : "SCAN";
}

export function scanPath(kind: QrKind, id: string): string {
  return `/q/${kind}/${encodeURIComponent(id)}`;
}

export function scanUrl(baseUrl: string, kind: QrKind, id: string): string {
  return `${baseUrl.replace(/\/+$/, "")}${scanPath(kind, id)}`;
}

/**
 * Los días del gráfico: `days` días que terminan hoy, o 30 días después del cierre si la
 * muestra cerró hace mucho (así el gráfico de una muestra vieja no queda vacío).
 */
export function statsWindow(a: { endsAt: Date }, now: Date, days = 60): { from: string; to: string } {
  const hoy = toArDay(now);
  const tope = addArDays(toArDay(a.endsAt), 30);
  const to = hoy < tope ? hoy : tope;
  return { from: addArDays(to, -(days - 1)), to };
}

/** Todos los días entre `from` y `to`, inclusive (tope de 400 por las dudas). */
export function dayRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to && out.length < 400; d = addArDays(d, 1)) out.push(d);
  return out;
}

export type StatRow = { workId: string; day: string; metric: string; count: number };

export function dailySeries(rows: readonly StatRow[], from: string, to: string, pick: (r: StatRow) => boolean): { day: string; count: number }[] {
  const porDia = new Map<string, number>();
  for (const r of rows) if (pick(r)) porDia.set(r.day, (porDia.get(r.day) ?? 0) + r.count);
  return dayRange(from, to).map((day) => ({ day, count: porDia.get(day) ?? 0 }));
}

export type StatTotals = { activityViews: number; workViews: number; workScans: number; activityScans: number; guestbookScans: number };

export function statTotals(rows: readonly StatRow[]): StatTotals {
  const t: StatTotals = { activityViews: 0, workViews: 0, workScans: 0, activityScans: 0, guestbookScans: 0 };
  for (const r of rows) {
    const deObra = r.workId !== ACTIVITY_LEVEL;
    if (r.metric === "VIEW") t[deObra ? "workViews" : "activityViews"] += r.count;
    else if (r.metric === "SCAN") t[deObra ? "workScans" : "activityScans"] += r.count;
    else if (r.metric === "GUESTBOOK_SCAN") t.guestbookScans += r.count;
  }
  return t;
}

/** Visitas y escaneos por obra, en el orden de la muestra; lo de obras ya quitadas va aparte. */
export function perWorkTotals<W extends { id: string; title: string }>(
  rows: readonly StatRow[],
  works: readonly W[],
): { works: { id: string; title: string; views: number; scans: number }[]; removed: { views: number; scans: number } } {
  const porObra = new Map(works.map((w) => [w.id, { id: w.id, title: w.title, views: 0, scans: 0 }]));
  const removed = { views: 0, scans: 0 };
  for (const r of rows) {
    if (r.workId === ACTIVITY_LEVEL || (r.metric !== "VIEW" && r.metric !== "SCAN")) continue;
    const destino = porObra.get(r.workId) ?? removed;
    if (r.metric === "VIEW") destino.views += r.count;
    else destino.scans += r.count;
  }
  return { works: works.map((w) => porObra.get(w.id)!), removed };
}

export type Bar = { day: string; count: number; x: number; y: number; width: number; height: number };

/** Barras para un SVG de `width` × `height` (y crece hacia abajo, como en SVG). */
export function barChart(series: readonly { day: string; count: number }[], o: { width: number; height: number; gap?: number }): { max: number; bars: Bar[] } {
  const gap = o.gap ?? 2;
  const n = series.length;
  const max = Math.max(0, ...series.map((s) => s.count));
  const ancho = n > 0 ? (o.width - gap * (n - 1)) / n : 0;
  const r2 = (v: number) => Math.round(v * 100) / 100;
  return {
    max,
    bars: series.map((s, i) => {
      const alto = max > 0 ? (s.count / max) * o.height : 0;
      return { day: s.day, count: s.count, x: r2(i * (ancho + gap)), y: r2(o.height - alto), width: r2(ancho), height: r2(alto) };
    }),
  };
}
