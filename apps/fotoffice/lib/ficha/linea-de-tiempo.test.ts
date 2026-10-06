import { describe, expect, it, vi } from "vitest";
import {
  armarLinea,
  cursorDe,
  leerCursor,
  serializarPagina,
  whereCorte,
  type EventoFicha,
  type Proveedor,
  type TipoEvento,
} from "./linea-de-tiempo";
import { nivelesPorRol } from "@/lib/access/niveles-de-prueba";

const PERSONA = { clientId: "c1", memberId: "m1" };
// Acceso como lo resuelve main: STAFF sin roles de la comisión tiene Caja en "Gestionar"; el
// colaborador (valor de 0.1) no tiene ningún módulo.
const EQUIPO = { workspaceId: "ws-1", role: "STAFF", acceso: { role: "STAFF", levels: nivelesPorRol("STAFF") } };
const COLABORADOR = { workspaceId: "ws-1", role: "COLLABORATOR", acceso: { role: "COLLABORATOR", levels: nivelesPorRol("COLLABORATOR") } };

function ev(clave: string, n: string, fecha: string, tipo: TipoEvento): EventoFicha {
  return { id: `${clave}:${n}`, tipo, fecha: new Date(fecha), actor: null, titulo: `${clave} ${n}` };
}

/** Un proveedor falso que se porta como uno real: lte + desempate por id + orden + take. */
function falso(
  clave: string,
  tipo: TipoEvento | TipoEvento[],
  eventos: EventoFicha[],
  extra: Partial<Proveedor> = {},
): Proveedor {
  return {
    clave,
    tipo,
    ...extra,
    traer: vi.fn(async (_ctx, _p, antesDe, take, opciones) => {
      const idTope = opciones?.idTope ?? null;
      return eventos
        .filter((e) => (opciones?.tipo ? e.tipo === opciones.tipo : true))
        .filter((e) => {
          if (!antesDe) return true;
          const t = e.fecha.getTime();
          if (t !== antesDe.getTime()) return t < antesDe.getTime();
          return idTope ? e.id < idTope : true;
        })
        .sort((a, b) => b.fecha.getTime() - a.fecha.getTime() || (a.id < b.id ? 1 : -1))
        .slice(0, take);
    }),
  };
}

/** Recorre todas las páginas y devuelve los ids en orden. */
async function recorrer(proveedores: Proveedor[], take: number, ctx = EQUIPO, filtro: TipoEvento | null = null) {
  const paginas: string[][] = [];
  let cursor: string | null = null;
  for (let i = 0; i < 50; i++) {
    const p = await armarLinea({ proveedores, ctx, persona: PERSONA, filtro, cursor, take });
    paginas.push(p.eventos.map((e) => e.id));
    if (!p.siguiente) break;
    cursor = p.siguiente;
  }
  return paginas;
}

describe("cursor", () => {
  it("ida y vuelta", () => {
    const e = ev("notas", "abc", "2026-09-01T10:00:00.000Z", "notas");
    expect(cursorDe(e)).toBe("2026-09-01T10:00:00.000Z|notas:abc");
    expect(leerCursor(cursorDe(e))).toEqual({ fecha: e.fecha, id: "notas:abc" });
  });
  it("basura → null", () => {
    expect(leerCursor(null)).toBeNull();
    expect(leerCursor("")).toBeNull();
    expect(leerCursor("hola")).toBeNull();
    expect(leerCursor("2026-99-99T00:00:00Z|x")).toBeNull();
    expect(leerCursor("2026-09-01T10:00:00.000Z|")).toBeNull();
  });
});

