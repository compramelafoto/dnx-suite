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
        db.rows.push({ ...create, connectedAt: new Date("2026-10-05T12:00:00Z"), lastUsedAt: null });
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

import { resetAndreaniTokenCacheForTests } from "./client";
import {
  deleteAndreaniCredentials,
  describeAndreaniConnection,
  loadAndreaniClient,
  markAndreaniNeedsReconsent,
  saveAndreaniCredentials,
} from "./credentials";
import { AndreaniError } from "./errors";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const NOW = () => new Date("2026-10-05T15:00:00Z");

let tokens = 0;
function fakeFetch(tarifa: () => Response = () => json(200, { tarifaConIva: { total: "7041.21" } })) {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const impl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, headers: Object.fromEntries(new Headers(init?.headers).entries()) });
    const path = new URL(url).pathname;
    if (path === "/login") {
      tokens += 1;
      return new Response("", { status: 200, headers: { "x-authorization-token": `tok-${tokens}` } });
    }
    if (path === "/v1/tarifas") return tarifa();
    if (path === "/v2/sucursales") return json(200, []);
    throw new Error(`ruta no simulada: ${url}`);
  });
  return { impl: impl as unknown as typeof fetch, calls };
}

const entrada = {
  env: "QA" as const,
  user: "usuario-api",
  password: "clave-secretisima",
  clientCode: "CL0003750",
  contractHome: "300006611",
  contractBranch: "300006622",
  originBranch: "SFN",
  testPostalCode: "3000",
};

