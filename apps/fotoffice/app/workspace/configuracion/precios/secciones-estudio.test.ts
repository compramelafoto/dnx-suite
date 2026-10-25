import { describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createStudioOwner, createStudioPerson, INITIAL_STUDIO_STRUCTURE } from "@repo/cuanto-cobro-core";
import { createBaseCompleteProfile } from "@repo/cuanto-cobro-core/__fixtures__/characterization-fixtures";

vi.mock("./actions", () => ({ guardarPerfilPreciosAction: async () => ({ ok: true, actualizado: "" }) }));
vi.mock("@/components/dnx-bot/oferta-perfil", () => ({ OfertaArmarConversando: () => null }));

const { SeccionEquipoEstudio, SeccionEquipoYCamaras, SeccionGastosFijos, SeccionOtrasLineas, SeccionResumenEstudio, SeccionVosEnElEstudio } = await import(
  "./secciones-estudio"
);
const { PerfilForm } = await import("./perfil-form");

/** Los números de Daniel (16/10): Sabi y Cami sin registrar, con aguinaldo y vacaciones, 5 días + sábados alternados; 8 h por día (supuesto). */
const PERFIL = createBaseCompleteProfile({
  studioStructure: {
    ...INITIAL_STUDIO_STRUCTURE,
    enabled: true,
    ownerDrawMonthly: "1000000",
    desiredProfitMode: "amount",
    desiredProfitMonthly: "500000",
    people: [
      createStudioOwner({ name: "Daniel", workdaysPerWeek: "6", hoursPerWorkday: "8", link: { kind: "member", userId: 7 } }),
      createStudioPerson({ id: "sp-sabi", name: "Sabi", employmentType: "informal", monthlySalary: "900000", workdaysPerWeek: "5,5", hoursPerWorkday: "8", vacationWeeksPerYear: "2" }),
      createStudioPerson({ id: "sp-cami", name: "Cami", employmentType: "informal", monthlySalary: "900000", workdaysPerWeek: "5,5", hoursPerWorkday: "8", vacationWeeksPerYear: "2" }),
    ],
  },
  cameras: [{ id: "cam-2", name: "Carnets", presetId: "custom", shutterRating: "150000", currentShutterCount: "", replacementValue: "500000" }],
});

const props = { perfil: PERFIL, cambiar: () => {}, miembros: [{ userId: 7, etiqueta: "Daniel" }] };
const html = (c: (p: typeof props) => ReactNode) => renderToStaticMarkup(createElement(c, props));

describe("secciones de Mi estudio", () => {
  it("gastos fijos: rubros sugeridos y el aviso del monotributo", () => {
    const h = html(SeccionGastosFijos);
    expect(h).toContain("Alquiler");
    expect(h).toContain("Impuestos, cobros y recargos");
  });

  it("equipo: una tarjeta por persona, con su costo, sus horas y su tarifa", () => {
    const h = html(SeccionEquipoEstudio);
    expect(h).toContain("Sabi");
    expect(h).toContain("Cami");
    expect(h).toContain("Sin registrar, con aguinaldo y vacaciones pagas");
    expect(h).toContain("5 + sábados alternados");
    expect(h).toMatch(/Cuesta <strong>\$\s?975\.000 por mes/);
    expect(h).toContain("su hora se cobra");
    expect(h).toContain("no se le manda ninguna invitación");
  });

  it("vos en el estudio: retiro, jornada y vínculo con tu usuario", () => {
    const h = html(SeccionVosEnElEstudio);
    expect(h).toContain("Tu retiro por mes");
    expect(h).toContain("Usar mis gastos personales");
    expect(h).toMatch(/<option value="7" selected="">Daniel<\/option>/);
  });

  it("equipamiento: otras cámaras con el costo por disparo", () => {
    const h = html(SeccionEquipoYCamaras);
    expect(h).toContain("Otras cámaras");
    expect(h).toMatch(/Cada disparo cuesta \$\s?3/);
  });

  it("otras líneas y ganancia como monto fijo", () => {
    const h = html(SeccionOtrasLineas);
    expect(h).toContain("Productos e impresiones");
    expect(h).toContain("Ganancia por mes");
  });

  it("resumen: valor hora del estudio y de cada persona", () => {
    const h = html(SeccionResumenEstudio);
    expect(h).toContain("Valor hora del estudio");
    expect(h).toContain("¿Cuánto vale una hora de cada uno?");
    expect(h).toContain("Sabi");
  });
});

describe("formulario con Mi estudio", () => {
  it("encendido: pasos del estudio y botón para apagarlo", () => {
    const h = renderToStaticMarkup(createElement(PerfilForm, { inicial: PERFIL, version: null, estudio: { ofrece: true, miembros: [] } }));
    expect(h).toContain("Gastos fijos del estudio");
    expect(h).toContain("Apagar Mi estudio");
    expect(h).toContain("Valor hora del estudio");
    expect(h).not.toContain("Gastos personales");
  });

  it("workspace de tipo estudio sin el modo: se ofrece encenderlo", () => {
    const h = renderToStaticMarkup(createElement(PerfilForm, { inicial: createBaseCompleteProfile(), version: null, estudio: { ofrece: true, miembros: [] } }));
    expect(h).toContain("Encender Mi estudio");
    expect(h).toContain("Gastos personales");
  });

  it("fotógrafo solo (no es estudio): nada cambia", () => {
    const h = renderToStaticMarkup(createElement(PerfilForm, { inicial: createBaseCompleteProfile(), version: null, estudio: { ofrece: false, miembros: [] } }));
    expect(h).not.toContain("Mi estudio");
    expect(h).toContain("Perfil del fotógrafo");
  });
});
