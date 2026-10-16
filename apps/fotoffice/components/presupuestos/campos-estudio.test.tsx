import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createBaseCompleteProfile } from "@repo/cuanto-cobro-core/__fixtures__/characterization-fixtures";
import { perfilConEstudio, SPEC } from "@repo/cuanto-cobro-core/__fixtures__/studio-fixtures";
import { conAsignaciones, trabajoVacio } from "@/lib/presupuestos/panel-cuanto-cobro";
import { CamposEstudio } from "./campos-estudio";

const nada = () => {};

describe("CamposEstudio", () => {
  it("modo estudio: «¿Quién lo hace?» con las tarifas de cada persona y la línea", () => {
    const t = conAsignaciones(trabajoVacio("Evento"), [{ persona: "sp-cami", actividad: "editing", horas: "10" }]);
    const html = renderToStaticMarkup(<CamposEstudio trabajo={t} onCambio={nada} perfil={perfilConEstudio(SPEC)} />);
    expect(html).toContain("¿Quién lo hace?");
    expect(html).toMatch(/Cami · \$\s?14\.297 la hora/);
    expect(html).toContain("+ Asignar cobertura");
    expect(html).toContain("Línea del estudio");
  });

  it("fotógrafo solo sin otras cámaras: no dibuja nada", () => {
    expect(renderToStaticMarkup(<CamposEstudio trabajo={trabajoVacio("x")} onCambio={nada} perfil={createBaseCompleteProfile()} />)).toBe("");
  });

  it("con otras cámaras: elegir cámara y disparos por unidad o por trabajo", () => {
    const perfil = { ...createBaseCompleteProfile(), cameras: [{ id: "cam-2", name: "Carnets", presetId: "custom", shutterRating: "150000", currentShutterCount: "", replacementValue: "500000" }] };
    const html = renderToStaticMarkup(<CamposEstudio trabajo={{ ...trabajoVacio("Carnet"), tipo: "physical-product" }} onCambio={nada} perfil={perfil} />);
    expect(html).toContain("Carnets");
    expect(html).toContain("Por unidad");
    expect(html).not.toContain("¿Quién lo hace?");
  });
});
