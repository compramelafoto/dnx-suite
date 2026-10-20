import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBaseCompleteProfile } from "@repo/cuanto-cobro-core/__fixtures__/characterization-fixtures";
import type { BotTool } from "@repo/dnx-bot";

const H = vi.hoisted(() => ({ leer: vi.fn(), guardar: vi.fn(), anotaciones: [] as { en: string; parche: unknown }[], limpiar: vi.fn() }));
vi.mock("@/lib/precios/perfil", () => ({
  leerPerfilPrecios: (...a: unknown[]) => H.leer(...a),
  guardarPerfilPrecios: (...a: unknown[]) => H.guardar(...a),
}));
// El borrador en memoria (en producción, una fila de BotAction: ver borrador-store.ts).
vi.mock("../borrador-store", () => ({
  leerBorrador: async () => H.anotaciones,
  anotarEnBorrador: async (_r: unknown, parche: unknown, ahora: Date = new Date()) => {
    H.anotaciones = [...H.anotaciones, { en: ahora.toISOString(), parche }];
    return H.anotaciones;
  },
  limpiarBorrador: async (r: unknown, hasta: Date) => {
    H.limpiar(r, hasta);
    H.anotaciones = H.anotaciones.filter((a) => Date.parse(a.en) > hasta.getTime());
  },
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
  H.anotaciones = [];
  H.limpiar.mockReset();
  H.leer.mockReset().mockResolvedValue({ perfil: createBaseCompleteProfile(), source: "clf-import", actualizado: new Date("2026-10-12T15:00:00.000Z") });
  H.guardar.mockReset().mockResolvedValue({ ok: true, actualizado: new Date("2026-10-12T16:00:00.000Z") });
});

describe("quién recibe las herramientas de perfil", () => {
  it("dueño o admin: las cuatro; sin configurar: ninguna", () => {
    const PERFIL = ["ver_perfil_de_precios", "simular_perfil", "anotar_en_borrador", "guardar_perfil_de_precios"];
    expect(herramientasPara(ctx(true)).map((t) => t.name)).toEqual(expect.arrayContaining(PERFIL));
    expect(herramientasPara(ctx(false)).map((t) => t.name).filter((n) => PERFIL.includes(n))).toEqual([]);
  });
  it("guardar es de escritura; ver y simular, de lectura", () => {
    expect(tool("ver_perfil_de_precios").kind).toBe("read");
    expect(tool("simular_perfil").kind).toBe("read");
    // Anotar no toca el perfil guardado: no pide «Confirmar».
    expect(tool("anotar_en_borrador").kind).toBe("read");
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

describe("borrador del perfil (lo que se va contando, sin guardar)", () => {
  const vacio = () => H.leer.mockResolvedValue(null);

  it("anotar_en_borrador: anota sin tocar el perfil guardado y devuelve lo que va (totales del motor)", async () => {
    vacio();
    const r = await tool("anotar_en_borrador").run(
      { parche: { viveSoloDeFotografia: "si", gastosPersonales: [{ grupoId: "housing", itemId: "rent-mortgage", monto: "450000" }] } },
      actor,
    );
    expect(r.ok).toBe(true);
    expect(H.guardar).not.toHaveBeenCalled();
    expect(H.anotaciones).toHaveLength(1);
    const d = (r as { data: { anotado: string[]; resumen: { gastosPersonales: string }; tarjeta: { titulo: string } } }).data;
    expect(d.anotado.join(" ")).toMatch(/Vivienda/);
    expect(d.resumen.gastosPersonales).toMatch(/450\.000/);
    expect(d.tarjeta.titulo).toMatch(/hasta ahora/i);
  });

  it("anotar con período: la cuenta la hace el servidor y vuelve escrita («80.000 cada 3 meses = 26.667 por mes»)", async () => {
    vacio();
    const r = await tool("anotar_en_borrador").run(
      { parche: { gastosPersonales: [{ grupoId: "other", itemId: "pets", monto: { monto: "80000", periodo: "trimestral" } }] } },
      actor,
    );
    const d = (r as { data: { conversiones: { detalle: string }[]; tarjeta: { filas: { valor: string }[] } } }).data;
    expect(d.conversiones[0]!.detalle).toMatch(/80\.000 cada 3 meses = \$\s?26\.667 por mes/);
    expect(d.tarjeta.filas.some((f) => /26\.667 por mes/.test(f.valor))).toBe(true);
  });

  it("anotar un dato inválido no lo guarda y explica qué corregir", async () => {
    vacio();
    const r = await tool("anotar_en_borrador").run({ parche: { gastosPersonales: [{ grupoId: "nada", monto: "1" }] } }, actor);
    expect(r.ok).toBe(false);
    expect(H.anotaciones).toHaveLength(0);
  });

  it("ver_perfil_de_precios trae el borrador con sus totales; simular_perfil lo suma solo", async () => {
    vacio();
    await tool("anotar_en_borrador").run({ parche: { gastosPersonales: [{ grupoId: "housing", itemId: "rent-mortgage", monto: "450000" }] } }, actor);
    const v = (await tool("ver_perfil_de_precios").run({}, actor)) as { data: { existe: boolean; borrador: { anotado: string[]; resumen: { gastosPersonales: string } } | null } };
    expect(v.data.existe).toBe(false);
    expect(v.data.borrador!.anotado.join(" ")).toMatch(/Alquiler/);
    expect(v.data.borrador!.resumen.gastosPersonales).toMatch(/450\.000/);
    const s = (await tool("simular_perfil").run({ parche: { gastosPersonales: [{ grupoId: "food", itemId: "supermarket", monto: "50000" }] } }, actor)) as {
      data: { resumen: { gastosPersonales: string } };
    };
    expect(s.data.resumen.gastosPersonales).toMatch(/500\.000/);
    // Simular no anota.
    expect(H.anotaciones).toHaveLength(1);
  });

  it("sin borrador, ver_perfil_de_precios dice borrador: null", async () => {
    const v = (await tool("ver_perfil_de_precios").run({}, actor)) as { data: { borrador: unknown } };
    expect(v.data.borrador).toBeNull();
  });

  it("guardar: prepare junta el borrador con el parche (congelado al proponer) y, al guardar bien, limpia lo anotado", async () => {
    vacio();
    await tool("anotar_en_borrador").run({ parche: { viveSoloDeFotografia: "si" } }, actor);
    await tool("anotar_en_borrador").run({ parche: { negocio: { software: "20000" } } }, actor);
    const g = tool("guardar_perfil_de_precios");
    const entrada = await g.prepare!({ parche: { ahorro: "30000" } }, actor);
    expect(entrada.parche).toEqual({ viveSoloDeFotografia: "si", negocio: { software: "20000" }, ahorro: "30000" });
    expect(entrada.borradorHasta).toBe(H.anotaciones.at(-1)!.en);
    expect(g.input.safeParse(entrada).success).toBe(true);
    expect(await g.describe!(entrada, actor)).toMatch(/Software/);
    const r = await g.run(entrada, actor);
    expect(r.ok).toBe(true);
    expect((H.guardar.mock.calls[0]![1] as { businessSoftware: string }).businessSoftware).toBe("20000");
    expect(H.limpiar).toHaveBeenCalledWith({ plataforma: "FOTOFFICE:ws1", userId: 7 }, new Date(entrada.borradorHasta));
    expect(H.anotaciones).toHaveLength(0);
  });

  it("guardar que falla no borra el borrador", async () => {
    vacio();
    await tool("anotar_en_borrador").run({ parche: { viveSoloDeFotografia: "si" } }, actor);
    H.guardar.mockResolvedValue({ ok: false, error: "x" });
    const g = tool("guardar_perfil_de_precios");
    await g.run(await g.prepare!({ parche: {} }, actor), actor);
    expect(H.limpiar).not.toHaveBeenCalled();
    expect(H.anotaciones).toHaveLength(1);
  });

  it("estadoDelPerfil con borrador: qué hay anotado antes de la ventana y qué falta (sin montos)", async () => {
    vacio();
    H.anotaciones = [
      { en: "2026-10-13T07:05:00.000Z", parche: { viveSoloDeFotografia: "si", gastosPersonales: [{ grupoId: "housing", itemId: "rent-mortgage", monto: "450000" }] } },
      { en: "2026-10-13T09:00:00.000Z", parche: { gastosPersonales: [{ grupoId: "food", itemId: "supermarket", monto: "350000" }] } },
    ];
    const e = await estadoDelPerfil(ctx(true), { borradorHasta: new Date("2026-10-13T08:00:00.000Z") });
    expect(e!.borrador!.anotado.join(" ")).toMatch(/Vivienda/);
    // Lo anotado después del corte ya está en el historial que ve el modelo: no se repite.
    expect(e!.borrador!.anotado.join(" ")).not.toMatch(/Alimentaci/);
    expect(e!.borrador!.rubrosSinDatos).toContain("Alimentación");
    expect(e!.borrador!.faltan.length).toBeGreaterThan(0);
    expect(JSON.stringify(e)).not.toMatch(/450/);
  });
});
