/**
 * Invitar a un jurado desde Clickatón escribe en el padrón maestro, nunca en la
 * copia local, y nunca crea una cuenta con contraseña: eso lo hace la persona
 * al aceptar. Sin padrón configurado, avisa en vez de inventar nada.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { inviteJudge, validateJudgeEmail, type DirectoryPrisma } from "./service";

const BASE = {
  organizationId: "org-1",
  contestId: "contest-1",
  sentByUserId: 1,
};

function prismaFalso(opciones: {
  cuenta?: { id: string } | null;
  pendiente?: { id: string } | null;
  alCrear?: (args: { data: Record<string, unknown> }) => void;
}): DirectoryPrisma {
  return {
    fotorankJudgeAccount: {
      findUnique: async () => opciones.cuenta ?? null,
    },
    fotorankJudgeInvitation: {
      findFirst: async () => opciones.pendiente ?? null,
      create: async (args) => {
        opciones.alCrear?.(args);
        return { id: "inv-1" };
      },
    },
  };
}

test("un email inválido se rechaza antes de tocar la base", async () => {
  const r = await inviteJudge({ ...BASE, email: "no-es-un-email", prisma: null });
  assert.equal(r.ok === false && r.reason, "INVALID_EMAIL");
});

test("sin padrón configurado avisa y no crea nada local", async () => {
  const r = await inviteJudge({ ...BASE, email: "jurado@ejemplo.com", prisma: null });
  assert.equal(r.ok === false && r.reason, "NOT_CONFIGURED");
});

test("no se invita dos veces al mismo concurso", async () => {
  const r = await inviteJudge({
    ...BASE,
    email: "jurado@ejemplo.com",
    prisma: prismaFalso({ pendiente: { id: "inv-previa" } }),
  });
  assert.equal(r.ok === false && r.reason, "ALREADY_INVITED");
});

test("una invitación nueva devuelve el token una sola vez", async () => {
  let creado: Record<string, unknown> = {};
  const r = await inviteJudge({
    ...BASE,
    email: "  Jurado@Ejemplo.COM ",
    prisma: prismaFalso({ alCrear: (args) => (creado = args.data) }),
  });
  assert.equal(r.ok, true);
  assert.ok(r.ok === true && r.token.length > 20);
  // El email se guarda normalizado: si no, el mismo jurado entra dos veces.
  assert.equal(creado.email, "jurado@ejemplo.com");
});

test("el token en claro nunca se guarda", async () => {
  let creado: Record<string, unknown> = {};
  const r = await inviteJudge({
    ...BASE,
    email: "jurado@ejemplo.com",
    prisma: prismaFalso({ alCrear: (args) => (creado = args.data) }),
  });
  const token = r.ok === true ? r.token : "";
  assert.ok(!JSON.stringify(creado).includes(token), "se guardó el token en claro");
  assert.equal(String(creado.tokenHash).length, 64);
});

test("la invitación nunca escribe una contraseña", async () => {
  let creado: Record<string, unknown> = {};
  await inviteJudge({
    ...BASE,
    email: "jurado@ejemplo.com",
    prisma: prismaFalso({ alCrear: (args) => (creado = args.data) }),
  });
  assert.ok(!("passwordHash" in creado), "la invitación no crea credenciales");
  assert.equal(creado.invitationStatus, "SENT");
});

test("si ya tiene cuenta, la invitación la referencia en vez de duplicarla", async () => {
  let creado: Record<string, unknown> = {};
  const r = await inviteJudge({
    ...BASE,
    email: "jurado@ejemplo.com",
    prisma: prismaFalso({
      cuenta: { id: "j-existente" },
      alCrear: (args) => (creado = args.data),
    }),
  });
  assert.equal(r.ok === true && r.judgeAccountId, "j-existente");
  assert.equal(creado.judgeAccountId, "j-existente");
});

test("la invitación vence", async () => {
  let creado: Record<string, unknown> = {};
  const ahora = new Date("2026-09-19T12:00:00.000Z");
  await inviteJudge({
    ...BASE,
    email: "jurado@ejemplo.com",
    now: ahora,
    prisma: prismaFalso({ alCrear: (args) => (creado = args.data) }),
  });
  const vence = creado.expiresAt as Date;
  assert.ok(vence.getTime() > ahora.getTime(), "nace vencida");
  assert.ok(
    vence.getTime() - ahora.getTime() <= 15 * 24 * 60 * 60 * 1000,
    "dura demasiado",
  );
});

test("el email se normaliza a minúsculas y sin espacios", () => {
  assert.equal(validateJudgeEmail("  Jurado@Ejemplo.COM "), "jurado@ejemplo.com");
  assert.equal(validateJudgeEmail("roto@"), null);
  assert.equal(validateJudgeEmail(""), null);
});
