import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createContactsClient,
  isContactsPermissionError,
  isExpiredSyncToken,
} from "./client";

/** Deja a `fetch` contestando lo que pida el test, sin salir a la red. */
function responder(status: number, body: unknown = {}) {
  const fake = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
  vi.stubGlobal("fetch", fake);
  return fake;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("el grupo del módulo", () => {
  it("reusa el grupo si ya existe, en vez de crear uno nuevo cada vez", async () => {
    const fake = responder(200, {
      contactGroups: [
        { resourceName: "contactGroups/otro", name: "Amigos" },
        { resourceName: "contactGroups/socios", name: "FOTOFFICE · Socios" },
      ],
    });
    const client = createContactsClient("token");
    await expect(client.ensureGroup("FOTOFFICE · Socios")).resolves.toBe("contactGroups/socios");
    // Una sola llamada: la de listar. No se creó nada.
    expect(fake).toHaveBeenCalledTimes(1);
  });

  it("lo crea la primera vez", async () => {
    const fake = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ contactGroups: [] }) })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ resourceName: "contactGroups/nuevo" }),
      });
    vi.stubGlobal("fetch", fake);
    const client = createContactsClient("token");
    await expect(client.ensureGroup("FOTOFFICE · Socios")).resolves.toBe("contactGroups/nuevo");
  });
});

describe("los errores de Google", () => {
  it("un 403 es falta de permiso: hay que reconectar, no reintentar", async () => {
    responder(403);
    const client = createContactsClient("token");
    const error = await client.ensureGroup("FOTOFFICE · Socios").catch((e: unknown) => e);
    expect(isContactsPermissionError(error)).toBe(true);
  });

  it("un 429 POR TOKEN VENCIDO manda a recargar todo", async () => {
    // La People API contesta 429 con reason EXPIRED_SYNC_TOKEN. No es un 410 como Calendar.
    responder(429, {
      error: { details: [{ reason: "EXPIRED_SYNC_TOKEN" }] },
    });
    const client = createContactsClient("token");
    const error = await client
      .listChanges({ syncToken: "viejo", pageToken: null })
      .catch((e: unknown) => e);
    expect(isExpiredSyncToken(error)).toBe(true);
  });

  it("un 429 POR CUOTA no borra el token: eso se arregla esperando", async () => {
    // Confundirlos hace recargar la agenda entera cada vez que Google frena la mano.
    responder(429, { error: { message: "Quota exceeded" } });
    const client = createContactsClient("token");
    const error = await client
      .listChanges({ syncToken: "vigente", pageToken: null })
      .catch((e: unknown) => e);
    expect(isExpiredSyncToken(error)).toBe(false);
    expect(isContactsPermissionError(error)).toBe(false);
  });

  it("un 500 no es ni falta de permiso ni token vencido", async () => {
    responder(500);
    const client = createContactsClient("token");
    const error = await client.listChanges({ syncToken: null, pageToken: null }).catch((e) => e);
    expect(isExpiredSyncToken(error)).toBe(false);
    expect(isContactsPermissionError(error)).toBe(false);
  });

  it("cualquier otra cosa que llegue no se confunde con un error de Google", () => {
    expect(isExpiredSyncToken(new Error("network"))).toBe(false);
    expect(isExpiredSyncToken(null)).toBe(false);
    expect(isContactsPermissionError({ code: 403 })).toBe(false);
  });
});

describe("leer los cambios", () => {
  it("devuelve la gente y el token para la próxima corrida", async () => {
    responder(200, {
      connections: [{ resourceName: "people/c1" }],
      nextSyncToken: "token-nuevo",
    });
    const client = createContactsClient("token");
    const page = await client.listChanges({ syncToken: null, pageToken: null });
    expect(page.people).toHaveLength(1);
    expect(page.nextSyncToken).toBe("token-nuevo");
    expect(page.nextPageToken).toBeNull();
  });

  it("una agenda vacía devuelve lista vacía, no rompe", async () => {
    responder(200, { nextSyncToken: "t" });
    const client = createContactsClient("token");
    await expect(
      client.listChanges({ syncToken: null, pageToken: null }),
    ).resolves.toMatchObject({ people: [] });
  });

  it("pide siempre los mismos campos: cambiarlos invalidaría el token", async () => {
    const fake = responder(200, { connections: [] });
    const client = createContactsClient("token");
    await client.listChanges({ syncToken: "t", pageToken: null });
    const url = String(fake.mock.calls[0][0]);
    expect(url).toContain("requestSyncToken=true");
    expect(url).toContain("personFields=");
  });
});

describe("escribir un contacto", () => {
  it("al crear devuelve el resourceName para poder seguirlo", async () => {
    responder(200, { resourceName: "people/c9", etag: "%e1" });
    const client = createContactsClient("token");
    await expect(client.createContact({ names: [] })).resolves.toEqual({
      resourceName: "people/c9",
      etag: "%e1",
      person: { resourceName: "people/c9", etag: "%e1" },
    });
  });

  it("al crear también devuelve la persona completa que guardó Google, no sólo el resourceName", async () => {
    // Sin esto, quien sincroniza no tiene forma de saber qué guardó Google de verdad: sólo lo
    // que le mandó. Si Google reformatea algo (un teléfono, un espacio), la corrida siguiente
    // vería ahí una diferencia que nadie provocó y volvería a empujar a esa persona para siempre.
    responder(200, {
      resourceName: "people/c9",
      etag: "%e1",
      names: [{ givenName: "Ana", familyName: "Pérez" }],
      phoneNumbers: [{ value: "+54 9 342 555-0000" }],
    });
    const client = createContactsClient("token");
    const resultado = await client.createContact({ names: [] });
    expect(resultado.person).toEqual({
      resourceName: "people/c9",
      etag: "%e1",
      names: [{ givenName: "Ana", familyName: "Pérez" }],
      phoneNumbers: [{ value: "+54 9 342 555-0000" }],
    });
  });

  it("al actualizar manda el etag: sin eso se pisa lo que otro acaba de escribir", async () => {
    const fake = responder(200, { etag: "%e2" });
    const client = createContactsClient("token");
    await client.updateContact({
      resourceName: "people/c9",
      etag: "%e1",
      body: { names: [] },
    });
    const enviado = JSON.parse(String(fake.mock.calls[0][1].body));
    expect(enviado.etag).toBe("%e1");
  });

  it("al actualizar también devuelve la persona que quedó en Google", async () => {
    responder(200, { etag: "%e2", phoneNumbers: [{ value: "342 5550000" }] });
    const client = createContactsClient("token");
    const resultado = await client.updateContact({
      resourceName: "people/c9",
      etag: "%e1",
      body: { names: [] },
    });
    expect(resultado.person).toEqual({ etag: "%e2", phoneNumbers: [{ value: "342 5550000" }] });
  });
});
