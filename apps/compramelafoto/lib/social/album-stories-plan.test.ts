import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  artDateKey,
  decideAlbumStory,
  MAX_STORIES_PER_DAY,
  nextFreeStorySlots,
  pickStoryPhotos,
  storyAlbumTitle,
  storyCredit,
  storyShortUrl,
  fraseDeHistoria,
  FRASES_POR_DIA,
  planAlbumStories,
  repartirFotos,
  STORY_SLOTS_ART,
  type AlbumStoryCandidate,
} from "./album-stories-plan";
import {
  ajusteDelCollage,
  elegirCollages,
  LOGO_BLANCO_REF,
  LOGO_COLOR_REF,
  pickStoryCollage,
  readStoryBrandResource,
  SEGURA_ABAJO,
  SEGURA_ARRIBA,
  STORY_COLLAGES,
} from "./album-story-collages";
import { normalizeExtraHandles } from "./album-social-consent";

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
    expect(s!.toISOString()).toBe("2026-11-22T00:00:00.000Z"); // 21:00 ART
  });

  it("el cron que publica corre exactamente en los diez horarios (y no cada 5 minutos)", () => {
    const vercel = JSON.parse(readFileSync(path.join(__dirname, "../../vercel.json"), "utf8")) as {
      crons: Array<{ path: string; schedule: string }>;
    };
    const publicar = vercel.crons.find((c) => c.path === "/api/cron/social-publish")!;
    const [minuto, horas] = publicar.schedule.split(" ");
    expect(minuto).toBe("0");
    const horasUtc = horas!.split(",").map(Number).sort((a, b) => a - b);
    const esperadas = STORY_SLOTS_ART.map((hhmm) => (Number(hhmm.slice(0, 2)) + 3) % 24).sort((a, b) => a - b);
    expect(horasUtc).toEqual(esperadas);
    for (const hhmm of STORY_SLOTS_ART) expect(hhmm.endsWith(":00")).toBe(true);
  });

  it("con la semana llena no devuelve nada", () => {
    const semana = nextFreeStorySlots([], ahora, 1000);
    expect(semana).toHaveLength(70);
    expect(nextFreeStorySlots(semana, ahora, 1)).toHaveLength(0);
  });
});

describe("planAlbumStories: 3 historias por álbum en días distintos", () => {
  const ahora = new Date("2026-11-21T11:00:00Z"); // 08:00 ART

  it("un álbum: hoy, mañana y pasado", () => {
    const [plan] = planAlbumStories([], ahora, 1);
    expect(plan!.map(artDateKey)).toEqual(["2026-11-21", "2026-11-22", "2026-11-23"]);
  });

  it("las tres historias de un álbum nunca caen el mismo día", () => {
    for (const n of [1, 4, 7, 12]) {
      for (const p of planAlbumStories([], ahora, n)) {
        const dias = p.map(artDateKey);
        expect(new Set(dias).size).toBe(dias.length);
        expect([...dias].sort()).toEqual(dias); // y en orden
      }
    }
  });

  it("nunca más de 10 por día, sumando todos los álbumes", () => {
    const plan = planAlbumStories([], ahora, 12).flat();
    const porDia = new Map<string, number>();
    for (const s of plan) porDia.set(artDateKey(s), (porDia.get(artDateKey(s)) ?? 0) + 1);
    expect(Math.max(...porDia.values())).toBeLessThanOrEqual(MAX_STORIES_PER_DAY);
  });

  it("primero va la historia 1 de cada álbum: con 12 álbumes, hoy salen 10 historias 1", () => {
    const plan = planAlbumStories([], ahora, 12);
    const hoy = plan.flat().filter((s) => artDateKey(s) === "2026-11-21");
    expect(hoy).toHaveLength(10);
    // Las 10 de hoy son la primera historia de los 10 primeros álbumes.
    for (let a = 0; a < 10; a++) expect(artDateKey(plan[a]![0]!)).toBe("2026-11-21");
  });

  it("respeta lo que ya estaba agendado", () => {
    const yaAgendadas = planAlbumStories([], ahora, 3).flat(); // 9 historias
    const [nuevo] = planAlbumStories(yaAgendadas, ahora, 1);
    // Hoy quedaban 7 lugares: el nuevo entra hoy.
    expect(artDateKey(nuevo![0]!)).toBe("2026-11-21");
    expect(nuevo).toHaveLength(3);
  });

  it("si la semana está llena, el álbum se queda con menos historias en vez de esperar", () => {
    const llena = planAlbumStories([], ahora, 30).flat(); // satura los 7 días
    const [nuevo] = planAlbumStories(llena, ahora, 1);
    expect(nuevo!.length).toBeLessThan(3);
  });
});

