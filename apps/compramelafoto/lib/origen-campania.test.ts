// pnpm --filter compramelafoto test:origen-campania
import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { middleware } from "../middleware";
import { guardarOrigenEnUsuario, leerOrigen, origenDesdeParams, origenValido } from "./origen-campania";

const p = (q: string) => new URLSearchParams(q);
const req = (cookie: string) => ({ headers: { get: (n: string) => (n === "cookie" ? cookie : null) } });

function cookieOrigen(url: string): string | null {
  const res = middleware(new NextRequest(new Request(url)));
  const found = (res.headers.getSetCookie?.() ?? []).find((c) => c.startsWith("clf_origen="));
  return found ? decodeURIComponent(found.split(";")[0]!.split("=")[1]!) : null;
}

test("el enlace de un anuncio arma fuente/medio/campaña/anuncio", () => {
  assert.equal(
    origenDesdeParams(p("utm_source=meta&utm_medium=paid&utm_campaign=captacion-fotografos&utm_content=C-eventos")),
    "meta/paid/captacion-fotografos/c-eventos"
  );
});

test("una visita sin campaña no pisa el origen", () => {
  assert.equal(origenDesdeParams(p("ref=abc")), null);
  assert.equal(origenDesdeParams(p("")), null);
});

test("solo con fbclid (anuncio sin UTM) queda como meta pago", () => {
  assert.equal(origenDesdeParams(p("fbclid=IwAR123")), "meta/paid/-/-");
});

test("limpia acentos, espacios y caracteres raros", () => {
  assert.equal(origenDesdeParams(p("utm_source=Instagram&utm_campaign=Campaña de Turismo!&utm_content=<script>")), "instagram/-/campana-de-turismo/script");
});

test("una cookie manipulada se descarta", () => {
  assert.equal(origenValido("meta/paid/x/y"), "meta/paid/x/y");
  assert.equal(origenValido("meta/paid/x"), null);
  assert.equal(origenValido("<script>/a/b/c"), null);
  assert.equal(leerOrigen(req("otra=1; clf_origen=meta%2Fpaid%2Fcaptacion-turismo%2Ft-qr")), "meta/paid/captacion-turismo/t-qr");
  assert.equal(leerOrigen(req("clf_origen=cualquier-cosa")), null);
});

test("el middleware guarda la cookie con el enlace del anuncio y no en una visita común", () => {
  assert.equal(
    cookieOrigen("https://www.compramelafoto.com/land?utm_source=meta&utm_medium=paid&utm_campaign=captacion-fotografos&utm_content=A-escolar"),
    "meta/paid/captacion-fotografos/a-escolar"
  );
  assert.equal(cookieOrigen("https://www.compramelafoto.com/land"), null);
});

test("al registrarse se guarda el tag origen:… y nunca lanza", async () => {
  let guardado: [number, string] | null = null;
  const tag = await guardarOrigenEnUsuario(
    { req: req("clf_origen=meta%2Fpaid%2Fcaptacion-fotografos%2Fc-eventos"), userId: 7 },
    { guardar: async (id, t) => { guardado = [id, t]; } }
  );
  assert.equal(tag, "origen:meta/paid/captacion-fotografos/c-eventos");
  assert.deepEqual(guardado, [7, "origen:meta/paid/captacion-fotografos/c-eventos"]);

  const sinCookie = await guardarOrigenEnUsuario({ req: req(""), userId: 7 }, { guardar: async () => { throw new Error("no debería llamarse"); } });
  assert.equal(sinCookie, null);

  const conError = await guardarOrigenEnUsuario(
    { req: req("clf_origen=meta%2Fpaid%2Fx%2Fy"), userId: 7 },
    { guardar: async () => { throw new Error("base caída"); } }
  );
  assert.equal(conError, null);
});
