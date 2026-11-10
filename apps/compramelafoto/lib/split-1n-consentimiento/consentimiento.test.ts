import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveConsentimientoConfig } from "./config";
import {
  actualizarEstado,
  aplicarEstadosConsultados,
  pedirInvitacion,
  type ClienteConsentimientoMp,
  type ConsentimientoGuardado,
  type DepsConsentimiento,
  type RepositorioConsentimiento,
} from "./servicio";

const AHORA = new Date("2026-11-11T12:00:00Z");

function repoFalso(filas: ConsentimientoGuardado[] = []) {
  const guardados: Array<{ userId: number; fila: Omit<ConsentimientoGuardado, "userId" | "lastCheckedAt"> }> = [];
  const estados: Array<{ receiverId: string; estado: string }> = [];
  const repo: RepositorioConsentimiento = {
    async buscarPorUsuario(userId) {
      return filas.find((f) => f.userId === userId) ?? null;
    },
    async buscarPorReceiver(receiverId) {
      return filas.find((f) => f.receiverId === receiverId) ?? null;
    },
    async guardar(userId, fila) {
      guardados.push({ userId, fila });
    },
    async actualizarEstado(receiverId, estado) {
      estados.push({ receiverId, estado });
    },
  };
  return { repo, guardados, estados };
}

function mpFalso(cambios: Partial<ClienteConsentimientoMp> = {}) {
  const llamadas = { invitar: 0, listar: 0, consultar: 0 };
  const mp: ClienteConsentimientoMp = {
    async invitar(correo) {
      llamadas.invitar++;
      return [{ sellerEmail: correo, receiverId: "R1", status: "PENDING", inviteUrl: "https://mp/inv/1" }];
    },
    async listar() {
      llamadas.listar++;
      return [];
    },
    async consultar() {
      llamadas.consultar++;
      return { status: "ACTIVE" };
    },
    ...cambios,
  };
  return { mp, llamadas };
}

function deps(repo: RepositorioConsentimiento, mp: ClienteConsentimientoMp): DepsConsentimiento {
  return { repo, mp, ahora: () => AHORA };
}

const guardado = (c: Partial<ConsentimientoGuardado> = {}): ConsentimientoGuardado => ({
  userId: 35,
  receiverId: "R1",
  correo: "foto@ejemplo.com",
  estado: "PENDING",
  inviteUrl: "https://mp/inv/1",
  lastCheckedAt: null,
  creadoEn: null,
  ...c,
});

describe("consentimiento: configuración", () => {
  it("apagado por defecto; se enciende con «true»", () => {
    assert.equal(resolveConsentimientoConfig({}).enabled, false);
    assert.equal(
      resolveConsentimientoConfig({ DNX_CLF_SPLIT_1N_CONSENTIMIENTO_ENABLED: "true" }).enabled,
      true,
    );
  });
});

