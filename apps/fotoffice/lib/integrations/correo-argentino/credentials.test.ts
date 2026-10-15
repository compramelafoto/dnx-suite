import { randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const masterKeyBase64 = randomBytes(32).toString("base64");

type Row = Record<string, unknown>;
type ClaveUnica = { workspaceId_integrationKey: { workspaceId: string; integrationKey: string } };

const db = { rows: [] as Row[] };

function buscar(where: ClaveUnica) {
  const key = where.workspaceId_integrationKey;
  return db.rows.find(
    (r) => r.workspaceId === key.workspaceId && r.integrationKey === key.integrationKey,
  );
}

vi.mock("@repo/db", () => ({
  prisma: {
    workspaceIntegration: {
      upsert: vi.fn(async ({ create }: { create: Row }) => {
        db.rows = db.rows.filter(
          (r) => r.workspaceId !== create.workspaceId || r.integrationKey !== create.integrationKey,
        );
        db.rows.push({ ...create, connectedAt: new Date(), lastUsedAt: null });
        return create;
      }),
      findUnique: vi.fn(async ({ where }: { where: ClaveUnica }) => buscar(where) ?? null),
      update: vi.fn(async ({ where, data }: { where: ClaveUnica; data: Row }) => {
        const row = buscar(where);
        if (!row) throw new Error("Record to update not found.");
        Object.assign(row, data);
        return row;
      }),
      delete: vi.fn(async ({ where }: { where: ClaveUnica }) => {
        const key = where.workspaceId_integrationKey;
        db.rows = db.rows.filter(
          (r) => r.workspaceId !== key.workspaceId || r.integrationKey !== key.integrationKey,
        );
        return null;
      }),
    },
  },
}));

import { resetMiCorreoTokenCacheForTests } from "./client";
import {
  deleteCorreoArgentinoCredentials,
  loadCorreoArgentinoClient,
  markCorreoNeedsReconsent,
  saveCorreoArgentinoCredentials,
} from "./credentials";
import { MiCorreoError } from "./errors";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const NOW = () => new Date("2022-04-26T23:00:00Z");

function fakeFetch(validate: () => Response = () => json(200, { customerId: "0090000025" })) {
  const calls: { url: string; body: string | null }[] = [];
  const impl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, body: (init?.body as string) ?? null });
    if (url.endsWith("/token")) return json(200, { token: "jwt", expires: "2022-04-26 21:16:20" });
    if (url.endsWith("/users/validate")) return validate();
    if (url.includes("/agencies")) return json(200, []);
    throw new Error(`ruta no simulada: ${url}`);
  });
  return { impl: impl as unknown as typeof fetch, calls };
}

const entrada = {
  env: "TEST" as const,
  apiUser: "api-user",
  apiPassword: "api-secretisima",
  accountEmail: "envios@sfpr.org.ar",
  accountPassword: "clave-de-la-cuenta",
};

