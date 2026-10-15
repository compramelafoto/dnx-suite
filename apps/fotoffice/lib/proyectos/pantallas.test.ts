import { beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Task 5 (pantallas de Proyectos): lecturas del tablero, de las tarjetas y de "Mis entregas", y
 * reglas de fuente (el navegador no importa la base; las pantallas pasan por la guarda; DNX
 * siembra sus roles al abrir; el menú y el buscador conocen Proyectos).
 */

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});
const G = vi.hoisted(() => ({ modulo: vi.fn(), niveles: {} as Record<string, string> }));

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));
vi.mock("@/lib/modules/gating", () => ({ isModuleEnabledForWorkspace: G.modulo }));
vi.mock("@/lib/access/acceso", () => ({ resolverAcceso: async () => ({ role: "STAFF", levels: G.niveles }) }));

const T = await import("./tarjetas");
const E = await import("./entregas");
const I = await import("./tablero-inicial");

const RAIZ = (() => {
  let dir = dirname(new URL(import.meta.url).pathname);
  while (!existsSync(join(dir, "package.json"))) dir = dirname(dir);
  return dir;
})();
const leer = (...partes: string[]) => readFileSync(join(RAIZ, ...partes.join("/").split("/")), "utf8");

const ctx = (projects: "NONE" | "VIEW" | "MANAGE", extra: Record<string, unknown> = {}) =>
  ({ workspaceId: "ws-1", userId: 7, userLabel: "Ana", role: "STAFF", acceso: { role: "STAFF", levels: { projects } }, ...extra }) as never;
const base = new Date("2026-11-01T00:00:00Z");

beforeEach(() => {
  B.vaciar();
  G.modulo.mockReset();
  G.modulo.mockResolvedValue(true);
  G.niveles = { projects: "VIEW" };
  B.agregar("fotofficeCircuit", { id: "ct-a", workspaceId: "ws-1", name: "Fotolibro", kind: "TRABAJO", isActive: true });
  B.agregar("fotofficeCircuit", { id: "ct-b", workspaceId: "ws-1", name: "Video", kind: "TRABAJO", isActive: true });
  B.agregar("fotofficeCircuit", { id: "ct-v", workspaceId: "ws-1", name: "Ventas", kind: "VENTA", isActive: true });
  B.agregar("fotofficeCircuit", { id: "ct-x", workspaceId: "ws-2", name: "Ajeno", kind: "TRABAJO", isActive: true });
  B.agregar("fotofficeStage", { id: "s-a1", circuitId: "ct-a", name: "Edición", order: 0, days: 5 });
  B.agregar("client", { id: "cl-1", workspaceId: "ws-1", firstName: "Laura" });
  B.agregar("client", { id: "cl-2", workspaceId: "ws-1", firstName: "Marta" });
});

function proyecto(id: string, extra: Record<string, unknown> = {}, recorrido: Record<string, unknown> | null = { stageId: "s-a1" }) {
  B.agregar("fotofficeProyecto", { id, workspaceId: "ws-1", number: `P-${id}`, name: `Proyecto ${id}`, clientId: "cl-1", circuitId: "ct-a", baseDate: base, ownerUserId: 7, ...extra });
  if (recorrido) {
    B.agregar("fotofficeJourney", { id: `j-${id}`, workspaceId: "ws-1", circuitId: (extra.circuitId as string) ?? "ct-a", kind: "TRABAJO", subjectType: "PROYECTO", subjectId: id, ...recorrido });
  }
}

