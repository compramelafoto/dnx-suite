import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";

const TOKEN = "abcDEF1234567890_-xyz";

function cookiesFrom(url: string): string[] {
  const res = middleware(new NextRequest(new Request(url)));
  return res.headers.getSetCookie?.() ?? [];
}

describe("middleware: cookie del Vendedor clf_dnxv", () => {
  it("?dnxv= guarda clf_dnxv por 60 días", () => {
    const c = cookiesFrom(`https://www.compramelafoto.com/land?dnxv=${TOKEN}`);
    const found = c.find((x) => x.startsWith("clf_dnxv="));
    assert.ok(found, "falta clf_dnxv");
    assert.ok(found.startsWith(`clf_dnxv=${TOKEN};`));
    assert.ok(found.includes("Max-Age=5184000"));
    assert.ok(found.includes("Path=/"));
    assert.ok(found.includes("SameSite=Lax"));
  });

  it("?dnxv= no toca clf_ref ni clf_ref_meta", () => {
    const c = cookiesFrom(`https://www.compramelafoto.com/?dnxv=${TOKEN}`);
    assert.equal(c.filter((x) => x.startsWith("clf_ref")).length, 0);
  });

  it("?ref= sigue igual con dnxv al lado", () => {
    const c = cookiesFrom(`https://www.compramelafoto.com/?ref=SQZW2CCT&dnxv=${TOKEN}`);
    assert.ok(c.some((x) => x.startsWith("clf_ref=SQZW2CCT;")));
    assert.ok(c.some((x) => x.startsWith(`clf_dnxv=${TOKEN};`)));
  });

  it("un dnxv inválido no guarda nada", () => {
    const c = cookiesFrom("https://www.compramelafoto.com/?dnxv=%3Cscript%3E");
    assert.equal(c.filter((x) => x.startsWith("clf_dnxv")).length, 0);
    const c2 = cookiesFrom("https://www.compramelafoto.com/?dnxv=corto");
    assert.equal(c2.filter((x) => x.startsWith("clf_dnxv")).length, 0);
  });
});
