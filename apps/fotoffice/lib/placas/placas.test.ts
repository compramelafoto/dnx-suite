import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { emitDesign, type VariableContract } from "@repo/design-studio";
import { CARNET_VARIABLE_CONTRACT } from "@/lib/carnet/template";
import { documentoAEditor, editorADocumento } from "@/lib/carnet/bridge";
import { getAllowedVariableKeysForProduct } from "@repo/template-editor-core";
import {
  PLACA_FORMATS,
  PLACA_FORMAT_PX,
  PLACA_KINDS,
  isPlacaTemplateKey,
  placaTemplateKey,
} from "./constants";
import { placaDesignDocument } from "./designs";
import { prepararImagen } from "./images";
import { pruneEmptyBlocks } from "./prune";
import {
  placaInitials,
  placaInstagram,
  placaPhoto,
  placaSpecialty,
  placaValues,
  placaZone,
  welcomeCaption,
  type PlacaMember,
} from "./values";

const CONTRATO: VariableContract = {
  variables: CARNET_VARIABLE_CONTRACT.variables.map((v) => ({ ...v, required: false })),
};

const SOCIO: PlacaMember = {
  firstName: "María Fernanda",
  lastName: "Gómez",
  memberNumber: "0428",
  joinedAt: new Date("2026-10-01T12:00:00.000Z"),
  avatarUrl: null,
  profilePhotoUrl: null,
  city: "Funes",
  province: "Santa Fe",
  studioCity: "Rosario",
  studioProvince: "Santa Fe",
  specialties: ["CASAMIENTOS", "SOCIAL"],
  instagram: "mariagomez.foto",
};

async function pngDe(color: string, ancho = 400, alto = 300): Promise<Uint8Array> {
  return new Uint8Array(
    await sharp({ create: { width: ancho, height: alto, channels: 3, background: color } })
      .png()
      .toBuffer(),
  );
}

async function dibujar(document: unknown, values: Record<string, unknown>, fotos: Record<string, Uint8Array>) {
  const { document: podado } = pruneEmptyBlocks(document, values);
  return emitDesign({
    document: podado,
    contract: CONTRATO,
    values: values as Record<string, string | number | Date | null>,
    formats: ["PNG_PER_SIDE"],
    pngDpi: 300,
    includeBleed: false,
    resources: { read: async (ref) => fotos[ref] ?? null },
    fileBaseName: "prueba",
  });
}

describe("los diseños base", () => {
  it.each(PLACA_KINDS.flatMap((k) => PLACA_FORMATS.map((f) => [k, f] as const)))(
    "%s %s sale como PNG del tamaño de Instagram, con foto",
    async (kind, format) => {
      const values = placaValues({
        member: { ...SOCIO, profilePhotoUrl: "foto://perfil" },
        institution: { name: "Sociedad de Fotógrafos de Rosario", logoUrl: "foto://logo" },
        extras: { aboutPhrase: "Contar historias de familias.", featuredPhotos: ["foto://d1", "foto://d2"] },
      });
      const fotos = {
        "foto://perfil": await pngDe("#884422"),
        "foto://logo": await pngDe("#ffffff", 200, 200),
        "foto://d1": await pngDe("#224488"),
        "foto://d2": await pngDe("#228844"),
      };
      const salida = await dibujar(placaDesignDocument(kind, format), values, fotos);
      expect(salida.ok, salida.ok ? "" : salida.errors.join(" | ")).toBe(true);
      if (!salida.ok) return;
      expect(salida.files).toHaveLength(1);
      const meta = await sharp(Buffer.from(salida.files[0].bytes)).metadata();
      expect({ w: meta.width, h: meta.height }).toEqual({
        w: PLACA_FORMAT_PX[format].width,
        h: PLACA_FORMAT_PX[format].height,
      });
    },
    30_000,
  );

  it("un socio sin foto, sin logo y sin fotos destacadas recibe su placa igual", async () => {
    const values = placaValues({ member: SOCIO, institution: { name: "SFPR", logoUrl: null } });
    const salida = await dibujar(placaDesignDocument("socio-semana", "cuadrada"), values, {});
    expect(salida.ok, salida.ok ? "" : salida.errors.join(" | ")).toBe(true);
  }, 30_000);

  it("sobrevive al viaje de ida y vuelta por el editor", async () => {
    // Es lo que pasa cuando Comunicación crea la plantilla: se guarda en el modelo del editor y
    // se vuelve a traducir al dibujar. Si el viaje perdiera bloques, la placa saldría vacía.
    const semilla = documentoAEditor(placaDesignDocument("bienvenida", "historia"));
    expect(semilla.canvas).toMatchObject({ width: 1080, height: 1920 });
    const vuelta = editorADocumento({
      canvas: semilla.canvas as never,
      blocks: semilla.blocks.map((b, i) => ({ ...b, id: `b${i}` })) as never,
      nombre: "Bienvenida",
      variablesConocidas: getAllowedVariableKeysForProduct("fotoffice"),
    });
    const values = placaValues({ member: SOCIO, institution: { name: "SFPR", logoUrl: null } });
    const salida = await dibujar(vuelta.document, values, {});
    expect(salida.ok, salida.ok ? "" : salida.errors.join(" | ")).toBe(true);
    if (!salida.ok) return;
    const meta = await sharp(Buffer.from(salida.files[0].bytes)).metadata();
    expect({ w: meta.width, h: meta.height }).toEqual({ w: 1080, h: 1920 });
  }, 30_000);
});

