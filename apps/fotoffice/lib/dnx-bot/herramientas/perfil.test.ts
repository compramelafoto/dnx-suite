import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBaseCompleteProfile } from "@repo/cuanto-cobro-core/__fixtures__/characterization-fixtures";
import type { BotTool } from "@repo/dnx-bot";

const H = vi.hoisted(() => ({ leer: vi.fn(), guardar: vi.fn() }));
vi.mock("@/lib/precios/perfil", () => ({
  leerPerfilPrecios: (...a: unknown[]) => H.leer(...a),
  guardarPerfilPrecios: (...a: unknown[]) => H.guardar(...a),
}));

import type { CtxBot } from "../acceso";
import { estadoDelPerfil, herramientasDePerfil } from "./perfil";
import { herramientasPara } from "./index";

const ctx = (configurar: boolean): CtxBot => ({
  workspaceId: "ws1",
  workspaceNombre: "DNX Estudio",
  userId: 7,
  userLabel: "Daniel",
  role: configurar ? "WORKSPACE_OWNER" : "STAFF",
  email: "d@x.test",
  nombre: "Daniel",
  capacidades: { configurar, gestionarPresupuestos: true, verConsultas: true },
  plataforma: "FOTOFFICE:ws1",
});
const actor = { userId: 7, role: "WORKSPACE_OWNER", email: "d@x.test", name: "Daniel" };
const tool = (nombre: string): BotTool => herramientasDePerfil(ctx(true)).find((t) => t.name === nombre)!;

beforeEach(() => {
  H.leer.mockReset().mockResolvedValue({ perfil: createBaseCompleteProfile(), source: "clf-import", actualizado: new Date("2026-10-12T15:00:00.000Z") });
  H.guardar.mockReset().mockResolvedValue({ ok: true, actualizado: new Date("2026-10-12T16:00:00.000Z") });
});

describe("quién recibe las herramientas de perfil", () => {
  it("dueño o admin: las tres; sin configurar: ninguna", () => {
    expect(herramientasPara(ctx(true)).map((t) => t.name)).toEqual(["ver_perfil_de_precios", "simular_perfil", "guardar_perfil_de_precios"]);
    expect(herramientasPara(ctx(false))).toEqual([]);
  });
  it("guardar es de escritura; ver y simular, de lectura", () => {
    expect(tool("ver_perfil_de_precios").kind).toBe("read");
    expect(tool("simular_perfil").kind).toBe("read");
    expect(tool("guardar_perfil_de_precios").kind).toBe("write");
  });
});

describe("ver_perfil_de_precios", () => {
  it("devuelve el perfil guardado con cifras formateadas y su origen", async () => {
    const r = await tool("ver_perfil_de_precios").run({}, actor);
    expect(r.ok).toBe(true);
    const d = (r as { data: Record<string, unknown> }).data as { existe: boolean; origen: string; completo: boolean; resumen: { valorHora: string } };
    expect(d.existe).toBe(true);
    expect(d.origen).toBe("clf-import");
    expect(d.completo).toBe(true);
    expect(d.resumen.valorHora).toMatch(/^\$/);
  });
  it("sin perfil: existe false y lo que falta", async () => {
    H.leer.mockResolvedValue(null);
    const r = await tool("ver_perfil_de_precios").run({}, actor);
    const d = (r as { data: { existe: boolean; completo: boolean; faltan: string[] } }).data;
    expect(d).toMatchObject({ existe: false, completo: false });
    expect(d.faltan.length).toBeGreaterThan(0);
  });
});

describe("simular_perfil", () => {
  it("no guarda nada y trae la tarjeta y los errores", async () => {
    const r = await tool("simular_perfil").run({ parche: { horasSemana: "45", distribucion: { unidad: "horas", coberturas: "10" } } }, actor);
    expect(H.guardar).not.toHaveBeenCalled();
    const d = (r as { data: { errores: string[]; tarjeta: { titulo: string } } }).data;
    expect(d.errores[0]).toMatch(/faltan repartir 35/);
    expect(d.tarjeta.titulo).toBe("Tu perfil de precios");
  });
});

