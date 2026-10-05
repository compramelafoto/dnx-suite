import { describe, expect, it } from "vitest";
import {
  parseDateOnly,
  parseNewProjectForm,
  parseProjectForm,
  parseStatusChange,
  parseTaskForm,
  parseTaskStatus,
  toDateInputValue,
  validateStatusChange,
} from "./forms";

function form(campos: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.set(k, v);
  return fd;
}

describe("fechas sin hora", () => {
  it("guarda el mediodía argentino y vuelve al mismo día", () => {
    const d = parseDateOnly("2026-10-15");
    expect(d?.toISOString()).toBe("2026-10-15T15:00:00.000Z");
    expect(toDateInputValue(d)).toBe("2026-10-15");
  });

  it("rechaza fechas que no existen o mal escritas", () => {
    expect(parseDateOnly("2026-02-31")).toBeNull();
    expect(parseDateOnly("15/10/2026")).toBeNull();
    expect(parseDateOnly("")).toBeNull();
  });
});

describe("formulario de proyecto", () => {
  it("exige título", () => {
    expect(parseProjectForm(form({ title: "  " })).ok).toBe(false);
  });

  it("lee todos los campos", () => {
    const r = parseProjectForm(
      form({
        title: "Muestra anual",
        description: "Con obras de socios",
        responsibleMemberId: "m1",
        deadlineAt: "2026-12-01",
        visibleToMembers: "on",
      }),
    );
    expect(r).toEqual({
      ok: true,
      values: {
        title: "Muestra anual",
        description: "Con obras de socios",
        responsibleMemberId: "m1",
        deadlineAt: new Date("2026-12-01T15:00:00.000Z"),
        visibleToMembers: true,
      },
    });
  });

  it("acepta cargar un proyecto ya aprobado, pero no uno terminado", () => {
    expect(parseNewProjectForm(form({ title: "X", initialStatus: "APPROVED" })).ok).toBe(true);
    expect(parseNewProjectForm(form({ title: "X", initialStatus: "DONE" })).ok).toBe(false);
    const r = parseNewProjectForm(form({ title: "X" }));
    expect(r.ok && r.values.initialStatus).toBe("PROPOSED");
  });
});

describe("cambio de estado", () => {
  const cambio = (campos: Record<string, string>) => {
    const r = parseStatusChange(form(campos));
    if (!r.ok) throw new Error(r.error);
    return r.values;
  };

  it("una decisión de comisión pide la fecha de la reunión", () => {
    expect(validateStatusChange("IN_REVIEW", cambio({ to: "APPROVED" }))).toMatch(/fecha de la reunión/);
    expect(validateStatusChange("IN_REVIEW", cambio({ to: "APPROVED", decidedOn: "2026-10-01" }))).toBeNull();
  });

  it("rechazar pide motivo y fecha", () => {
    expect(validateStatusChange("IN_REVIEW", cambio({ to: "REJECTED", decidedOn: "2026-10-01" }))).toMatch(/motivo/);
    expect(
      validateStatusChange("IN_REVIEW", cambio({ to: "REJECTED", decidedOn: "2026-10-01", reason: "No hay plata" })),
    ).toBeNull();
  });

  it("no deja saltos que no existen", () => {
    expect(validateStatusChange("DONE", cambio({ to: "IN_PROGRESS" }))).toMatch(/no se puede/);
    expect(validateStatusChange("APPROVED", cambio({ to: "APPROVED" }))).toMatch(/ya está/);
  });

  it("rechaza un estado inventado", () => {
    expect(parseStatusChange(form({ to: "BORRADO" })).ok).toBe(false);
  });
});

describe("tareas", () => {
  it("exige título y lee la fecha", () => {
    expect(parseTaskForm(form({ title: "" })).ok).toBe(false);
    const r = parseTaskForm(form({ title: "Diseñar flyer", dueAt: "2026-10-10", assigneeMemberId: "" }));
    expect(r.ok && r.values.assigneeMemberId).toBeNull();
    expect(r.ok && r.values.dueAt?.toISOString()).toBe("2026-10-10T15:00:00.000Z");
  });

  it("no se hizo exige motivo", () => {
    expect(parseTaskStatus(form({ status: "NOT_DONE" })).ok).toBe(false);
    expect(parseTaskStatus(form({ status: "NOT_DONE", reason: "Llovió" })).ok).toBe(true);
    expect(parseTaskStatus(form({ status: "DONE" })).ok).toBe(true);
  });
});
