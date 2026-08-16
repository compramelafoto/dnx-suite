import { describe, expect, it } from "vitest";
import { buildMemberImportPrompt } from "./prompt";
import { MEMBER_IMPORT_COLUMNS, MEMBER_IMPORT_HEADER_ROW } from "./columns";

describe("buildMemberImportPrompt — dinámico, nunca un texto fijo desincronizado del schema", () => {
  it("incluye el encabezado CSV real (derivado de MEMBER_IMPORT_COLUMNS)", () => {
    const prompt = buildMemberImportPrompt({ workspaceName: "SFPR", categoryNames: ["Activo"] });
    expect(prompt).toContain(MEMBER_IMPORT_HEADER_ROW);
  });

  it("incluye todas las columnas con su descripción, no una lista hardcodeada aparte", () => {
    const prompt = buildMemberImportPrompt({ workspaceName: "SFPR", categoryNames: ["Activo"] });
    for (const col of MEMBER_IMPORT_COLUMNS) {
      expect(prompt).toContain(col.key);
    }
  });

  it("incluye el nombre del workspace", () => {
    const prompt = buildMemberImportPrompt({ workspaceName: "FotoPositiva", categoryNames: ["Voluntario"] });
    expect(prompt).toContain("FotoPositiva");
  });

  it("incluye las categorías reales pasadas, no un ejemplo fijo", () => {
    const prompt = buildMemberImportPrompt({
      workspaceName: "DNX Estudio",
      categoryNames: ["Socio activo", "Honorario"],
    });
    expect(prompt).toContain("Socio activo");
    expect(prompt).toContain("Honorario");
    expect(prompt).not.toContain("Estudiante"); // no aparece una categoría que no se pasó
  });

  it("sin categorías: avisa que hace falta crear una antes de importar, no inventa una lista", () => {
    const prompt = buildMemberImportPrompt({ workspaceName: "SFPR", categoryNames: [] });
    expect(prompt).toContain("no tiene categorías");
  });

  it("nunca incluye datos personales del padrón existente (no recibe ningún Member como input)", () => {
    // Contrato de tipos: buildMemberImportPrompt solo acepta workspaceName + categoryNames.
    const prompt = buildMemberImportPrompt({ workspaceName: "SFPR", categoryNames: ["Activo"] });
    expect(prompt).not.toMatch(/@[\w.-]+\.\w+/); // ningún email colado
  });

  it("le pide explícitamente a la IA que pregunte antes de asumir, y que no invente datos", () => {
    const prompt = buildMemberImportPrompt({ workspaceName: "SFPR", categoryNames: ["Activo"] });
    expect(prompt).toMatch(/pregunt/i);
    expect(prompt).toMatch(/no inventes/i);
  });

  it("pide responder solo con el CSV, dentro de un bloque de código, sin explicaciones", () => {
    const prompt = buildMemberImportPrompt({ workspaceName: "SFPR", categoryNames: ["Activo"] });
    expect(prompt).toMatch(/bloque de código/i);
    expect(prompt).toMatch(/NO agregues explicaciones/i);
  });
});
