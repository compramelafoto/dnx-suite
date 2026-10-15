// lib/course-classroom/alumno.test.ts
import { describe, expect, it, vi } from "vitest";
import { otorgarAccesosPendientes } from "./alumno";

describe("otorgar los accesos que faltan", () => {
  it("otorga cada inscripción pendiente a la persona", async () => {
    const otorgar = vi.fn().mockResolvedValue({ ok: true });
    const n = await otorgarAccesosPendientes(7, {
      buscarPendientes: vi.fn().mockResolvedValue(["insc-1", "insc-2"]),
      otorgar,
    });
    expect(n).toBe(2);
    expect(otorgar).toHaveBeenCalledWith({ enrollmentId: "insc-1", userId: 7 });
    expect(otorgar).toHaveBeenCalledWith({ enrollmentId: "insc-2", userId: 7 });
  });

  it("si una falla, sigue con las demás", async () => {
    const otorgar = vi.fn().mockRejectedValueOnce(new Error("x")).mockResolvedValueOnce({ ok: true });
    const n = await otorgarAccesosPendientes(7, {
      buscarPendientes: vi.fn().mockResolvedValue(["insc-1", "insc-2"]),
      otorgar,
    });
    expect(n).toBe(1);
  });
});
