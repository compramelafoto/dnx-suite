import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const fuente = readFileSync(join(__dirname, "../../app/actions/agenda.ts"), "utf8");

function cuerpoDe(nombre: string): string {
  const i = fuente.indexOf(`export async function ${nombre}`);
  expect(i, nombre).toBeGreaterThan(0);
  const j = fuente.indexOf("\nexport async function", i + 10);
  return fuente.slice(i, j === -1 ? undefined : j);
}

describe("acciones de la agenda", () => {
  it("es un archivo 'use server' que sólo exporta funciones async", () => {
    expect(fuente.startsWith('"use server"')).toBe(true);
    expect(fuente.match(/^export (?!async function|type )/gm)).toBeNull();
  });

  it("las que cambian una cita piden Gestionar y avisan a Google después, con after()", () => {
    expect(fuente).toContain("after(() => alCambiarCita(workspaceId, citaId))");
    for (const n of ["crearCitaAction", "editarCitaAction", "moverCitaAction", "cambiarEstadoCitaAction", "anularCitaAction"]) {
      const c = cuerpoDe(n);
      expect(c, n).toContain('contextoDeAgenda("operar")');
      expect(c, n).toContain("avisarCambio(");
    }
  });

  it("los participantes piden Gestionar y los tipos pasan por `configurar` en lib", () => {
    for (const n of ["agregarParticipanteCitaAction", "editarParticipanteCitaAction", "quitarParticipanteCitaAction", "buscarContactosAgendaAction"]) {
      expect(cuerpoDe(n), n).toContain('contextoDeAgenda("operar")');
    }
    const tipos = readFileSync(join(__dirname, "tipos.ts"), "utf8");
    expect(tipos.match(/puedeConfigurarAgenda\(ctx\)/g)).toHaveLength(2);
  });

  it("confirmar y el alta manual del pedido empujan las citas creadas con after()", () => {
    const pedidos = readFileSync(join(__dirname, "../../app/actions/pedidos.ts"), "utf8");
    expect(pedidos.match(/after\(\(\) => empujarCitasDelPedido\(workspaceId, r\.pedidoId\)\)/g)).toHaveLength(2);
  });
});