describe("consentimiento: pedir la invitación", () => {
  it("rechaza un correo mal escrito sin llamar a Mercado Pago", async () => {
    const { repo } = repoFalso();
    const { mp, llamadas } = mpFalso();
    const r = await pedirInvitacion(deps(repo, mp), { userId: 35, correo: "no-es-correo" });
    assert.equal(r.ok, false);
    assert.equal(r.ok === false && r.codigo, "CORREO_INVALIDO");
    assert.equal(llamadas.invitar, 0);
  });

  it("invita, guarda el receptor y devuelve el enlace", async () => {
    const { repo, guardados } = repoFalso();
    const { mp } = mpFalso();
    const r = await pedirInvitacion(deps(repo, mp), { userId: 35, correo: "  Foto@Ejemplo.com " });
    assert.equal(r.ok, true);
    assert.deepEqual(r.ok && r.vista, {
      estado: "PENDING",
      correo: "foto@ejemplo.com",
      inviteUrl: "https://mp/inv/1",
      actualizadoEn: AHORA.toISOString(),
    });
    assert.equal(guardados.length, 1);
    assert.deepEqual(guardados[0], {
      userId: 35,
      fila: { receiverId: "R1", correo: "foto@ejemplo.com", estado: "PENDING", inviteUrl: "https://mp/inv/1" },
    });
  });

  it("si ya está ACTIVE con el mismo correo, no vuelve a invitar", async () => {
    const { repo, guardados } = repoFalso([guardado({ estado: "ACTIVE" })]);
    const { mp, llamadas } = mpFalso();
    const r = await pedirInvitacion(deps(repo, mp), { userId: 35, correo: "foto@ejemplo.com" });
    assert.equal(r.ok && r.vista.estado, "ACTIVE");
    assert.equal(llamadas.invitar, 0);
    assert.equal(guardados.length, 0);
  });

  it("si está PENDING con el mismo correo y enlace, devuelve el enlace guardado", async () => {
    const { repo } = repoFalso([guardado()]);
    const { mp, llamadas } = mpFalso();
    const r = await pedirInvitacion(deps(repo, mp), { userId: 35, correo: "foto@ejemplo.com" });
    assert.equal(r.ok && r.vista.inviteUrl, "https://mp/inv/1");
    assert.equal(llamadas.invitar, 0);
  });

  it("si fue cancelado, invita de nuevo", async () => {
    const { repo, guardados } = repoFalso([guardado({ estado: "CANCELED" })]);
    const { mp, llamadas } = mpFalso();
    const r = await pedirInvitacion(deps(repo, mp), { userId: 35, correo: "foto@ejemplo.com" });
    assert.equal(r.ok, true);
    assert.equal(llamadas.invitar, 1);
    assert.equal(guardados.length, 1);
  });

  it("una invitación anterior de la lista sólo se vincula si la cuenta conectada es la misma", async () => {
    const listar = async () => [{ sellerEmail: "FOTO@ejemplo.com", receiverId: "R9", status: "ACTIVE" }];
    const invitar = async () => [];
    const a = repoFalso();
    const conCuenta = await pedirInvitacion(deps(a.repo, mpFalso({ invitar, listar }).mp), {
      userId: 35,
      correo: "foto@ejemplo.com",
      mpUserId: "R9",
    });
    assert.equal(conCuenta.ok && conCuenta.vista.estado, "ACTIVE");
    assert.equal(a.guardados[0]?.fila.receiverId, "R9");

    const b = repoFalso();
    const sinCuenta = await pedirInvitacion(deps(b.repo, mpFalso({ invitar, listar }).mp), {
      userId: 35,
      correo: "foto@ejemplo.com",
      mpUserId: "OTRA",
    });
    assert.equal(sinCuenta.ok === false && sinCuenta.codigo, "YA_INVITADO");
    assert.equal(b.guardados.length, 0);
  });

  it("si Mercado Pago responde ACTIVE de entrada, también exige la cuenta conectada", async () => {
    const { repo, guardados } = repoFalso();
    const { mp } = mpFalso({
      async invitar(correo) {
        return [{ sellerEmail: correo, receiverId: "R5", status: "ACTIVE" }];
      },
    });
    const r = await pedirInvitacion(deps(repo, mp), { userId: 35, correo: "ajeno@ejemplo.com" });
    assert.equal(r.ok === false && r.codigo, "YA_INVITADO");
    assert.equal(guardados.length, 0);
  });

  it("no deja pedir invitaciones para otra cuenta más de una vez cada 10 minutos", async () => {
    const hace5 = new Date(AHORA.getTime() - 5 * 60_000);
    const { repo } = repoFalso([guardado({ creadoEn: hace5 })]);
    const { mp, llamadas } = mpFalso();
    const r = await pedirInvitacion(deps(repo, mp), { userId: 35, correo: "otra@ejemplo.com" });
    assert.equal(r.ok === false && r.codigo, "ESPERA");
    assert.equal(llamadas.invitar, 0);
  });

  it("si no aparece en ningún lado, avisa que Mercado Pago no lo aceptó", async () => {
    const { repo, guardados } = repoFalso();
    const { mp } = mpFalso({
      async invitar() {
        return [];
      },
    });
    const r = await pedirInvitacion(deps(repo, mp), { userId: 35, correo: "foto@ejemplo.com" });
    assert.equal(r.ok === false && r.codigo, "MP_RECHAZO");
    assert.equal(guardados.length, 0);
  });

  it("si Mercado Pago falla, no guarda nada y avisa", async () => {
    const { repo, guardados } = repoFalso();
    const { mp } = mpFalso({
      async invitar() {
        throw new Error("503");
      },
    });
    const r = await pedirInvitacion(deps(repo, mp), { userId: 35, correo: "foto@ejemplo.com" });
    assert.equal(r.ok === false && r.codigo, "ERROR_MP");
    assert.equal(guardados.length, 0);
  });

  it("no deja que dos usuarios de CLF compartan la misma cuenta de Mercado Pago", async () => {
    const { repo, guardados } = repoFalso([guardado({ userId: 99, receiverId: "R1" })]);
    const { mp } = mpFalso();
    const r = await pedirInvitacion(deps(repo, mp), { userId: 35, correo: "foto@ejemplo.com" });
    assert.equal(r.ok === false && r.codigo, "CUENTA_DE_OTRO_USUARIO");
    assert.equal(guardados.length, 0);
  });
});

