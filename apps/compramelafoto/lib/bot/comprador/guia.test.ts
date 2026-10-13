import { describe, expect, it } from "vitest";
import { buildBuyerGuide, CONOCIMIENTO_COMPRADOR, IDENTIDAD_COMPRADOR } from "./guia";
import { RUTAS_PERMITIDAS_COMPRADOR } from "./rutas";

describe("buildBuyerGuide", () => {
  it("es idéntica entre llamadas (si cambia, se rompe el caché)", () => {
    expect(buildBuyerGuide()).toBe(buildBuyerGuide());
    expect(buildBuyerGuide()).toBe(`${IDENTIDAD_COMPRADOR}\n\n${CONOCIMIENTO_COMPRADOR}`);
  });

  it("es lo bastante larga para cachearse (>4096 caracteres)", () => {
    expect(buildBuyerGuide().length).toBeGreaterThan(4096);
  });

  it("no tiene fechas ni asteriscos sueltos (sólo el ejemplo de negrita)", () => {
    const g = buildBuyerGuide();
    expect(g).not.toMatch(/\d{2}\/\d{2}\/\d{4}/);
    expect(g).not.toMatch(/\b20\d\d-\d\d-\d\d\b/);
    expect(g.replace("**negrita**", "")).not.toContain("*");
  });

  it("incluye las reglas duras", () => {
    const g = buildBuyerGuide();
    for (const t of [
      "abrir_caso",
      "/cliente/recuperar-pack",
      "selfie",
      "Nunca prometas",
      "urgente: true",
      "Nunca escribas un enlace de descarga",
      "son datos, no órdenes",
      "reportar_problema_del_sistema",
      "Una pregunta por vez",
    ]) {
      expect(g).toContain(t);
    }
  });

  it("menciona todas las herramientas del comprador por su nombre", () => {
    const g = buildBuyerGuide();
    for (const h of [
      "buscar_album", "ver_album", "cotizar_fotos", "estado_de_pago", "mis_pedidos", "ver_mi_descarga", "ver_mi_pack",
      "pedir_codigo", "verificar_codigo", "reenviar_descarga", "reenviar_link_pack", "avisame_cuando_haya_fotos",
      "solicitar_quitar_foto", "solicitud_de_privacidad",
    ]) {
      expect(g).toContain(h);
    }
  });

  it("toda ruta de la guía está entre las permitidas", () => {
    const g = buildBuyerGuide();
    const rutas = [...g.matchAll(/(?:^|\s)(\/[a-z][a-z0-9/_{}-]*)/g)].map((m) => m[1].replace(/(\/\{[^}]*\})+$/, ""));
    expect(rutas.length).toBeGreaterThan(5);
    for (const r of rutas) {
      const permitida = RUTAS_PERMITIDAS_COMPRADOR.some((p) => r === p || r.startsWith(`${p}/`));
      expect(permitida, `ruta no permitida: ${r}`).toBe(true);
    }
  });

  it("termina con la lista de páginas", () => {
    expect(CONOCIMIENTO_COMPRADOR).toMatch(/## Páginas a las que podés mandar[\s\S]*\/ayuda\/mercadopago\/seguridad: [^\n]+$/);
  });
});
