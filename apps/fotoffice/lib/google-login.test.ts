import { describe, expect, it } from "vitest";
import { safeFotofficeNextPath } from "./google-login";

describe("safeFotofficeNextPath", () => {
  it("acepta paths internos", () => {
    expect(safeFotofficeNextPath("/workspace")).toBe("/workspace");
    expect(safeFotofficeNextPath("/onboarding")).toBe("/onboarding");
  });

  it("rechaza open redirects", () => {
    expect(safeFotofficeNextPath("https://evil.com")).toBeUndefined();
    expect(safeFotofficeNextPath("//evil.com")).toBeUndefined();
    expect(safeFotofficeNextPath("workspace")).toBeUndefined();
    expect(safeFotofficeNextPath("/\\evil")).toBeUndefined();
  });
});
