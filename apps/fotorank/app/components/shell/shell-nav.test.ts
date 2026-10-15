/**
 * El menú del panel se dibuja dos veces: en la barra lateral y en el menú a pantalla
 * completa del encabezado. Hasta el 2026-09-21 eran dos listas escritas a mano, y habían
 * divergido: la barra tenía 14 entradas agrupadas y el encabezado 7 sueltas, con nombres
 * distintos. Acá se garantiza que las dos salgan de la misma fuente.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { menuLinksFromSections, contarItems } from "./shell-nav";
import type { ShellSection } from "./shell-nav";

const SECCIONES: ShellSection[] = [
  {
    title: "Concursos",
    items: [
      { label: "Panel", href: "/dashboard", icon: "dashboard" },
      { label: "Concursos", href: "/concursos", icon: "camera" },
    ],
  },
  {
    title: "Jurados",
    items: [
      { label: "Jurados", href: "/jurados", icon: "user", roles: ["admin"] },
      {
        label: "Asignaciones",
        href: "/jurados/asignaciones",
        icon: "plus",
        roles: ["admin"],
      },
    ],
  },
];

test("el menú del encabezado sale de las mismas secciones que la barra lateral", () => {
  const links = menuLinksFromSections(SECCIONES);
  assert.deepEqual(
    links.map((l) => l.href),
    ["/dashboard", "/concursos", "/jurados", "/jurados/asignaciones", "/"],
  );
});

test("la última entrada siempre lleva al sitio público", () => {
  const links = menuLinksFromSections(SECCIONES);
  const ultima = links.at(-1);
  assert.equal(ultima?.href, "/");
  assert.equal(ultima?.label, "Ir al inicio");
  assert.equal(ultima?.primary, true);
});

test("respeta el nombre exacto de cada entrada, sin abreviar", () => {
  const links = menuLinksFromSections(SECCIONES);
  assert.equal(links[3]?.label, "Asignaciones");
});

test("una sección vacía no agrega nada", () => {
  const links = menuLinksFromSections([{ title: "Vacía", items: [] }]);
  assert.deepEqual(
    links.map((l) => l.href),
    ["/"],
  );
});

test("contarItems sirve para vigilar que un menú no se desborde", () => {
  assert.equal(contarItems(SECCIONES), 4);
});
