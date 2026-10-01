import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { RegistrationListMobileCard } from "./RegistrationListMobileCard";
import type { AdminRegistrationListItem } from "@/lib/admin-registration/domain/types";

function fila(overrides: Partial<AdminRegistrationListItem> = {}): AdminRegistrationListItem {
  return {
    id: "reg-1",
    editionId: "ed-1",
    venueId: null,
    ticketTypeId: "tt-1",
    status: "CONFIRMED",
    paymentStatus: "APPROVED",
    visibleCode: "0042",
    firstName: "Daniel",
    lastName: "Cuart",
    email: "daniel@example.test",
    documentNumber: null,
    currency: "ARS",
    totalAmount: 100000,
    itemCount: 1,
    includedProductLabel: "Remera",
    shirtSizeLabel: "L",
    itemFulfillmentStatus: "PENDING",
    paymentOrderId: null,
    holdExpiresAt: null,
    confirmedAt: null,
    cancelledAt: null,
    createdAt: new Date("2026-09-22T10:00:00Z"),
    updatedAt: new Date("2026-09-22T10:00:00Z"),
    hasInternalNotes: false,
    fotoRankParticipantId: null,
    fotoRankSyncStatus: null,
    fotoRankSyncedAt: null,
    instagramHandle: null,
    profilePhotoAssetId: null,
    welcomeCardId: null,
    welcomeCardStatus: null,
    welcomeCardAssetId: null,
    welcomePublicationStatus: null,
    ...overrides,
  } as AdminRegistrationListItem;
}

describe("la tarjeta del listado en el teléfono", () => {
  it("un regalo sin activar no se lee como si el comprador participara", () => {
    const html = renderToStaticMarkup(
      <RegistrationListMobileCard row={fila({ status: "GIFT_AWAITING_REDEMPTION" })} />,
    );
    assert.match(html, /A designar/);
    assert.match(html, /Lo regaló Daniel Cuart/);
    assert.match(html, /Regalo sin activar/);
    // Sin talle elegido todavía: prometerlo sería inventar una tarea.
    assert.doesNotMatch(html, /Talle L/);
  });

  it("una inscripción común se sigue viendo igual que antes", () => {
    const html = renderToStaticMarkup(<RegistrationListMobileCard row={fila()} />);
    assert.match(html, /Daniel Cuart/);
    assert.match(html, /Talle L/);
    assert.doesNotMatch(html, /A designar/);
  });
});
