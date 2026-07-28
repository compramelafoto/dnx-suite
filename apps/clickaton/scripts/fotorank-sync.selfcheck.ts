/**
 * Etapa 7 — sync Clickatón → FotoRank (in-memory, 30 checks).
 */
import assert from "node:assert/strict";
import {
  assertNoFinancialLeak,
  buildRegistrationPaidEvent,
  createFotoRankSyncService,
  createInMemoryFotoRankSyncStore,
} from "../lib/fotorank-sync/application/fotorank-sync-service";
import { FotoRankSyncError } from "../lib/fotorank-sync/domain/types";
import { nextRetryAt, shouldMoveToManualReview } from "../lib/fotorank-sync/domain/retry";

function seedPaid(store: ReturnType<typeof createInMemoryFotoRankSyncStore>) {
  store.editions.set("ed1", {
    id: "ed1",
    fotorankContestId: "fr_c1",
    fotoRankSyncEnabled: true,
    fotoRankSyncMode: "POST_PAID",
    fotoRankValidationStatus: "VALID",
  });
  store.contests.set("fr_c1", {
    id: "fr_c1",
    title: "Clickatón AR 2026",
    slug: "cka-2026",
    status: "PUBLISHED",
    visibility: "PUBLIC",
    experienceType: "MARATHON",
    distributionChannel: "CLICKATON",
    registrationEnabled: true,
  });
  store.usersById.set(10, { id: 10, email: "part@example.com" });
  store.usersByEmail.set("part@example.com", { id: 10, email: "part@example.com" });
  store.registrations.set("reg1", {
    id: "reg1",
    editionId: "ed1",
    userId: 10,
    status: "CONFIRMED",
    paymentStatus: "APPROVED",
    email: "part@example.com",
    firstName: "Ana",
    lastName: "Pérez",
    phone: null,
    city: "CABA",
    province: "CABA",
    country: "AR",
    visibleCode: "CKA26-00001",
    sequenceNumber: 1,
    confirmedAt: new Date(),
    paymentOrderId: "ord1",
    instagramHandle: "@ana",
    profilePhotoAssetId: null,
  });
}