describe("consentimiento: actualizar el estado", () => {
  it("sin invitación pedida, devuelve SIN_PEDIR sin consultar", async () => {
    const { repo } = repoFalso();
    const { mp, llamadas } = mpFalso();
    const v = await actualizarEstado(deps(repo, mp), { userId: 35 });
    assert.equal(v.estado, "SIN_PEDIR");
    assert.equal(llamadas.consultar, 0);
  });

  it("consulta a Mercado Pago y guarda el estado nuevo", async () => {
    const { repo, estados } = repoFalso([guardado()]);
    const { mp } = mpFalso();
    const v = await actualizarEstado(deps(repo, mp), { userId: 35 });
    assert.equal(v.estado, "ACTIVE");
    assert.deepEqual(estados, [{ receiverId: "R1", estado: "ACTIVE" }]);
  });

  it("no vuelve a consultar antes de un minuto, salvo que se fuerce", async () => {
    const reciente = new Date(AHORA.getTime() - 30_000);
    const { repo } = repoFalso([guardado({ lastCheckedAt: reciente })]);
    const { mp, llamadas } = mpFalso();
    const v = await actualizarEstado(deps(repo, mp), { userId: 35 });
    assert.equal(v.estado, "PENDING");
    assert.equal(llamadas.consultar, 0);
    await actualizarEstado(deps(repo, mp), { userId: 35, forzar: true });
    assert.equal(llamadas.consultar, 1);
  });

  it("si la consulta falla, devuelve lo guardado", async () => {
    const { repo, estados } = repoFalso([guardado()]);
    const { mp } = mpFalso({
      async consultar() {
        throw new Error("timeout");
      },
    });
    const v = await actualizarEstado(deps(repo, mp), { userId: 35 });
    assert.equal(v.estado, "PENDING");
    assert.equal(estados.length, 0);
  });

  it("guarda los estados que el cobro consultó en vivo, y no lanza si la base falla", async () => {
    const { repo, estados } = repoFalso();
    await aplicarEstadosConsultados(repo, [
      { receiverId: "R1", status: "CANCELED" },
      null,
    ]);
    assert.deepEqual(estados, [{ receiverId: "R1", estado: "CANCELED" }]);
    await aplicarEstadosConsultados(
      {
        ...repo,
        async actualizarEstado() {
          throw new Error("db");
        },
      },
      [{ receiverId: "R1", status: "ACTIVE" }],
    );
  });
});
