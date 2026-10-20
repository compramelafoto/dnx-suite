import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getModuleDefinition } = await import("@/lib/modules/registry");
const { RESERVED_SLUGS } = await import("@/lib/entrada/institution-shortcut");
const { TIPOS_PLANTILLA, ETIQUETA_TIPO_PLANTILLA, CLAVES_AUTOMATICO } = await import("@/lib/plantillas/constantes");
const { AUTOMATICOS } = await import("@/lib/plantillas/definiciones");
const { CLAVES_SECUENCIA, SECUENCIAS_INICIALES } = await import("@/lib/numeracion/secuencias");
const { variablesPara } = await import("@/lib/plantillas/variables");

describe("Galería: lo que se registra en el resto del sistema", () => {
  it("el módulo está disponible, depende de Proyectos y su ruta está reservada", () => {
    expect(getModuleDefinition("gallery")).toMatchObject({ status: "AVAILABLE", route: "/galerias", dependsOn: ["projects"] });
    expect(RESERVED_SLUGS.has("galerias")).toBe(true);
  });

  it("GALERIA es un tipo de plantilla con etiqueta y sus variables", () => {
    expect(TIPOS_PLANTILLA).toContain("GALERIA");
    expect(ETIQUETA_TIPO_PLANTILLA.GALERIA).toBe("Galería");
    expect(variablesPara("GALERIA", []).map((v) => v.clave)).toEqual(expect.arrayContaining(["galeria_enlace", "galeria_cantidad", "galeria_nombre"]));
    expect(variablesPara("CONTRATO", []).map((v) => v.clave)).not.toContain("galeria_enlace");
  });

  it("los dos correos automáticos son de tipo GALERIA y por correo", () => {
    for (const clave of ["GALERIA_ENVIO", "GALERIA_SELECCION_ENVIADA"] as const) {
      expect(CLAVES_AUTOMATICO).toContain(clave);
      expect(AUTOMATICOS[clave]).toMatchObject({ canal: "EMAIL", tipo: "GALERIA" });
    }
  });

  it("la numeración GALERIA lleva año y cuatro dígitos como las demás", () => {
    expect(CLAVES_SECUENCIA).toContain("GALERIA");
    expect(SECUENCIAS_INICIALES.GALERIA).toMatchObject({ prefix: "", withYear: true, digits: 4, nextValue: 1 });
  });
});
