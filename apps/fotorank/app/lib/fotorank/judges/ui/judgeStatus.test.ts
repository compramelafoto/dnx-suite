/**
 * La lista de jurados mostraba ACTIVE y SUSPENDED, y las invitaciones el
 * estado crudo. Son palabras de la base filtrándose a la pantalla.
 *
 * Sigue la forma de public-ux/participant-status.ts, que ya existía: mismo
 * StatusTone, mismo PresentedStatus. Dos formas de lo mismo sería peor que una.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  presentJudgeAccountStatus,
  presentJudgeInvitationStatus,
  presentJudgeAssignmentStatus,
  presentJudgeDirectoryInviteStatus,
  presentJudgeMembershipStatus,
  presentJudgeAssignmentType,
  presentJudgeReviewStatus,
  presentJudgeMethodType,
} from "./judgeStatus";

const CASOS = {
  presentJudgeAccountStatus: ["INVITED", "PENDING_REGISTRATION", "ACTIVE", "SUSPENDED", "DISABLED"],
  presentJudgeInvitationStatus: ["DRAFT", "SENT", "OPENED", "ACCEPTED", "REJECTED", "EXPIRED", "REVOKED"],
  presentJudgeAssignmentStatus: [
    "ASSIGNED", "INVITATION_SENT", "ACCEPTED", "REJECTED",
    "IN_PROGRESS", "COMPLETED", "EXTENDED", "REPLACED_BY_BACKUP",
  ],
  presentJudgeDirectoryInviteStatus: ["PENDING", "ACCEPTED", "REJECTED", "CANCELLED", "EXPIRED", "ARCHIVED"],
  presentJudgeMembershipStatus: ["ACTIVE", "INVITED", "DISABLED"],
  presentJudgeAssignmentType: ["PRIMARY", "BACKUP"],
  presentJudgeReviewStatus: ["PENDING", "APPROVED", "REJECTED"],
  presentJudgeMethodType: [
    "SCORE_1_5", "SCORE_1_10", "SCORE_0_100", "YES_NO",
    "FAVORITES_SELECTION", "SELECTION_WITH_QUOTA", "CRITERIA_BASED",
  ],
} as const;

const FUNCIONES = {
  presentJudgeAccountStatus,
  presentJudgeInvitationStatus,
  presentJudgeAssignmentStatus,
  presentJudgeDirectoryInviteStatus,
  presentJudgeMembershipStatus,
  presentJudgeAssignmentType,
  presentJudgeReviewStatus,
  presentJudgeMethodType,
};

test("cada valor de cada enum tiene un texto en castellano", () => {
  for (const [nombre, valores] of Object.entries(CASOS)) {
    const fn = FUNCIONES[nombre as keyof typeof FUNCIONES];
    for (const v of valores) {
      const p = fn(v);
      assert.ok(p.label.length > 0, `${nombre}(${v}) sin texto`);
      assert.notEqual(p.label, v, `${nombre}(${v}) devuelve el enum crudo`);
      assert.ok(!/^[A-Z_]+$/.test(p.label), `${nombre}(${v}) parece un enum: ${p.label}`);
      assert.ok(!p.label.includes("_"), `${nombre}(${v}) tiene guión bajo`);
    }
  }
});

test("todo estado explica qué significa, sin jerga de la base", () => {
  for (const [nombre, valores] of Object.entries(CASOS)) {
    const fn = FUNCIONES[nombre as keyof typeof FUNCIONES];
    for (const v of valores) {
      const d = fn(v).description;
      assert.ok(d.length > 0, `${nombre}(${v}) sin explicación`);
      for (const jerga of ["ACCEPTED", "PENDING", "NULL", "enum", "status"]) {
        assert.ok(!d.includes(jerga), `${nombre}(${v}) nombra "${jerga}" en la explicación`);
      }
    }
  }
});

test("los que exigen atención no se pintan como si todo estuviera bien", () => {
  assert.equal(presentJudgeAccountStatus("ACTIVE").tone, "success");
  assert.equal(presentJudgeAccountStatus("SUSPENDED").tone, "danger");
  assert.equal(presentJudgeInvitationStatus("EXPIRED").tone, "warning");
  assert.equal(presentJudgeAssignmentStatus("IN_PROGRESS").tone, "primary");
  assert.equal(presentJudgeAssignmentStatus("COMPLETED").tone, "success");
  assert.equal(presentJudgeReviewStatus("REJECTED").tone, "danger");
  assert.equal(presentJudgeReviewStatus("APPROVED").tone, "success");
});

test("un valor desconocido no rompe la pantalla", () => {
  const p = presentJudgeAccountStatus("LO_QUE_SEA");
  assert.equal(p.tone, "neutral");
  assert.ok(p.label.length > 0);
  assert.ok(!p.label.includes("LO_QUE_SEA"));
});

test("los textos concretos que se acordaron", () => {
  assert.equal(presentJudgeAccountStatus("ACTIVE").label, "Activo");
  assert.equal(presentJudgeAccountStatus("SUSPENDED").label, "Suspendido");
  assert.equal(presentJudgeAccountStatus("INVITED").label, "Invitado");
  assert.equal(presentJudgeAccountStatus("PENDING_REGISTRATION").label, "Falta que se registre");
  assert.equal(presentJudgeAssignmentStatus("INVITATION_SENT").label, "Invitación enviada");
  assert.equal(presentJudgeAssignmentStatus("IN_PROGRESS").label, "Evaluando");
  assert.equal(presentJudgeAssignmentStatus("REPLACED_BY_BACKUP").label, "Reemplazado por el suplente");
  assert.equal(presentJudgeAssignmentType("PRIMARY").label, "Titular");
  assert.equal(presentJudgeAssignmentType("BACKUP").label, "Suplente");
  assert.equal(presentJudgeReviewStatus("PENDING").label, "En revisión");
  assert.equal(presentJudgeMethodType("SCORE_1_10").label, "Puntaje del 1 al 10");
  assert.equal(presentJudgeMethodType("YES_NO").label, "Pasa o no pasa");
});

test("usa los mismos tonos que el resto de la aplicación", () => {
  const validos = new Set(["neutral", "primary", "success", "warning", "danger"]);
  for (const [nombre, valores] of Object.entries(CASOS)) {
    const fn = FUNCIONES[nombre as keyof typeof FUNCIONES];
    for (const v of valores) {
      assert.ok(validos.has(fn(v).tone), `${nombre}(${v}) usa un tono ajeno: ${fn(v).tone}`);
    }
  }
});