describe("tarjeta Proyectos", () => {
  it("sin Ver en Proyectos no devuelve nada", async () => {
    proyecto("a");
    expect(await T.proyectosParaTarjeta(ctx("NONE"), { clientId: "cl-1" })).toEqual([]);
  });

  it("del contacto: número, nombre, flujo, etapa, fecha final y estado; sólo del workspace", async () => {
    proyecto("a", { finalDueDate: new Date("2026-12-20T00:00:00Z") });
    proyecto("b", { clientId: "cl-2" });
    proyecto("c", { circuitId: "ct-x", workspaceId: "ws-2" }, null);
    const r = await T.proyectosParaTarjeta(ctx("VIEW"), { clientId: "cl-1" });
    expect(r).toEqual([{ id: "a", numero: "P-a", nombre: "Proyecto a", flujo: "Fotolibro", etapa: "Edición", finalDueDate: "2026-12-20", estado: "EN_CURSO" }]);
  });

  it("suspendido y cerrado se distinguen; el cerrado no tiene etapa", async () => {
    proyecto("s", { suspendedAt: new Date(), suspendReason: "x" });
    proyecto("z", {}, { stageId: null, closedAt: new Date(), outcome: "TERMINADO" });
    const r = await T.proyectosParaTarjeta(ctx("VIEW"), { clientId: "cl-1" });
    const por = Object.fromEntries(r.map((p) => [p.id, p]));
    expect(por.s!.estado).toBe("SUSPENDIDO");
    expect(por.z).toMatchObject({ estado: "CERRADO", etapa: null });
  });

  it("de un pedido: sólo los de ese pedido", async () => {
    proyecto("a", { pedidoId: "ped-1", pedidoItemIndex: 0 });
    proyecto("b", { pedidoId: "ped-2", pedidoItemIndex: 0 });
    expect((await T.proyectosParaTarjeta(ctx("VIEW"), { pedidoId: "ped-1" })).map((p) => p.id)).toEqual(["a"]);
  });

  it("de una consulta: filtra por los pedidos de esa consulta dentro del workspace", async () => {
    expect(T.filtroDeTarjeta("ws-1", { consultaLeadId: "lead-1" })).toEqual({
      workspaceId: "ws-1",
      pedido: { is: { consultaLeadId: "lead-1", workspaceId: "ws-1" } },
    });
    expect(T.filtroDeTarjeta("ws-1", { clientId: "c" })).toEqual({ workspaceId: "ws-1", clientId: "c" });
    expect(T.filtroDeTarjeta("ws-1", { pedidoId: "p" })).toEqual({ workspaceId: "ws-1", pedidoId: "p" });
  });
});

describe("Mis entregas de la semana (lectura)", () => {
  const AHORA = new Date("2026-10-15T15:00:00Z");
  const hoyMas = (d: number) => new Date(Date.UTC(2026, 9, 15 + d));

  it("los propios, vivos, con fecha final vencida o dentro de 7 días; ni de otros, ni suspendidos, ni cerrados", async () => {
    proyecto("vencido", { finalDueDate: hoyMas(-3) });
    proyecto("semana", { finalDueDate: hoyMas(7) });
    proyecto("lejano", { finalDueDate: hoyMas(8) });
    proyecto("ajeno", { finalDueDate: hoyMas(1), ownerUserId: 99 });
    proyecto("suspendido", { finalDueDate: hoyMas(1), suspendedAt: new Date(), suspendReason: "x" });
    proyecto("cerrado", { finalDueDate: hoyMas(1) }, { stageId: null, closedAt: new Date(), outcome: "TERMINADO" });
    proyecto("sinfecha", {});
    const r = await E.misEntregasDelInicio({ id: 7 }, "ws-1", AHORA);
    expect(r!.map((e) => [e.id, e.dias])).toEqual([["vencido", -3], ["semana", 7]]);
  });

  it("con muchos vencidos no se pierden las entregas de la semana", async () => {
    for (let i = 0; i < 60; i++) proyecto(`viejo${i}`, { finalDueDate: hoyMas(-100 + i) });
    proyecto("proxima", { finalDueDate: hoyMas(2) });
    const r = await E.misEntregasDelInicio({ id: 7 }, "ws-1", AHORA);
    expect(r!.some((e) => e.id === "proxima")).toBe(true);
  });

  it("sin Ver en Proyectos o con el módulo apagado no se muestra (y no se lee nada)", async () => {
    proyecto("a", { finalDueDate: hoyMas(1) });
    G.niveles = { projects: "NONE" };
    expect(await E.misEntregasDelInicio({ id: 7 }, "ws-1", AHORA)).toBeNull();
    G.niveles = { projects: "VIEW" };
    G.modulo.mockResolvedValue(false);
    expect(await E.misEntregasDelInicio({ id: 7 }, "ws-1", AHORA)).toBeNull();
  });

  it("sin entregas no hay bloque; un error no rompe el inicio y no registra datos personales", async () => {
    expect(await E.misEntregasDelInicio({ id: 7 }, "ws-1", AHORA)).toBeNull();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    G.modulo.mockRejectedValue(Object.assign(new Error("fallo con ana@example.com"), { code: "P1001" }));
    expect(await E.misEntregasDelInicio({ id: 7 }, "ws-1", AHORA)).toBeNull();
    const registrado = JSON.stringify(log.mock.calls[0]);
    expect(registrado).toContain("P1001");
    expect(registrado).not.toContain("ana@example.com");
    log.mockRestore();
  });
});

