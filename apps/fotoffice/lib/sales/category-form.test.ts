import { describe, expect, it } from "vitest";
import { parseCategoryForm } from "./category-form";

function form(campos: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.set(k, v);
  return fd;
}

/**
 * Arma el `FormData` tal cual lo manda `<CategoryForm>` para "Activa": el checkbox más el
 * `<input type="hidden" value="off">` de respaldo, en ese orden. Tildada, viajan las dos
 * entradas (el "on" del checkbox primero); destildada, sólo la del oculto. Como
 * `FormData.get` toma la primera coincidencia, esto ejercita el orden real del DOM en vez
 * de un valor puesto a mano.
 */
function formConCasillaActiva(campos: Record<string, string>, tildada: boolean): FormData {
  const fd = form(campos);
  if (tildada) fd.append("isActive", "on");
  fd.append("isActive", "off");
  return fd;
}

describe("parseCategoryForm", () => {
  it("un nombre alcanza", () => {
    const r = parseCategoryForm(form({ name: "Marcos" }));
    expect(r.ok && r.values.name).toBe("Marcos");
  });

  it("sin nombre se rechaza", () => {
    expect(parseCategoryForm(form({ name: "  " }))).toEqual({
      ok: false,
      error: "Poné un nombre para la categoría.",
    });
  });

  it("el orden es cero por omisión", () => {
    const r = parseCategoryForm(form({ name: "Marcos" }));
    expect(r.ok && r.values.order).toBe(0);
  });

  it("un orden no numérico cae a cero", () => {
    const r = parseCategoryForm(form({ name: "Marcos", order: "no es un número" }));
    expect(r.ok && r.values.order).toBe(0);
  });

  it("isActive es verdadero por omisión", () => {
    const r = parseCategoryForm(form({ name: "Marcos" }));
    expect(r.ok && r.values.isActive).toBe(true);
  });

  it("isActive sigue en verdadero cuando la casilla viaja tildada junto al respaldo oculto", () => {
    const r = parseCategoryForm(formConCasillaActiva({ name: "Marcos" }, true));
    expect(r.ok && r.values.isActive).toBe(true);
  });

  it("isActive se puede apagar", () => {
    // Antes mandaba `isActive: "off"` a mano, un valor que el formulario real nunca
    // producía (la casilla no tenía respaldo oculto): pasaba en verde con el componente
    // roto. Ahora arma el `FormData` como lo hace `formConCasillaActiva` con la casilla
    // destildada: sólo viaja el "off" del respaldo, igual que en la pantalla.
    const r = parseCategoryForm(formConCasillaActiva({ name: "Marcos" }, false));
    expect(r.ok && r.values.isActive).toBe(false);
  });
});
