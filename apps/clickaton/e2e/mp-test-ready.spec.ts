import { test } from "@playwright/test";

test("Mercado Pago sandbox E2E requires explicit readiness", async ({ page: _page }, testInfo) => {
  void _page;
  testInfo.annotations.push({
    type: "BLOCKED",
    description: "Set MP_TEST_READY=1 only after readiness:mp-test returns READY_FOR_TEST.",
  });
  test.skip(
    process.env.MP_TEST_READY !== "1",
    "BLOCKED: MP_TEST_READY no configurado",
  );
});
