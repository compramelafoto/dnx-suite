import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  autoInvitacionEncendida,
  leerCorreoMercadoPago,
  parametrosDeVuelta,
  pedirInvitacionAlConectar,
  type DepsAlConectar,
} from "./al-conectar";
import type {
  ClienteConsentimientoMp,
  ConsentimientoGuardado,
  DepsConsentimiento,
  RepositorioConsentimiento,
} from "./servicio";

const ENCENDIDO = {
  DNX_CLF_SPLIT_1N_CONSENTIMIENTO_ENABLED: "true",
  DNX_MP_SPLIT_CONSENT_PRODUCTION_ENABLED: "true",
};
const ENTRADA = { userId: 35, rol: "PHOTOGRAPHER", accessToken: "APP_USR-token-nuevo", mpUserId: "R1" };

function armar(opciones: {
  env?: NodeJS.ProcessEnv;
  filas?: ConsentimientoGuardado[];
  mp?: Partial<ClienteConsentimientoMp>;
  correo?: string | null | (() => Promise<string | null>);
  crearDepsLanza?: boolean;
}) {
  const llamadas = { crearDeps: 0, leerCorreo: [] as string[], invitar: [] as string[], guardados: 0 };
  const repo: RepositorioConsentimiento = {
    async buscarPorUsuario(userId) {
      return opciones.filas?.find((f) => f.userId === userId) ?? null;
    },
    async buscarPorReceiver(receiverId) {
      return opciones.filas?.find((f) => f.receiverId === receiverId) ?? null;
    },
    async guardar() {
      llamadas.guardados++;
    },
    async actualizarEstado() {},
  };
  const mp: ClienteConsentimientoMp = {
    async invitar(correo) {
      llamadas.invitar.push(correo);
      return [{ sellerEmail: correo, receiverId: "R1", status: "PENDING", inviteUrl: "https://mp/inv/1" }];
    },
    async listar() {
      return [];
    },
    async consultar() {
      return null;
    },
    ...opciones.mp,
  };
  const deps: DepsAlConectar = {
    env: opciones.env ?? ENCENDIDO,
    async leerCorreo(token) {
      llamadas.leerCorreo.push(token);
      if (typeof opciones.correo === "function") return opciones.correo();
      return opciones.correo === undefined ? "Foto@Ejemplo.com" : opciones.correo;
    },
    crearDeps(): DepsConsentimiento {
      llamadas.crearDeps++;
      if (opciones.crearDepsLanza) throw new Error("falta DNX_CLF_SPLIT_1N_PILOTO_ACCESS_TOKEN");
      return { repo, mp, ahora: () => new Date("2026-11-10T12:00:00Z") };
    },
    esperaMaximaMs: 50,
  };
  return { deps, llamadas };
}

describe("invitación al conectar: interruptores apagados", () => {
  it("hacen falta los dos interruptores", () => {
    assert.equal(autoInvitacionEncendida({}), false);
    assert.equal(autoInvitacionEncendida({ DNX_CLF_SPLIT_1N_CONSENTIMIENTO_ENABLED: "true" }), false);
    assert.equal(autoInvitacionEncendida({ DNX_MP_SPLIT_CONSENT_PRODUCTION_ENABLED: "true" }), false);
    assert.equal(autoInvitacionEncendida(ENCENDIDO), true);
  });

  for (const env of [{}, { DNX_CLF_SPLIT_1N_CONSENTIMIENTO_ENABLED: "true" }, { DNX_MP_SPLIT_CONSENT_PRODUCTION_ENABLED: "true" }]) {
    it(`apagado (${JSON.stringify(env)}): no llama a nadie y la vuelta queda igual que antes`, async () => {
      const { deps, llamadas } = armar({ env });
      const r = await pedirInvitacionAlConectar(deps, ENTRADA);
      assert.deepEqual(r, { pedida: false, motivo: "APAGADO" });
      assert.equal(llamadas.crearDeps, 0);
      assert.equal(llamadas.leerCorreo.length, 0);
      assert.deepEqual(parametrosDeVuelta(r), {});
    });
  }

  it("un laboratorio o un comprador no recibe invitación", async () => {
    for (const rol of [null, "CLIENT", "LAB"]) {
      const { deps, llamadas } = armar({});
      const r = await pedirInvitacionAlConectar(deps, { ...ENTRADA, rol });
      assert.deepEqual(r, { pedida: false, motivo: "ROL" });
      assert.equal(llamadas.crearDeps, 0);
    }
  });

  it("sin id de la cuenta conectada no se pide (no se podría verificar de quién es)", async () => {
    const { deps, llamadas } = armar({});
    const r = await pedirInvitacionAlConectar(deps, { ...ENTRADA, mpUserId: null });
    assert.deepEqual(r, { pedida: false, motivo: "SIN_CUENTA" });
    assert.equal(llamadas.leerCorreo.length, 0);
  });
});

