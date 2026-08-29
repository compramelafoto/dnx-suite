import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { claimedPrefixes, submodulesFor } from "./submodules";
import { MEMBERS_MODULE_KEY } from "@/lib/members/constants";

const RAIZ = join(import.meta.dirname, "..", "..");

/** Traduce una ruta del menú al archivo que la sirve. */
function pageDe(href: string): string {
  return join(RAIZ, "app", "(shell)", href.replace(/^\//, ""), "page.tsx");
}

describe("submodulesFor", () => {
  it("el Diseñador está entre las pantallas de Socios", () => {
    const hrefs = submodulesFor(MEMBERS_MODULE_KEY, { canManage: true }).map((s) => s.href);
    expect(hrefs).toContain("/members/disenador");
  });

  it("quien no administra ve el padrón pero no lo que requiere permiso", () => {
    const hrefs = submodulesFor(MEMBERS_MODULE_KEY, { canManage: false }).map((s) => s.href);
    expect(hrefs).toEqual(["/members"]);
  });

  it("un módulo de una sola pantalla no inventa una lista", () => {
    expect(submodulesFor("website", { canManage: true })).toEqual([]);
    expect(submodulesFor("no-existe", { canManage: true })).toEqual([]);
  });

  it("cada pantalla declarada tiene su archivo", () => {
    for (const clave of [MEMBERS_MODULE_KEY]) {
      for (const sub of submodulesFor(clave, { canManage: true })) {
        expect(existsSync(pageDe(sub.href)), `no existe la pantalla ${sub.href}`).toBe(true);
      }
    }
  });

  it("toda pantalla se explica: sin descripción, la tarjeta del inicio no dice nada", () => {
    for (const sub of submodulesFor(MEMBERS_MODULE_KEY, { canManage: true })) {
      expect(sub.description.length, `${sub.href} sin descripción`).toBeGreaterThan(10);
    }
  });

  it("no hay rutas repetidas", () => {
    const hrefs = submodulesFor(MEMBERS_MODULE_KEY, { canManage: true }).map((s) => s.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});

describe("claimedPrefixes", () => {
  it("excluye la raíz del módulo: es la que recibe el resto", () => {
    const p = claimedPrefixes(MEMBERS_MODULE_KEY);
    expect(p).not.toContain("/members");
    expect(p).toContain("/members/disenador");
    expect(p).toContain("/members/carnets");
  });

  it("una ruta del módulo que nadie reclama cae en el padrón", () => {
    const reclamadas = claimedPrefixes(MEMBERS_MODULE_KEY);
    const cae = (path: string) =>
      !reclamadas.some((r) => path === r || path.startsWith(`${r}/`));
    expect(cae("/members/123")).toBe(true);
    expect(cae("/members/123/edit")).toBe(true);
    expect(cae("/members/disenador")).toBe(false);
    expect(cae("/members/cuotas/configuracion")).toBe(false);
  });
});
