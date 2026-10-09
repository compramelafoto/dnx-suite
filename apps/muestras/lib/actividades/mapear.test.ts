import { describe, expect, it } from "vitest";
import { LARGOS, datosParaGuardar, esImagenPropia, fichaDesdeFormData as mapearConBase } from "./mapear";

const BASE = "https://pub-test.r2.dev";
/** Los tests inyectan la base pública de imágenes en vez de depender del entorno. */
const fichaDesdeFormData = (f: FormData) => mapearConBase(f, { baseImagenes: BASE });

function fd(o: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
}

const base = {
  type: "MUESTRA",
  title: " Miradas ",
  description: "Texto",
  coverImageUrl: `${BASE}/muestras/7/p.webp`,
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
  works: JSON.stringify([{ imageUrl: `${BASE}/muestras/7/1.webp`, title: "Uno", authorName: "Ana", year: 2025, technique: null, isHighlight: true }]),
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
  it("una charla sólo online descarta el lugar", () => {
    const f = fichaDesdeFormData(fd({ ...base, type: "CHARLA", isVirtualOnly: "on" }));
    expect(f.isVirtualOnly).toBe(true);
    expect(f.latitude).toBeNull();
    expect(f.address).toBeNull();
  });
  it("una muestra nunca queda como sólo online: conserva la sede", () => {
    const f = fichaDesdeFormData(fd({ ...base, isVirtualOnly: "on" }));
    expect(f.isVirtualOnly).toBe(false);
    expect(f.address).toBe("Calle 1");
    expect(f.latitude).toBeCloseTo(-31.74);
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

describe("largos máximos", () => {
  it("recorta los textos largos en vez de rechazarlos", () => {
    const largo = (n: number) => "a".repeat(n + 50);
    const f = fichaDesdeFormData(fd({
      ...base,
      title: largo(LARGOS.title), description: largo(LARGOS.description), organizersText: largo(LARGOS.organizersText),
      scheduleText: largo(LARGOS.scheduleText), priceText: largo(LARGOS.priceText), externalUrl: largo(LARGOS.externalUrl),
      venueName: largo(LARGOS.venueName), address: largo(LARGOS.address), city: largo(LARGOS.city), province: largo(LARGOS.province),
      works: JSON.stringify([{ imageUrl: `${BASE}/muestras/7/1.webp`, title: largo(200), authorName: largo(200), technique: largo(200) }]),
    }));
    expect(f.title).toHaveLength(200);
    expect(f.description).toHaveLength(10_000);
    expect(f.organizersText).toHaveLength(500);
    expect(f.scheduleText).toHaveLength(500);
    expect(f.priceText).toHaveLength(200);
    expect(f.externalUrl).toHaveLength(500);
    expect(f.venueName).toHaveLength(200);
    expect(f.address).toHaveLength(300);
    expect(f.city).toHaveLength(120);
    expect(f.province).toHaveLength(120);
    expect(f.works[0]!.title).toHaveLength(200);
    expect(f.works[0]!.authorName).toHaveLength(200);
    expect(f.works[0]!.technique).toHaveLength(200);
  });
});

describe("imágenes ajenas", () => {
  it("esImagenPropia sólo acepta la base pública seguida de /muestras/", () => {
    expect(esImagenPropia(`${BASE}/muestras/7/abc.webp`, BASE)).toBe(true);
    expect(esImagenPropia(`${BASE}/otra-cosa/7/abc.webp`, BASE)).toBe(false);
    expect(esImagenPropia("https://malo.com/muestras/7/abc.webp", BASE)).toBe(false);
    expect(esImagenPropia(`${BASE}.malo.com/muestras/7/abc.webp`, BASE)).toBe(false);
    expect(esImagenPropia(`${BASE}/muestras/../secreto.webp`, BASE)).toBe(false);
    expect(esImagenPropia(`${BASE}/muestras/7/a.webp" onerror="x`, BASE)).toBe(false);
  });
  it("sin base configurada no acepta ninguna (falla cerrado)", () => {
    expect(esImagenPropia(`${BASE}/muestras/7/abc.webp`, null)).toBe(false);
    const f = mapearConBase(fd(base), { baseImagenes: null });
    expect(f.coverImageUrl).toBeNull();
    expect(f.works).toEqual([]);
  });
  it("una portada ajena queda en null y una obra ajena se descarta", () => {
    const f = fichaDesdeFormData(fd({
      ...base,
      coverImageUrl: "https://malo.com/espia.png",
      works: JSON.stringify([
        { imageUrl: "https://malo.com/1.webp", title: "Ajena" },
        { imageUrl: `${BASE}/muestras/7/2.webp`, title: "Propia" },
      ]),
    }));
    expect(f.coverImageUrl).toBeNull();
    expect(f.works.map((w) => w.title)).toEqual(["Propia"]);
  });
  it("lee la base del entorno y le saca la barra final", () => {
    const antes = process.env.R2_PUBLIC_URL;
    process.env.R2_PUBLIC_URL = `${BASE}/`;
    try {
      expect(mapearConBase(fd(base)).coverImageUrl).toBe(`${BASE}/muestras/7/p.webp`);
    } finally {
      if (antes === undefined) delete process.env.R2_PUBLIC_URL; else process.env.R2_PUBLIC_URL = antes;
    }
  });
});

describe("perfil del autor en cada obra", () => {
  it("acepta un id de perfil con forma de id y descarta lo demás", () => {
    const f = fichaDesdeFormData(fd({
      ...base,
      works: JSON.stringify([
        { imageUrl: `${BASE}/muestras/7/1.webp`, title: "Uno", authorProfileId: "cm1abcdefghijklmnop" },
        { imageUrl: `${BASE}/muestras/7/2.webp`, title: "Dos", authorProfileId: "'; drop table" },
        { imageUrl: `${BASE}/muestras/7/3.webp`, title: "Tres" },
      ]),
    }));
    expect(f.works.map((w) => w.authorProfileId)).toEqual(["cm1abcdefghijklmnop", null, null]);
  });
});
