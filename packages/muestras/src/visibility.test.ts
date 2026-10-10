import { describe, expect, it } from "vitest";
import { MAX_WORKS } from "./constants";
import {
  coverIsHiddenWork, onlineExhibitedWorks, parseVisibility, pickPerVisit, presetOf, roomExhibitedWorks,
  visibilityFromPreset, visibilitySummary, type Visibility,
} from "./visibility";

const abierta = { startsAt: new Date("2026-11-01T03:00:00Z"), endsAt: new Date("2026-11-30T02:59:59.999Z") };
const durante = new Date("2026-11-10T15:00:00Z");
const despues = new Date("2026-12-05T15:00:00Z");
const obras = Array.from({ length: 20 }, (_, i) => ({ id: `w${i}`, isHighlight: i < 2, sortOrder: i }));
const ids = (ws: { id: string }[]) => ws.map((w) => w.id);
const estaticas = (r: ReturnType<typeof onlineExhibitedWorks>) => {
  if (r.mode !== "STATIC") throw new Error("esperaba STATIC");
  return r;
};

describe("ajuste guardado o de legado", () => {
  it("vacío: como hasta hoy según galleryMode", () => {
    expect(parseVisibility(null, "HIGHLIGHTS_UNTIL_CLOSED").online.exhibited).toBe("HIGHLIGHTS");
    expect(parseVisibility(null, "FULL").online.exhibited).toBe("ALL");
    expect(presetOf(parseVisibility(null, "FULL"))).toBe("OPEN");
  });
  it("roto o con valores desconocidos: completa con lo seguro", () => {
    const v = parseVisibility({ v: 1, online: { exhibited: "TODO", randomCount: -3, rotation: "X" }, room: "x" }, "HIGHLIGHTS_UNTIL_CLOSED");
    expect(v.online.exhibited).toBe("HIGHLIGHTS");
    expect(v.online.randomCount).toBe(3);
    expect(v.online.rotation).toBe("FIXED");
    expect(v.room.exhibited).toBe("ARTIST");
    expect(v.revealAfterClose).toBe(true);
  });
  it("lo guardado se respeta (también una cantidad grande y por visitante)", () => {
    const b = visibilityFromPreset("PREVIEW", "s");
    const g: Visibility = { ...b, preset: "CUSTOM", online: { ...b.online, randomCount: 80, rotation: "PER_VISIT" } };
    expect(parseVisibility(JSON.parse(JSON.stringify(g)), "FULL")).toEqual(g);
  });
  it("la cantidad al azar nunca pasa el tope técnico de obras", () => {
    const v = parseVisibility({ v: 1, online: { exhibited: "RANDOM", randomCount: 1_000_000, rotation: "PER_VISIT", seed: "s" } }, "FULL");
    expect(v.online.randomCount).toBe(MAX_WORKS);
  });
});

describe("presets", () => {
  it("Adelanto (la sugerencia): 3 al azar, siempre las mismas", () => {
    const v = visibilityFromPreset("PREVIEW", "s");
    expect(v.online).toMatchObject({ exhibited: "RANDOM", randomCount: 3, rotation: "FIXED", artists: true });
    expect(v.profile).toEqual({ exhibited: "LIKE_ONLINE" });
    expect(v.room).toEqual({ exhibited: "ARTIST", portfolio: true, otherExhibitions: true, buy: true });
  });
  it("tocar una opción lo vuelve personalizado", () => {
    const v = visibilityFromPreset("PREVIEW", "s");
    expect(presetOf(v)).toBe("PREVIEW");
    expect(presetOf({ ...v, online: { ...v.online, rotation: "PER_VISIT" } })).toBe("CUSTOM");
  });
});