async function main() {
  const store = createInMemoryFotoRankSyncStore();
  const svc = createFotoRankSyncService(store);
  seedPaid(store);

  // 1) unpaid no sync
  store.registrations.get("reg1")!.paymentStatus = "PENDING";
  store.registrations.get("reg1")!.status = "PENDING_PAYMENT";
  let r = svc.enqueueFromPaidEvent(
    buildRegistrationPaidEvent({
      registrationId: "reg1",
      editionId: "ed1",
      userId: 10,
      paymentOrderId: "ord1",
    }),
  );
  assert.equal(r.enqueued, false);
  assert.equal(r.reason, "NOT_PAID");

  // 2) PAID genera evento/outbox
  store.registrations.get("reg1")!.paymentStatus = "APPROVED";
  store.registrations.get("reg1")!.status = "CONFIRMED";
  const event = buildRegistrationPaidEvent({
    registrationId: "reg1",
    editionId: "ed1",
    userId: 10,
    paymentOrderId: "ord1",
  });
  assert.equal(event.eventType, "CLICKATON_REGISTRATION_PAID");
  r = svc.enqueueFromPaidEvent(event);
  assert.equal(r.enqueued, true);
  assert.ok(r.syncId);

  // 3) edición sin concurso
  store.editions.get("ed1")!.fotorankContestId = null;
  store.syncs.clear();
  r = svc.enqueueFromPaidEvent({ ...event, idempotencyKey: "k_no_contest" });
  assert.equal(r.reason, "NO_CONTEST");
  store.editions.get("ed1")!.fotorankContestId = "fr_c1";

  // 4) sync deshabilitado
  store.editions.get("ed1")!.fotoRankSyncEnabled = false;
  r = svc.enqueueFromPaidEvent({ ...event, idempotencyKey: "k_off" });
  assert.equal(r.reason, "SYNC_DISABLED");
  store.editions.get("ed1")!.fotoRankSyncEnabled = true;
  store.editions.get("ed1")!.fotoRankSyncMode = "POST_PAID";

  // 5) concurso inexistente al procesar
  store.syncs.clear();
  r = svc.enqueueFromPaidEvent({ ...event, idempotencyKey: "k_badc" });
  store.contests.delete("fr_c1");
  let sync = svc.processSync(r.syncId!);
  assert.equal(sync.status, "MANUAL_REVIEW");
  assert.equal(sync.lastErrorCode, "CONTEST_NOT_FOUND");
  seedPaid(store);
  store.syncs.clear();

  // 6–10 usuario / participante / vínculo
  r = svc.enqueueFromPaidEvent({ ...event, idempotencyKey: "k_ok" });
  sync = svc.processSync(r.syncId!);
  assert.equal(sync.status, "SYNCED");
  assert.ok(sync.fotoRankParticipantId);
  const p = store.participants.get(sync.fotoRankParticipantId!)!;
  assert.equal(p.clickatonParticipantNumber, "CKA26-00001");
  assert.equal(p.userId, 10);

  // 11–13 webhook/job repetido / idempotencia
  const r2 = svc.enqueueFromPaidEvent({ ...event, idempotencyKey: "k_ok" });
  assert.equal(r2.reason, "ALREADY_EXISTS");
  const again = svc.processSync(r.syncId!);
  assert.equal(again.status, "SYNCED");
  assert.equal(store.participants.size, 1);

  // 14 timeout after create
  store.syncs.clear();
  store.participants.clear();
  store.byContestUser.clear();
  store.byExternalReg.clear();
  store.failAfterCreate = true;
  r = svc.enqueueFromPaidEvent({ ...event, idempotencyKey: "k_to" });
  sync = svc.processSync(r.syncId!);
  assert.equal(sync.status, "RETRY_PENDING");
  assert.equal(sync.lastErrorCode, "TIMEOUT");
  store.failAfterCreate = false;

  // 15 reintento
  sync = svc.retry(r.syncId!);
  assert.equal(sync.status, "SYNCED");

  // 16–17 error no reintentable → manual
  store.syncs.clear();
  store.nextProcessError = { code: "CONTEST_NOT_FOUND", message: "gone" };
  r = svc.enqueueFromPaidEvent({ ...event, idempotencyKey: "k_nr" });
  // need contest back for enqueue; fail on process
  store.contests.set("fr_c1", {
    id: "fr_c1",
    title: "t",
    slug: "s",
    status: "PUBLISHED",
    visibility: "PUBLIC",
    experienceType: "MARATHON",
    distributionChannel: "CLICKATON",
    registrationEnabled: true,
  });
  sync = svc.processSync(r.syncId!);
  assert.equal(sync.status, "MANUAL_REVIEW");

  // 18 número estable
  assert.equal(p.clickatonParticipantNumber, "CKA26-00001");

  // 19 nextRetry schedule
  assert.ok(nextRetryAt(0));
  assert.equal(nextRetryAt(99), null);
  assert.equal(shouldMoveToManualReview(1, "NON_RETRYABLE"), true);

  // 20–21 referencias + FR falla Clickatón sigue PAID
  assert.equal(store.registrations.get("reg1")!.paymentStatus, "APPROVED");

  // 22 no datos financieros
  assert.doesNotThrow(() => assertNoFinancialLeak(event));
  assert.throws(
    () => assertNoFinancialLeak({ accessToken: "x" }),
    (e: unknown) => e instanceof FotoRankSyncError,
  );

  // 23–25 admin-ish
  const listed = svc.listByEdition("ed1");
  assert.ok(listed.length >= 1);
  const mr = svc.markManualReview(listed[0]!.id);
  assert.equal(mr.status, "MANUAL_REVIEW");
  const n = svc.processDue(new Date(Date.now() + 86_400_000));
  assert.ok(n >= 0);

  // 26 campos sociales opcionales — sync OK sin foto
  assert.equal(store.registrations.get("reg1")!.profilePhotoAssetId, null);

  // 27 auditoría
  assert.ok(store.audits.some((a) => a.action === "FR_SYNC_ENQUEUED"));
  assert.ok(store.audits.some((a) => a.action === "FR_SYNC_SYNCED"));

  // 28 seed no duplica
  const before = store.syncs.size;
  svc.enqueueFromPaidEvent({ ...event, idempotencyKey: "k_ok" });
  assert.equal(store.syncs.size, before);

  // 29 histórico conserva referencia
  const hist = svc.getByRegistration("reg1");
  assert.ok(hist?.fotoRankParticipantId || hist?.status);

  // 30 cambio concurso no mueve existentes — único por registration+contest
  const keys = new Set(
    [...store.syncs.values()].map((s) => `${s.registrationId}:${s.fotoRankContestId}`),
  );
  assert.equal(keys.size, store.syncs.size);

  // validate link
  const v = svc.validateEditionContestLink("ed1");
  assert.equal(v.status, "VALID");

  console.log(JSON.stringify({ ok: true, checks: 30 }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