describe("flujo con que abre el tablero", () => {
  it("el primero (por nombre) de los flujos de trabajo con proyectos en curso; sin ninguno, null", async () => {
    expect(await I.circuitoInicialDelTablero("ws-1")).toBeNull();
    proyecto("v", { circuitId: "ct-b" }, { stageId: "s-b1", circuitId: "ct-b" });
    expect(await I.circuitoInicialDelTablero("ws-1")).toBe("ct-b");
    proyecto("a", { circuitId: "ct-a" });
    expect(await I.circuitoInicialDelTablero("ws-1")).toBe("ct-a");
  });

  it("un proyecto cerrado o de otro workspace no cuenta", async () => {
    proyecto("c", {}, { stageId: null, closedAt: new Date(), outcome: "TERMINADO" });
    B.agregar("fotofficeJourney", { id: "j-x", workspaceId: "ws-2", circuitId: "ct-x", kind: "TRABAJO", subjectType: "PROYECTO", subjectId: "px", stageId: "s" });
    expect(await I.circuitoInicialDelTablero("ws-1")).toBeNull();
  });
});

describe("reglas de fuente", () => {
  it("ningún componente de cliente importa la base ni módulos del servidor", () => {
    const dir = join(RAIZ, "components", "proyectos");
    const archivos = readdirSync(dir).filter((f) => f.endsWith(".tsx"));
    expect(archivos.length).toBeGreaterThanOrEqual(8);
    const puros = [
      "@/lib/proyectos/ficha-vista", "@/lib/ficha/formato", "@/lib/pedidos/pantalla", "@/lib/proyectos/entregas-puro",
      "@/lib/proyectos/tarjetas",
    ];
    for (const f of archivos) {
      const c = readFileSync(join(dir, f), "utf8");
      expect(c, f).not.toContain("@repo/db");
      expect(c, f).not.toContain("server-only");
      if (c.startsWith('"use client";')) {
        // Un componente de cliente sólo importa acciones, tipos y módulos puros.
        for (const m of c.matchAll(/from "(@\/lib\/[^"]+)"/g)) {
          expect(puros, `${f} importa ${m[1]}`).toContain(m[1]);
        }
      }
    }
    for (const f of ["components/ficha/adjuntos.tsx", "components/ficha/subir-adjunto.ts", "components/consultas/selector-contacto.tsx"]) {
      expect(leer(f), f).not.toContain("@repo/db");
    }
  });

  it("los componentes de la ficha usan las acciones del proyecto, no las de Consultas ni las de personas", () => {
    expect(leer("components/proyectos/participantes-proyecto.tsx")).toContain("buscarContactosProyectoAction");
    expect(leer("components/proyectos/participantes-proyecto.tsx")).not.toContain("@/app/actions/consultas");
    const ad = leer("components/proyectos/adjuntos-proyecto.tsx");
    for (const a of ["pedirSubidaAdjuntoAction", "confirmarSubidaAdjuntoAction", "enlaceDeDescargaAdjuntoAction", "borrarAdjuntoAction", "restaurarAdjuntoAction"]) {
      expect(ad).toContain(a);
    }
    expect(ad).not.toContain("@/app/actions/ficha");
    expect(leer("components/proyectos/datos-proyecto.tsx")).toContain("suspenderProyectoAction");
    expect(leer("components/proyectos/datos-proyecto.tsx")).toContain("reanudarProyectoAction");
    expect(leer("components/proyectos/notas-proyecto.tsx")).toContain("agregarNotaAction");
  });

  it("las pantallas pasan por la guarda del módulo; la guarda va primero y respeta el orden", () => {
    for (const ruta of ["app/(shell)/proyectos/layout.tsx", "app/(shell)/proyectos/page.tsx", "app/(shell)/proyectos/lista/page.tsx", "app/(shell)/proyectos/[id]/page.tsx"]) {
      expect(leer(ruta), ruta).toContain('requireProyectos("ver")');
    }
    const guarda = leer("lib/proyectos/pagina.ts");
    const orden = ["requireAuth(", "resolveActiveWorkspace(", "isModuleEnabledForWorkspace(", "puede(acceso, nivel, PROJECTS_MODULE_KEY)"];
    const pos = orden.map((s) => guarda.indexOf(s));
    expect(pos.every((p) => p > -1)).toBe(true);
    expect([...pos].sort((a, b) => a - b)).toEqual(pos);
  });

  it("la guarda de pantallas va en cache() y el contacto sin Ver en Clientes no es un enlace", () => {
    expect(leer("lib/proyectos/pagina.ts")).toContain("cache(requireProyectosSinCache)");
    expect(leer("components/proyectos/datos-proyecto.tsx")).toContain("veContactos ? (");
    expect(leer("components/proyectos/participantes-proyecto.tsx")).toContain("p.clientId && puedeElegirContactos");
  });

  it("al abrir las pantallas DNX siembra sus roles de participante", () => {
    for (const ruta of ["app/(shell)/proyectos/page.tsx", "app/(shell)/proyectos/lista/page.tsx", "app/(shell)/proyectos/[id]/page.tsx"]) {
      expect(leer(ruta), ruta).toContain("await prepararProyectos(workspace.id)");
    }
    expect(leer("lib/proyectos/pagina.ts")).toContain("asegurarRolesProyectoDnx(workspaceId,");
  });

  it("el tablero es el del motor para PROYECTO/TRABAJO, con el flujo inicial y el selector", () => {
    const p = leer("app/(shell)/proyectos/page.tsx");
    expect(p).toContain('{ tipoSujeto: "PROYECTO", clase: "TRABAJO" }');
    expect(p).toContain("circuitoInicialDelTablero(");
    expect(p).toContain('tipo="PROYECTO"');
    expect(leer("components/circuitos/tablero.tsx")).toContain('tipo = "CAPTACION"');
  });

  it("la lista usa la definición registrada con la clave `proyectos`", () => {
    const l = leer("app/(shell)/proyectos/lista/page.tsx");
    expect(l).toContain("listadoProyectos");
    expect(l).toContain('ruta="/proyectos/lista"');
    expect(leer("lib/listado/registro.ts")).toMatch(/proyectos: \{\s*moduleKey: "projects",\s*ruta: "\/proyectos\/lista"/);
  });

  it("la ficha lee con la guarda y el workspace de la sesión, y cae en notFound", () => {
    const p = leer("app/(shell)/proyectos/[id]/page.tsx");
    expect(p).toContain("cargarFichaProyecto(ctx, id,");
    expect(p).toContain("notFound()");
    expect(p).toContain('<MasDatos entityType="PROYECTO"');
    expect(p).toContain('tipo="PROYECTO"');
    // Sin Gestionar no se edita nada: lo decide `puedeEditar`.
    expect(p).toContain('puedeEnContexto(ctx, "operar", PROJECTS_MODULE_KEY)');
    const f = leer("lib/proyectos/ficha.ts");
    expect(f).toContain("where: { id: proyectoId, workspaceId }");
  });

  it("las tarjetas «Proyectos» están en el pedido, la consulta y el contacto, con «Ver» en Proyectos", () => {
    expect(leer("app/(shell)/pedidos/[id]/page.tsx")).toContain("<ProyectosDelPedido");
    for (const ruta of ["app/(shell)/consultas/[id]/page.tsx", "app/(shell)/clientes/[clientId]/page.tsx"]) {
      const s = leer(ruta);
      expect(s, ruta).toContain("<TarjetaProyectos");
      expect(s, ruta).toContain('puede(acceso, "ver", PROJECTS_MODULE_KEY)');
      expect(s, ruta).toContain("proyectosEncendidos(workspace.id)");
    }
    expect(leer("app/(shell)/consultas/[id]/page.tsx")).toContain("{ consultaLeadId: id }");
    expect(leer("app/(shell)/clientes/[clientId]/page.tsx")).toContain("{ clientId: cliente.id }");
  });

  it("el inicio muestra «Mis entregas de la semana» sólo si hay, por la carga protegida", () => {
    const p = leer("app/(shell)/dashboard/page.tsx");
    expect(p).toContain("misEntregasDelInicio(user, workspace.id,");
    expect(p).toContain("{entregas ? <MisEntregas entregas={entregas} /> : null}");
  });

  it("«Mis tareas» se pide por tipos según los permisos de Consultas y de Proyectos", () => {
    const i = leer("lib/circuitos/inicio.ts");
    expect(i).toContain('puede(acceso, "operar", SERVICE_LEADS_MODULE_KEY)');
    expect(i).toContain('puede(acceso, "operar", PROJECTS_MODULE_KEY)');
    expect(i).toContain("tipos,");
  });

  it("el menú muestra Proyectos sólo con nivel en el módulo projects y el buscador lo conoce", () => {
    const nav = leer("components/shell/shell-nav.tsx");
    expect(nav).toMatch(/\.\.\.\(ve\(PROJECTS_MODULE_KEY\)\s*\?\s*\[\s*\{\s*href: "\/proyectos"/);
    expect(nav).toContain('const PROJECTS_MODULE_KEY = "projects";');
    expect(leer("lib/shell/nav-keywords.ts")).toContain('"/proyectos": [');
  });
});
