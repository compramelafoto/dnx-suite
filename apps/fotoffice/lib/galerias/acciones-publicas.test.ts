import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
let ip = "1.1.1.1";
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": ip }) }));
vi.mock("@/lib/auth", () => ({ getAuthUser: async () => null }));
vi.mock("@/lib/presupuestos/vistas", () => ({ esDelEquipo: async () => false }));
const despues: (() => unknown)[] = [];
vi.mock("next/server", () => ({ after: (fn: () => unknown) => despues.push(fn) }));
vi.mock("@/lib/presupuestos/sitio", () => ({ workspaceDelSlug: async (s: unknown) => (s === "dnxestudio" ? "ws-1" : null) }));
const P = vi.hoisted(() => ({
  elegirFoto: vi.fn(async () => ({ ok: true, cantidad: 1 })),
  comentarFoto: vi.fn(),
  enviarSeleccion: vi.fn(),
  urlDeDescarga: vi.fn(),
  urlsDeVista: vi.fn(),
}));
vi.mock("@/lib/galerias/publico", () => P);
const aviso = vi.hoisted(() => vi.fn(async () => ({ cliente: "ENVIADO", estudio: "ENVIADO" })));
vi.mock("@/lib/galerias/avisos", () => ({ avisarSeleccionEnviada: aviso }));

const A = await import("../../app/w/[workspaceSlug]/galeria/[token]/acciones");
const { resetRateLimit } = await import("@/lib/geocode/rate-limit");
const V = await import("../../app/w/[workspaceSlug]/galeria/[token]/visitante");

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimit();
  despues.length = 0;
  ip = "1.1.1.1";
});

describe("acciones públicas: freno y workspace", () => {
  it("un slug desconocido da 'no válido' sin llegar a la lógica", async () => {
    expect(await A.elegirFotoAction("nadie", "t", "f1", true)).toMatchObject({ ok: false, codigo: "INVALIDO" });
    expect(P.elegirFoto).not.toHaveBeenCalled();
  });
  it("pasa el workspace del slug (no uno que mande el navegador) y el token tal cual", async () => {
    await A.elegirFotoAction("dnxestudio", "tok", "f1", true);
    expect(P.elegirFoto).toHaveBeenCalledWith("ws-1", "tok", "f1", true);
  });
  it("enviar: tras 10 intentos desde la misma IP, el freno responde sin tocar la base; otra IP sigue pasando", async () => {
    P.enviarSeleccion.mockResolvedValue({ ok: false, error: "x", codigo: "REGLA" });
    for (let i = 0; i < 10; i++) expect(await A.enviarSeleccionAction("dnxestudio", "t", "")).toMatchObject({ codigo: "REGLA" });
    expect(await A.enviarSeleccionAction("dnxestudio", "t", "")).toMatchObject({ ok: false, codigo: "TOPE" });
    expect(P.enviarSeleccion).toHaveBeenCalledTimes(10);
    ip = "2.2.2.2";
    expect(await A.enviarSeleccionAction("dnxestudio", "t", "")).toMatchObject({ codigo: "REGLA" });
  });
  it("cada acción tiene su propio contador", async () => {
    P.enviarSeleccion.mockResolvedValue({ ok: false, error: "x", codigo: "REGLA" });
    for (let i = 0; i < 11; i++) await A.enviarSeleccionAction("dnxestudio", "t", "");
    await A.elegirFotoAction("dnxestudio", "t", "f1", true);
    expect(P.elegirFoto).toHaveBeenCalledTimes(1);
  });
  it("la página: 60 aperturas por IP cada 10 minutos", async () => {
    for (let i = 0; i < 60; i++) expect((await V.visitanteDelEnlace()).permitido).toBe(true);
    expect((await V.visitanteDelEnlace()).permitido).toBe(false);
    ip = "3.3.3.3";
    expect((await V.visitanteDelEnlace()).permitido).toBe(true);
  });
});

describe("enviar y los correos", () => {
  it("al enviar bien, programa los avisos con after() (y no los espera); al fallar, no manda nada", async () => {
    const hecho = { ok: true, cantidad: 3, enviadaEn: "10 de octubre", aviso: { workspaceId: "ws-1", galeriaId: "g1", galeriaClienteId: "gc1", cantidad: 3 } };
    P.enviarSeleccion.mockResolvedValueOnce(hecho);
    const r = await A.enviarSeleccionAction("dnxestudio", "t", "hola");
    expect(r).toEqual({ ok: true, cantidad: 3, enviadaEn: "10 de octubre" });
    expect(aviso).not.toHaveBeenCalled();
    expect(despues).toHaveLength(1);
    await despues[0]!();
    expect(aviso).toHaveBeenCalledWith(hecho.aviso);

    despues.length = 0;
    P.enviarSeleccion.mockResolvedValueOnce({ ok: false, error: "ya", codigo: "SOLO_LECTURA" });
    expect(await A.enviarSeleccionAction("dnxestudio", "t", "")).toMatchObject({ ok: false });
    expect(despues).toHaveLength(0);
  });
});
