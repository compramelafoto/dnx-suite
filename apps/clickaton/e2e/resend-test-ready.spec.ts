import { test } from "@playwright/test";

test("Resend staging E2E requires explicit readiness", async ({ page: _page }, testInfo) => {
  void _page;
  testInfo.annotations.push({
    type: "BLOCKED",
    description:
      "Set RESEND_TEST_READY=1 only after readiness:resend-staging returns READY_FOR_SAFE_TEST.",
  });
  test.skip(
    process.env.RESEND_TEST_READY !== "1",
    "BLOCKED: RESEND_TEST_READY no configurado",
  );
});
