import { describe, expect, it } from "vitest";
import { visibilityFromPreset } from "@repo/muestras";
import { artistasDeMuestra } from "./artistas";

const foto = (perfil: string, n: number) => ({
  id: `${perfil}-f${n}`, imageUrl: `https://pub-test.r2.dev/muestras/u/${perfil}-portfolio-${n}.webp`, title: `Foto ${n}`,
  year: 2020, technique: null, caption: null, sortOrder: n,
});
const perfil = (id: string, nombre: string, fotos: number) => ({
  id, slug: id, displayName: nombre, bio: `Bio de ${nombre}`, city: "Rosario", province: "Santa Fe", avatarUrl: null,
  portfolio: Array.from({ length: fotos }, (_, i) => foto(id, fotos - i)),
  _count: { portfolio: fotos },
});
const ana = perfil("ana", "Ana", 10);
const beto = perfil("beto", "Beto", 2);
const obra = (id: string, sortOrder: number, authorName: string, p: ReturnType<typeof perfil> | null) => ({
  id, sortOrder, authorName, authorProfileId: p?.id ?? null, authorProfile: p,
  imageUrl: `https://pub-test.r2.dev/muestras/a1/oculta-${id}.webp`,
});
const muestra = {
  works: [
    obra("w3", 3, "Ana", ana),
    obra("w1", 1, "Beto", beto),
    obra("w2", 2, "Carla Sin Perfil", null),
    obra("w4", 4, "carla sin perfil", null),
    obra("w5", 5, "Beto", beto),
  ],
};

describe("artistasDeMuestra", () => {
  const v = visibilityFromPreset("SURPRISE", "s");

  it("uno por autor, en el orden de su primera obra, con hasta 8 fotos del portfolio en su orden", () => {
    const r = artistasDeMuestra(muestra, v);
    expect(r.map((x) => x.nombre)).toEqual(["Beto", "Carla Sin Perfil", "Ana"]);
    expect(r[0]!.perfil).toEqual({ slug: "beto", bio: "Bio de Beto", ciudad: "Rosario, Santa Fe", avatarUrl: null });
    expect(r[1]!.perfil).toBeNull();
    expect(r[1]!.portfolio).toEqual([]);
    expect(r[2]!.portfolio).toHaveLength(8);
    expect(r[2]!.portfolio.map((f) => f.title)).toEqual(["Foto 1", "Foto 2", "Foto 3", "Foto 4", "Foto 5", "Foto 6", "Foto 7", "Foto 8"]);
    expect(r[2]!.totalPortfolio).toBe(10);
    expect(Object.keys(r[2]!.portfolio[0]!).sort()).toEqual(["caption", "id", "imageUrl", "technique", "title", "year"]);
  });

  it("sin artistas en la publicación online → nada", () => {
    expect(artistasDeMuestra(muestra, { ...v, online: { ...v.online, artists: false } })).toEqual([]);
  });

  it("nunca lleva la imagen de una obra expuesta", () => {
    const json = JSON.stringify(artistasDeMuestra(muestra, v));
    expect(json).not.toContain("oculta-");
    expect(json).toContain("ana-portfolio-1.webp");
  });
});
