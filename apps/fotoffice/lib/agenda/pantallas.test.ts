import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Reglas de fuente de las pantallas de Agenda (Etapa 4, Entrega B, tarea 3): el navegador no importa la base,
 * las pantallas pasan por la guarda, la grilla de Reservas se comparte sin cambiar su comportamiento, y el
 * menú, el buscador y las fichas conocen la Agenda.
 */

const RAIZ = (() => {
  let dir = dirname(new URL(import.meta.url).pathname);
  while (!existsSync(join(dir, "package.json"))) dir = dirname(dir);
  return dir;
})();
const leer = (ruta: string) => readFileSync(join(RAIZ, ...ruta.split("/")), "utf8");

describe("pantallas de Agenda: fuente", () => {
  it("los componentes del navegador no importan la base ni código de servidor", () => {
    for (const ruta of ["components/agenda/agenda-calendar.tsx", "components/agenda/dialogo-cita.tsx", "app/workspace/configuracion/agenda/tipos/tipos-de-cita.tsx"]) {
      const f = leer(ruta);
      expect(f.startsWith('"use client"'), ruta).toBe(true);
      expect(f, ruta).not.toContain("@repo/db");
      expect(f, ruta).not.toContain("server-only");
      expect(f, ruta).not.toMatch(/from "@\/lib\/agenda\/(vista|citas|tipos|participantes|pagina|de-origen)"/);
    }
    // Los cálculos que usa el navegador son puros.
    for (const ruta of ["lib/agenda/vista-cliente.ts", "lib/agenda/vista-tipos.ts", "lib/agenda/permisos-capas.ts"]) {
      expect(leer(ruta), ruta).not.toContain("server-only");
      expect(leer(ruta), ruta).not.toContain("@repo/db");
    }
  });

  it("la página pasa por la guarda, siembra los tipos y lee las capas por lib/agenda/vista", () => {
    const p = leer("app/(shell)/agenda/page.tsx");
    expect(p).toContain('requireAgenda("ver")');
    expect(p).toContain("prepararAgenda(");
    expect(p).toContain("cargarVistaAgenda(");
    // La página no lee capas por su cuenta: sólo ajustes, roles y tipos.
    expect(p).not.toContain("fotofficeProyecto.");
    expect(p).not.toContain("fotofficePedido.");
    expect(p).not.toContain("booking.");
    const g = leer("lib/agenda/pagina.ts");
    expect(g).toContain("AGENDA_MODULE_KEY");
    expect(g).toContain("asegurarTiposCitaDnx(");
  });

  it("cada capa se lee detrás de su permiso en lib/agenda/vista", () => {
    const v = leer("lib/agenda/vista.ts");
    for (const capa of ["CITAS", "ENTREGAS", "TAREAS", "CUOTAS", "CONSULTAS", "CUMPLEANOS", "RESERVAS"]) {
      expect(v, capa).toContain(`permitida("${capa}")`);
    }
    expect(v).toContain("capasPermitidas(ctx, modulos)");
    expect(v).toContain("TOPE_POR_CAPA");
    // Los cumpleaños salen de la ficha del contacto, no del padrón de socios.
    expect(v).toContain("fotofficeContactoPerfil");
  });

  it("la grilla de Reservas sigue usando las piezas compartidas, sin cambios de comportamiento", () => {
    const r = leer("app/(shell)/reservas/agenda-calendar.tsx");
    for (const pieza of ["calendar-toolbar", "mini-month", "time-grid", "lib/bookings/calendar-view"]) expect(r).toContain(pieza);
    const a = leer("components/agenda/agenda-calendar.tsx");
    for (const pieza of ["@/components/bookings/calendar/calendar-toolbar", "@/components/bookings/calendar/mini-month", "@/components/bookings/calendar/time-grid"]) {
      expect(a).toContain(pieza);
    }
  });

  it("arrastrar sólo mueve citas y sólo con Gestionar; las otras capas llevan a su ficha", () => {
    const a = leer("components/agenda/agenda-calendar.tsx");
    expect(a).toContain("if (!puedeGestionar || !e.editable");
    expect(a).toContain("moverCitaAction(");
    expect(a).toContain("router.push(e.href)");
    // Las capas encendidas se recuerdan en el navegador con resguardo si no se puede guardar.
    expect(a).toContain("localStorage");
    expect(a.match(/try \{/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("el diálogo de cita usa las acciones de Agenda y muestra el origen sólo de lectura", () => {
    const d = leer("components/agenda/dialogo-cita.tsx");
    for (const accion of ["crearCitaAction", "editarCitaAction", "anularCitaAction", "agregarParticipanteCitaAction", "quitarParticipanteCitaAction", "buscarContactosAgendaAction"]) {
      expect(d, accion).toContain(accion);
    }
    expect(d).toContain("Origen");
  });

  it("el menú muestra Agenda sólo con nivel en el módulo agenda y el buscador la conoce", () => {
    const nav = leer("components/shell/shell-nav.tsx");
    expect(nav).toContain('const AGENDA_MODULE_KEY = "agenda";');
    expect(nav).toMatch(/ve\(AGENDA_MODULE_KEY\)\s*\?\s*\[\s*\{\s*href: "\/agenda"/);
    expect(nav).toContain('moduleKey: AGENDA_MODULE_KEY');
    expect(leer("lib/shell/nav-keywords.ts")).toContain('"/agenda": [');
  });

  it("las fichas del proyecto, el pedido y la consulta tienen la tarjeta «Citas», que no lee nada sin Agenda", () => {
    for (const [ruta, origen] of [
      ["app/(shell)/proyectos/[id]/page.tsx", "proyectoId"],
      ["app/(shell)/pedidos/[id]/page.tsx", "pedidoId"],
      ["app/(shell)/consultas/[id]/page.tsx", "consultaLeadId"],
    ] as const) {
      const p = leer(ruta);
      expect(p, ruta).toContain("<TarjetaCitas");
      expect(p, ruta).toContain(`citasDeOrigen(`);
      expect(p, ruta).toContain(`${origen}`);
    }
    const d = leer("lib/agenda/de-origen.ts");
    expect(d).toContain("if (!puedeVerAgenda(ctx)) return null;");
    expect(d).toContain("isModuleEnabledForWorkspace(ctx.workspaceId, AGENDA_MODULE_KEY)");
    expect(leer("components/agenda/tarjeta-citas.tsx")).toContain("/agenda?fecha=");
  });

  it("los tipos de cita se configuran con `configurar` antes de leer nada", () => {
    const p = leer("app/workspace/configuracion/agenda/tipos/page.tsx");
    expect(p.indexOf('puede(role, "configurar")')).toBeGreaterThan(0);
    expect(p.indexOf('puede(role, "configurar")')).toBeLessThan(p.indexOf("listarTipos("));
  });
});
