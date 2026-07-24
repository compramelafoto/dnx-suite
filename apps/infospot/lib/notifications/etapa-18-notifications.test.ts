/**
 * Tests Etapa 18 — permisos de notificación CLF + reglas de apertura.
 * pnpm --filter infospot test:etapa-18
 */

import assert from "node:assert/strict";
import {
  canNotifyClfPhotographerCall,
  canProvisionClfPhotographerCall,
  type InfoSpotPermissionSubject,
} from "@repo/db";
import {
  shouldEmitPhotographerCallOpened,
  evaluateCampaignPolicy,
} from "@repo/notifications";
import { isCallOpenForNotify } from "./call-open";

function subject(
  partial: Partial<InfoSpotPermissionSubject> & { role: string },
): InfoSpotPermissionSubject {
  return {
    status: "ACTIVE",
    canPublish: false,
    publicationPolicy: "REQUIRES_APPROVAL",
    canProvisionClfPhotographerCall: false,
    canNotifyClfPhotographerCall: false,
    isSuperAdmin: false,
    ...partial,
  };
}

// 17. Director puede enviar
{
  const director = subject({ role: "INFOSPOT_DIRECTOR" });
  assert.equal(canNotifyClfPhotographerCall(director), true);
}

// 18. Usuario con permiso puede enviar
{
  const redactor = subject({
    role: "INFOSPOT_REDACTOR",
    canNotifyClfPhotographerCall: true,
  });
  assert.equal(canNotifyClfPhotographerCall(redactor), true);
}

// 19. Provisioning sin notify no puede enviar
{
  const onlyProvision = subject({
    role: "INFOSPOT_REDACTOR",
    canProvisionClfPhotographerCall: true,
    canNotifyClfPhotographerCall: false,
  });
  assert.equal(canProvisionClfPhotographerCall(onlyProvision), true);
  assert.equal(canNotifyClfPhotographerCall(onlyProvision), false);
}

// 20-21. Sin permiso
{
  const none = subject({ role: "INFOSPOT_REDACTOR" });
  assert.equal(canNotifyClfPhotographerCall(none), false);
}

// 22-23. Otorgar / retirar (simulado por flag persistido)
{
  const granted = subject({
    role: "INFOSPOT_REDACTOR",
    canNotifyClfPhotographerCall: true,
  });
  const revoked = subject({
    role: "INFOSPOT_REDACTOR",
    canNotifyClfPhotographerCall: false,
  });
  assert.equal(canNotifyClfPhotographerCall(granted), true);
  assert.equal(canNotifyClfPhotographerCall(revoked), false);
}

// 24. Borrador no genera evento
assert.equal(
  shouldEmitPhotographerCallOpened({
    previousProvisioningStatus: "NOT_REQUESTED",
    nextProvisioningStatus: "DRAFT",
    enabled: true,
    visibility: "PUBLIC",
    joinPolicy: "OPEN",
    desiredClfStatus: "ACTIVE",
    clfEventId: null,
  }),
  false,
);

// 25. Cerrada no permite campaña
{
  const policy = evaluateCampaignPolicy({
    campaignsForSourceEntity: 0,
    campaignsByActorToday: 0,
    eligibleCount: 10,
    actorIsDirectorOrSuperAdmin: true,
    callOpen: false,
    callExpired: false,
  });
  assert.equal(policy.ok, false);
}

// 26-27. Apertura emite una vez; abrir ≠ enviar (solo evento)
assert.equal(
  shouldEmitPhotographerCallOpened({
    previousProvisioningStatus: "NOT_REQUESTED",
    nextProvisioningStatus: "PROVISIONED",
    enabled: true,
    visibility: "PUBLIC",
    joinPolicy: "OPEN",
    desiredClfStatus: "ACTIVE",
    clfEventId: 1,
  }),
  true,
);
assert.equal(
  shouldEmitPhotographerCallOpened({
    previousProvisioningStatus: "PROVISIONED",
    nextProvisioningStatus: "PROVISIONED",
    enabled: true,
    visibility: "PUBLIC",
    joinPolicy: "OPEN",
    desiredClfStatus: "ACTIVE",
    clfEventId: 1,
  }),
  false,
);

// UI helper: call open detection
assert.equal(
  isCallOpenForNotify({
    enabled: true,
    provisioningStatus: "PROVISIONED",
    desiredClfStatus: "ACTIVE",
    clfEventId: 9,
    publicUrl: "https://example.com/e/x",
    eventEnded: false,
    missingGeoref: false,
  }),
  true,
);
assert.equal(
  isCallOpenForNotify({
    enabled: true,
    provisioningStatus: "PROVISIONED",
    desiredClfStatus: "CLOSED",
    clfEventId: 9,
    publicUrl: "https://example.com/e/x",
    eventEnded: false,
    missingGeoref: false,
  }),
  false,
);

console.log("etapa-18-notifications.test.ts: OK");
