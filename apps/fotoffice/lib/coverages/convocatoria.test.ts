import { describe, expect, it } from "vitest";
import type { EstadoDeRol } from "./cupos";
import {
  planPublicarConvocatoria,
  puedeCrearseConvocatoria,
  puedeEditarseConvocatoria,
  puedePublicarse,
} from "./convocatoria";

describe("puedePublicarse", () => {
  const rolConLugar: EstadoDeRol = { vacancies: 1, asignadasVivas: 0, asignadasAceptadas: 0 };
  const rolCompleto: EstadoDeRol = { vacancies: 1, asignadasVivas: 1, asignadasAceptadas: 0 };

  it("sin título, no se puede publicar", () => {
    const r = puedePublicarse({ title: "" }, [rolConLugar]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("título");
  });

  it("un título con solo espacios tampoco alcanza", () => {
    const r = puedePublicarse({ title: "   " }, [rolConLugar]);
    expect(r.ok).toBe(false);
  });

  it("sin roles, no hay nada que publicar", () => {
    const r = puedePublicarse({ title: "Cobertura de la colecta" }, []);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("vacantes");
  });

  it("con todos los roles completos, no se puede publicar", () => {
    const r = puedePublicarse({ title: "Cobertura de la colecta" }, [rolCompleto]);
    expect(r.ok).toBe(false);
  });

  it("con al menos un rol con lugar, se puede publicar", () => {
    const r = puedePublicarse({ title: "Cobertura de la colecta" }, [rolCompleto, rolConLugar]);
    expect(r).toEqual({ ok: true });
  });

  it("un rol completo no es lo mismo que sin roles: acá alcanza con uno libre", () => {
    // Caso que separa esta regla de una que mirara solo "hay roles": con dos roles, uno
    // completo, la convocatoria igual puede salir a buscar para el que falta.
    const r = puedePublicarse({ title: "T" }, [rolConLugar]);
    expect(r.ok).toBe(true);
  });
});

describe("puedeCrearseConvocatoria", () => {
  it("si ya existe una convocatoria, no se crea otra", () => {
    const r = puedeCrearseConvocatoria({ coverageStatus: "PLANIFICADA", yaExiste: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("ya tiene");
  });

  it("camino feliz: planificada y sin convocatoria previa", () => {
    const r = puedeCrearseConvocatoria({ coverageStatus: "PLANIFICADA", yaExiste: false });
    expect(r).toEqual({ ok: true });
  });

  it("una cobertura que ya está buscando equipo también admite crearla", () => {
    // El caso mixto: se invitó a alguien a dedo —y eso movió la cobertura a BUSCANDO_EQUIPO— y
    // ahora hace falta publicar para conseguir a quien falta. Exigir PLANIFICADA dejaba esa
    // cobertura sin poder publicar nunca.
    const r = puedeCrearseConvocatoria({ coverageStatus: "BUSCANDO_EQUIPO", yaExiste: false });
    expect(r).toEqual({ ok: true });
  });

  it("con el equipo ya confirmado, o terminada, no se crea ninguna", () => {
    for (const estado of ["EQUIPO_CONFIRMADO", "REALIZADA", "ENTREGADA", "CERRADA", "CANCELADA"]) {
      const r = puedeCrearseConvocatoria({ coverageStatus: estado, yaExiste: false });
      expect(r.ok).toBe(false);
    }
  });
});

describe("puedeEditarseConvocatoria", () => {
  it("se puede editar en borrador", () => {
    expect(puedeEditarseConvocatoria("BORRADOR")).toBe(true);
  });

  it("no se puede editar ya publicada", () => {
    expect(puedeEditarseConvocatoria("PUBLICADA")).toBe(false);
  });

  it("no se puede editar completa, cerrada, vencida ni cancelada", () => {
    for (const estado of ["COMPLETA", "CERRADA", "VENCIDA", "CANCELADA"]) {
      expect(puedeEditarseConvocatoria(estado)).toBe(false);
    }
  });
});

describe("planPublicarConvocatoria", () => {
  const rolConLugar: EstadoDeRol = { vacancies: 1, asignadasVivas: 0, asignadasAceptadas: 0 };
  const call = { workspaceId: "ws-a", status: "BORRADOR", title: "Convocatoria" };
  const coverage = { status: "PLANIFICADA" };

  it("una convocatoria de otro workspace no existe para esta persona", () => {
    const r = planPublicarConvocatoria({
      call: null,
      coverage,
      roles: [rolConLugar],
      workspaceId: "ws-a",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("No encontramos");
  });

  it("no se puede publicar una convocatoria que no es de este workspace", () => {
    const r = planPublicarConvocatoria({
      call: { ...call, workspaceId: "ws-b" },
      coverage,
      roles: [rolConLugar],
      workspaceId: "ws-a",
    });
    expect(r.ok).toBe(false);
  });

  it("una convocatoria ya publicada no se vuelve a publicar", () => {
    const r = planPublicarConvocatoria({
      call: { ...call, status: "PUBLICADA" },
      coverage,
      roles: [rolConLugar],
      workspaceId: "ws-a",
    });
    expect(r.ok).toBe(false);
  });

  it("sin título, la transición pasa pero el contenido no", () => {
    const r = planPublicarConvocatoria({
      call: { ...call, title: null },
      coverage,
      roles: [rolConLugar],
      workspaceId: "ws-a",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("título");
  });

  it("si la cobertura ya no puede pasar a buscando equipo (por ejemplo, cancelada), no se publica", () => {
    const r = planPublicarConvocatoria({
      call,
      coverage: { status: "CANCELADA" },
      roles: [rolConLugar],
      workspaceId: "ws-a",
    });
    expect(r.ok).toBe(false);
  });

  it("camino feliz: borrador de este workspace, con título y un rol con lugar, cobertura planificada", () => {
    const r = planPublicarConvocatoria({ call, coverage, roles: [rolConLugar], workspaceId: "ws-a" });
    expect(r).toEqual({ ok: true, moverCobertura: true });
  });

  it("si la cobertura ya está buscando equipo, se publica igual y no se la vuelve a mover", () => {
    // Pasa cuando se invitó a alguien a dedo antes de publicar. Escribir otra vez el mismo
    // estado dejaría en el historial un «buscando equipo → buscando equipo» que no ocurrió.
    const r = planPublicarConvocatoria({
      call,
      coverage: { status: "BUSCANDO_EQUIPO" },
      roles: [rolConLugar],
      workspaceId: "ws-a",
    });
    expect(r).toEqual({ ok: true, moverCobertura: false });
  });
});
