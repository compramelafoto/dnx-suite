import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { allSubmoduleItems, claimedPrefixes, submodulesFor } from "./submodules";
import { MEMBERS_MODULE_KEY } from "@/lib/members/constants";
import { ICONOS } from "@/components/shell/nav-icons";
import { personVocabulary } from "@/lib/vocabulario/personas";

const RAIZ = join(import.meta.dirname, "..", "..");

const SOCIO = personVocabulary(null);
const VOLUNTARIO = personVocabulary({ singular: "voluntario/a", plural: "voluntarios/as" });

/** Traduce una ruta del menú al archivo que la sirve. */
function pageDe(href: string): string {
  return join(RAIZ, "app", "(shell)", href.replace(/^\//, ""), "page.tsx");
}

describe("submodulesFor", () => {
  it("el Diseñador está entre las pantallas de Socios", () => {
    const hrefs = submodulesFor(MEMBERS_MODULE_KEY, { canManage: true }, SOCIO).map(
      (s) => s.href,
    );
    expect(hrefs).toContain("/members/disenador");
  });

  it("quien no administra ve el padrón pero no lo que requiere permiso", () => {
    const hrefs = submodulesFor(MEMBERS_MODULE_KEY, { canManage: false }, SOCIO).map(
      (s) => s.href,
    );
    expect(hrefs).toEqual(["/members"]);
  });

  it("un módulo de una sola pantalla no inventa una lista", () => {
    expect(submodulesFor("website", { canManage: true }, SOCIO)).toEqual([]);
    expect(submodulesFor("no-existe", { canManage: true }, SOCIO)).toEqual([]);
  });

  it("cada pantalla declarada tiene su archivo", () => {
    for (const clave of [MEMBERS_MODULE_KEY]) {
      for (const sub of submodulesFor(clave, { canManage: true }, SOCIO)) {
        expect(existsSync(pageDe(sub.href)), `no existe la pantalla ${sub.href}`).toBe(true);
      }
    }
  });

  it("toda pantalla se explica: sin descripción, la tarjeta del inicio no dice nada", () => {
    for (const sub of submodulesFor(MEMBERS_MODULE_KEY, { canManage: true }, SOCIO)) {
      expect(sub.description.length, `${sub.href} sin descripción`).toBeGreaterThan(10);
    }
  });

  it("no hay rutas repetidas", () => {
    const hrefs = submodulesFor(MEMBERS_MODULE_KEY, { canManage: true }, SOCIO).map(
      (s) => s.href,
    );
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  describe("vocabulario de personas", () => {
    it("con el vocabulario por omisión, el padrón dice lo mismo que decía antes", () => {
      const padron = submodulesFor(MEMBERS_MODULE_KEY, { canManage: true }, SOCIO).find(
        (s) => s.href === "/members",
      );
      expect(padron?.description).toBe("Todos los socios, su estado y su ficha.");
    });

    it("con voluntarios configurados, el padrón dice Voluntarios/as", () => {
      const padron = submodulesFor(MEMBERS_MODULE_KEY, { canManage: true }, VOLUNTARIO).find(
        (s) => s.href === "/members",
      );
      expect(padron?.description).toBe("Todos los voluntarios/as, su estado y su ficha.");
    });

    it("ningún label ni descripción devuelto contiene una llave sin resolver", () => {
      for (const vocabulario of [SOCIO, VOLUNTARIO]) {
        for (const sub of submodulesFor(MEMBERS_MODULE_KEY, { canManage: true }, vocabulario)) {
          expect(sub.label, `label de ${sub.href} quedó con un marcador sin resolver`).not.toContain(
            "{",
          );
          expect(
            sub.description,
            `description de ${sub.href} quedó con un marcador sin resolver`,
          ).not.toContain("{");
        }
      }
    });
  });
});

describe("íconos de los submódulos", () => {
  it("cada ícono declarado existe en el mapa que dibuja el menú", () => {
    // Este es el hallazgo que motiva la prueba: declarar acá un nombre de lucide-react que no
    // esté en ICONOS no rompe nada — shell-nav.tsx cae en su ícono genérico de reserva, en
    // silencio, y nadie se entera hasta que alguien mira la pantalla. Barremos TODOS los
    // módulos (no solo Socios) porque el problema apareció justo en los que se acaban de dar
    // de alta.
    for (const sub of allSubmoduleItems()) {
      expect(
        ICONOS[sub.icon],
        `"${sub.icon}" (usado por ${sub.href}) no está en ICONOS: caería en el ícono genérico`,
      ).toBeDefined();
    }
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
