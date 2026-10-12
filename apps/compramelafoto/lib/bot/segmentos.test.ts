import { describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  albumCount: vi.fn(),
  orderFindFirst: vi.fn(),
  albumFindFirst: vi.fn(),
  progreso: vi.fn(),
  outreach: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: (...a: unknown[]) => m.userFindUnique(...a) },
    album: { count: (...a: unknown[]) => m.albumCount(...a), findFirst: (...a: unknown[]) => m.albumFindFirst(...a) },
    order: { findFirst: (...a: unknown[]) => m.orderFindFirst(...a) },
  },
}));
vi.mock("./escolar/progreso", () => ({ computeSchoolSetupProgress: (...a: unknown[]) => m.progreso(...a) }));
vi.mock("./outreach", () => ({ leerOutreachPanel: (...a: unknown[]) => m.outreach(...a) }));

import { cargarDatosSegmento, elegirCampania, type DatosSegmento } from "./segmentos";
import type { ProgresoEscolar } from "./escolar/progreso";

const NOW = new Date("2026-10-12T15:00:00Z"); // 12:00 AR -> Buen día
const dias = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

const progreso = (o: Partial<ProgresoEscolar> = {}): ProgresoEscolar => ({
  albumId: 5, albumTitulo: "5to A", schoolId: 1, pasos: [], hechos: 3, total: 11,
  siguiente: { n: 4, id: "album_vinculado", titulo: "Crear el Álbum Vinculado", estado: "pendiente", opcional: false, accion: true, enlace: null },
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
      { label: "No, gracias", mensaje: null, accion: "DECLINED" },
    ]);
    const s = elegirCampania(base({ tuvoEscolar: false }), NOW)!;
    expect(s.texto.startsWith("¡Buen día, Ana! ¿Te dedicás")).toBe(true);
    expect(s.texto).toContain("automatizarlo: preventa, cursos, plantillas y entrega.");
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
    expect(g.botones.map((b) => [b.label, b.accion])).toEqual([
      ["Arreglemos", "CLICKED"],
      ["Ahora no", "DISMISSED"],
      ["No, gracias", "DECLINED"],
    ]);
  });
  it("escolar_en_curso no insiste si lo que sigue es un paso opcional", () => {
    const sig = { n: 3, id: "admin_escuela" as const, titulo: "Invitar", estado: "pendiente" as const, opcional: true, accion: true, enlace: null };
    expect(elegirCampania(base({ progreso: progreso({ siguiente: sig }) }), NOW)).toBeNull();
    expect(elegirCampania(base({ progreso: progreso({ siguiente: { ...sig, opcional: false, estado: "hecho" } }) }), NOW)).toBeNull();
  });
  it("escolar_en_curso DECLINED: 90 días sin mostrarse, ni forzada", () => {
    const d = base({ progreso: progreso(), outreach: [{ campaign: "escolar_en_curso", status: "DECLINED", updatedAt: dias(30) }] });
    expect(elegirCampania(d, NOW)).toBeNull();
    expect(elegirCampania(d, NOW, { forzar: "escolar_en_curso" })).toBeNull();
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

describe("cargarDatosSegmento", () => {
  it("excluye álbumes de prueba de tuvoEscolar y pide el progreso sólo de álbumes recientes", async () => {
    m.userFindUnique.mockResolvedValue({ name: "Ana", createdAt: dias(400) });
    m.albumCount.mockResolvedValue(2);
    m.orderFindFirst.mockResolvedValue({ id: 1 });
    m.albumFindFirst.mockResolvedValue({ id: 8 });
    m.outreach.mockResolvedValue([]);
    m.progreso.mockResolvedValue(progreso());
    const d = await cargarDatosSegmento(7);
    expect(m.albumFindFirst.mock.calls[0][0].where).toMatchObject({ userId: 7, deletedAt: null, isTest: false });
    expect(m.progreso).toHaveBeenCalledWith(7, undefined, expect.any(Date), { soloRecientes: true });
    expect(d.tuvoEscolar).toBe(true);
    expect(d.progreso?.albumId).toBe(5);
  });

  it("sin álbum escolar real no calcula el progreso", async () => {
    m.progreso.mockClear();
    m.userFindUnique.mockResolvedValue({ name: "Ana", createdAt: dias(400) });
    m.albumCount.mockResolvedValue(1);
    m.orderFindFirst.mockResolvedValue(null);
    m.albumFindFirst.mockResolvedValue(null);
    m.outreach.mockResolvedValue([]);
    const d = await cargarDatosSegmento(7);
    expect(d.tuvoEscolar).toBe(false);
    expect(d.progreso).toBeNull();
    expect(m.progreso).not.toHaveBeenCalled();
  });
});
