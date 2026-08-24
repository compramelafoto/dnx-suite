import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeMercadoPagoOAuthHttpClient } from "@repo/payments";
import {
  ConnectError,
  completeMpConnection,
  startMpConnection,
  type ConnectDeps,
} from "./service";

const CONFIG = {
  configured: true as const,
  missing: [] as string[],
  clientId: "cid",
  clientSecret: "csec",
  redirectUri: "https://fotoffice.com/api/payments/mercadopago/connect/callback",
};

/** Base de datos falsa en memoria, con la forma mínima que usa el servicio. */
function makeStore() {
  const identities = new Map<string, { id: string; organizationRef: string }>();
  const states = new Map<string, Record<string, unknown>>();
  const accounts: Record<string, unknown>[] = [];
  const credentials: Record<string, unknown>[] = [];

  const store: ConnectDeps["store"] = {
    async getOrCreateIdentity(organizationRef, legalName) {
      const found = identities.get(organizationRef);
      if (found) return found;
      const created = { id: `fi-${identities.size + 1}`, organizationRef, legalName };
      identities.set(organizationRef, created);
      return created;
    },
    async saveState(state) {
      states.set(state.stateHash, { ...state });
      return state;
    },
    async findStateByHash(stateHash) {
      const s = states.get(stateHash);
      return (s as never) ?? null;
    },
    async markStateUsed(stateHash, at) {
      const s = states.get(stateHash);
      if (s) s.usedAt = at;
    },
    async saveCredential(record) {
      credentials.push(record);
      return { id: `cred-${credentials.length}` };
    },
    async upsertPaymentAccount(account) {
      accounts.push(account);
      return { id: `acc-${accounts.length}` };
    },
  };
  return { store, identities, states, accounts, credentials };
}

