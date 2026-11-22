import { describe, expect, it } from "vitest";
import {
  artDateKey,
  decideAlbumStory,
  MAX_STORIES_PER_DAY,
  nextFreeStorySlots,
  pickStoryPhotos,
  storyAlbumTitle,
  storyCredit,
  type AlbumStoryCandidate,
} from "./album-stories-plan";
import { pickStoryCollage, STORY_COLLAGES } from "./album-story-collages";

const base: AlbumStoryCandidate = {
  isPublic: true,
  isHidden: false,
  hiddenPhotosEnabled: false,
  isTest: false,
  schoolId: null,
  deletedAt: null,
  photoCount: 120,
  consentGiven: null,
  alreadyGenerated: false,
};

describe("decideAlbumStory", () => {
  it("un álbum público de más de 50 fotos sin tocar el permiso entra (activado por defecto)", () => {
    expect(decideAlbumStory(base)).toEqual({ eligible: true });
  });

  it.each([
    [{ isPublic: false }, "NOT_PUBLIC"],
    [{ isHidden: true }, "HIDDEN"],
    [{ hiddenPhotosEnabled: true }, "SELFIE_PROTECTED"],
    [{ isTest: true }, "TEST_ALBUM"],
    [{ schoolId: 3 }, "SCHOOL_ALBUM"],
    [{ deletedAt: new Date() }, "DELETED"],
    [{ consentGiven: false }, "NO_CONSENT"],
    [{ photoCount: 50 }, "TOO_FEW_PHOTOS"],
    [{ alreadyGenerated: true }, "ALREADY_GENERATED"],
  ] as const)("%o queda afuera por %s", (cambio, motivo) => {
    expect(decideAlbumStory({ ...base, ...cambio })).toEqual({ eligible: false, reason: motivo });
  });

  it("51 fotos alcanzan", () => {
    expect(decideAlbumStory({ ...base, photoCount: 51 }).eligible).toBe(true);
  });
});

describe("pickStoryPhotos", () => {
  const cien = Array.from({ length: 100 }, (_, i) => i + 1);

  it("reparte las fotos a lo largo del álbum", () => {
    expect(pickStoryPhotos(cien, 4)).toEqual([13, 38, 63, 88]);
  });

  it("usa primero las marcadas por el fotógrafo y completa con repartidas", () => {
    const r = pickStoryPhotos(cien, 4, [7, 999, 7, 50]);
    expect(r.slice(0, 2)).toEqual([7, 50]);
    expect(r).toHaveLength(4);
    expect(new Set(r).size).toBe(4);
  });

  it("no inventa fotos si hay pocas", () => {
    expect(pickStoryPhotos([1, 2], 4)).toEqual([1, 2]);
  });
});

describe("nextFreeStorySlots", () => {
  // 21/11/2026 08:00 hora argentina
  const ahora = new Date("2026-11-21T11:00:00Z");

  it("arranca a las 10:00 hora argentina del mismo día", () => {
    const [primero] = nextFreeStorySlots([], ahora, 1);
    expect(primero!.toISOString()).toBe("2026-11-21T13:00:00.000Z");
  });

  it("nunca pone más de 10 en un día y pasa el resto a los días siguientes", () => {
    const slots = nextFreeStorySlots([], ahora, 25);
    const porDia = new Map<string, number>();
    for (const s of slots) porDia.set(artDateKey(s), (porDia.get(artDateKey(s)) ?? 0) + 1);
    expect([...porDia.values()].every((n) => n <= MAX_STORIES_PER_DAY)).toBe(true);
    expect([...porDia.keys()]).toEqual(["2026-11-21", "2026-11-22", "2026-11-23"]);
  });

  it("respeta lo ya agendado y no repite horario", () => {
    const yaHoy = nextFreeStorySlots([], ahora, 8);
    const siguientes = nextFreeStorySlots(yaHoy, ahora, 3);
    expect(artDateKey(siguientes[0]!)).toBe("2026-11-21");
    expect(artDateKey(siguientes[2]!)).toBe("2026-11-22");
    const todos = [...yaHoy, ...siguientes].map((d) => d.getTime());
    expect(new Set(todos).size).toBe(todos.length);
  });

  it("no agenda horarios que ya pasaron", () => {
    const tarde = new Date("2026-11-21T23:30:00Z"); // 20:30 ART
    const [s] = nextFreeStorySlots([], tarde, 1);
    expect(s!.toISOString()).toBe("2026-11-22T00:15:00.000Z"); // 21:15 ART
  });

  it("con la semana llena no devuelve nada", () => {
    const semana = nextFreeStorySlots([], ahora, 1000);
    expect(semana).toHaveLength(70);
    expect(nextFreeStorySlots(semana, ahora, 1)).toHaveLength(0);
  });
});

describe("plantillas", () => {
  it("rotan sin repetir dos seguidas", () => {
    for (let i = 0; i < 20; i++) {
      expect(pickStoryCollage(i).id).not.toBe(pickStoryCollage(i + 1).id);
    }
  });

  it("todas son 1080×1920, de 3 o 4 fotos, y sin campos de documento", () => {
    for (const c of STORY_COLLAGES) {
      expect(c.document.format).toMatchObject({ width: 1080, height: 1920 });
      const fotos = c.contract.variables.filter((v) => v.type === "image");
      expect(fotos).toHaveLength(c.fotos);
      for (const v of c.contract.variables) expect(v.key).not.toMatch(/dni|documento|cuit|cuil/i);
    }
  });
});

describe("textos", () => {
  it("crédito con @ o con nombre", () => {
    expect(storyCredit("juanfoto", "Juan")).toBe("Fotos de @juanfoto");
    expect(storyCredit(null, "Juan Pérez")).toBe("Fotos de Juan Pérez");
    expect(storyCredit(null, null)).toBe("");
  });

  it("recorta títulos largos", () => {
    expect(storyAlbumTitle("a".repeat(80))).toHaveLength(58);
    expect(storyAlbumTitle("  Maratón   2026 ")).toBe("Maratón 2026");
  });
});
