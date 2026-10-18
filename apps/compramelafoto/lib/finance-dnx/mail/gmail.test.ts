import assert from "node:assert/strict";
import test from "node:test";

import { BODY_MAX_CHARS, GmailError, getMessage, htmlToText, listMessageIds } from "./gmail";

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64url");

function capture(status: number, body: object) {
  const calls: string[] = [];
  const impl = (async (url: string | URL, init?: RequestInit) => {
    calls.push(String(url));
    assert.equal((init?.headers as Record<string, string>).authorization, "Bearer tok");
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { calls, impl };
}

test("listar manda la búsqueda y devuelve ids y página siguiente", async () => {
  const f = capture(200, { messages: [{ id: "a" }, { id: "b" }], nextPageToken: "p2" });
  const r = await listMessageIds({ accessToken: "tok", query: "from:(payment@aws.com)", fetchImpl: f.impl });
  assert.deepEqual(r, { ids: ["a", "b"], nextPageToken: "p2" });
  const url = new URL(f.calls[0]);
  assert.equal(url.searchParams.get("q"), "from:(payment@aws.com)");
  assert.equal(url.searchParams.get("maxResults"), "100");
});

test("sin resultados devuelve lista vacía", async () => {
  const f = capture(200, { resultSizeEstimate: 0 });
  assert.deepEqual(await listMessageIds({ accessToken: "tok", query: "q", fetchImpl: f.impl }), { ids: [], nextPageToken: null });
});

test("prefiere la parte de texto plano y lee encabezados", async () => {
  const f = capture(200, {
    id: "m1",
    internalDate: String(Date.UTC(2026, 9, 17, 23, 22)),
    payload: {
      headers: [
        { name: "From", value: "payment@aws.com" },
        { name: "Subject", value: "Gracias por el pago" },
      ],
      mimeType: "multipart/alternative",
      parts: [
        { mimeType: "text/html", body: { data: b64("<p>HTML</p>") } },
        { mimeType: "text/plain", body: { data: b64("Hemos cobrado 106.72 USD") } },
      ],
    },
  });
  const m = await getMessage({ accessToken: "tok", id: "m1", fetchImpl: f.impl });
  assert.equal(m.from, "payment@aws.com");
  assert.equal(m.subject, "Gracias por el pago");
  assert.equal(m.bodyText, "Hemos cobrado 106.72 USD");
  assert.equal(m.receivedAt.toISOString(), "2026-10-17T23:22:00.000Z");
});

test("si sólo hay HTML (anidado), lo pasa a texto", async () => {
  const f = capture(200, {
    id: "m2",
    internalDate: "0",
    payload: {
      headers: [],
      mimeType: "multipart/mixed",
      parts: [
        {
          mimeType: "multipart/alternative",
          parts: [{ mimeType: "text/html", body: { data: b64("<div>Total:&nbsp;<b>$20.00</b></div><style>x{}</style>") } }],
        },
        { mimeType: "application/pdf", filename: "Receipt.pdf", body: { attachmentId: "att" } },
      ],
    },
  });
  const m = await getMessage({ accessToken: "tok", id: "m2", fetchImpl: f.impl });
  assert.equal(m.bodyText, "Total: $20.00");
  assert.equal(m.subject, "");
});

test("htmlToText saca scripts, estilos y entidades, y respeta saltos de bloque", () => {
  assert.equal(
    htmlToText("<script>alert(1)</script><p>Hola&amp;chau</p><p>Línea&#58; 2</p>"),
    "Hola&chau\nLínea: 2",
  );
});

test("un cuerpo enorme se recorta", async () => {
  const f = capture(200, {
    id: "m3", internalDate: "0",
    payload: { headers: [], mimeType: "text/plain", body: { data: b64("x".repeat(BODY_MAX_CHARS + 50)) } },
  });
  const m = await getMessage({ accessToken: "tok", id: "m3", fetchImpl: f.impl });
  assert.equal(m.bodyText.length, BODY_MAX_CHARS);
});

test("un error de Gmail tira GmailError con el código", async () => {
  const f = capture(401, { error: { message: "Invalid Credentials" } });
  await assert.rejects(
    listMessageIds({ accessToken: "tok", query: "q", fetchImpl: f.impl }),
    (e: unknown) => e instanceof GmailError && e.status === 401,
  );
});
