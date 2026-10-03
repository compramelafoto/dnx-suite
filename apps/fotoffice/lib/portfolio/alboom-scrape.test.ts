import { describe, expect, it } from "vitest";
import { albumIdDesdeSlug, fotosAjenas, fotosDeAlbum } from "./alboom-scrape";

const F = (album: string, archivo: string) =>
  `https://storage.alboom.ninja/sites/47869/albuns/${album}/${archivo}`;

describe("albumIdDesdeSlug", () => {
  it("lee el número que encabeza el slug", () => {
    expect(albumIdDesdeSlug("1583301-melisa-valeria-chiappero-fotografa-de-xv")).toBe("1583301");
    expect(albumIdDesdeSlug("1572863-sin-titulo")).toBe("1572863");
  });

  it("acepta un slug que sea sólo el número", () => {
    expect(albumIdDesdeSlug("1572664")).toBe("1572664");
  });

  it("sin número devuelve null, para que la migración no adivine", () => {
    expect(albumIdDesdeSlug("claudia-begala")).toBeNull();
    expect(albumIdDesdeSlug("")).toBeNull();
  });

  it("no toma un número que no esté al principio", () => {
    expect(albumIdDesdeSlug("foto-1583301")).toBeNull();
  });
});

describe("fotosDeAlbum", () => {
  it("devuelve sólo las del álbum pedido", () => {
    // Esto es la forma de las fichas viejas: la galería del socio y, al pie, la tira de
    // "otros asociados" con miniaturas de otros fotógrafos.
    const html = `
      <div class="galeria">
        <img src="${F("1572664", "001.jpg")}">
        <img src="${F("1572664", "002.jpg")}">
      </div>
      <div class="otros-asociados">
        <img src="${F("1575699", "dsc_2853-editar.jpg")}">
        <img src="${F("1573093", "savoy-52.jpg")}">
      </div>`;

    expect(fotosDeAlbum(html, "1572664")).toEqual([
      F("1572664", "001.jpg"),
      F("1572664", "002.jpg"),
    ]);
  });

  it("es el error que mezcló los portfolios: las ajenas NO entran", () => {
    const html = `<img src="${F("1572666", "09.jpg")}"><img src="${F("1570584", "09.jpg")}">`;
    const fotos = fotosDeAlbum(html, "1572666");
    expect(fotos).toHaveLength(1);
    expect(fotos[0]).toContain("/albuns/1572666/");
  });

  it("conserva el orden de la página", () => {
    const html = `<img src="${F("1", "c.jpg")}"><img src="${F("1", "a.jpg")}"><img src="${F("1", "b.jpg")}">`;
    expect(fotosDeAlbum(html, "1")).toEqual([F("1", "c.jpg"), F("1", "a.jpg"), F("1", "b.jpg")]);
  });

  it("no repite una foto que aparece dos veces (miniatura y grande)", () => {
    const html = `<a href="${F("1", "a.jpg")}"><img src="${F("1", "a.jpg")}"></a>`;
    expect(fotosDeAlbum(html, "1")).toEqual([F("1", "a.jpg")]);
  });

  it("ignora las direcciones de otro sitio de Alboom", () => {
    const html = `<img src="https://storage.alboom.ninja/sites/99999/albuns/1/a.jpg">`;
    expect(fotosDeAlbum(html, "1")).toEqual([]);
  });

  it("corta la dirección antes de la consulta", () => {
    const html = `<img src="${F("1", "a.jpg")}?w=300">`;
    expect(fotosDeAlbum(html, "1")).toEqual([F("1", "a.jpg")]);
  });

  it("una ficha sin fotos devuelve lista vacía", () => {
    expect(fotosDeAlbum("<p>nada</p>", "1")).toEqual([]);
  });
});

describe("fotosAjenas", () => {
  it("cuenta las de otros álbumes, sin repetir", () => {
    const html = `
      <img src="${F("1", "a.jpg")}">
      <img src="${F("2", "x.jpg")}">
      <img src="${F("2", "x.jpg")}">
      <img src="${F("3", "y.jpg")}">`;
    expect(fotosAjenas(html, "1")).toBe(2);
  });

  it("sin ajenas, cero", () => {
    expect(fotosAjenas(`<img src="${F("1", "a.jpg")}">`, "1")).toBe(0);
  });
});