describe("guardar_perfil_de_precios", () => {
  const parche = { negocio: { software: "20000" } };
  it("describe: cada dato cambiado y el valor hora antes y ahora", async () => {
    const s = await tool("guardar_perfil_de_precios").describe!({ parche }, actor);
    expect(s).toMatch(/^Guardar el perfil de precios: 1 dato cambiado\. Valor hora: antes \$.* → ahora \$/);
    expect(s).toContain("Software:");
    expect(H.guardar).not.toHaveBeenCalled();
  });
  it("describe con errores o sin cambios: no hay propuesta", async () => {
    await expect(tool("guardar_perfil_de_precios").describe!({ parche: { distribucion: { unidad: "horas", coberturas: "1" } } }, actor)).rejects.toThrow(/faltan repartir/);
    await expect(tool("guardar_perfil_de_precios").describe!({ parche: {} }, actor)).rejects.toThrow(/No hay cambios/);
  });
  it("run: relee, aplica y guarda con origen dnx-bot; before = perfil anterior", async () => {
    const r = await tool("guardar_perfil_de_precios").run({ parche }, actor);
    expect(r.ok).toBe(true);
    const [c, perfil, opciones] = H.guardar.mock.calls[0]!;
    expect(c).toMatchObject({ workspaceId: "ws1", userId: 7 });
    expect((perfil as { businessSoftware: string }).businessSoftware).toBe("20000");
    // Con la versión recién leída: si alguien guardó en el medio, no se pisa.
    expect(opciones).toEqual({ source: "dnx-bot", esperado: new Date("2026-10-12T15:00:00.000Z") });
    const before = (r as { before: { perfil: { businessSoftware: string }; guardadoPorElBot: string } }).before;
    expect(before.perfil.businessSoftware).toBe("15000");
    expect(before.guardadoPorElBot).toBe("2026-10-12T16:00:00.000Z");
  });
  it("undo: si el perfil cambió después del bot, no lo pisa y lo dice", async () => {
    H.guardar.mockResolvedValue({ ok: false, error: "El perfil cambió mientras lo tenías abierto. Recargá para ver los datos nuevos.", conflicto: true });
    const r = await tool("guardar_perfil_de_precios").undo!({ perfil: createBaseCompleteProfile(), source: "manual", guardadoPorElBot: "2026-10-12T16:00:00.000Z" }, actor);
    expect(r).toEqual({ ok: false, message: "El perfil cambió mientras lo tenías abierto. Recargá para ver los datos nuevos." });
  });

  it("run: si guardar falla, devuelve el error", async () => {
    H.guardar.mockResolvedValue({ ok: false, error: "Sólo el dueño o un administrador pueden configurar los precios." });
    const r = await tool("guardar_perfil_de_precios").run({ parche }, actor);
    expect(r).toEqual({ ok: false, message: "Sólo el dueño o un administrador pueden configurar los precios." });
  });
  it("run sin perfil previo: guarda, pero no se puede deshacer", async () => {
    H.leer.mockResolvedValue(null);
    const r = await tool("guardar_perfil_de_precios").run({ parche: { viveSoloDeFotografia: "si" } }, actor);
    expect(r.ok).toBe(true);
    expect((r as { before?: unknown }).before).toBeUndefined();
    expect(H.guardar.mock.calls[0]![2]).toEqual({ source: "dnx-bot", esperado: null });
  });
  it("undo: vuelve a guardar el perfil anterior", async () => {
    const before = { perfil: createBaseCompleteProfile(), source: "manual", guardadoPorElBot: "2026-10-12T16:00:00.000Z" };
    const r = await tool("guardar_perfil_de_precios").undo!(before, actor);
    expect(r.ok).toBe(true);
    // Sólo si sigue siendo lo que guardó el bot: no pisa un cambio posterior.
    expect(H.guardar.mock.calls[0]![2]).toEqual({ source: "manual", esperado: new Date("2026-10-12T16:00:00.000Z") });
    expect(await tool("guardar_perfil_de_precios").undo!({ basura: 1 }, actor)).toMatchObject({ ok: false });
  });
});

describe("estadoDelPerfil (para la situación)", () => {
  it("completo con su origen; sin perfil, no existe; sin configurar, null", async () => {
    expect(await estadoDelPerfil(ctx(true))).toEqual({ existe: true, completo: true, faltan: [], origen: "clf-import" });
    H.leer.mockResolvedValue(null);
    expect(await estadoDelPerfil(ctx(true))).toMatchObject({ existe: false, completo: false, origen: null });
    expect(await estadoDelPerfil(ctx(false))).toBeNull();
  });
});
