/**
 * Shared TEST helpers for Clickatón QA2 (no real PII).
 * Identities must use *.test or +test@ domains.
 */

export const QA_TEST_IDENTITIES = {
  paidApproved: {
    email: "qa2.paid.approved@clickaton.staging.test",
    firstName: "QA2",
    lastName: "PaidApproved",
  },
  paidPending: {
    email: "qa2.paid.pending@clickaton.staging.test",
    firstName: "QA2",
    lastName: "PaidPending",
  },
  paidRejected: {
    email: "qa2.paid.rejected@clickaton.staging.test",
    firstName: "QA2",
    lastName: "PaidRejected",
  },
  freeTicket: {
    email: "qa2.free.ticket@clickaton.staging.test",
    firstName: "QA2",
    lastName: "FreeTicket",
  },
  holdExpired: {
    email: "qa2.hold.expired@clickaton.staging.test",
    firstName: "QA2",
    lastName: "HoldExpired",
  },
  mobile: {
    email: "qa2.mobile.journey@clickaton.staging.test",
    firstName: "QA2",
    lastName: "Mobile",
  },
} as const;

export const PILOT_EDITION_SLUG = "piloto-test-11b";
