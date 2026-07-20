/**
 * Selfcheck UI inscripciones 10D3E — in-memory, sin Neon.
 * Modo: sin entidad Order separada (solo Registration + soft payment refs).
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createAdminRegistrationAuthorization } from "../lib/admin-registration/auth/admin-registration-auth";
import { createAdminRegistrationService } from "../lib/admin-registration/application/registration-service";
import {
  createInMemoryAdminRegistrationRepository,
  createInMemoryAdminRegistrationStore,
  seedAdminRegistration,
} from "../lib/admin-registration/infrastructure/in-memory-registration-repository";
import {
  setAdminRegistrationActorForTests,
  setAdminRegistrationServiceForTests,
} from "../lib/admin-registration/actions/runtime";
import {
  addInternalNoteAction,
  getRegistrationAction,
  listRegistrationsAction,
  setRegistrationStatusAction,
  updateRegistrationAssignmentAction,
} from "../lib/admin-registration/actions/registrations";
import { availableActionsFor } from "../lib/admin-registration/domain/transitions";
import { maskDocument } from "../lib/admin-registration/ui/status-labels";
import { adminRoutes } from "../config/admin/navigation";
import type { AdminRegistrationActor } from "../lib/admin-registration/domain/types";

const ROOT = join(process.cwd());

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`admin-registrations-orders-ui.selfcheck: ${msg}`);
}

function file(rel: string) {
  const p = join(ROOT, rel);
  assert(existsSync(p), `missing ${rel}`);
  return readFileSync(p, "utf8");
}

function form(data: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(data)) fd.set(k, v);
  return fd;
}

async function main() {
  assert(adminRoutes.registrations === "/admin/inscripciones", "nav registrations");
  assert(!("orders" in adminRoutes), "no orders route in nav");

  file("app/admin/(panel)/inscripciones/page.tsx");
  file("app/admin/(panel)/inscripciones/[registrationId]/page.tsx");
  assert(!existsSync(join(ROOT, "app/admin/(panel)/ordenes")), "no ordenes folder");

  const listPage = file("app/admin/(panel)/inscripciones/page.tsx");
  assert(listPage.includes("listRegistrationsAction"), "list action");
  assert(listPage.includes("ClickatonRegistration"), "model note");
  assert(!listPage.includes('href="/admin/ordenes"'), "no broken orders link");

  const detailPage = file("app/admin/(panel)/inscripciones/[registrationId]/page.tsx");
  assert(detailPage.includes("RegistrationTransitionButtons"), "transitions");
  assert(detailPage.includes("soft refs"), "soft payment");

  for (const rel of [
    "components/admin/registrations/RegistrationTransitionButtons.tsx",
    "components/admin/registrations/InternalNoteForm.tsx",
    "components/admin/registrations/AssignmentForm.tsx",
  ]) {
    const src = file(rel);
    assert(src.includes('"use client"'), `${rel} client`);
    assert(!src.includes("@prisma/client"), `${rel} no prisma`);
    assert(!src.includes("@repo/db"), `${rel} no db`);
    assert(!src.includes("createPrismaAdminRegistrationRepository"), `${rel} no repo`);
    assert(!src.includes("createAdminRegistrationService"), `${rel} no service`);
  }

  const actionsSrc = file("lib/admin-registration/actions/registrations.ts");
  assert(!/hard.?delete|deleteRegistration/i.test(actionsSrc), "no hard delete");
  assert(!actionsSrc.includes("method: \"GET\""), "no get mutate");

  assert(maskDocument("30123456") === "••••3456", "mask doc");
  assert(maskDocument(null) === "—", "mask null");

  const store = createInMemoryAdminRegistrationStore();
  store.ticketTypes.set("tt1", {
    id: "tt1",
    editionId: "ed1",
    venueId: "vn1",
    capacity: 2,
    isActive: true,
  });
  store.ticketTypes.set("tt2", {
    id: "tt2",
    editionId: "ed1",
    venueId: null,
    capacity: 10,
    isActive: true,
  });
  store.venues.set("vn1", { id: "vn1", editionId: "ed1", isActive: true });
  store.venues.set("vn_bad", { id: "vn_bad", editionId: "ed2", isActive: true });

  const expires = new Date(Date.now() + 60_000);
  const reg = seedAdminRegistration(store, {
    editionId: "ed1",
    ticketTypeId: "tt1",
    venueId: "vn1",
    userId: 9,
    firstName: "Ana",
    lastName: "Pérez",
    email: "ana@example.com",
    documentNumber: "30123456",
    status: "PENDING_PAYMENT",
    paymentStatus: "PENDING",
    totalAmount: 4_000_000,
    visibleCode: "COR26-00001",
    paymentOrderId: null,
    items: [
      {
        id: "item1",
        productId: "p1",
        productVariantId: "v1",
        nameSnapshot: "Remera M",
        skuSnapshot: "TEE-M",
        quantity: 1,
        unitPriceAmount: 0,
        totalPriceAmount: 0,
        currency: "ARS",
        isIncluded: true,
      },
    ],
    capacityHold: {
      id: "ch1",
      status: "ACTIVE",
      expiresAt: expires,
      consumedAt: null,
      releasedAt: null,
      ticketTypeId: "tt1",
    },
    stockHolds: [
      {
        id: "sh1",
        productVariantId: "v1",
        quantity: 1,
        status: "ACTIVE",
        expiresAt: expires,
      },
    ],
  });

  // second confirmed to leave 1 slot (capacity 2)
  seedAdminRegistration(store, {
    id: "reg_confirmed",
    editionId: "ed1",
    ticketTypeId: "tt1",
    userId: 10,
    firstName: "Bob",
    lastName: "Lopez",
    email: "bob@example.com",
    status: "CONFIRMED",
    paymentStatus: "APPROVED",
    totalAmount: 0,
  });

  const repo = createInMemoryAdminRegistrationRepository(store);
  const svc = createAdminRegistrationService({
    repo,
    auth: createAdminRegistrationAuthorization(),
  });
  setAdminRegistrationServiceForTests(svc);

  const admin: AdminRegistrationActor = {
    userId: 1,
    email: "admin@example.com",
    globalRole: "SUPER_ADMIN",
  };
  const stranger: AdminRegistrationActor = {
    userId: 2,
    email: "nobody@example.com",
    globalRole: "USER",
  };

  setAdminRegistrationActorForTests(null);
  const unauth = await listRegistrationsAction({ editionId: "ed1" });
  assert(unauth.ok === false && unauth.code === "UNAUTHORIZED", "no session");

  setAdminRegistrationActorForTests(stranger);
  const forbidden = await listRegistrationsAction({ editionId: "ed1" });
  assert(forbidden.ok === false && forbidden.code === "FORBIDDEN", "no permission");

  setAdminRegistrationActorForTests(admin);
  const listed = await listRegistrationsAction({ editionId: "ed1" });
  assert(listed.ok && listed.data?.length === 2, "list");

  const filtered = await listRegistrationsAction({
    editionId: "ed1",
    status: "PENDING_PAYMENT",
    query: "ana",
  });
  assert(filtered.ok && filtered.data?.length === 1, "filters");

  const detail = await getRegistrationAction(reg.id);
  assert(detail.ok && detail.data?.items[0]?.nameSnapshot === "Remera M", "detail items");
  assert(detail.data?.commercial.kind === "registration_with_soft_payment_refs", "commercial");
  assert(detail.data?.documentNumber === "30123456", "full doc in detail");

  const stockBefore = store.rows.get(reg.id)!.stockHolds[0]!.quantity;

  assert(availableActionsFor("PENDING_PAYMENT").includes("confirm_admin"), "actions pending");
  assert(availableActionsFor("PENDING_PAYMENT").includes("cancel"), "cancel pending");

  const badTransition = await setRegistrationStatusAction(reg.id, "disqualify", "x");
  assert(badTransition.ok === false, "invalid transition");

  const noReason = await setRegistrationStatusAction(reg.id, "confirm_admin", "ab");
  assert(noReason.ok === false && noReason.code === "VALIDATION", "reason required");

  const confirmed = await setRegistrationStatusAction(
    reg.id,
    "confirm_admin",
    "Cortesía operativa",
  );
  assert(confirmed.ok && confirmed.data?.status === "CONFIRMED", "confirm");
  assert(confirmed.data?.capacityHold?.status === "CONSUMED", "hold consumed");
  assert(
    store.rows.get(reg.id)!.stockHolds[0]!.status === "CONSUMED",
    "stock hold consumed",
  );
  assert(
    store.rows.get(reg.id)!.stockHolds[0]!.quantity === stockBefore,
    "stock qty unchanged by admin read/transition (hold status only)",
  );

  const cancel = await setRegistrationStatusAction(
    confirmed.data!.id,
    "cancel",
    "Solicitud del participante",
  );
  assert(cancel.ok && cancel.data?.status === "CANCELLED", "cancel");

  const reactivate = await setRegistrationStatusAction(
    cancel.data!.id,
    "reactivate",
    "Error administrativo",
  );
  assert(reactivate.ok && reactivate.data?.status === "DRAFT", "reactivate");

  const note = await addInternalNoteAction(
    reg.id,
    undefined,
    form({ note: "Llamar mañana" }),
  );
  assert(note.ok && note.data?.hasInternalNotes, "internal note");

  const assignBad = await updateRegistrationAssignmentAction(
    reg.id,
    undefined,
    form({ ticketTypeId: "tt2", venueId: "vn_bad", reason: "cambio sede" }),
  );
  assert(assignBad.ok === false, "edition mismatch venue");

  // DRAFT allows assignment
  const assignOk = await updateRegistrationAssignmentAction(
    reg.id,
    undefined,
    form({ ticketTypeId: "tt2", venueId: "", reason: "Cambio de entrada" }),
  );
  assert(assignOk.ok && assignOk.data?.ticketTypeId === "tt2", "assignment");

  // capacity exceeded path
  store.rows.get(reg.id)!.status = "PENDING_PAYMENT";
  store.rows.get(reg.id)!.ticketTypeId = "tt1";
  store.rows.get(reg.id)!.capacityHold = {
    id: "ch2",
    status: "ACTIVE",
    expiresAt: expires,
    consumedAt: null,
    releasedAt: null,
    ticketTypeId: "tt1",
  };
  // fill capacity: confirmed=1 already + active hold of another pending
  seedAdminRegistration(store, {
    id: "reg_hold2",
    editionId: "ed1",
    ticketTypeId: "tt1",
    userId: 11,
    firstName: "Cara",
    lastName: "X",
    email: "cara@example.com",
    status: "PENDING_PAYMENT",
    paymentStatus: "PENDING",
    capacityHold: {
      id: "ch3",
      status: "ACTIVE",
      expiresAt: expires,
      consumedAt: null,
      releasedAt: null,
      ticketTypeId: "tt1",
    },
  });
  // confirmed 1 + active holds 2 (reg + reg_hold2) - selfHold for reg = 1 → used = 1 + (2-1) = 2 >= capacity 2
  const capFail = await setRegistrationStatusAction(reg.id, "confirm_admin", "forzar cupo");
  assert(capFail.ok === false && capFail.code === "CAPACITY_EXCEEDED", "capacity");

  assert(
    typeof unauth.message === "string" &&
      !String(unauth.message).toLowerCase().includes("prisma"),
    "no prisma error",
  );

  setAdminRegistrationServiceForTests(null);
  setAdminRegistrationActorForTests(undefined);

  console.log("clickaton admin-registrations-orders-ui.selfcheck: ok (partial: no Order entity)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
