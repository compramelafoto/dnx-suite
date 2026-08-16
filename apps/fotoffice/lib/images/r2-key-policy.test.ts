import { describe, expect, it } from "vitest";
import {
  assertFotofficeDeletableR2Key,
  assertSafeFotofficeR2Key,
  isFotofficeOwnedR2Key,
} from "./r2-key-policy";

describe("r2-key-policy — namespace de FotoOffice dentro del bucket compartido del monorepo", () => {
  it("una key propia de FotoOffice es borrable", () => {
    const key = "fotoffice/workspace-logos/ws_123/abc.png";
    expect(isFotofficeOwnedR2Key(key)).toBe(true);
    expect(() => assertFotofficeDeletableR2Key(key)).not.toThrow();
  });

  it("una key de otra app (InfoSpot) NO es borrable por FotoOffice", () => {
    const key = "infospot/avatars/1/abc.png";
    expect(isFotofficeOwnedR2Key(key)).toBe(false);
    expect(() => assertFotofficeDeletableR2Key(key)).toThrow(/namespace/);
  });

  it("una key del namespace comercial CLF NO es borrable por FotoOffice", () => {
    expect(isFotofficeOwnedR2Key("albums/evento-x/foto1.jpg")).toBe(false);
  });

  it("path traversal (..) es rechazado", () => {
    expect(() => assertSafeFotofficeR2Key("fotoffice/workspace-logos/../../secrets.env")).toThrow();
  });

  it("una URL completa no es una key válida (evita confundir key con URL externa)", () => {
    expect(() => assertSafeFotofficeR2Key("https://evil.example/x.png")).toThrow();
  });

  it("key vacía es rechazada", () => {
    expect(() => assertSafeFotofficeR2Key("")).toThrow();
    expect(() => assertSafeFotofficeR2Key("   ")).toThrow();
  });
});
