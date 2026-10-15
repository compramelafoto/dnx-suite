import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const leer = (ruta: string) => readFileSync(join(__dirname, "../../..", ruta), "utf8");

describe("Configuración → Agenda (permisos y enlaces)", () => {
  const pagina = leer("app/workspace/configuracion/agenda/page.tsx");

  it("pide `configurar` antes de leer nada de la base", () => {
    const iPermiso = pagina.indexOf('puede(role, "configurar")');
    expect(iPermiso).toBeGreaterThan(-1);
    for (const lectura of ["prisma.", "isModuleEnabledForWorkspace(", "estadoDeGoogleAgenda("]) {
      expect(pagina.indexOf(lectura, pagina.indexOf("export default")), lectura).toBeGreaterThan(iPermiso);
    }
  });

  it("enlaza a Tipos de cita y a Integraciones, y tiene el recordatorio al cliente", () => {
    expect(pagina).toContain('href="/workspace/configuracion/agenda/tipos"');
    expect(pagina).toContain('href="/workspace/configuracion/integraciones"');
    expect(pagina).toContain("<RecordatorioForm");
  });

  it("muestra los avisos y la última sincronización, sin códigos de error ni datos de la cuenta fuera del correo conectado", () => {
    expect(pagina).toContain("googleLastSyncAt");
    expect(pagina).not.toMatch(/googleCalendarId\}|calendarId\}/);
  });

  it("la acción de crear el calendario pasa por `configurar` en lib y sincroniza después de responder", () => {
    const acciones = leer("app/actions/agenda.ts");
    const i = acciones.indexOf("export async function crearCalendarioAgendaAction");
    const cuerpo = acciones.slice(i);
    expect(cuerpo).toContain('contextoDeAgenda("ver")');
    expect(cuerpo).toContain("crearCalendarioDeAgenda(ctx");
    expect(cuerpo).toContain("after(() => sincronizarAgenda(");
    expect(leer("lib/agenda/google/calendario.ts")).toContain("puedeConfigurarAgenda(ctx)");
  });
});

describe("los cambios llegan a Google después de confirmar, sin frenar la acción", () => {
  it("proyectos: alta manual, edición, suspensión y reanudación", () => {
    const f = leer("app/actions/proyectos.ts");
    expect(f).toContain("after(() => alCambiarProyecto(workspaceId, proyectoId))");
    expect(f.match(/avisarEntrega\(ctx\.workspaceId/g)?.length).toBeGreaterThanOrEqual(4);
  });
  it("cierre de un proyecto desde el motor de etapas", () => {
    const f = leer("app/actions/circuitos.ts");
    const i = f.indexOf("export async function cerrarAction");
    expect(f.slice(i, f.indexOf("export async function cambiarVencimientoAction"))).toContain("after(() => alCambiarProyecto(");
  });
  it("pedido confirmado o cargado a mano: citas y entregas", () => {
    const f = leer("app/actions/pedidos.ts");
    expect(f.match(/after\(\(\) => empujarEntregasDelPedido\(/g)).toHaveLength(2);
    expect(f.match(/after\(\(\) => empujarCitasDelPedido\(/g)).toHaveLength(2);
  });
  it("crearCitaAction valida el pedidoId antes de revalidar", () => {
    expect(leer("app/actions/agenda.ts")).toContain("if (esId(datos.pedidoId)) revalidatePath");
  });
  it("el cron está en vercel.json cada 10 minutos", () => {
    const v = JSON.parse(leer("vercel.json")) as { crons: { path: string; schedule: string }[] };
    expect(v.crons).toContainEqual({ path: "/api/cron/agenda-google-sync", schedule: "*/10 * * * *" });
  });
});