function makeDeps(over: Partial<ConnectDeps> = {}): ConnectDeps {
  const { store } = makeStore();
  return {
    config: CONFIG,
    store,
    mpClient: createFakeMercadoPagoOAuthHttpClient(),
    masterKeyBase64: Buffer.alloc(32, 7).toString("base64"),
    now: () => new Date("2026-08-24T12:00:00Z"),
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("startMpConnection", () => {
  it("devuelve la URL de autorización de MercadoPago con PKCE", async () => {
    const deps = makeDeps();
    const r = await startMpConnection({ workspaceId: "ws-sfpr", userId: 7 }, deps);

    const url = new URL(r.authorizeUrl);
    expect(url.host).toBe("auth.mercadopago.com");
    expect(url.searchParams.get("client_id")).toBe("cid");
    expect(url.searchParams.get("redirect_uri")).toBe(CONFIG.redirectUri);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBeTruthy();
    expect(url.searchParams.get("state")).toBeTruthy();
  });

  it("crea la identidad financiera de la institución con su ref propio", async () => {
    const { store, identities } = makeStore();
    await startMpConnection({ workspaceId: "ws-sfpr", userId: 7 }, makeDeps({ store }));

    expect([...identities.keys()]).toEqual(["fotoffice-workspace:ws-sfpr"]);
  });

  it("guarda el estado con productKey fotoffice, nunca clickaton", async () => {
    const { store, states } = makeStore();
    await startMpConnection({ workspaceId: "ws-sfpr", userId: 7 }, makeDeps({ store }));

    const state = [...states.values()][0]!;
    expect(state.productKey).toBe("fotoffice");
    expect(state.userId).toBe(7);
  });

  /** El verificador PKCE en claro nunca puede quedar en la base. */
  it("guarda el verificador cifrado, no en claro", async () => {
    const { store, states } = makeStore();
    const r = await startMpConnection({ workspaceId: "ws-sfpr", userId: 7 }, makeDeps({ store }));

    const state = [...states.values()][0]!;
    expect(state.codeVerifierCiphertext).toBeTruthy();
    expect(state.codeVerifierNonce).toBeTruthy();
    expect(state.codeVerifierAuthTag).toBeTruthy();
    // Ni el verificador ni el token de estado aparecen en claro en ningún campo guardado.
    const serialized = JSON.stringify(state);
    expect(serialized).not.toContain(r.debugCodeVerifier);
  });

  /** El token del navegador no se guarda: se guarda su hash. */
  it("guarda el hash del state, no el state", async () => {
    const { store, states } = makeStore();
    const r = await startMpConnection({ workspaceId: "ws-sfpr", userId: 7 }, makeDeps({ store }));

    const url = new URL(r.authorizeUrl);
    const stateToken = url.searchParams.get("state")!;
    expect(states.has(stateToken)).toBe(false);
    expect([...states.values()][0]!.stateHash).not.toBe(stateToken);
  });

  it("el estado vence, y el vencimiento es futuro", async () => {
    const { store, states } = makeStore();
    await startMpConnection({ workspaceId: "ws-sfpr", userId: 7 }, makeDeps({ store }));

    const state = [...states.values()][0]!;
    expect((state.expiresAt as Date).getTime()).toBeGreaterThan(
      new Date("2026-08-24T12:00:00Z").getTime(),
    );
  });

  it("sin configuración de MercadoPago falla con un error claro", async () => {
    const deps = makeDeps({
      config: { configured: false, missing: ["FOTOFFICE_MP_CLIENT_ID"], clientId: null, clientSecret: null, redirectUri: null },
    });
    await expect(startMpConnection({ workspaceId: "ws-1", userId: 7 }, deps)).rejects.toThrow(
      ConnectError,
    );
  });
});

describe("completeMpConnection", () => {
  /** Recorre el flujo completo y devuelve el estado interno para inspeccionarlo. */
  async function fullFlow(over: Partial<ConnectDeps> = {}) {
    const made = makeStore();
    const deps = makeDeps({ store: made.store, ...over });
    const started = await startMpConnection({ workspaceId: "ws-sfpr", userId: 7 }, deps);
    const stateToken = new URL(started.authorizeUrl).searchParams.get("state")!;
    return { made, deps, stateToken };
  }

  it("intercambia el código y deja la cuenta lista para recibir split", async () => {
    const { made, deps, stateToken } = await fullFlow();
    const r = await completeMpConnection({ code: "auth-code", state: stateToken }, deps);

    expect(r.workspaceId).toBe("ws-sfpr");
    const account = made.accounts[0]!;
    expect(account.provider).toBe("MERCADOPAGO");
    expect(account.capabilities).toContain("SPLIT_RECEIVER");
    expect(account.status).toBe("ACTIVE");
    expect(account.originApp).toBe("fotoffice");
  });

  /** El token nunca puede quedar en la fila de la cuenta: solo su referencia cifrada. */
  it("el access token no queda en la cuenta, solo la referencia a la credencial", async () => {
    const { made, deps, stateToken } = await fullFlow();
    await completeMpConnection({ code: "auth-code", state: stateToken }, deps);

    const account = made.accounts[0]!;
    expect(account.credentialReference).toBeTruthy();
    expect(JSON.stringify(account)).not.toContain("APP_USR-fake-access-token");
    expect(made.credentials).toHaveLength(1);
  });

  it("marca el estado como usado", async () => {
    const { made, deps, stateToken } = await fullFlow();
    await completeMpConnection({ code: "auth-code", state: stateToken }, deps);

    expect([...made.states.values()][0]!.usedAt).toBeTruthy();
  });

  /**
   * Un state solo sirve una vez. Si se pudiera reusar, alguien que capture la URL de
   * retorno podría reconectar la cuenta cuando quisiera.
   */
  it("un state ya usado se rechaza", async () => {
    const { deps, stateToken } = await fullFlow();
    await completeMpConnection({ code: "auth-code", state: stateToken }, deps);

    await expect(
      completeMpConnection({ code: "otro-code", state: stateToken }, deps),
    ).rejects.toThrow(ConnectError);
  });

  it("un state inventado se rechaza y no crea nada", async () => {
    const { made, deps } = await fullFlow();
    await expect(
      completeMpConnection({ code: "auth-code", state: "inventado" }, deps),
    ).rejects.toThrow(ConnectError);
    expect(made.accounts).toHaveLength(0);
  });

  it("un state vencido se rechaza", async () => {
    const made = makeStore();
    const deps = makeDeps({ store: made.store });
    const started = await startMpConnection({ workspaceId: "ws-sfpr", userId: 7 }, deps);
    const stateToken = new URL(started.authorizeUrl).searchParams.get("state")!;

    const tarde = makeDeps({ store: made.store, now: () => new Date("2026-08-25T12:00:00Z") });
    await expect(
      completeMpConnection({ code: "auth-code", state: stateToken }, tarde),
    ).rejects.toThrow(ConnectError);
  });

  it("si MercadoPago rechaza el intercambio no se crea cuenta ni credencial", async () => {
    const made = makeStore();
    const deps = makeDeps({ store: made.store });
    const started = await startMpConnection({ workspaceId: "ws-sfpr", userId: 7 }, deps);
    const stateToken = new URL(started.authorizeUrl).searchParams.get("state")!;

    const falla = makeDeps({
      store: made.store,
      mpClient: createFakeMercadoPagoOAuthHttpClient({ failExchange: true }),
    });
    await expect(
      completeMpConnection({ code: "auth-code", state: stateToken }, falla),
    ).rejects.toThrow();
    expect(made.accounts).toHaveLength(0);
    expect(made.credentials).toHaveLength(0);
  });

  it("un state de otro producto se rechaza", async () => {
    const made = makeStore();
    const deps = makeDeps({ store: made.store });
    const started = await startMpConnection({ workspaceId: "ws-sfpr", userId: 7 }, deps);
    const stateToken = new URL(started.authorizeUrl).searchParams.get("state")!;
    // Alguien reusa una fila de Clickatón, que comparte tabla.
    [...made.states.values()][0]!.productKey = "clickaton";

    await expect(
      completeMpConnection({ code: "auth-code", state: stateToken }, deps),
    ).rejects.toThrow(ConnectError);
  });
});
