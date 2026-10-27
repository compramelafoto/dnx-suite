import { describe, expect, it } from "vitest";
import { isFotofficeOwnedR2Key } from "@/lib/images/r2-key-policy";
import {
  MAX_BYTES_DOCUMENTO,
  esKeyDeDocumento,
  esPdfPorFirma,
  nombreDeArchivoDocumento,
  prefijoDocumentos,
  rutaPublicaDocumento,
  slugDeDocumento,
  validarPesoDocumento,
  validarSlugDocumento,
  validarTituloDocumento,
} from "./documentos";
import { decideCustomDomainRoute } from "./domain/routing";
import { RESERVED_SITE_SEGMENTS } from "./reserved-slugs";

const bytes = (s: string) => new TextEncoder().encode(s);
const UUID = "0f8fad5b-d9cb-469f-a165-70867728950e";

describe("validar PDF por los primeros bytes", () => {
  it("acepta lo que empieza con %PDF-", () => {
    expect(esPdfPorFirma(bytes("%PDF-1.7\n%âãÏÓ"))).toBe(true);
  });
  it("rechaza otra cosa aunque se llame .pdf", () => {
    expect(esPdfPorFirma(bytes("<html>"))).toBe(false);
    expect(esPdfPorFirma(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00]))).toBe(false);
    expect(esPdfPorFirma(bytes("%PD"))).toBe(false);
    expect(esPdfPorFirma(bytes(" %PDF-1.4"))).toBe(false);
  });
});

describe("dirección (slug) del documento", () => {
  it("acepta minúsculas, números y guiones", () => {
    expect(validarSlugDocumento("propuesta-casamiento-2027")).toBeNull();
  });
  it("rechaza vacía, mayúsculas, espacios, barras, guiones al borde y largos", () => {
    for (const s of ["", "Propuesta", "con espacio", "a/b", "-a", "a-", "a--b", "a.pdf", "x".repeat(81)]) {
      expect(validarSlugDocumento(s)).not.toBeNull();
    }
  });
  it("sale del título sin tildes ni signos", () => {
    expect(slugDeDocumento("Propuesta de Casamiento ¡2027!")).toBe("propuesta-de-casamiento-2027");
    expect(slugDeDocumento("¿?")).toBe("documento");
    expect(validarSlugDocumento(slugDeDocumento("Á".repeat(200)))).toBeNull();
  });
  it("el enlace público y el nombre del archivo", () => {
    expect(rutaPublicaDocumento("dnx", "lista")).toBe("/w/dnx/d/lista");
    expect(nombreDeArchivoDocumento("Lista de precios", "lista")).toBe("lista-de-precios.pdf");
  });
});

describe("título y peso", () => {
  it("título obligatorio y con tope", () => {
    expect(validarTituloDocumento("  ")).not.toBeNull();
    expect(validarTituloDocumento("x".repeat(161))).not.toBeNull();
    expect(validarTituloDocumento("Lista")).toBeNull();
  });
  it("hasta 25 MB", () => {
    expect(MAX_BYTES_DOCUMENTO).toBe(25 * 1024 * 1024);
    expect(validarPesoDocumento(0)).not.toBeNull();
    expect(validarPesoDocumento(Number.NaN)).not.toBeNull();
    expect(validarPesoDocumento(MAX_BYTES_DOCUMENTO + 1)).not.toBeNull();
    expect(validarPesoDocumento(MAX_BYTES_DOCUMENTO)).toBeNull();
  });
});

describe("keys de R2", () => {
  it("el prefijo es de la institución y está dentro de lo que FOTOFFICE puede borrar", () => {
    expect(prefijoDocumentos("ws1")).toBe("fotoffice/website-documents/ws1/");
    expect(isFotofficeOwnedR2Key(`${prefijoDocumentos("ws1")}${UUID}.pdf`)).toBe(true);
  });
  it("sólo acepta las keys firmadas para ESE workspace", () => {
    expect(esKeyDeDocumento(`fotoffice/website-documents/ws1/${UUID}.pdf`, "ws1")).toBe(true);
    expect(esKeyDeDocumento(`fotoffice/website-documents/ws2/${UUID}.pdf`, "ws1")).toBe(false);
    expect(esKeyDeDocumento(`fotoffice/website-documents/ws1/../ws2/${UUID}.pdf`, "ws1")).toBe(false);
    expect(esKeyDeDocumento(`fotoffice/website-documents/ws1/${UUID}.exe`, "ws1")).toBe(false);
    expect(esKeyDeDocumento(`fotoffice/governance/ws1/${UUID}.pdf`, "ws1")).toBe(false);
    expect(esKeyDeDocumento(123, "ws1")).toBe(false);
  });
});

describe("ruteo del enlace", () => {
  it("`d` es una dirección reservada: ninguna página propia la puede usar", () => {
    expect(RESERVED_SITE_SEGMENTS).toContain("d");
  });
  it("en el dominio propio, /d/<doc> se sirve desde /w/<slug>/d/<doc>", () => {
    expect(decideCustomDomainRoute({ pathname: "/d/lista", search: "", slug: "dnx", fotofficeOrigin: "https://fotoffice.com" })).toEqual({
      kind: "rewrite",
      pathname: "/w/dnx/d/lista",
    });
  });
});
