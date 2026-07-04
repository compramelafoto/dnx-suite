export type TextureAsset = {
  id: string;
  name: string;
  filename: string;
};

const FILES = [
  "Corazones 1.png",
  "Corazones 2.png",
  "Corazones 3.png",
  "Corazones 4.png",
  "Corazones 6.png",
  "Flores.png",
  "Fun.png",
  "Girasoles 2.png",
  "Girasoles.png",
  "Globos.png",
  "Kids 1.png",
  "Kids 2.png",
  "Kids 3.png",
  "Kids 4.png",
  "Kids 5.png",
  "Moños.png",
  "Navidad 1.png",
  "Navidad 2.png",
  "Navidad 3.png",
  "Ositos.png",
  "Otoño 1.png",
  "Otoño 2.png",
  "Puzzle.png",
  "Rùstico 1.png",
  "Via Láctea 1.png",
  "Vìa Lactea 2.png",
];

export const TEXTURES: TextureAsset[] = [
  { id: "none", name: "Sin textura", filename: "" },
  ...FILES.map((file) => ({
    id: file
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9\-]/g, ""),
    name: file.replace(".png", ""),
    filename: file,
  })),
];

export function getTextureById(id: string) {
  return TEXTURES.find((texture) => texture.id === id) ?? TEXTURES[0];
}

export function getTextureUrl(texture: TextureAsset) {
  if (!texture.filename) return "";
  const normalized = texture.filename.normalize("NFC");
  return `/texturas/${encodeURIComponent(normalized)}?v=${encodeURIComponent(texture.id)}`;
}