describe("pruneEmptyBlocks", () => {
  const doc = {
    sides: [
      {
        id: "a",
        blocks: [
          { id: "foto", type: "image", variableKey: "profilePhoto" },
          { id: "fondo", type: "image", resourceRef: "https://x/fondo.png" },
          { id: "qr", type: "qrcode", variableKey: "verificationUrl" },
          { id: "nombre", type: "text", content: "{{fullName}}" },
        ],
      },
    ],
  };

  it("saca imágenes y QR sin dato, y deja el resto", () => {
    const { document, removed } = pruneEmptyBlocks(doc, { profilePhoto: null, verificationUrl: "" });
    expect(removed.sort()).toEqual(["foto", "qr"]);
    const ids = (document as typeof doc).sides[0].blocks.map((b) => b.id);
    expect(ids).toEqual(["fondo", "nombre"]);
  });

  it("no toca el documento original", () => {
    pruneEmptyBlocks(doc, {});
    expect(doc.sides[0].blocks).toHaveLength(4);
  });
});

describe("prepararImagen", () => {
  it("convierte una foto WebP, que el módulo de diseño no sabe leer", async () => {
    const webp = await sharp({ create: { width: 64, height: 48, channels: 3, background: "#123456" } })
      .webp()
      .toBuffer();
    const lista = await prepararImagen(`data:image/webp;base64,${webp.toString("base64")}`);
    expect(lista).not.toBeNull();
    const meta = await sharp(Buffer.from(lista as Uint8Array)).metadata();
    expect(meta.format).toBe("jpeg");
  });

  it("achica una foto enorme", async () => {
    const grande = await sharp({ create: { width: 4000, height: 3000, channels: 3, background: "#777" } })
      .jpeg()
      .toBuffer();
    const lista = await prepararImagen(`data:image/jpeg;base64,${grande.toString("base64")}`);
    const meta = await sharp(Buffer.from(lista as Uint8Array)).metadata();
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBe(1600);
  });

  it("conserva la transparencia de un logo", async () => {
    const logo = await sharp({
      create: { width: 50, height: 50, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .png()
      .toBuffer();
    const lista = await prepararImagen(`data:image/png;base64,${logo.toString("base64")}`);
    const meta = await sharp(Buffer.from(lista as Uint8Array)).metadata();
    expect(meta.format).toBe("png");
  });

  it("devuelve null ante algo que no es una imagen o una dirección desconocida", async () => {
    expect(await prepararImagen("data:image/png;base64,bm8gZXMgdW5hIGltYWdlbg==")).toBeNull();
    expect(await prepararImagen("socios/relativa.png")).toBeNull();
  });
});

describe("los datos del socio en la placa", () => {
  it("prefiere la foto del portal a la del carnet", () => {
    expect(placaPhoto({ profilePhotoUrl: "p", avatarUrl: "a" })).toBe("p");
    expect(placaPhoto({ profilePhotoUrl: " ", avatarUrl: "a" })).toBe("a");
    expect(placaPhoto({ profilePhotoUrl: null, avatarUrl: null })).toBeNull();
  });

  it("la zona es la del estudio; si no hay, la personal; y no repite provincia y ciudad", () => {
    expect(placaZone(SOCIO)).toBe("Rosario, Santa Fe");
    expect(placaZone({ ...SOCIO, studioCity: null, studioProvince: null })).toBe("Funes, Santa Fe");
    expect(placaZone({ city: "Santa Fe", province: "Santa Fe", studioCity: null, studioProvince: null })).toBe(
      "Santa Fe",
    );
    expect(placaZone({ city: null, province: null, studioCity: null, studioProvince: null })).toBeNull();
  });

  it("escribe las especialidades con su nombre, hasta tres", () => {
    expect(placaSpecialty(["CASAMIENTOS"])).toBe("Casamientos");
    expect(placaSpecialty([])).toBeNull();
    expect(placaSpecialty(["CASAMIENTOS", "SOCIAL", "CASAMIENTOS", "SOCIAL"])?.split(" · ")).toHaveLength(3);
  });

  it("iniciales con tildes y en mayúscula", () => {
    expect(placaInitials("ángel", "zárate")).toBe("ÁZ");
    expect(placaInitials("", "")).toBe("·");
  });

  it("Instagram con una sola arroba", () => {
    expect(placaInstagram("@@juan")).toBe("@juan");
    expect(placaInstagram("")).toBeNull();
  });

  it("el número de socio va como número, que es como lo declara el contrato", () => {
    expect(placaValues({ member: SOCIO, institution: { name: "X", logoUrl: null } }).memberNumber).toBe(428);
  });
});

describe("el texto sugerido de bienvenida", () => {
  it("nombra al socio, lo etiqueta y cuenta a qué se dedica", () => {
    const texto = welcomeCaption({ member: SOCIO, institutionName: "SFPR" });
    expect(texto).toContain("María Fernanda Gómez (@mariagomez.foto)");
    expect(texto).toContain("a SFPR");
    expect(texto).toContain("Se dedica a casamientos · social y eventos y trabaja en Rosario, Santa Fe.");
  });

  it("sin Instagram ni datos, igual se puede publicar", () => {
    const texto = welcomeCaption({
      member: { firstName: "Ana", lastName: "Paz", instagram: null, specialties: [] },
      institutionName: "SFPR",
    });
    expect(texto).toContain("¡Le damos la bienvenida a Ana Paz a SFPR!");
    expect(texto).not.toContain("Se dedica");
  });
});

describe("las marcas de las plantillas", () => {
  it("cada combinación tiene su marca, y todas se reconocen como placa", () => {
    const marcas = PLACA_KINDS.flatMap((k) => PLACA_FORMATS.map((f) => placaTemplateKey(k, f)));
    expect(new Set(marcas).size).toBe(4);
    expect(marcas.every(isPlacaTemplateKey)).toBe(true);
    expect(isPlacaTemplateKey("carnet-socio-v1")).toBe(false);
  });
});
