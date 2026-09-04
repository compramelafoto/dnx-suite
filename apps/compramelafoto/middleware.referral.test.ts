import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";

function refCookieFrom(url: string): string | null {
  const res = middleware(new NextRequest(new Request(url)));
  const cookies = res.headers.getSetCookie?.() ?? [];
  const found = cookies.find((c) => c.startsWith("clf_ref="));
  if (!found) return null;
  const value = found.split(";")[0]?.split("=")[1] ?? "";
  return decodeURIComponent(value) || null;
}

describe("middleware: cookie de referido clf_ref", () => {
  it("setea clf_ref en la home (link por defecto del panel de referidos)", () => {
    assert.equal(refCookieFrom("https://www.compramelafoto.com/?ref=SQZW2CCT"), "SQZW2CCT");
  });

  it("setea clf_ref en la home aunque venga con otros parámetros", () => {
    assert.equal(
      refCookieFrom("https://www.compramelafoto.com/?ref=SQZW2CCT&utm_source=wa"),
      "SQZW2CCT"
    );
  });

  it("sigue seteando clf_ref en las landings", () => {
    assert.equal(refCookieFrom("https://www.compramelafoto.com/land?ref=ABC12345"), "ABC12345");
  });

  it("no setea clf_ref si no hay ref", () => {
    assert.equal(refCookieFrom("https://www.compramelafoto.com/"), null);
  });
});
