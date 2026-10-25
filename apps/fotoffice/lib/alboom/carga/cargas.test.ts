import { beforeEach, describe, expect, it, vi } from "vitest";
import { CLAVES_CARGA, conDependencias } from "./catalogo";
import { MAX_REINTENTOS, MENSAJES_CARGA, cancelarCarga, correrCargas, estadoCargas, iniciarCarga, iniciarSimulacion } from "./cargas";
import { CONTACTO, PRODUCTO } from "./ejemplos-alboom";
import { crearRepoMemoria, type RepoMemoria } from "./repositorio-memoria";

const WS = "ws-1";
let M: RepoMemoria;

beforeEach(() => {
  M = crearRepoMemoria();
  M.crudo(WS, "contactos", "7001", CONTACTO);
  M.crudo(WS, "contactos", "7004", { ...CONTACTO, id: "7004", name: "Martín", email: "martin@correo.test", cellular: "3416000000" });
  M.crudo(WS, "productos", "55", PRODUCTO);
});

/** Corre tandas del cron hasta que no quede nada activo. */
async function hastaTerminar(ahora = () => 0) {
  for (let i = 0; i < 20 && (await M.repo.cargaActiva(WS)); i++) await correrCargas(M.repo, { ahora });
}

describe("elegir partes", () => {
  it("suma las dependencias y respeta el orden; vacío = todas", () => {
    expect(conDependencias(["combos"])).toEqual(["productos", "combos"]);
    expect(conDependencias(["etapas", "usuarios"])).toEqual(["usuarios", "circuitos", "etapas"]);
    expect(conDependencias(["inventada"])).toEqual([...CLAVES_CARGA]);
  });
});

