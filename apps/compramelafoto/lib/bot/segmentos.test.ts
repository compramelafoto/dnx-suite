import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("./escolar/progreso", () => ({ computeSchoolSetupProgress: vi.fn() }));
vi.mock("./outreach", () => ({ leerOutreachPanel: vi.fn() }));

import { elegirCampania, type DatosSegmento } from "./segmentos";
import type { ProgresoEscolar } from "./escolar/progreso";

const NOW = new Date("2026-10-12T15:00:00Z"); // 12:00 AR -> Buen día
const dias = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

const progreso = (o: Partial<ProgresoEscolar> = {}): ProgresoEscolar => ({
  albumId: 5, albumTitulo: "5to A", schoolId: 1, pasos: [], hechos: 3, total: 11,
  siguiente: { n: 4, id: "album_vinculado", titulo: "Crear el Álbum Vinculado", estado: "pendiente", opcional: false, enlace: null },
  aMedias: false, ...o,
});
const base = (o: Partial<DatosSegmento> = {}): DatosSegmento => ({
  nombre: "Ana Pérez", registradoHace: 100, tieneAlbum: true, vendio: true, tuvoEscolar: true,
  progreso: null, outreach: [], ...o,
});

describe("elegirCampania", () => {
  it("nadie aplica -> null", () => {
    expect(elegirCampania(base(), NOW)).toBeNull();
  });
  it("prioridad: escolar_en_curso gana sobre nuevo, sin_ventas y sin_escolar", () => {
    expect(elegirCampania(base({ progreso: progreso(), registradoHace: 3, tieneAlbum: false }), NOW)!.campaign).toBe("escolar_en_curso");
    expect(elegirCampania(base({ registradoHace: 3, tieneAlbum: false, vendio: false }), NOW)!.campaign).toBe("nuevo");
    expect(elegirCampania(base({ tieneAlbum: true, vendio: false }), NOW)!.campaign).toBe("sin_ventas");
    expect(elegirCampania(base({ tuvoEscolar: false }), NOW)!.campaign).toBe("sin_escolar");
  });
  it("nuevo no aplica a los 15 días", () => {
    expect(elegirCampania(base({ registradoHace: 15, tieneAlbum: false, vendio: false, tuvoEscolar: false }), NOW)).toBeNull();
  });
  it("textos exactos y primer nombre", () => {
    const g = elegirCampania(base({ progreso: progreso() }), NOW)!;
    expect(g.texto).toBe("Buen día, Ana. Tu álbum escolar **5to A** va por el paso 4 de 11: crear el álbum vinculado. ¿Seguimos?");
    expect(g.botones).toEqual([
      { label: "Seguimos", mensaje: "Quiero seguir con mi álbum escolar", accion: "CLICKED" },
      { label: "Ahora no", mensaje: null, accion: "DISMISSED" },
    ]);
    const s = elegirCampania(base({ tuvoEscolar: false }), NOW)!;
    expect(s.texto.startsWith("¡Buen día, Ana! ¿Te dedicás")).toBe(true);
    expect(s.botones.map((b) => b.accion)).toEqual(["CLICKED", "CLICKED", "DECLINED"]);
  });
  it("sin nombre no deja coma suelta", () => {
    for (const nombre of [null, "   "]) {
      const g = elegirCampania(base({ nombre, tuvoEscolar: false }), NOW)!;
      expect(g.texto.startsWith("¡Buen día! ")).toBe(true);
      const v = elegirCampania(base({ nombre, tieneAlbum: true, vendio: false }), NOW)!;
      expect(v.texto.startsWith("Buen día. Vi que")).toBe(true);
    }
  });
  it("aMedias usa el texto especial", () => {
    const g = elegirCampania(base({ progreso: progreso({ aMedias: true }) }), NOW)!;
    expect(g.texto).toBe("Buen día, Ana. Tu álbum **5to A** está marcado como escolar pero no tiene escuela, así que queda a medias. ¿Lo arreglamos?");
  });
  it("progreso sin siguiente o sin álbum no dispara escolar_en_curso", () => {
    expect(elegirCampania(base({ progreso: progreso({ siguiente: null }) }), NOW)).toBeNull();
    expect(elegirCampania(base({ progreso: progreso({ albumId: null }) }), NOW)).toBeNull();
  });

  describe("supresión", () => {
    const sinEsc = (status: string, d: number) => base({ tuvoEscolar: false, outreach: [{ campaign: "sin_escolar", status, updatedAt: dias(d) }] });
    it("DECLINED: día 89 suprime, día 91 vuelve", () => {
      expect(elegirCampania(sinEsc("DECLINED", 89), NOW)).toBeNull();
      expect(elegirCampania(sinEsc("DECLINED", 91), NOW)!.campaign).toBe("sin_escolar");
    });
    it("DISMISSED: 6 días suprime, 8 vuelve", () => {
      expect(elegirCampania(sinEsc("DISMISSED", 6), NOW)).toBeNull();
      expect(elegirCampania(sinEsc("DISMISSED", 8), NOW)!.campaign).toBe("sin_escolar");
    });
    it("CLICKED suprime siempre (salvo escolar); SHOWN no", () => {
      expect(elegirCampania(sinEsc("CLICKED", 400), NOW)).toBeNull();
      expect(elegirCampania(sinEsc("SHOWN", 1), NOW)!.campaign).toBe("sin_escolar");
    });
    it("escolar CLICKED: suprime el mismo día, vuelve al día siguiente", () => {
      const mk = (u: Date) => base({ progreso: progreso(), outreach: [{ campaign: "escolar_en_curso", status: "CLICKED", updatedAt: u }] });
      expect(elegirCampania(mk(new Date("2026-10-12T11:00:00Z")), NOW)).toBeNull(); // 08:00 AR mismo día
      expect(elegirCampania(mk(new Date("2026-10-11T23:00:00Z")), NOW)!.campaign).toBe("escolar_en_curso");
    });
    it("escolar DISMISSED reciente cae a la siguiente campaña", () => {
      const d = base({ progreso: progreso(), tuvoEscolar: false, outreach: [{ campaign: "escolar_en_curso", status: "DISMISSED", updatedAt: dias(2) }] });
      expect(elegirCampania(d, NOW)!.campaign).toBe("sin_escolar");
    });
    it("el estado de otra campaña no suprime", () => {
      const d = base({ tuvoEscolar: false, outreach: [{ campaign: "nuevo", status: "DECLINED", updatedAt: dias(1) }] });
      expect(elegirCampania(d, NOW)!.campaign).toBe("sin_escolar");
    });
  });

  describe("forzar", () => {
    const sinEsc = (status: string, d: number) => base({ tuvoEscolar: false, outreach: [{ campaign: "sin_escolar", status, updatedAt: dias(d) }] });
    it("fuerza aunque esté CLICKED o DISMISSED", () => {
      expect(elegirCampania(sinEsc("CLICKED", 3), NOW, { forzar: "sin_escolar" })!.campaign).toBe("sin_escolar");
      expect(elegirCampania(sinEsc("DISMISSED", 1), NOW, { forzar: "sin_escolar" })!.campaign).toBe("sin_escolar");
    });
    it("nunca fuerza una DECLINED de menos de 90 días", () => {
      expect(elegirCampania(sinEsc("DECLINED", 10), NOW, { forzar: "sin_escolar" })).toBeNull();
      expect(elegirCampania(sinEsc("DECLINED", 91), NOW, { forzar: "sin_escolar" })!.campaign).toBe("sin_escolar");
    });
    it("no fuerza si la condición no se cumple, ni cae a otra campaña", () => {
      expect(elegirCampania(base({ tuvoEscolar: true }), NOW, { forzar: "sin_escolar" })).toBeNull();
      expect(elegirCampania(base({ tuvoEscolar: false, tieneAlbum: true, vendio: false }), NOW, { forzar: "sin_escolar" })).toBeNull();
    });
  });
});
