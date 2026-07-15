/**
 * Tests: directorio público (sin DB).
 * pnpm --filter @repo/db exec tsx ../../apps/compramelafoto/lib/public/public-directory.test.ts
 */

import assert from "node:assert/strict";
import { CommunityProfileType, LabApprovalStatus, Role } from "@prisma/client";
import {
  DIRECTORY_COUNTS_KEYS,
  DIRECTORY_FORBIDDEN_FIELDS,
  DIRECTORY_LAB_PUBLIC_FIELDS,
  DIRECTORY_ORGANIZER_PUBLIC_FIELDS,
  DIRECTORY_PHOTOGRAPHER_PUBLIC_FIELDS,
  buildDirectoryCommunityCountWhere,
  buildDirectoryLabsWhere,
  buildDirectoryOrganizersWhere,
  buildDirectoryPhotographersWhere,
} from "./public-directory";

{
  const where = buildDirectoryPhotographersWhere();
  assert.deepEqual(where.role.in, [Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
  assert.equal(where.isPublicPageEnabled, true);
  assert.equal(where.isBlocked, false);
}

{
  const where = buildDirectoryLabsWhere();
  assert.equal(where.approvalStatus, LabApprovalStatus.APPROVED);
  assert.equal(where.isActive, true);
  assert.equal(where.isSuspended, false);
}

{
  const where = buildDirectoryCommunityCountWhere(
    CommunityProfileType.EVENT_VENDOR
  );
  assert.equal(where.type, CommunityProfileType.EVENT_VENDOR);
  assert.equal(where.status, "ACTIVE");
  assert.ok(where.AND);
}

{
  const where = buildDirectoryOrganizersWhere();
  assert.equal(where.isPublished, true);
  assert.deepEqual(where.user.role.in, [Role.ORGANIZER, Role.SCHOOL_ORGANIZER]);
}

{
  for (const key of DIRECTORY_COUNTS_KEYS) {
    assert.equal(typeof key, "string");
  }
  assert.ok(!DIRECTORY_PHOTOGRAPHER_PUBLIC_FIELDS.includes("email" as never));
  assert.ok(!DIRECTORY_LAB_PUBLIC_FIELDS.includes("email" as never));
  assert.ok(DIRECTORY_ORGANIZER_PUBLIC_FIELDS.includes("publicEmail"));
  assert.ok(DIRECTORY_FORBIDDEN_FIELDS.includes("mpAccessToken"));
  assert.ok(DIRECTORY_FORBIDDEN_FIELDS.includes("email"));
}

console.log("public-directory.test.ts: ok");