describe("armarLinea", () => {
  it("mezcla tres fuentes ordenadas de la más nueva a la más vieja", async () => {
    const p = await armarLinea({
      proveedores: [
        falso("notas", "notas", [ev("notas", "1", "2026-09-03T00:00:00Z", "notas"), ev("notas", "2", "2026-09-01T00:00:00Z", "notas")]),
        falso("caja", "plata", [ev("caja", "1", "2026-09-02T00:00:00Z", "plata")], { capacidad: "verDinero" }),
        falso("carnets", "carnets", [ev("carnets", "1", "2026-09-04T00:00:00Z", "carnets")]),
      ],
      ctx: EQUIPO,
      persona: PERSONA,
      filtro: null,
      cursor: null,
    });
    expect(p.eventos.map((e) => e.id)).toEqual(["carnets:1", "notas:1", "caja:1", "notas:2"]);
    expect(p.siguiente).toBeNull();
    expect(p.fallaron).toEqual([]);
  });

  it("empates de fecha: ordenados por id y sin repetir ni saltear entre páginas", async () => {
    const f = "2026-09-01T12:00:00.000Z";
    const a = ["a", "b", "c", "d", "e"].map((n) => ev("notas", n, f, "notas"));
    const b = ["a", "b", "c", "d"].map((n) => ev("caja", n, f, "plata"));
    const c = [ev("carnets", "z", f, "carnets"), ev("carnets", "y", "2026-08-01T00:00:00Z", "carnets")];
    const paginas = await recorrer([falso("notas", "notas", a), falso("caja", "plata", b), falso("carnets", "carnets", c)], 3);
    const ids = paginas.flat();
    expect(ids).toEqual([
      "notas:e", "notas:d", "notas:c", "notas:b", "notas:a",
      "carnets:z",
      "caja:d", "caja:c", "caja:b", "caja:a",
      "carnets:y",
    ]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(paginas.map((p) => p.length)).toEqual([3, 3, 3, 2]);
  });

  it("65 eventos (con empates) → páginas de 30, 30 y 5; siguiente null al final", async () => {
    const mk = (clave: string, tipo: TipoEvento, desde: number, cant: number) =>
      Array.from({ length: cant }, (_, i) => {
        // De a cinco comparten fecha: fuerza empates en los cortes.
        const k = desde + i;
        const fecha = new Date(Date.UTC(2026, 0, 1) + Math.floor(k / 5) * 60_000).toISOString();
        return ev(clave, String(k).padStart(3, "0"), fecha, tipo);
      });
    const prov = [
      falso("notas", "notas", mk("notas", "notas", 0, 25)),
      falso("historial-cliente", "cambios", mk("historial-cliente", "cambios", 10, 20)),
      falso("caja", "plata", mk("caja", "plata", 5, 20), { capacidad: "verDinero" }),
    ];
    const paginas = await recorrer(prov, 30);
    expect(paginas.map((p) => p.length)).toEqual([30, 30, 5]);
    const ids = paginas.flat();
    expect(new Set(ids).size).toBe(65);

    // Mismo orden que si se ordenara todo junto.
    const todos = [...mk("notas", "notas", 0, 25), ...mk("historial-cliente", "cambios", 10, 20), ...mk("caja", "plata", 5, 20)]
      .sort((x, y) => y.fecha.getTime() - x.fecha.getTime() || (x.id < y.id ? 1 : -1))
      .map((e) => e.id);
    expect(ids).toEqual(todos);

    const ultima = await armarLinea({ proveedores: prov, ctx: EQUIPO, persona: PERSONA, filtro: null, cursor: null, take: 65 });
    expect(ultima.siguiente).toBeNull();
  });

  it("tolera un proveedor que ignora el desempate (sólo lte): descarta lo ya mostrado", async () => {
    const f = "2026-09-01T12:00:00.000Z";
    const eventos = ["a", "b", "c", "d"].map((n) => ev("notas", n, f, "notas"));
    const ingenuo: Proveedor = {
      clave: "notas",
      tipo: "notas",
      traer: async (_c, _p, antesDe) =>
        eventos.filter((e) => !antesDe || e.fecha <= antesDe).sort((a, b) => (a.id < b.id ? 1 : -1)),
    };
    const paginas = await recorrer([ingenuo], 2);
    expect(paginas.flat()).toEqual(["notas:d", "notas:c", "notas:b", "notas:a"]);
  });

  it("la plata desaparece sin verDinero: Equipo la ve, Colaborador no (y ni se consulta)", async () => {
    const caja = falso("caja", "plata", [ev("caja", "1", "2026-09-02T00:00:00Z", "plata")], { capacidad: "verDinero" });
    const notas = falso("notas", "notas", [ev("notas", "1", "2026-09-01T00:00:00Z", "notas")]);
    const equipo = await armarLinea({ proveedores: [caja, notas], ctx: EQUIPO, persona: PERSONA, filtro: null, cursor: null });
    expect(equipo.eventos.map((e) => e.id)).toEqual(["caja:1", "notas:1"]);

    (caja.traer as ReturnType<typeof vi.fn>).mockClear();
    const colab = await armarLinea({ proveedores: [caja, notas], ctx: COLABORADOR, persona: PERSONA, filtro: null, cursor: null });
    expect(colab.eventos.map((e) => e.id)).toEqual(["notas:1"]);
    expect(caja.traer).not.toHaveBeenCalled();
  });

  it("la plata de Caja se mira sobre Caja: con Ver en Cuotas pero sin Caja, no sale", async () => {
    const caja = falso("caja", "plata", [ev("caja", "1", "2026-09-02T00:00:00Z", "plata")], {
      capacidad: "verDinero",
      moduloDinero: "cash",
    });
    const soloCuotas = {
      workspaceId: "ws-1",
      role: "STAFF",
      acceso: { role: "STAFF", levels: { ...nivelesPorRol("STAFF"), cash: "NONE" as const, "membership-dues": "VIEW" as const } },
    };
    const r = await armarLinea({ proveedores: [caja], ctx: soloCuotas, persona: PERSONA, filtro: null, cursor: null });
    expect(r.eventos).toEqual([]);
    expect(caja.traer).not.toHaveBeenCalled();
  });

  it("un evento de plata de un proveedor sin capacidad declarada tampoco sale sin permiso", async () => {
    const mal = falso("mezcla", ["notas", "plata"], [ev("mezcla", "1", "2026-09-02T00:00:00Z", "plata"), ev("mezcla", "2", "2026-09-01T00:00:00Z", "notas")]);
    const r = await armarLinea({ proveedores: [mal], ctx: COLABORADOR, persona: PERSONA, filtro: null, cursor: null });
    expect(r.eventos.map((e) => e.id)).toEqual(["mezcla:2"]);
  });

  it("un proveedor que lanza se omite y su clave va a fallaron", async () => {
    const vi_ = vi.spyOn(console, "error").mockImplementation(() => {});
    const roto: Proveedor = { clave: "caja", tipo: "plata", capacidad: "verDinero", traer: async () => { throw new Error("db caída"); } };
    const r = await armarLinea({
      proveedores: [roto, falso("notas", "notas", [ev("notas", "1", "2026-09-01T00:00:00Z", "notas")])],
      ctx: EQUIPO,
      persona: PERSONA,
      filtro: null,
      cursor: null,
    });
    expect(r.fallaron).toEqual(["caja"]);
    expect(r.eventos.map((e) => e.id)).toEqual(["notas:1"]);
    vi_.mockRestore();
  });

  it("filtro notas: sólo notas, y los proveedores de otro tipo no se consultan", async () => {
    const notas = falso("notas", "notas", [ev("notas", "1", "2026-09-01T00:00:00Z", "notas")]);
    const mixto = falso("eventos-persona", ["cambios", "notas", "adjuntos"], [
      ev("eventos-persona", "1", "2026-09-03T00:00:00Z", "cambios"),
      ev("eventos-persona", "2", "2026-09-02T00:00:00Z", "notas"),
    ]);
    const carnets = falso("carnets", "carnets", [ev("carnets", "1", "2026-09-04T00:00:00Z", "carnets")]);
    const r = await armarLinea({ proveedores: [notas, mixto, carnets], ctx: EQUIPO, persona: PERSONA, filtro: "notas", cursor: null });
    expect(r.eventos.map((e) => e.id)).toEqual(["eventos-persona:2", "notas:1"]);
    expect(carnets.traer).not.toHaveBeenCalled();
    expect((mixto.traer as ReturnType<typeof vi.fn>).mock.calls[0]![4]).toMatchObject({ tipo: "notas" });
  });

  it("pide take + 1 y pasa la fecha y el id del cursor", async () => {
    const notas = falso("notas", "notas", []);
    await armarLinea({ proveedores: [notas], ctx: EQUIPO, persona: PERSONA, filtro: null, cursor: "2026-09-01T00:00:00.000Z|caja:x", take: 30 });
    expect(notas.traer).toHaveBeenCalledWith({ workspaceId: "ws-1" }, PERSONA, new Date("2026-09-01T00:00:00.000Z"), 31, {
      idTope: "caja:x",
      tipo: null,
    });
  });

  it("serializa las fechas como texto ISO", () => {
    const w = serializarPagina({ eventos: [ev("notas", "1", "2026-09-01T00:00:00Z", "notas")], siguiente: null, fallaron: [] });
    expect(w.eventos[0]!.fecha).toBe("2026-09-01T00:00:00.000Z");
  });
});

describe("whereCorte", () => {
  const d = new Date("2026-09-01T00:00:00Z");
  it("sin cursor no acota", () => expect(whereCorte("createdAt", "notas:", null, null)).toEqual({}));
  it("id de la misma fuente: menor en el empate", () =>
    expect(whereCorte("createdAt", "notas:", d, "notas:abc")).toEqual({
      OR: [{ createdAt: { lt: d } }, { createdAt: d, id: { lt: "abc" } }],
    }));
  it("fuente que ordena antes que el tope: entra todo el empate", () =>
    expect(whereCorte("createdAt", "caja:", d, "notas:abc")).toEqual({ createdAt: { lte: d } }));
  it("fuente que ordena después que el tope: el empate ya se mostró", () =>
    expect(whereCorte("createdAt", "notas:", d, "caja:abc")).toEqual({ createdAt: { lt: d } }));
});
