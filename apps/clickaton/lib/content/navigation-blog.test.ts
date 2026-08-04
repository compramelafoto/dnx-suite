import assert from "node:assert/strict";
import test from "node:test";
import { footerNavigation, mainNavigation, routes } from "../../config/navigation";

test("el Blog es descubrible en navegación pública y footer", () => {
  assert.equal(routes.blog, "/blog");
  assert.ok(mainNavigation.some((item) => item.href === routes.blog && item.label === "Blog"));
  assert.ok(footerNavigation.some((item) => item.href === routes.blog && item.label === "Blog"));
});
