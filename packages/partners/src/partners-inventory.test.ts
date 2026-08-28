import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AD_PLACEMENT_CATALOG } from "./campaigns";
import { DNX_INVENTORY, listSellableSpaces } from "./inventory";

describe("mapa de inventario", () => {
  it("cubre exactamente el catálogo técnico, sin sobrantes ni faltantes", () => {
    const catalogo = AD_PLACEMENT_CATALOG.map((e) => e.placementKey).sort();
    const mapa = DNX_INVENTORY.map((e) => e.placementKey).sort();
    assert.deepEqual(mapa, catalogo);
  });

  it("cada espacio declara dueño, audiencia, montaje y acceso", () => {
    for (const espacio of DNX_INVENTORY) {
      assert.ok(["PLATFORM", "ORGANIZER", "WORKSPACE"].includes(espacio.owner));
      assert.ok(["SALE", "EXCHANGE", "BOTH"].includes(espacio.access));
      assert.equal(typeof espacio.mounted, "boolean");
      assert.ok(espacio.audience.length > 0);
    }
  });

  it("hay nueve espacios montados y veintiuno sin montar", () => {
    const montados = DNX_INVENTORY.filter((e) => e.mounted);
    assert.equal(montados.length, 9);
    assert.equal(DNX_INVENTORY.length - montados.length, 21);
  });

  it("el concurso de FotoRank es del organizador y la portada de la plataforma", () => {
    const buscar = (k: string) => DNX_INVENTORY.find((e) => e.placementKey === k);
    assert.equal(buscar("FOTORANK_CONTEST_WELCOME")?.owner, "ORGANIZER");
    assert.equal(buscar("FOTORANK_HOME_WELCOME")?.owner, "PLATFORM");
  });

  it("el orden es estable: por aplicación y después por clave", () => {
    const claves = DNX_INVENTORY.map((e) => `${e.application}|${e.placementKey}`);
    assert.deepEqual(claves, [...claves].sort());
  });
});

describe("listSellableSpaces", () => {
  it("un organizador de FotoRank ve su concurso y no la portada", () => {
    const espacios = listSellableSpaces({ owner: "ORGANIZER", application: "FOTO_RANK" });
    const claves = espacios.map((e) => e.placementKey);
    assert.deepEqual(claves, ["FOTORANK_CONTEST_WELCOME"]);
  });

  it("DNX ve toda la red montada y nada de otros dueños", () => {
    const espacios = listSellableSpaces({ owner: "PLATFORM" });
    assert.equal(espacios.length, 8);
    assert.ok(espacios.every((e) => e.owner === "PLATFORM"));
    assert.ok(espacios.every((e) => e.mounted));
  });

  it("un workspace no ve nada montado todavía, pero sí lo declarado", () => {
    assert.deepEqual(listSellableSpaces({ owner: "WORKSPACE" }), []);
    const declarados = listSellableSpaces({ owner: "WORKSPACE", includeUnmounted: true });
    assert.equal(declarados.length, 6);
    assert.ok(declarados.every((e) => e.application === "FOTO_OFFICE"));
  });

  it("pedir canje trae los de canje y los de ambas vías", () => {
    const canje = listSellableSpaces({
      owner: "WORKSPACE",
      access: "EXCHANGE",
      includeUnmounted: true,
    })
      .map((e) => e.placementKey)
      .sort();
    assert.deepEqual(canje, [
      "FOTOFFICE_PORTAL_MARQUEE",
      "FOTOFFICE_BENEFIT_CARD",
      "FOTOFFICE_RAFFLE_SPONSOR",
      // Los `BOTH` entran siempre: adentro del workspace un aliado puede
      // acceder dando descuentos en vez de plata.
      "FOTOFFICE_PORTAL_WELCOME",
      "FOTOFFICE_PORTAL_SPONSORS",
    ].sort());
  });

  it("pedir venta trae los de venta y los de ambas vías", () => {
    const venta = listSellableSpaces({
      owner: "WORKSPACE",
      access: "SALE",
      includeUnmounted: true,
    })
      .map((e) => e.placementKey)
      .sort();
    assert.deepEqual(venta, [
      "FOTOFFICE_PUBLIC_MARQUEE",
      "FOTOFFICE_RAFFLE_SPONSOR",
      "FOTOFFICE_PORTAL_WELCOME",
      "FOTOFFICE_PORTAL_SPONSORS",
    ].sort());
  });

  it("filtrar por aplicación no cruza plataformas", () => {
    const espacios = listSellableSpaces({ owner: "PLATFORM", application: "INFO_SPOT" });
    assert.ok(espacios.length > 0);
    assert.ok(espacios.every((e) => e.application === "INFO_SPOT"));
  });
});

describe("el montaje coincide con la fuente de verdad de las placas", () => {
  it("ninguna placa listada como no montada figura como montada en el mapa", async () => {
    const { UNMOUNTED_WELCOME_PLACEMENT_KEYS } = await import("./welcome-admin");
    for (const key of UNMOUNTED_WELCOME_PLACEMENT_KEYS) {
      const espacio = DNX_INVENTORY.find((e) => e.placementKey === key);
      assert.equal(espacio?.mounted, false, `${key} está marcado montado y no lo está`);
    }
  });
});