describe("simular y cargar", () => {
  it("la simulación guarda la huella de los crudos y no escribe nada", async () => {
    const r = await iniciarSimulacion(M.repo, WS, 7, ["contactos"]);
    expect(r.ok).toBe(true);
    await hastaTerminar();
    const sim = await M.repo.ultimaCarga(WS, "SIMULACION");
    expect(sim).toMatchObject({ status: "LISTA", entities: ["contactos"] });
    expect(sim!.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(M.datos.escrituras).toBe(0);
    expect(M.datos.clientes).toHaveLength(0);
  });

  it("sin simulación LISTA no se carga", async () => {
    expect(await iniciarCarga(M.repo, WS, 7)).toEqual({ ok: false, error: MENSAJES_CARGA.sinSimulacion });
    await iniciarSimulacion(M.repo, WS, 7, []);
    expect(await iniciarCarga(M.repo, WS, 7)).toEqual({ ok: false, error: MENSAJES_CARGA.activa });
    await cancelarCarga(M.repo, WS);
    expect(await iniciarCarga(M.repo, WS, 7)).toEqual({ ok: false, error: MENSAJES_CARGA.sinSimulacion });
  });

  it("la carga exige que los crudos sigan iguales a los simulados, y carga exactamente lo simulado", async () => {
    await iniciarSimulacion(M.repo, WS, 7, ["contactos"]);
    await hastaTerminar();
    M.crudo(WS, "contactos", "7001", { ...CONTACTO, city: "Rosario" });
    expect(await iniciarCarga(M.repo, WS, 7)).toEqual({ ok: false, error: MENSAJES_CARGA.datosCambiaron });
    expect((await estadoCargas(M.repo, WS)).cargaHabilitada).toEqual({ ok: false, error: MENSAJES_CARGA.datosCambiaron });

    await iniciarSimulacion(M.repo, WS, 7, ["contactos"]);
    await hastaTerminar();
    expect((await estadoCargas(M.repo, WS)).cargaHabilitada).toEqual({ ok: true });
    const r = await iniciarCarga(M.repo, WS, 7);
    expect(r.ok).toBe(true);
    await hastaTerminar();
    const carga = await M.repo.ultimaCarga(WS, "CARGA");
    expect(carga).toMatchObject({ status: "LISTA", entities: ["contactos"] });
    expect(M.datos.clientes).toHaveLength(2);
    expect(M.datos.productos).toHaveLength(0);
  });

  it("después de una carga, la simulación anterior ya no habilita otra carga", async () => {
    await iniciarSimulacion(M.repo, WS, 7, ["productos"]);
    await hastaTerminar();
    await iniciarCarga(M.repo, WS, 7);
    await hastaTerminar();
    expect(await iniciarCarga(M.repo, WS, 7)).toEqual({ ok: false, error: MENSAJES_CARGA.simulacionVieja });
  });

  it("una sola activa por workspace; nunca con una extracción en curso; sin datos no hay nada que simular", async () => {
    expect((await iniciarSimulacion(M.repo, WS, 7, [])).ok).toBe(true);
    expect(await iniciarSimulacion(M.repo, WS, 7, [])).toEqual({ ok: false, error: MENSAJES_CARGA.activa });
    expect((await iniciarSimulacion(M.repo, "ws-2", 7, [])).ok).toBe(false);
    await cancelarCarga(M.repo, WS);
    M.datos.extraccionesActivas.add(WS);
    expect(await iniciarSimulacion(M.repo, WS, 7, [])).toEqual({ ok: false, error: MENSAJES_CARGA.extraccion });
    expect(await iniciarSimulacion(M.repo, "ws-vacio", 7, [])).toEqual({ ok: false, error: MENSAJES_CARGA.sinDatos });
  });

  it("si los crudos cambian mientras se simula, la simulación termina en error", async () => {
    await iniciarSimulacion(M.repo, WS, 7, ["contactos"]);
    M.crudo(WS, "contactos", "7999", { ...CONTACTO, id: "7999", email: "nuevo@correo.test" });
    await hastaTerminar();
    expect(await M.repo.ultimaCarga(WS, "SIMULACION")).toMatchObject({ status: "ERROR", errorReason: MENSAJES_CARGA.cambiaronDurante });
  });
});

describe("huella al terminar la carga", () => {
  it("si los crudos cambian durante la carga, termina en error (volver a cargar no duplica)", async () => {
    await iniciarSimulacion(M.repo, WS, 7, ["contactos"]);
    await hastaTerminar();
    await iniciarCarga(M.repo, WS, 7);
    M.crudo(WS, "contactos", "7999", { ...CONTACTO, id: "7999", name: "Nueva", email: "nueva@correo.test" });
    await hastaTerminar();
    expect(await M.repo.ultimaCarga(WS, "CARGA")).toMatchObject({ status: "ERROR", errorReason: MENSAJES_CARGA.cambiaronDuranteCarga });
  });
});

describe("cron: presupuesto, turno y reanudación", () => {
  it("con poco tiempo pausa, suelta el turno y la tanda siguiente retoma", async () => {
    await iniciarSimulacion(M.repo, WS, 7, []);
    let reloj = 0;
    // Cada consulta del reloj avanza 2 s: con 45 s de presupuesto y 30 s de margen entran pocos lotes de a uno.
    const ahora = () => (reloj += 2000);
    const r1 = await correrCargas(M.repo, { ahora, presupuestoMs: 45_000, lote: 1 });
    expect(r1).toEqual([{ cargaId: expect.any(String), workspaceId: WS, resultado: "PAUSADA" }]);
    const pausada = (await M.repo.cargaActiva(WS))!;
    expect(pausada.lockedUntil).toBeNull();
    expect(pausada.progress).toMatchObject({ indice: expect.any(Number) });
    const r2 = await correrCargas(M.repo, { ahora, lote: 1 });
    expect(r2[0]!.resultado).toBe("LISTA");
    const lista = (await M.repo.ultimaCarga(WS))!;
    const leidos = Object.values((lista.report as { entidades: Record<string, { leidos: number }> }).entidades).reduce((s, e) => s + e.leidos, 0);
    expect(leidos).toBe(3);
  });

  it("el turno impide que dos tandas corran la misma carga", async () => {
    const { id } = (await iniciarSimulacion(M.repo, WS, 7, [])) as { id: string };
    expect(await M.repo.reclamar(id, WS, new Date(0), 60_000)).toBe(true);
    expect(await correrCargas(M.repo, { ahora: () => 1000 })).toEqual([]);
    // Vencido el turno (tanda muerta), otra la toma.
    expect((await correrCargas(M.repo, { ahora: () => 120_000 }))[0]!.resultado).toBe("LISTA");
  });

  it("cancelada a mitad, frena y suelta el turno", async () => {
    await iniciarSimulacion(M.repo, WS, 7, []);
    const guardar = M.repo.guardarAvance;
    M.repo.guardarAvance = async (...a) => {
      await cancelarCarga(M.repo, WS);
      return guardar(...a);
    };
    const r = await correrCargas(M.repo, { ahora: () => 0 });
    expect(r[0]!.resultado).toBe("CANCELADA");
    expect((await M.repo.ultimaCarga(WS))!).toMatchObject({ status: "CANCELADA", lockedUntil: null });
  });

  it("una falla inesperada se reintenta y, tras varias seguidas, la carga termina en error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await iniciarSimulacion(M.repo, WS, 7, ["contactos"]);
    M.repo.clientes = async () => {
      throw Object.assign(new Error("conexión cortada con datos ana@x.test"), { code: "P1001" });
    };
    const resultados: string[] = [];
    for (let i = 0; i <= MAX_REINTENTOS; i++) resultados.push(...(await correrCargas(M.repo, { ahora: () => i * 1000 })).map((r) => r.resultado));
    expect(resultados).toEqual([...Array(MAX_REINTENTOS).fill("REINTENTAR"), "ERROR"]);
    expect(await M.repo.ultimaCarga(WS)).toMatchObject({ status: "ERROR" });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("ana@x.test");
  });
});
