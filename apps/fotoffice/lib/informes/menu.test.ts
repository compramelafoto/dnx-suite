import { describe, expect, it } from "vitest";
import { itemsMenuInformes } from "./menu";
import { NAV_KEYWORDS } from "@/lib/shell/nav-keywords";

describe("itemsMenuInformes", () => {
  it("sin nivel en el módulo no hay entradas", () => {
    expect(itemsMenuInformes({ veInformes: false, puedeConfigurar: true })).toEqual([]);
  });
  it("quien ve Informes tiene Tablero, Resultados, Flujo de caja y Monotributo; Ajustes sólo si puede configurar", () => {
    expect(itemsMenuInformes({ veInformes: true, puedeConfigurar: false }).map((i) => i.label)).toEqual(["Tablero", "Resultados", "Flujo de caja", "Monotributo"]);
    expect(itemsMenuInformes({ veInformes: true, puedeConfigurar: true }).map((i) => i.label)).toEqual(["Tablero", "Resultados", "Flujo de caja", "Monotributo", "Ajustes"]);
  });
  it("sólo el Tablero se marca por coincidencia exacta y todas tienen palabras para el buscador", () => {
    const items = itemsMenuInformes({ veInformes: true, puedeConfigurar: true });
    expect(items.filter((i) => i.activeMatch === "exact").map((i) => i.href)).toEqual(["/informes"]);
    for (const i of items) expect(NAV_KEYWORDS[i.href]?.length).toBeGreaterThan(0);
  });
});
