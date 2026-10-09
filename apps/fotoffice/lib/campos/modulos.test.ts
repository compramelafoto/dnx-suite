import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({ encendidos: new Set<string>() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/modules/gating", () => ({ isModuleEnabledForWorkspace: async (_ws: string, clave: string) => H.encendidos.has(clave) }));

const { enumerar, moduloDeRegistroEncendido, MODULO_DE_REGISTRO, tiposConModuloEncendido } = await import("./modulos");

beforeEach(() => {
  H.encendidos = new Set();
});

describe("módulos de los tipos de registro", () => {
  it("cada tipo con su módulo; un tipo desconocido nunca está encendido", async () => {
    H.encendidos = new Set([MODULO_DE_REGISTRO.SOCIO]);
    expect(await moduloDeRegistroEncendido("ws", "SOCIO")).toBe(true);
    expect(await moduloDeRegistroEncendido("ws", "CLIENTE")).toBe(false);
    expect(await moduloDeRegistroEncendido("ws", "PRESUPUESTO")).toBe(false);
  });

  it("Proyectos tiene campos con su módulo `projects`", async () => {
    expect(MODULO_DE_REGISTRO.PROYECTO).toBe("projects");
    H.encendidos = new Set(["projects"]);
    expect(await moduloDeRegistroEncendido("ws", "PROYECTO")).toBe(true);
    expect(await tiposConModuloEncendido("ws")).toEqual(["PROYECTO"]);
  });

  it("los tipos encendidos, en el orden de siempre", async () => {
    expect(await tiposConModuloEncendido("ws")).toEqual([]);
    H.encendidos = new Set([MODULO_DE_REGISTRO.CONSULTA, MODULO_DE_REGISTRO.CLIENTE]);
    expect(await tiposConModuloEncendido("ws")).toEqual(["CLIENTE", "CONSULTA"]);
  });

  it("enumerar", () => {
    expect(enumerar([], "y")).toBe("");
    expect(enumerar(["clientes"], "y")).toBe("clientes");
    expect(enumerar(["clientes", "socios"], "o")).toBe("clientes o socios");
    expect(enumerar(["clientes", "socios", "consultas"], "y")).toBe("clientes, socios y consultas");
  });
});