describe("repartirFotos", () => {
  it("alterna las fotos entre las historias, sin repetir", () => {
    const r = repartirFotos([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], [4, 3, 4]);
    expect(r).toEqual([
      [1, 4, 7, 10],
      [2, 5, 8],
      [3, 6, 9, 11],
    ]);
    expect(new Set(r.flat()).size).toBe(11);
  });

  it("con pocas fotos, las últimas historias quedan cortas (y no se inventan fotos)", () => {
    expect(repartirFotos([1, 2, 3, 4], [3, 3, 3])).toEqual([[1, 4], [2], [3]]);
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

describe("los 20 modelos", () => {
  it("son 20, con identificador único", () => {
    expect(STORY_COLLAGES).toHaveLength(20);
    expect(new Set(STORY_COLLAGES.map((c) => c.id)).size).toBe(20);
  });

  it("dos seguidas nunca repiten fondo (contando la vuelta del final al principio)", () => {
    const fondo = (i: number) => STORY_COLLAGES[i % 20]!.document.sides[0]!.background;
    for (let i = 0; i < 20; i++) expect(fondo(i)).not.toBe(fondo(i + 1));
  });

  it("todas llevan el logo y «Compramelafoto.com»", () => {
    for (const c of STORY_COLLAGES) {
      const bloques = c.document.sides[0]!.blocks;
      expect(bloques.some((b) => b.type === "image" && [LOGO_COLOR_REF, LOGO_BLANCO_REF].includes(b.resourceRef ?? ""))).toBe(true);
      expect(bloques.some((b) => b.type === "text" && b.content === "Compramelafoto.com")).toBe(true);
    }
  });

  it("logo, textos y botón quedan dentro de la zona que no tapa Instagram", () => {
    for (const c of STORY_COLLAGES) {
      for (const b of c.document.sides[0]!.blocks) {
        const esFoto = b.type === "image" && Boolean(b.variableKey);
        if (esFoto) continue;
        expect(b.y, `${c.id} · ${b.id}`).toBeGreaterThanOrEqual(SEGURA_ARRIBA);
        expect(b.y + b.height, `${c.id} · ${b.id}`).toBeLessThanOrEqual(SEGURA_ABAJO);
      }
    }
  });

  it("las fotos no se pisan con el texto ni se salen de la hoja", () => {
    for (const c of STORY_COLLAGES) {
      const bloques = c.document.sides[0]!.blocks;
      const fotos = bloques.filter((b) => b.type === "image" && b.variableKey);
      const textos = bloques.filter((b) => b.type === "text" || b.type === "rect" || (b.type === "image" && !b.variableKey));
      for (const f of fotos) {
        expect(f.x).toBeGreaterThanOrEqual(0);
        expect(f.x + f.width).toBeLessThanOrEqual(1080);
        for (const t of textos) {
          const seCruzan = f.x < t.x + t.width && t.x < f.x + f.width && f.y < t.y + t.height && t.y < f.y + f.height;
          expect(seCruzan, `${c.id}: ${f.id} pisa ${t.id}`).toBe(false);
        }
      }
    }
  });

  it("el logo se resuelve a un PNG", () => {
    const png = readStoryBrandResource(LOGO_COLOR_REF)!;
    expect([...png.slice(1, 4)].map((n) => String.fromCharCode(n)).join("")).toBe("PNG");
    expect(readStoryBrandResource(LOGO_BLANCO_REF)).not.toBeNull();
    expect(readStoryBrandResource("otra-cosa")).toBeNull();
  });
});

describe("elegirCollages: modelos según la forma de las fotos", () => {
  const promedio = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

  it("para fotos horizontales elige modelos donde entran más completas que el promedio", () => {
    const elegidos = elegirCollages(1.5, 0, 3);
    const todos = STORY_COLLAGES.map((c) => ajusteDelCollage(c, 1.5));
    expect(promedio(elegidos.map((c) => ajusteDelCollage(c, 1.5)))).toBeGreaterThan(promedio(todos));
  });

  it("para fotos verticales elige otros modelos que para horizontales", () => {
    const h = new Set(Array.from({ length: 20 }, (_, i) => elegirCollages(1.5, i, 1)[0]!.id));
    const v = new Set(Array.from({ length: 20 }, (_, i) => elegirCollages(0.67, i, 1)[0]!.id));
    expect([...v].some((id) => !h.has(id))).toBe(true);
  });

  it("devuelve modelos distintos y rota con el ordinal", () => {
    const a = elegirCollages(1.5, 0, 3);
    expect(new Set(a.map((c) => c.id)).size).toBe(3);
    expect(elegirCollages(1.5, 1, 3)[0]!.id).toBe(a[1]!.id);
  });

  it("siempre tiene al menos 6 modelos para rotar", () => {
    for (const aspecto of [0.5, 0.67, 1, 1.5, 2]) {
      const ids = new Set(Array.from({ length: 30 }, (_, i) => elegirCollages(aspecto, i, 1)[0]!.id));
      expect(ids.size).toBeGreaterThanOrEqual(6);
    }
  });
});

describe("cuentas extra para etiquetar", () => {
  it("acepta @, usuario o link; descarta repetidas, al fotógrafo y a la plataforma", () => {
    const r = normalizeExtraHandles(
      ["@club.atletico", "https://instagram.com/sponsor_sa", "CLUB.ATLETICO", "@foto", "@compramelafoto", "no válido!!"],
      ["foto"],
    );
    expect(r.handles).toEqual(["club.atletico", "sponsor_sa"]);
    expect(r.invalid).toEqual(["no válido!!"]);
  });

  it("corta en 20", () => {
    const muchas = Array.from({ length: 25 }, (_, i) => `cuenta${i + 1}`);
    expect(normalizeExtraHandles(muchas).handles).toHaveLength(20);
  });
});

describe("frase que va cambiando", () => {
  it("cambia según el día: el mismo álbum no repite frase en sus 3 historias", () => {
    for (const albumId of [1, 2, 1557, 99999]) {
      const frases = [1, 2, 3].map((d) => fraseDeHistoria(d, albumId));
      expect(new Set(frases).size).toBe(3);
    }
  });

  it("álbumes distintos usan variantes distintas del mismo día", () => {
    const delDia1 = new Set([1, 2, 3, 4, 5].map((id) => fraseDeHistoria(1, id)));
    expect(delDia1.size).toBe(5);
  });

  it("todas entran en una línea con letra grande (≤ 28 caracteres)", () => {
    for (const f of FRASES_POR_DIA.flat()) expect(f.length).toBeLessThanOrEqual(28);
  });
});

describe("textos", () => {
  it("la dirección impresa es la corta", () => {
    expect(storyShortUrl(1557)).toBe("compramelafoto.com/a/1557");
  });

  it("crédito con @ o con nombre", () => {
    expect(storyCredit("juanfoto", "Juan")).toBe("Fotos de @juanfoto");
    expect(storyCredit(null, "Juan Pérez")).toBe("Fotos de Juan Pérez");
    expect(storyCredit(null, null)).toBe("");
  });

  it("recorta títulos largos", () => {
    expect(storyAlbumTitle("a".repeat(80))).toHaveLength(80);
    expect(storyAlbumTitle("a".repeat(100))).toHaveLength(78);
    expect(storyAlbumTitle("  Maratón   2026 ")).toBe("Maratón 2026");
  });
});