describe("invitación al conectar: encendida", () => {
  it("lee el correo con el token recién obtenido y pide la invitación con ese correo", async () => {
    const { deps, llamadas } = armar({});
    const r = await pedirInvitacionAlConectar(deps, ENTRADA);
    assert.deepEqual(llamadas.leerCorreo, ["APP_USR-token-nuevo"]);
    assert.deepEqual(llamadas.invitar, ["foto@ejemplo.com"]);
    assert.equal(llamadas.guardados, 1);
    assert.deepEqual(r, { pedida: true, estado: "PENDING", inviteUrl: "https://mp/inv/1" });
    assert.deepEqual(parametrosDeVuelta(r), { tab: "mercadopago", cobro_dividido: "aceptar" });
  });

  it("una invitación previa se vincula sólo si es de la cuenta conectada", async () => {
    const mp = {
      async invitar() {
        return [];
      },
      async listar() {
        return [{ sellerEmail: "foto@ejemplo.com", receiverId: "R1", status: "PENDING", inviteUrl: "https://mp/inv/1" }];
      },
    };
    const propia = armar({ mp });
    assert.equal((await pedirInvitacionAlConectar(propia.deps, ENTRADA)).pedida, true);

    const ajena = armar({ mp });
    const r = await pedirInvitacionAlConectar(ajena.deps, { ...ENTRADA, mpUserId: "OTRA" });
    assert.deepEqual(r, { pedida: false, motivo: "FALLA", codigo: "YA_INVITADO" });
    assert.equal(ajena.llamadas.guardados, 0);
  });

  it("dos usuarios no comparten la misma cuenta de Mercado Pago", async () => {
    const otro: ConsentimientoGuardado = {
      userId: 99,
      receiverId: "R1",
      correo: "foto@ejemplo.com",
      estado: "PENDING",
      inviteUrl: "https://mp/inv/1",
      lastCheckedAt: null,
      creadoEn: null,
    };
    const { deps, llamadas } = armar({ filas: [otro] });
    const r = await pedirInvitacionAlConectar(deps, ENTRADA);
    assert.deepEqual(r, { pedida: false, motivo: "FALLA", codigo: "CUENTA_DE_OTRO_USUARIO" });
    assert.equal(llamadas.guardados, 0);
  });

  it("un cobro dividido ya activo no se toca", async () => {
    const activo: ConsentimientoGuardado = {
      userId: 35,
      receiverId: "R0",
      correo: "vieja@ejemplo.com",
      estado: "ACTIVE",
      inviteUrl: null,
      lastCheckedAt: null,
      creadoEn: null,
    };
    const { deps, llamadas } = armar({ filas: [activo] });
    const r = await pedirInvitacionAlConectar(deps, ENTRADA);
    assert.deepEqual(r, { pedida: false, motivo: "YA_ACTIVO" });
    assert.equal(llamadas.invitar.length, 0);
    assert.deepEqual(parametrosDeVuelta(r), {});
  });
});

describe("invitación al conectar: una falla nunca rompe la conexión", () => {
  const casos: Array<[string, Parameters<typeof armar>[0], string]> = [
    ["Mercado Pago rechaza la invitación", { mp: { invitar: async () => Promise.reject(new Error("500")) } }, "FALLA"],
    ["falta la configuración del piloto", { crearDepsLanza: true }, "FALLA"],
    ["no se pudo leer el correo", { correo: () => Promise.reject(new Error("fetch failed")) }, "FALLA"],
    ["la cuenta no trae correo", { correo: null }, "SIN_CORREO"],
    ["Mercado Pago no responde a tiempo", { correo: () => new Promise<string | null>(() => {}) }, "FALLA"],
  ];
  for (const [nombre, opciones, motivo] of casos) {
    it(`${nombre}: no lanza y la vuelta queda igual que antes`, async () => {
      const { deps } = armar(opciones);
      const r = await pedirInvitacionAlConectar(deps, ENTRADA);
      assert.equal(r.pedida, false);
      assert.equal(r.pedida === false && r.motivo, motivo);
      assert.deepEqual(parametrosDeVuelta(r), {});
    });
  }
});

describe("leerCorreoMercadoPago", () => {
  it("usa el token en /users/me y devuelve el correo", async () => {
    const pedidos: Array<{ url: string; auth: string | null }> = [];
    const fetchFalso = (async (url: string, init?: RequestInit) => {
      pedidos.push({ url, auth: new Headers(init?.headers).get("authorization") });
      return new Response(JSON.stringify({ id: 1, email: "foto@ejemplo.com" }), { status: 200 });
    }) as unknown as typeof fetch;
    assert.equal(await leerCorreoMercadoPago("TOK", fetchFalso), "foto@ejemplo.com");
    assert.deepEqual(pedidos, [{ url: "https://api.mercadopago.com/users/me", auth: "Bearer TOK" }]);
  });

  it("devuelve null si Mercado Pago responde con error", async () => {
    const fetchFalso = (async () => new Response("{}", { status: 401 })) as unknown as typeof fetch;
    assert.equal(await leerCorreoMercadoPago("TOK", fetchFalso), null);
  });
});
