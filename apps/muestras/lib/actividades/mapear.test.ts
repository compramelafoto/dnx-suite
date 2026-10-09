import { describe, expect, it } from "vitest";
import { datosParaGuardar, fichaDesdeFormData } from "./mapear";

function fd(o: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
}

const base = {
  type: "MUESTRA",
  title: " Miradas ",
  description: "Texto",
  coverImageUrl: "https://img/p.webp",
  organizersText: "Fotoclub",
  startDay: "2026-11-05",
  endDay: "2026-11-20",
  scheduleText: "16 a 20",
  isVirtualOnly: "",
  address: "Calle 1",
  city: "Paraná",
  province: "Entre Ríos",
  latitude: "-31.74",
  longitude: "-60.51",
  galleryMode: "HIGHLIGHTS_UNTIL_CLOSED",
  rightsConfirmed: "on",
  works: JSON.stringify([{ imageUrl: "https://img/1.webp", title: "Uno", authorName: "Ana", year: 2025, technique: null, isHighlight: true }]),
};

describe("fichaDesdeFormData", () => {
  it("recorta textos y convierte números y casillas", () => {
    const f = fichaDesdeFormData(fd(base));
    expect(f.title).toBe("Miradas");
    expect(f.latitude).toBeCloseTo(-31.74);
    expect(f.isVirtualOnly).toBe(false);
    expect(f.rightsConfirmed).toBe(true);
    expect(f.works).toHaveLength(1);
  });
  it("una actividad sólo virtual descarta el lugar", () => {
    const f = fichaDesdeFormData(fd({ ...base, isVirtualOnly: "on" }));
    expect(f.latitude).toBeNull();
    expect(f.address).toBeNull();
  });
  it("obras mal formadas se ignoran", () => {
    const f = fichaDesdeFormData(fd({ ...base, works: "no es json" }));
    expect(f.works).toEqual([]);
  });
});

describe("datosParaGuardar", () => {
  it("pasa las fechas a hora argentina y calcula el geohash", () => {
    const d = datosParaGuardar(fichaDesdeFormData(fd(base)));
    expect((d.startsAt as Date).toISOString()).toBe("2026-11-05T03:00:00.000Z");
    expect((d.endsAt as Date).toISOString()).toBe("2026-11-21T02:59:59.999Z");
    expect(typeof d.geohash).toBe("string");
  });
  it("no toca el estado de revisión ni el dueño", () => {
    const d = datosParaGuardar(fichaDesdeFormData(fd(base)));
    expect("reviewStatus" in d).toBe(false);
    expect("proposedByUserId" in d).toBe(false);
  });
});

describe("fechas inválidas", () => {
  it("una fecha con forma válida pero imposible no rompe y usa el respaldo", () => {
    const d = datosParaGuardar(fichaDesdeFormData(fd({ ...base, startDay: "2026-13-45", endDay: "2026-13-46", openingDay: "2026-02-31" })));
    expect(d.startsAt).toBeInstanceOf(Date);
    expect(d.endsAt).toBeInstanceOf(Date);
    expect(d.openingAt).toBeNull();
  });
});