describe("obras expuestas online", () => {
  const con = (p: Partial<Visibility["online"]>, extra: Partial<Visibility> = {}) => {
    const b = visibilityFromPreset("PREVIEW", "semilla-1");
    return { ...b, ...extra, online: { ...b.online, ...p } };
  };
  it("todas, ninguna, destacadas", () => {
    expect(estaticas(onlineExhibitedWorks(con({ exhibited: "ALL" }), abierta, obras, durante)).works).toHaveLength(20);
    expect(onlineExhibitedWorks(con({ exhibited: "NONE" }), abierta, obras, durante)).toMatchObject({ mode: "STATIC", works: [], hiddenCount: 20 });
    expect(ids(estaticas(onlineExhibitedWorks(con({ exhibited: "HIGHLIGHTS" }), abierta, obras, durante)).works)).toEqual(["w0", "w1"]);
  });
  it("siempre las mismas: N obras, iguales en otro momento y con otro orden de entrada", () => {
    const v = con({ exhibited: "RANDOM", randomCount: 3, rotation: "FIXED" });
    const a = estaticas(onlineExhibitedWorks(v, abierta, obras, durante));
    const b = estaticas(onlineExhibitedWorks(v, abierta, [...obras].reverse(), new Date("2026-11-20T15:00:00Z")));
    expect(a.works).toHaveLength(3);
    expect(ids(a.works)).toEqual(ids(b.works));
  });
  it("otra semilla, otro sorteo", () => {
    const a = estaticas(onlineExhibitedWorks(con({ exhibited: "RANDOM", seed: "uno" }), abierta, obras, durante));
    const b = estaticas(onlineExhibitedWorks(con({ exhibited: "RANDOM", seed: "dos" }), abierta, obras, durante));
    expect(ids(a.works)).not.toEqual(ids(b.works));
  });
  it("cada día: igual dentro del día argentino, cambia entre días", () => {
    const v = con({ exhibited: "RANDOM", rotation: "DAILY" });
    const manana = estaticas(onlineExhibitedWorks(v, abierta, obras, new Date("2026-11-10T12:00:00Z")));
    const noche = estaticas(onlineExhibitedWorks(v, abierta, obras, new Date("2026-11-11T02:30:00Z")));
    expect(ids(manana.works)).toEqual(ids(noche.works));
    const dias = new Set(Array.from({ length: 10 }, (_, i) =>
      ids(estaticas(onlineExhibitedWorks(v, abierta, obras, new Date(Date.UTC(2026, 10, 10 + i, 15)))).works).join()));
    expect(dias.size).toBeGreaterThan(1);
  });
  it("para cada visitante: no devuelve obras, sólo cuántas", () => {
    const r = onlineExhibitedWorks(con({ exhibited: "RANDOM", rotation: "PER_VISIT", randomCount: 5 }), abierta, obras, durante);
    expect(r).toEqual({ mode: "PER_VISIT", count: 5, total: 20 });
  });
  it("una cantidad mayor que las obras es 'todas'", () => {
    expect(onlineExhibitedWorks(con({ exhibited: "RANDOM", randomCount: 50, rotation: "PER_VISIT" }), abierta, obras, durante)).toMatchObject({ mode: "STATIC", isPartial: false });
  });
  it("después del cierre: todo, salvo que se mantenga la reserva", () => {
    expect(estaticas(onlineExhibitedWorks(con({ exhibited: "RANDOM", rotation: "PER_VISIT" }), abierta, obras, despues)).works).toHaveLength(20);
    expect(estaticas(onlineExhibitedWorks(con({ exhibited: "NONE" }, { revealAfterClose: false }), abierta, obras, despues)).works).toHaveLength(0);
  });
});

describe("elegir para cada visitante", () => {
  it("N distintas, en el orden de la galería, con el azar que pasa la app", () => {
    let k = 0;
    const secuencia = [7, 0, 12, 3, 3, 1];
    const r = pickPerVisit(obras, 4, (max) => secuencia[k++]! % max);
    expect(r).toHaveLength(4);
    expect(new Set(ids(r)).size).toBe(4);
    expect(r.map((w) => w.sortOrder)).toEqual([...r.map((w) => w.sortOrder)].sort((x, y) => x - y));
  });
  it("con el azar real, a la larga salen todas (lo que avisa el panel)", () => {
    const vistas = new Set<string>();
    for (let i = 0; i < 200; i++) for (const w of pickPerVisit(obras, 3, (m) => Math.floor(Math.random() * m))) vistas.add(w.id);
    expect(vistas.size).toBe(20);
  });
});

describe("QR de la sala", () => {
  const ws = [
    { id: "a1", sortOrder: 0, authorProfileId: "pA", authorName: "Ana" },
    { id: "a2", sortOrder: 1, authorProfileId: "pA", authorName: "Ana" },
    { id: "b1", sortOrder: 2, authorProfileId: null, authorName: "Beto" },
    { id: "b2", sortOrder: 3, authorProfileId: null, authorName: " beto " },
    { id: "c1", sortOrder: 4, authorProfileId: "pC", authorName: "Ceci" },
  ];
  const sala = (exhibited: Visibility["room"]["exhibited"]) => {
    const b = visibilityFromPreset("PREVIEW", "s");
    return { ...b, room: { ...b.room, exhibited } };
  };
  it("la escaneada, las del mismo artista (por perfil o por nombre), toda la muestra", () => {
    expect(ids(roomExhibitedWorks(sala("SCANNED"), ws, ["a1"]))).toEqual(["a1"]);
    expect(ids(roomExhibitedWorks(sala("ARTIST"), ws, ["a1"]))).toEqual(["a1", "a2"]);
    expect(ids(roomExhibitedWorks(sala("ARTIST"), ws, ["b1"]))).toEqual(["b1", "b2"]);
    expect(roomExhibitedWorks(sala("ALL"), ws, ["c1"])).toHaveLength(5);
  });
  it("un id escaneado que ya no está en la muestra no abre nada", () => {
    expect(roomExhibitedWorks(sala("ALL"), ws, ["zz"])).toEqual([]);
  });
});

describe("textos y portada", () => {
  it("resumen de qué ve cada uno", () => {
    const v = visibilityFromPreset("PREVIEW", "s");
    expect(visibilitySummary(v).online).toBe("La publicación online muestra 3 obras de la sala elegidas al azar (siempre las mismas) y presenta a los artistas con su biografía y su portfolio.");
    expect(visibilitySummary({ ...v, online: { ...v.online, rotation: "PER_VISIT" } }).online)
      .toBe("La publicación online muestra 3 obras de la sala elegidas al azar, distintas para cada visitante, y presenta a los artistas con su biografía y su portfolio.");
    expect(visibilitySummary(v).room).toBe("Quien escanea el QR de una ficha ve esa obra y las demás del mismo artista, su portfolio, las otras muestras donde expuso y el botón para adquirir la obra.");
  });
  it("portada que es una obra reservada", () => {
    expect(coverIsHiddenWork("https://r2/x.webp", [{ id: "w1", imageUrl: "https://r2/x.webp" }], new Set())).toBe(true);
    expect(coverIsHiddenWork("https://r2/x.webp", [{ id: "w1", imageUrl: "https://r2/x.webp" }], new Set(["w1"]))).toBe(false);
  });
});
