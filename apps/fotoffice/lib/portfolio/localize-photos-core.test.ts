import { describe, expect, it } from "vitest";
import {
  MARCA_EXTERNA,
  direccionDeOrigen,
  esFotoExterna,
  nombreDeArchivo,
  pendientesRestantes,
} from "./localize-photos-core";

describe("esFotoExterna", () => {
  it("reconoce la marca que dejó la migración", () => {
    expect(esFotoExterna(`${MARCA_EXTERNA}https://storage.alboom.ninja/a/b.jpg`)).toBe(true);
  });

  it("una foto ya alojada en nuestro bucket no es externa", () => {
    expect(esFotoExterna("fotoffice/member-portfolio/ws_sfpr_seed/abc.jpg")).toBe(false);
  });

  it("no confunde una key que apenas contenga la palabra", () => {
    expect(esFotoExterna("fotoffice/member-portfolio/externo-del-club.jpg")).toBe(false);
  });
});

describe("direccionDeOrigen", () => {
  it("devuelve la dirección que está detrás de la marca", () => {
    expect(direccionDeOrigen(`${MARCA_EXTERNA}https://storage.alboom.ninja/a/010.jpg`)).toBe(
      "https://storage.alboom.ninja/a/010.jpg",
    );
  });

  it("una key que no es externa no tiene origen", () => {
    expect(direccionDeOrigen("fotoffice/member-portfolio/ws/abc.jpg")).toBeNull();
  });

  it("la marca sola, sin dirección, tampoco", () => {
    expect(direccionDeOrigen(MARCA_EXTERNA)).toBeNull();
    expect(direccionDeOrigen(`${MARCA_EXTERNA}   `)).toBeNull();
  });
});

describe("nombreDeArchivo", () => {
  it("se queda con el último tramo de la dirección", () => {
    expect(nombreDeArchivo("https://storage.alboom.ninja/sites/47869/albuns/1/010.jpg")).toBe(
      "010.jpg",
    );
  });

  it("descifra los nombres con acentos", () => {
    expect(nombreDeArchivo("https://x.com/a/boda-mar%C3%ADa.jpg")).toBe("boda-mar-a.jpg");
  });

  it("ignora la consulta y el ancla", () => {
    expect(nombreDeArchivo("https://x.com/a/preboda-181.jpg?v=3#foo")).toBe("preboda-181.jpg");
  });

  it("sin extensión usable inventa una, para no dejar la copia sin extensión", () => {
    expect(nombreDeArchivo("https://x.com/a/sin-punto")).toBe("foto.jpg");
    expect(nombreDeArchivo("https://x.com/")).toBe("foto.jpg");
  });

  it("una dirección rota no revienta", () => {
    expect(nombreDeArchivo("no-es-una-url/a/b.png")).toBe("b.png");
  });

  it("recorta nombres larguísimos", () => {
    expect(nombreDeArchivo(`https://x.com/${"a".repeat(300)}.jpg`).length).toBeLessThanOrEqual(80);
  });
});

describe("pendientesRestantes", () => {
  it("descuenta las traídas", () => {
    expect(pendientesRestantes(116, 8, 0)).toBe(108);
  });

  it("descuenta también las fallidas, para que el botón pueda terminar", () => {
    // Si las fallidas contaran como pendientes, quien repite tandas giraría sobre las mismas.
    expect(pendientesRestantes(3, 0, 3)).toBe(0);
  });

  it("nunca devuelve un número negativo", () => {
    expect(pendientesRestantes(2, 5, 1)).toBe(0);
  });

  it("sin nada por hacer, cero", () => {
    expect(pendientesRestantes(0, 0, 0)).toBe(0);
  });
});
