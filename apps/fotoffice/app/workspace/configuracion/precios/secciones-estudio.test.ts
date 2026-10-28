import { describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createStudioOwner, createStudioPerson, INITIAL_STUDIO_STRUCTURE } from "@repo/cuanto-cobro-core";
import { createBaseCompleteProfile } from "@repo/cuanto-cobro-core/__fixtures__/characterization-fixtures";
import { perfilDanielSeparado } from "@repo/cuanto-cobro-core/__fixtures__/studio-fixtures";

vi.mock("./actions", () => ({ guardarPerfilPreciosAction: async () => ({ ok: true, actualizado: "" }) }));
vi.mock("@/components/dnx-bot/oferta-perfil", () => ({ OfertaArmarConversando: () => null }));

const { SeccionEquipoEstudio, SeccionEquipoYCamaras, SeccionGastosFijos, SeccionOtrasLineas, SeccionResumenEstudio, SeccionVosEnElEstudio } = await import(
  "./secciones-estudio"
);
const { PerfilForm } = await import("./perfil-form");
const { SeccionLocalYCoberturas } = await import("./secciones-local");

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

describe("Local y coberturas", () => {
  const SEPARADO = perfilDanielSeparado();
  const props = (extra: Record<string, unknown> = {}) => ({ perfil: SEPARADO, cambiar: () => {}, miembros: [], ...extra });
  const ventas = (months: { month: string; sales: number }[]) => ({ months });

  it("resumen separado sin datos del local: dos recuadros y el aviso de «sin datos»", () => {
    const h = renderToStaticMarkup(createElement(SeccionResumenEstudio, props()));
    expect(h).toContain("Tus coberturas");
    expect(h).toContain("El local");
    expect(h).toContain("Todavía no hay datos: elegí las categorías de Caja de tus ventas o cargá un estimado");
    expect(h).toContain("Tu hora");
    expect(h).not.toContain("Tu retiro");
  });

  it("«Tus coberturas»: lo que necesitás llevarte (con otros ingresos) y tus insumos, en vez de la resta a mano", () => {
    const perfil = {
      ...SEPARADO,
      livesOnlyFromPhotography: "no" as const,
      externalMonthlyIncome: "200000",
      studioStructure: {
        ...SEPARADO.studioStructure!,
        people: SEPARADO.studioStructure!.people.map((p) => (p.role === "owner" ? { ...p, monthlySupplies: "50000" } : p)),
      },
    };
    const h = renderToStaticMarkup(createElement(SeccionResumenEstudio, props({ perfil })));
    expect(h).toContain("Lo que necesitás llevarte de las coberturas");
    expect(h).toContain("Tus insumos");
    expect(h).toContain("menos tus otros ingresos");
    expect(h).not.toContain("− Lo que te paga el local");
  });

  it("resumen separado medido: el último mes en verde o en rojo, con la lista de meses", () => {
    // Gastos del local: 450.000 + 230.000 + 30.000 + 80.000 + 45.000 + 20 % de 130.000 + equipo + 1.000.000. Con 40 % de mercadería.
    const perfil = { ...SEPARADO, studioStructure: { ...SEPARADO.studioStructure!, localGoodsCostPercent: "40" } };
    const rojo = renderToStaticMarkup(createElement(SeccionResumenEstudio, props({ perfil, ventasLocal: ventas([{ month: "2026-09", sales: 1_000_000 }, { month: "2026-08", sales: 1_000_000 }]) })));
    expect(rojo).toContain("Le faltaron");
    expect(rojo).toMatch(/septiembre/i);
    expect(rojo).toMatch(/agosto/i);
    const verde = renderToStaticMarkup(createElement(SeccionResumenEstudio, props({ perfil, ventasLocal: ventas([{ month: "2026-09", sales: 20_000_000 }, { month: "2026-08", sales: 1_000_000 }]) })));
    expect(verde).toContain("Se pagó solo y sobraron");
  });

  it("resumen separado con un monto a mano: el semáforo dice «estimado»", () => {
    const perfil = { ...SEPARADO, studioStructure: { ...SEPARADO.studioStructure!, localMonthlyContributionManual: "10000000" } };
    const h = renderToStaticMarkup(createElement(SeccionResumenEstudio, props({ perfil })));
    expect(h).toContain("Se pagó solo y sobraron");
    expect(h).toContain("estimado");
  });

  it("el paso: interruptor, gastos personales, sueldo del local, clasificación y categorías de Caja", () => {
    const h = renderToStaticMarkup(createElement(SeccionLocalYCoberturas, props({ categoriasIngreso: [{ id: "cat-ventas", nombre: "Ventas" }] })));
    for (const t of [
      "Separar el local de las coberturas",
      "Lo que pase en el local nunca cambia el precio de tus eventos.",
      "Lo que te paga el local por mes",
      "Otros ingresos",
      "¿Vivís sólo de la fotografía?",
      "Tu tiempo en el local (%)",
      "Gastos compartidos que van a coberturas (%)",
      "Costo de la mercadería (% de lo que vendés)",
      "Lo que deja el local por mes (estimado)",
      "Alquiler",
      "Camila",
      "Productos e impresiones",
      "Ventas",
      "Compartido",
    ]) {
      expect(h).toContain(t);
    }
    // El valor por defecto de los compartidos: 100 − 20 % en el local.
    expect(h).toContain("80 %");
  });

  it("vos en el estudio y otras líneas: sin «Tu retiro» ni «Lo que dejan» en modo separado", () => {
    expect(renderToStaticMarkup(createElement(SeccionVosEnElEstudio, props()))).not.toContain("Tu retiro por mes");
    expect(renderToStaticMarkup(createElement(SeccionOtrasLineas, props()))).not.toContain("Lo que dejan por mes las líneas que no venden horas");
  });

  it("formulario: el paso «Local y coberturas» aparece sólo con el modo separado", () => {
    const con = renderToStaticMarkup(createElement(PerfilForm, { inicial: SEPARADO, version: null, estudio: { ofrece: true, miembros: [] } }));
    expect(con).toContain("Local y coberturas");
    const sin = renderToStaticMarkup(createElement(PerfilForm, { inicial: PERFIL, version: null, estudio: { ofrece: true, miembros: [] } }));
    expect(sin).not.toContain("Local y coberturas");
  });

  it("sin el modo, «Vos en el estudio» ofrece separar el local", () => {
    expect(html(SeccionVosEnElEstudio)).toContain("Separar el local de las coberturas");
  });
});
