import { describe, expect, it } from "vitest";
import { entradaDeMuestra, erroresDePlantilla, vistaPreviaDePlantilla } from "./muestra";
import { CUERPO_PLANTILLA_MODELO } from "./modelo";

const HOY = new Date("2026-10-10T15:00:00.000Z");
const SIN_EMPRESA = { nombre: null, cuit: null, domicilio: null };

describe("vista previa con un pedido de ejemplo", () => {
  it("completa el modelo con datos inventados: dos contratantes, tabla de ítems y de cuotas", () => {
    const v = vistaPreviaDePlantilla(CUERPO_PLANTILLA_MODELO, SIN_EMPRESA, HOY);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    const tablas = v.bloques.filter((b) => b.tipo === "tabla");
    expect(tablas).toHaveLength(2);
    expect(v.bloques.some((b) => b.tipo === "salto")).toBe(true);
    const texto = JSON.stringify(v.bloques);
    expect(texto).toContain("Ana Gómez");
    expect(texto).toContain("Luis Pérez");
    expect(texto).toContain("Tu empresa (ejemplo)");
    expect(texto).not.toMatch(/\[[a-z_0-9:]+\]/);
  });

  it("usa los datos de la empresa cargados en los ajustes", () => {
    const v = vistaPreviaDePlantilla("[empresa_nombre] / [empresa_cuit] / [empresa_domicilio]", { nombre: "Estudio Luz", cuit: "30-1-2", domicilio: "Mitre 1" }, HOY);
    expect(v.ok && JSON.stringify(v.bloques)).toContain("Estudio Luz / 30-1-2 / Mitre 1");
  });

  it("el bloque del contratante 2 sigue la regla: con dato aparece (el ejemplo tiene dos)", () => {
    expect(entradaDeMuestra(SIN_EMPRESA, HOY).contratantes).toHaveLength(2);
  });

  it("avisa de variables que no existen, con su nombre, y no completa nada", () => {
    const v = vistaPreviaDePlantilla("Hola [inventada] y [nombre]", SIN_EMPRESA, HOY);
    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.desconocidas.sort()).toEqual(["inventada", "nombre"]);
    expect(v.errores.length).toBeGreaterThan(0);
    expect(erroresDePlantilla("[inventada]")?.[0]).toContain("[inventada]");
    expect(erroresDePlantilla("[contratante1_nombre]")).toBeNull();
  });

  it("no ejecuta ni interpreta HTML: queda como texto", () => {
    const v = vistaPreviaDePlantilla("<script>alert(1)</script> [contratante1_nombre]", SIN_EMPRESA, HOY);
    expect(v.ok && JSON.stringify(v.bloques)).toContain("<script>alert(1)</script>");
  });
});