describe("credenciales de Andreani", () => {
  beforeEach(() => {
    db.rows = [];
    tokens = 0;
    resetAndreaniTokenCacheForTests();
    process.env.DNX_INTEGRATIONS_VAULT_MASTER_KEY = masterKeyBase64;
  });

  it("valida con token nuevo + cotización de prueba y guarda cifrado", async () => {
    const f = fakeFetch();
    const r = await saveAndreaniCredentials("ws-1", 7, entrada, { fetchImpl: f.impl, now: NOW });
    expect(r).toEqual({ testQuoteMinor: 704121 });

    expect(f.calls.map((c) => new URL(c.url).pathname)).toEqual(["/login", "/v1/tarifas"]);
    const q = new URL(f.calls[1]!.url).searchParams;
    // La cotización de prueba: contrato de domicilio, 1 bulto de 1 kg, 30×20×10, valor 0.
    expect(Object.fromEntries(q.entries())).toEqual({
      cpDestino: "3000",
      contrato: "300006611",
      cliente: "CL0003750",
      sucursalOrigen: "SFN",
      "bultos[0][kilos]": "1",
      "bultos[0][largoCm]": "30",
      "bultos[0][anchoCm]": "20",
      "bultos[0][altoCm]": "10",
      "bultos[0][volumen]": "6000",
      "bultos[0][valorDeclarado]": "0.00",
    });

    expect(db.rows).toHaveLength(1);
    const fila = db.rows[0]!;
    expect(fila).toMatchObject({
      workspaceId: "ws-1",
      integrationKey: "andreani",
      provider: "ANDREANI",
      accountEmail: "usuario-api",
      grantedScopes: [],
      status: "ACTIVE",
      connectedByUserId: 7,
    });
    const guardado = JSON.stringify(fila);
    expect(guardado).not.toContain("clave-secretisima");
    expect(guardado).not.toContain("300006611");
  });

  it("al guardar siempre pide un token nuevo, aunque haya uno en caché", async () => {
    const f = fakeFetch();
    await saveAndreaniCredentials("ws-1", 7, entrada, { fetchImpl: f.impl, now: NOW });
    await saveAndreaniCredentials("ws-2", 8, entrada, { fetchImpl: f.impl, now: NOW });
    expect(f.calls.filter((c) => c.url.endsWith("/login"))).toHaveLength(2);
    // La segunda cotización usa el token recién pedido, no el de la caché.
    expect(f.calls[3]!.headers["x-authorization-token"]).toBe("tok-2");
  });

  it("si la cotización de prueba falla, no guarda nada y propaga el error", async () => {
    const f = fakeFetch(() => json(400, { title: "Error", detail: "No se pudo obtener la tarifa" }));
    const e = await saveAndreaniCredentials("ws-1", 7, entrada, { fetchImpl: f.impl, now: NOW }).catch((x) => x);
    expect(e).toBeInstanceOf(AndreaniError);
    expect((e as AndreaniError).kind).toBe("BUSINESS");
    expect(db.rows).toHaveLength(0);
  });

  it("rechaza datos incompletos o un ambiente inventado sin salir a la red", async () => {
    const f = fakeFetch();
    for (const malo of [
      { ...entrada, user: "  " },
      { ...entrada, password: "" },
      { ...entrada, clientCode: "" },
      { ...entrada, contractHome: " " },
      { ...entrada, testPostalCode: "" },
      { ...entrada, env: "STAGING" as unknown as "QA" },
    ]) {
      await expect(
        saveAndreaniCredentials("ws-1", 7, malo, { fetchImpl: f.impl, now: NOW }),
      ).rejects.toBeInstanceOf(AndreaniError);
    }
    expect(f.calls).toHaveLength(0);
    expect(db.rows).toHaveLength(0);
  });

  it("sin clave maestra no sale a la red ni guarda", async () => {
    delete process.env.DNX_INTEGRATIONS_VAULT_MASTER_KEY;
    const f = fakeFetch();
    await expect(saveAndreaniCredentials("ws-1", 7, entrada, { fetchImpl: f.impl, now: NOW })).rejects.toThrow();
    expect(f.calls).toHaveLength(0);
    expect(db.rows).toHaveLength(0);
  });

  it("nunca loguea la contraseña", async () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => undefined),
    );
    try {
      await saveAndreaniCredentials("ws-1", 7, entrada, { fetchImpl: fakeFetch().impl, now: NOW });
      await saveAndreaniCredentials("ws-1", 7, entrada, {
        fetchImpl: fakeFetch(() => json(500, {})).impl,
        now: NOW,
      }).catch(() => undefined);
      await loadAndreaniClient("ws-1");
      await describeAndreaniConnection("ws-1");
      expect(JSON.stringify(spies.flatMap((s) => s.mock.calls))).not.toContain("clave-secretisima");
    } finally {
      for (const s of spies) s.mockRestore();
    }
  });

  it("lo guardado arma un cliente del mismo ambiente con cliente, contratos y origen", async () => {
    await saveAndreaniCredentials("ws-1", 7, { ...entrada, env: "PROD" }, { fetchImpl: fakeFetch().impl, now: NOW });
    resetAndreaniTokenCacheForTests();

    const g = fakeFetch();
    const cargado = await loadAndreaniClient("ws-1", { fetchImpl: g.impl, now: NOW });
    expect(cargado).toMatchObject({
      clientCode: "CL0003750",
      contractHome: "300006611",
      contractBranch: "300006622",
      originBranch: "SFN",
    });
    await cargado!.client.getToken();
    expect(g.calls[0]!.url).toBe("https://apis.andreani.com/login");
  });

  it("sin contrato de sucursal ni sucursal de origen guarda null", async () => {
    await saveAndreaniCredentials(
      "ws-1",
      7,
      { ...entrada, contractBranch: "  ", originBranch: undefined },
      { fetchImpl: fakeFetch().impl, now: NOW },
    );
    const cargado = await loadAndreaniClient("ws-1");
    expect(cargado).toMatchObject({ contractBranch: null, originBranch: null });
  });

  it("sin integración, de otro workspace o que necesita reconexión → null", async () => {
    expect(await loadAndreaniClient("ws-1")).toBeNull();
    await saveAndreaniCredentials("ws-1", 7, entrada, { fetchImpl: fakeFetch().impl, now: NOW });
    expect(await loadAndreaniClient("ws-2")).toBeNull();
    await markAndreaniNeedsReconsent("ws-1");
    expect(db.rows[0]!.status).toBe("NEEDS_RECONSENT");
    expect(await loadAndreaniClient("ws-1")).toBeNull();
  });

  it("si no se puede descifrar → null, no explota", async () => {
    await saveAndreaniCredentials("ws-1", 7, entrada, { fetchImpl: fakeFetch().impl, now: NOW });
    process.env.DNX_INTEGRATIONS_VAULT_MASTER_KEY = randomBytes(32).toString("base64");
    expect(await loadAndreaniClient("ws-1")).toBeNull();
  });

  it("describe la conexión enmascarada, sin contraseña", async () => {
    expect(await describeAndreaniConnection("ws-1")).toBeNull();
    await saveAndreaniCredentials("ws-1", 7, entrada, { fetchImpl: fakeFetch().impl, now: NOW });
    const info = await describeAndreaniConnection("ws-1");
    expect(info).toEqual({
      status: "ACTIVE",
      connectedAt: new Date("2026-10-05T12:00:00Z"),
      env: "QA",
      user: "us•••",
      clientCode: "•••••3750",
      contractHome: "•••••6611",
      contractBranch: "•••••6622",
      originBranch: "SFN",
    });
    expect(JSON.stringify(info)).not.toContain("clave-secretisima");
  });

  it("marcar reconexión sin integración no explota", async () => {
    await expect(markAndreaniNeedsReconsent("ws-9")).resolves.toBeUndefined();
  });

  it("borrar quita la fila y no devuelve la credencial", async () => {
    await saveAndreaniCredentials("ws-1", 7, entrada, { fetchImpl: fakeFetch().impl, now: NOW });
    expect(await deleteAndreaniCredentials("ws-1")).toBeUndefined();
    expect(db.rows).toHaveLength(0);
    await expect(deleteAndreaniCredentials("ws-1")).resolves.toBeUndefined();
  });
});
