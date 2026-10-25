import { describe, expect, it } from "vitest";
import { capasPermitidas } from "./permisos-capas";

const TODOS = new Set(["agenda", "projects", "orders", "service-leads", "clients", "bookings", "quotes"]);

function ctx(role: string, levels: Record<string, string>) {
  return { workspaceId: "ws-1", userId: 7, userLabel: "Ana", role, acceso: { role, levels } } as never;
}

const VER_TODO = { agenda: "VIEW", projects: "VIEW", orders: "VIEW", "service-leads": "VIEW", clients: "VIEW", bookings: "VIEW" };

describe("capas permitidas", () => {
  it("el dueño ve todas las capas con todos los módulos encendidos", () => {
    const { capas, tiposDeTarea } = capasPermitidas(ctx("WORKSPACE_OWNER", { ...VER_TODO, agenda: "MANAGE", projects: "MANAGE", "service-leads": "MANAGE" }), TODOS);
    expect(capas).toEqual(["CITAS", "ENTREGAS", "TAREAS", "CUOTAS", "CONSULTAS", "CUMPLEANOS", "RESERVAS"]);
    expect(tiposDeTarea).toEqual(["CAPTACION", "PROYECTO"]);
  });

  it("sin el módulo encendido no hay capa, aunque el nivel diga Ver", () => {
    const sin = (m: string) => new Set([...TODOS].filter((x) => x !== m));
    const c = ctx("WORKSPACE_OWNER", { ...VER_TODO, projects: "MANAGE", "service-leads": "MANAGE" });
    expect(capasPermitidas(c, sin("agenda")).capas).not.toContain("CITAS");
    expect(capasPermitidas(c, sin("projects")).capas).not.toContain("ENTREGAS");
    expect(capasPermitidas(c, sin("projects")).tiposDeTarea).toEqual(["CAPTACION"]);
    expect(capasPermitidas(c, sin("orders")).capas).not.toContain("CUOTAS");
    expect(capasPermitidas(c, sin("service-leads")).capas).not.toContain("CONSULTAS");
    expect(capasPermitidas(c, sin("clients")).capas).not.toContain("CUMPLEANOS");
    expect(capasPermitidas(c, sin("bookings")).capas).not.toContain("RESERVAS");
  });

  it("sin Ver en el módulo no hay capa", () => {
    const sin = (m: string) => ctx("STAFF", { ...VER_TODO, [m]: "NONE" });
    expect(capasPermitidas(sin("agenda"), TODOS).capas).not.toContain("CITAS");
    expect(capasPermitidas(sin("projects"), TODOS).capas).not.toContain("ENTREGAS");
    expect(capasPermitidas(sin("clients"), TODOS).capas).not.toContain("CUMPLEANOS");
    expect(capasPermitidas(sin("bookings"), TODOS).capas).not.toContain("RESERVAS");
    expect(capasPermitidas(sin("service-leads"), TODOS).capas).not.toContain("CONSULTAS");
  });

  it("las tareas piden Gestionar (la regla de «Mis tareas»): con sólo Ver no hay capa", () => {
    const soloVer = capasPermitidas(ctx("STAFF", VER_TODO), TODOS);
    expect(soloVer.capas).not.toContain("TAREAS");
    expect(soloVer.tiposDeTarea).toEqual([]);
    const gestionaProyectos = capasPermitidas(ctx("STAFF", { ...VER_TODO, projects: "MANAGE" }), TODOS);
    expect(gestionaProyectos.capas).toContain("TAREAS");
    expect(gestionaProyectos.tiposDeTarea).toEqual(["PROYECTO"]);
  });

  it("las cuotas piden además permiso de dinero: Ver Pedidos solo no alcanza", () => {
    expect(capasPermitidas(ctx("STAFF", VER_TODO), TODOS).capas).not.toContain("CUOTAS");
    expect(capasPermitidas(ctx("STAFF", { ...VER_TODO, cash: "VIEW" }), TODOS).capas).toContain("CUOTAS");
    expect(capasPermitidas(ctx("STAFF", { ...VER_TODO, "membership-dues": "VIEW" }), TODOS).capas).toContain("CUOTAS");
    expect(capasPermitidas(ctx("WORKSPACE_ADMIN", VER_TODO), TODOS).capas).toContain("CUOTAS");
    // Con permiso de dinero pero sin Ver en Pedidos, tampoco.
    expect(capasPermitidas(ctx("STAFF", { ...VER_TODO, orders: "NONE", cash: "VIEW" }), TODOS).capas).not.toContain("CUOTAS");
  });

  it("sin usuario no se ve nada", () => {
    const c = { ...(ctx("WORKSPACE_OWNER", VER_TODO) as object), userId: null } as never;
    expect(capasPermitidas(c, TODOS)).toEqual({ capas: [], tiposDeTarea: [] });
  });
});
