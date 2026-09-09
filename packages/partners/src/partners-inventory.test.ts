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
      assert.ok(
        ["GLOBAL", "EVENT", "CONTEST", "ALBUM", "ORGANIZATION"].includes(espacio.contextType),
        `${espacio.placementKey} no declara alcance`,
      );
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

describe("alcance de cada espacio", () => {
  it("lo de portada es global y lo de contexto no", () => {
    const buscar = (k: string) => DNX_INVENTORY.find((e) => e.placementKey === k);
    assert.equal(buscar("INFOSPOT_HOME_WELCOME")?.contextType, "GLOBAL");
    assert.equal(buscar("FOTORANK_CONTEST_WELCOME")?.contextType, "CONTEST");
    assert.equal(buscar("CLICKATON_EVENT_WELCOME")?.contextType, "EVENT");
    assert.equal(buscar("CLF_ALBUM_WELCOME")?.contextType, "ALBUM");
  });

  it("los de FotoOffice son de la institución", () => {
    const fo = DNX_INVENTORY.filter((e) => e.application === "FOTO_OFFICE");
    assert.equal(fo.length, 6);
    assert.ok(fo.every((e) => e.contextType === "ORGANIZATION"));
  });
});

describe("vender inventario ajeno", () => {
  it("sin habilitación, un organizador ve solo lo suyo", () => {
    const espacios = listSellableSpaces({ owner: "ORGANIZER" });
    assert.ok(espacios.every((e) => e.owner === "ORGANIZER"));
  });

  it("habilitado, suma los espacios globales de plataforma", () => {
    const espacios = listSellableSpaces({ owner: "ORGANIZER", canSellPlatform: true });
    const duenos = new Set(espacios.map((e) => e.owner));
    assert.deepEqual([...duenos].sort(), ["ORGANIZER", "PLATFORM"]);
  });

  it("la habilitación no le abre el inventario de otros vendedores", () => {
    const espacios = listSellableSpaces({ owner: "ORGANIZER", canSellPlatform: true });
    assert.ok(espacios.every((e) => e.owner !== "WORKSPACE"));
  });

  it("un workspace habilitado también llega a la red", () => {
    const espacios = listSellableSpaces({
      owner: "WORKSPACE",
      canSellPlatform: true,
      includeUnmounted: true,
    });
    assert.ok(espacios.some((e) => e.owner === "PLATFORM"));
    assert.ok(espacios.some((e) => e.owner === "WORKSPACE"));
  });

  it("a DNX la habilitación no le cambia nada: la red ya es suya", () => {
    const sin = listSellableSpaces({ owner: "PLATFORM" }).map((e) => e.placementKey);
    const con = listSellableSpaces({ owner: "PLATFORM", canSellPlatform: true }).map(
      (e) => e.placementKey,
    );
    assert.deepEqual(con, sin);
  });

  it("filtrar por aplicación sigue mandando sobre la habilitación", () => {
    const espacios = listSellableSpaces({
      owner: "ORGANIZER",
      canSellPlatform: true,
      application: "INFO_SPOT",
    });
    assert.ok(espacios.every((e) => e.application === "INFO_SPOT"));
  });
});
