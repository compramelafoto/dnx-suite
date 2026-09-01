import { describe, expect, it } from "vitest";
import { PORTAL_MENU, portalBottomBar, resolvePortalMenu } from "./menu";

const TODOS = new Set(["membership-dues", "bookings", "courses-sales", "governance", "members"]);

describe("menú del socio", () => {
  it("sigue el orden del documento de navegación", () => {
    const ordenes = resolvePortalMenu(new Set()).map((i) => i.order);
    expect(ordenes).toEqual([...ordenes].sort((a, b) => a - b));
    expect(ordenes[0]).toBe(10);
  });

  it("no esconde nada: lo que falta se muestra como Próximamente", () => {
    // La excepción del portal. En el panel la regla es la contraria y sigue siéndolo.
    const items = resolvePortalMenu(new Set());
    expect(items).toHaveLength(PORTAL_MENU.length);
    expect(items.every((i) => i.state === "DISPONIBLE" || i.state === "PROXIMAMENTE")).toBe(true);
  });

  it("una sección construida sigue sin estar disponible si el módulo está apagado", () => {
    const sinCuotas = resolvePortalMenu(new Set());
    const cuotas = sinCuotas.find((i) => i.href === "/portal/cuotas");
    expect(cuotas?.state).toBe("PROXIMAMENTE");

    const conCuotas = resolvePortalMenu(new Set(["membership-dues"]));
    expect(conCuotas.find((i) => i.href === "/portal/cuotas")?.state).toBe("DISPONIBLE");
  });

  it("una sección sin construir no se habilita por tener el módulo prendido", () => {
    const items = resolvePortalMenu(TODOS);
    expect(items.find((i) => i.href === "/portal/reservas")?.state).toBe("PROXIMAMENTE");
  });

  it("inicio, carnet y perfil no dependen de ningún módulo", () => {
    const items = resolvePortalMenu(new Set());
    for (const href of ["/portal", "/portal/carnet", "/portal/perfil"]) {
      expect(items.find((i) => i.href === href)?.state, href).toBe("DISPONIBLE");
    }
  });

  it("la barra del teléfono lleva como mucho cuatro", () => {
    const barra = portalBottomBar(resolvePortalMenu(TODOS));
    expect(barra.length).toBeLessThanOrEqual(4);
    expect(barra.length).toBeGreaterThan(0);
    // Al alcance del pulgar va lo que se usa siempre, no lo que todavía no existe.
    expect(barra.every((i) => i.built)).toBe(true);
  });

  it("no hay rutas ni órdenes repetidos", () => {
    const hrefs = PORTAL_MENU.map((i) => i.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    const ordenes = PORTAL_MENU.map((i) => i.order);
    expect(new Set(ordenes).size).toBe(ordenes.length);
  });

  it("toda sección se explica: sin descripción la portada no dice nada", () => {
    for (const i of PORTAL_MENU) {
      expect(i.description.length, i.href).toBeGreaterThan(10);
    }
  });

  it("cada sección construida tiene su pantalla", async () => {
    const { existsSync } = await import("node:fs");
    const { join } = await import("node:path");
    for (const i of PORTAL_MENU.filter((x) => x.built)) {
      const ruta = join(import.meta.dirname, "..", "..", "app", i.href.replace(/^\//, ""), "page.tsx");
      expect(existsSync(ruta), `falta la pantalla ${i.href}`).toBe(true);
    }
  });
});