describe("credenciales de Correo Argentino", () => {
  beforeEach(() => {
    db.rows = [];
    resetMiCorreoTokenCacheForTests();
    process.env.DNX_INTEGRATIONS_VAULT_MASTER_KEY = masterKeyBase64;
  });

  it("valida contra MiCorreo y guarda cifrado; la contraseña de la cuenta no se guarda", async () => {
    const f = fakeFetch();
    const resultado = await saveCorreoArgentinoCredentials("ws-1", 7, entrada, {
      fetchImpl: f.impl,
      now: NOW,
    });
    expect(resultado).toEqual({ customerId: "0090000025" });
    // Pidió token y validó la cuenta con email y contraseña.
    expect(f.calls.map((c) => new URL(c.url).pathname)).toEqual([
      "/micorreo/v1/token",
      "/micorreo/v1/users/validate",
    ]);
    expect(JSON.parse(f.calls[1]!.body!)).toEqual({
      email: "envios@sfpr.org.ar",
      password: "clave-de-la-cuenta",
    });

    expect(db.rows).toHaveLength(1);
    const fila = db.rows[0]!;
    expect(fila).toMatchObject({
      workspaceId: "ws-1",
      integrationKey: "correo-argentino",
      provider: "CORREO_ARGENTINO",
      accountEmail: "envios@sfpr.org.ar",
      accountExternalId: "0090000025",
      grantedScopes: [],
      status: "ACTIVE",
      connectedByUserId: 7,
    });
    const guardado = JSON.stringify(fila);
    expect(guardado).not.toContain("api-secretisima");
    expect(guardado).not.toContain("clave-de-la-cuenta");
    expect(guardado).not.toContain("api-user");
  });

  it("al guardar siempre pide un token nuevo, aunque haya uno en caché", async () => {
    const f = fakeFetch();
    await saveCorreoArgentinoCredentials("ws-1", 7, entrada, { fetchImpl: f.impl, now: NOW });
    await saveCorreoArgentinoCredentials("ws-2", 8, entrada, { fetchImpl: f.impl, now: NOW });
    expect(f.calls.filter((c) => c.url.endsWith("/token"))).toHaveLength(2);
  });

  it("si MiCorreo rechaza la cuenta, no guarda nada y propaga el error", async () => {
    const f = fakeFetch(() => json(404, { code: "404", message: "Usuario no valido o inexistente" }));
    const error = await saveCorreoArgentinoCredentials("ws-1", 7, entrada, {
      fetchImpl: f.impl,
      now: NOW,
    }).catch((e) => e);
    expect(error).toBeInstanceOf(MiCorreoError);
    expect((error as MiCorreoError).kind).toBe("BUSINESS");
    expect(db.rows).toHaveLength(0);
  });

  it("rechaza datos incompletos o un ambiente inventado sin salir a la red", async () => {
    const f = fakeFetch();
    for (const malo of [
      { ...entrada, apiUser: "  " },
      { ...entrada, apiPassword: "" },
      { ...entrada, accountEmail: "" },
      { ...entrada, accountPassword: "" },
      { ...entrada, env: "STAGING" as unknown as "TEST" },
    ]) {
      await expect(
        saveCorreoArgentinoCredentials("ws-1", 7, malo, { fetchImpl: f.impl, now: NOW }),
      ).rejects.toBeInstanceOf(MiCorreoError);
    }
    expect(f.calls).toHaveLength(0);
    expect(db.rows).toHaveLength(0);
  });

  it("sin clave maestra no guarda nada", async () => {
    delete process.env.DNX_INTEGRATIONS_VAULT_MASTER_KEY;
    const f = fakeFetch();
    await expect(
      saveCorreoArgentinoCredentials("ws-1", 7, entrada, { fetchImpl: f.impl, now: NOW }),
    ).rejects.toThrow();
    expect(db.rows).toHaveLength(0);
    expect(f.calls).toHaveLength(0);
  });

  it("lo guardado arma un cliente del mismo ambiente con el customerId", async () => {
    const f = fakeFetch();
    await saveCorreoArgentinoCredentials("ws-1", 7, { ...entrada, env: "PROD" }, { fetchImpl: f.impl, now: NOW });
    resetMiCorreoTokenCacheForTests();

    const g = fakeFetch();
    const cargado = await loadCorreoArgentinoClient("ws-1", { fetchImpl: g.impl, now: NOW });
    expect(cargado?.customerId).toBe("0090000025");
    await cargado!.client.agencies({ customerId: cargado!.customerId, provinceCode: "S" });
    expect(g.calls[0]!.url).toBe("https://api.correoargentino.com.ar/micorreo/v1/token");
  });

  it("sin integración, de otro workspace o que necesita reconexión → null", async () => {
    expect(await loadCorreoArgentinoClient("ws-1")).toBeNull();
    const f = fakeFetch();
    await saveCorreoArgentinoCredentials("ws-1", 7, entrada, { fetchImpl: f.impl, now: NOW });
    expect(await loadCorreoArgentinoClient("ws-2")).toBeNull();
    await markCorreoNeedsReconsent("ws-1");
    expect(db.rows[0]!.status).toBe("NEEDS_RECONSENT");
    expect(await loadCorreoArgentinoClient("ws-1")).toBeNull();
  });

  it("si no se puede descifrar → null, no explota", async () => {
    const f = fakeFetch();
    await saveCorreoArgentinoCredentials("ws-1", 7, entrada, { fetchImpl: f.impl, now: NOW });
    process.env.DNX_INTEGRATIONS_VAULT_MASTER_KEY = randomBytes(32).toString("base64");
    expect(await loadCorreoArgentinoClient("ws-1")).toBeNull();
  });

  it("marcar reconexión sin integración no explota", async () => {
    await expect(markCorreoNeedsReconsent("ws-9")).resolves.toBeUndefined();
  });

  it("borrar quita la fila y no devuelve la credencial", async () => {
    const f = fakeFetch();
    await saveCorreoArgentinoCredentials("ws-1", 7, entrada, { fetchImpl: f.impl, now: NOW });
    expect(await deleteCorreoArgentinoCredentials("ws-1")).toBeUndefined();
    expect(db.rows).toHaveLength(0);
    await expect(deleteCorreoArgentinoCredentials("ws-1")).resolves.toBeUndefined();
  });
});
