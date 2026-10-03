import { describe, expect, it } from "vitest";
import { homeWidgetGates } from "./gates";
import type { ModuleLevels } from "@/lib/permissions/levels";

const TODO_NONE: ModuleLevels = {};

describe("homeWidgetGates — cada número del inicio, por el nivel de su módulo", () => {
  it("sin niveles no se calcula nada: un número que lleva a 'sin permiso' es peor que ninguno", () => {
    expect(homeWidgetGates(TODO_NONE)).toEqual({
      socios: false,
      cuotas: false,
      altas: false,
      caja: false,
      reservas: false,
      sorteos: false,
      coberturas: false,
      pedidos: false,
    });
  });

  it("con VIEW en cada módulo ve sus números, pero Cuotas exige gestionar el cobro", () => {
    const g = homeWidgetGates({
      members: "VIEW",
      "membership-dues": "VIEW",
      cash: "VIEW",
      bookings: "VIEW",
      raffles: "VIEW",
      coverages: "VIEW",
      "service-leads": "VIEW",
    });
    expect(g).toEqual({
      socios: true,
      cuotas: false,
      altas: false,
      caja: true,
      reservas: true,
      sorteos: true,
      coberturas: true,
      pedidos: true,
    });
  });

  it("una Tesorería con Cuotas pero sin Socios ve lo cobrado y no el padrón ni las altas", () => {
    const g = homeWidgetGates({ "membership-dues": "MANAGE", members: "NONE" });
    expect(g.cuotas).toBe(true);
    expect(g.altas).toBe(false);
    expect(g.socios).toBe(false);
  });

  it("las altas llevan a Solicitudes, que exige gestionar Socios: sólo con members MANAGE", () => {
    expect(homeWidgetGates({ "membership-dues": "MANAGE", members: "VIEW" }).altas).toBe(false);
    expect(homeWidgetGates({ members: "MANAGE" }).altas).toBe(true);
  });

  it("el contador de pedidos de Captación no depende de ser dueño: alcanza con verlos", () => {
    expect(homeWidgetGates({ "service-leads": "VIEW" }).pedidos).toBe(true);
    expect(homeWidgetGates({ "service-leads": "NONE" }).pedidos).toBe(false);
  });
});
