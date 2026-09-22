import test from "node:test";
import assert from "node:assert/strict";

import type { SidebarSectionConfig } from "@repo/design-system";

import { sidebarConAtajos, COLA_DE_REVISION_HREF } from "./sidebarConAtajos";
import {
  PANEL_DE_JURADO_ETIQUETA,
  PANEL_DE_JURADO_HREF,
} from "../../lib/fotorank/access/judge-panel-entry";

const NADIE = { esJurado: false, juradosPorRevisar: 0 };

function menuBase(): SidebarSectionConfig[] {
  return [
    {
      title: "Mi actividad",
      items: [
        { label: "Hub personal", href: "/mi-actividad", icon: "dashboard" },
        { label: "Participaciones", href: "/participaciones", icon: "gallery" },
      ],
    },
    {
      title: "Gestión",
      items: [{ label: "Jurados", href: "/jurados", icon: "user" }],
    },
  ];
}

function items(secciones: SidebarSectionConfig[]) {
  return secciones.flatMap((s) => s.items);
}

function hrefs(secciones: SidebarSectionConfig[]): string[] {
  return items(secciones).map((i) => i.href);
}

test("sin atajos, el menú queda igual", () => {
  const resultado = sidebarConAtajos(menuBase(), NADIE);
  assert.deepEqual(hrefs(resultado), hrefs(menuBase()));
});

test("quien es jurado ve su panel dentro de Mi actividad", () => {
  const resultado = sidebarConAtajos(menuBase(), { ...NADIE, esJurado: true });
  const miActividad = resultado.find((s) => s.title === "Mi actividad");
  assert.ok(miActividad!.items.some((i) => i.href === PANEL_DE_JURADO_HREF));
});

test("el atajo a la cola aparece con el número de fichas que esperan", () => {
  const resultado = sidebarConAtajos(menuBase(), { ...NADIE, juradosPorRevisar: 2 });
  const entrada = items(resultado).find((i) => i.href === COLA_DE_REVISION_HREF);
  assert.ok(entrada, "debería estar el atajo a la cola");
  assert.match(entrada!.label, /\b2\b/);
});

test("con la cola vacía no hay atajo: no se promete trabajo que no existe", () => {
  const resultado = sidebarConAtajos(menuBase(), { ...NADIE, juradosPorRevisar: 0 });
  assert.ok(!hrefs(resultado).includes(COLA_DE_REVISION_HREF));
});

test("las dos cosas a la vez conviven", () => {
  const resultado = sidebarConAtajos(menuBase(), { esJurado: true, juradosPorRevisar: 5 });
  const destinos = hrefs(resultado);
  assert.ok(destinos.includes(PANEL_DE_JURADO_HREF));
  assert.ok(destinos.includes(COLA_DE_REVISION_HREF));
});

test("no se confunde con Jurados, que es administrar a los jurados", () => {
  const resultado = sidebarConAtajos(menuBase(), { esJurado: true, juradosPorRevisar: 3 });
  const gestion = resultado.find((s) => s.title === "Gestión");
  assert.deepEqual(
    gestion!.items.map((i) => i.href),
    ["/jurados"],
    "Gestión no debería recibir ningún atajo personal",
  );
  assert.notEqual(PANEL_DE_JURADO_ETIQUETA, "Jurados");
});

test("no modifica el menú que recibe", () => {
  const original = menuBase();
  const antes = JSON.stringify(original);
  sidebarConAtajos(original, { esJurado: true, juradosPorRevisar: 4 });
  assert.equal(JSON.stringify(original), antes);
});

test("no agrega dos veces lo mismo", () => {
  const atajos = { esJurado: true, juradosPorRevisar: 2 };
  const unaVez = sidebarConAtajos(menuBase(), atajos);
  const dosVeces = sidebarConAtajos(unaVez, atajos);
  for (const destino of [PANEL_DE_JURADO_HREF, COLA_DE_REVISION_HREF]) {
    assert.equal(
      hrefs(dosVeces).filter((h) => h === destino).length,
      1,
      `${destino} debería aparecer una sola vez`,
    );
  }
});

test("si no existe Mi actividad, los atajos no se pierden", () => {
  const sinSeccionPropia: SidebarSectionConfig[] = [
    { title: "Gestión", items: [{ label: "Jurados", href: "/jurados", icon: "user" }] },
  ];
  const resultado = sidebarConAtajos(sinSeccionPropia, { esJurado: true, juradosPorRevisar: 1 });
  const destinos = hrefs(resultado);
  assert.ok(destinos.includes(PANEL_DE_JURADO_HREF));
  assert.ok(destinos.includes(COLA_DE_REVISION_HREF));
});
