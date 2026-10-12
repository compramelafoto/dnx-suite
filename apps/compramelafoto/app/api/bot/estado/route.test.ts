import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ user: vi.fn(), enabled: vi.fn(), cfg: vi.fn(), sit: vi.fn(), datos: vi.fn(), visto: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getAuthUser: () => m.user() }));
vi.mock("@/lib/bot/config", () => ({ isBotEnabledForUser: () => m.enabled(), readBotConfig: () => m.cfg() }));
vi.mock("@/lib/bot/contexto", () => ({ buildPhotographerSituation: (...a: unknown[]) => m.sit(...a) }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/bot/escolar/progreso", () => ({ computeSchoolSetupProgress: vi.fn() }));
vi.mock("@/lib/bot/outreach", async (orig) => ({
  ...(await orig<typeof import("@/lib/bot/outreach")>()),
  leerOutreachPanel: vi.fn(),
  registrarVisto: (...a: unknown[]) => m.visto(...a),
}));
vi.mock("@/lib/bot/segmentos", async (orig) => ({
  ...(await orig<typeof import("@/lib/bot/segmentos")>()),
  cargarDatosSegmento: (...a: unknown[]) => m.datos(...a),
}));
import { GET } from "./route";

const datos = (o: Record<string, unknown> = {}) => ({
  nombre: "Ana", registradoHace: 100, tieneAlbum: true, vendio: true, tuvoEscolar: false, progreso: null, outreach: [], ...o,
});
const get = (q = "") => GET(new Request(`http://x/api/bot/estado${q}`));

beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
  m.cfg.mockReturnValue({ enabled: true });
  m.user.mockResolvedValue({ id: 7, role: "PHOTOGRAPHER", email: "f@x.com", name: "F" });
  m.enabled.mockResolvedValue(true);
  m.sit.mockResolvedValue({ alerts: [] });
  m.datos.mockResolvedValue(datos());
  m.visto.mockResolvedValue(undefined);
});

describe("GET /api/bot/estado", () => {
  it("bot apagado → no lee la sesión", async () => {
    m.cfg.mockReturnValue({ enabled: false });
    expect(await (await GET()).json()).toEqual({ enabled: false });
    expect(m.user).not.toHaveBeenCalled();
  });
  it("alerta que bloquea ventas → saludo con la alerta", async () => {
    m.sit.mockResolvedValue({ alerts: [{ level: "bloquea_ventas", text: "No tenés Mercado Pago conectado." }] });
    const r = await (await GET()).json();
    expect(r).toMatchObject({ enabled: true, alerta: true });
    expect(r.saludo).toContain("Mercado Pago");
  });
  it("si falla armar la situación → saludo neutro, sin romper", async () => {
    m.sit.mockRejectedValue(new Error("db caída"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ enabled: true, alerta: false, saludo: "Hola, soy DNX Bot. ¿En qué te ayudo?" });
  });
  describe("globito", () => {
    it("fotógrafo: devuelve el globito y registra SHOWN", async () => {
      const r = await (await get()).json();
      expect(r.globito).toMatchObject({ campaign: "sin_escolar" });
      expect(r.progresoEscolar).toBeNull();
      expect(m.visto).toHaveBeenCalledWith(7, "sin_escolar");
    });
    it("organizador: sin globito y sin leer segmentos", async () => {
      m.user.mockResolvedValue({ id: 8, role: "ORGANIZER", email: "o@x.com", name: "O" });
      const r = await (await get()).json();
      expect(r.globito).toBeNull();
      expect(m.datos).not.toHaveBeenCalled();
      expect(m.visto).not.toHaveBeenCalled();
    });
    it("sin campaña que aplique → null y no registra", async () => {
      m.datos.mockResolvedValue(datos({ tuvoEscolar: true }));
      expect((await (await get()).json()).globito).toBeNull();
      expect(m.visto).not.toHaveBeenCalled();
    });
    it("devuelve progresoEscolar cuando hay álbum escolar", async () => {
      const progreso = { albumId: 5, albumTitulo: "5to A", schoolId: 1, pasos: [], hechos: 3, total: 11, siguiente: { n: 4, id: "x", titulo: "Paso", estado: "pendiente", opcional: false, enlace: null }, aMedias: false };
      m.datos.mockResolvedValue(datos({ tuvoEscolar: true, progreso }));
      const r = await (await get()).json();
      expect(r.progresoEscolar).toMatchObject({ albumId: 5, hechos: 3 });
      expect(r.globito.campaign).toBe("escolar_en_curso");
    });
    it("calcula el progreso escolar una sola vez: lo pasa a la situación", async () => {
      const progreso = { albumId: 5, albumTitulo: "5to A", schoolId: 1, pasos: [], hechos: 3, total: 11, siguiente: null, aMedias: false };
      m.datos.mockResolvedValue(datos({ tuvoEscolar: true, progreso }));
      await get();
      expect(m.sit).toHaveBeenCalledWith(7, { progresoEscolar: progreso });
      m.datos.mockResolvedValue(datos());
      await get();
      expect(m.sit).toHaveBeenLastCalledWith(7, { progresoEscolar: null });
    });
    it("si falla el globito, la situación calcula el progreso por su cuenta", async () => {
      m.datos.mockRejectedValue(new Error("db"));
      vi.spyOn(console, "error").mockImplementation(() => {});
      await get();
      expect(m.sit).toHaveBeenCalledWith(7, {});
    });
    it("alerta «a medias» (nivel aviso) no cambia el saludo", async () => {
      m.sit.mockResolvedValue({ alerts: [{ level: "aviso", albumId: 3, text: "«E» está marcado como escolar pero no tiene escuela: queda a medias." }] });
      const r = await (await get()).json();
      expect(r).toMatchObject({ alerta: false, saludo: "Hola, soy DNX Bot. ¿En qué te ayudo?" });
    });
    it("?campaign=sin_escolar fuerza aunque esté CLICKED o DISMISSED", async () => {
      const hace = new Date(Date.now() - 2 * 86_400_000);
      for (const status of ["CLICKED", "DISMISSED"]) {
        m.datos.mockResolvedValue(datos({ outreach: [{ campaign: "sin_escolar", status, updatedAt: hace }] }));
        expect((await (await get()).json()).globito).toBeNull();
        expect((await (await get("?campaign=sin_escolar")).json()).globito.campaign).toBe("sin_escolar");
      }
    });
    it("?campaign= no fuerza una DECLINED reciente", async () => {
      m.datos.mockResolvedValue(datos({ outreach: [{ campaign: "sin_escolar", status: "DECLINED", updatedAt: new Date(Date.now() - 86_400_000) }] }));
      expect((await (await get("?campaign=sin_escolar")).json()).globito).toBeNull();
    });
    it("?campaign= inválida se ignora", async () => {
      expect((await (await get("?campaign=otra")).json()).globito.campaign).toBe("sin_escolar");
    });
    it("si falla calcular el globito → globito null y estado 200", async () => {
      m.datos.mockRejectedValue(new Error("db"));
      vi.spyOn(console, "error").mockImplementation(() => {});
      const res = await get();
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ enabled: true, globito: null, progresoEscolar: null });
    });
    it("si falla registrar SHOWN, el globito sale igual", async () => {
      m.visto.mockRejectedValue(new Error("db"));
      vi.spyOn(console, "error").mockImplementation(() => {});
      expect((await (await get()).json()).globito.campaign).toBe("sin_escolar");
    });
  });
});
