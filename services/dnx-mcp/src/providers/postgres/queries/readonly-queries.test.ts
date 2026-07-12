import { describe, expect, it } from "vitest";
import { assertReadOnlyQuery } from "./readonly-queries.js";

describe("assertReadOnlyQuery", () => {
  it("permite SELECT", () => {
    expect(() => {
      assertReadOnlyQuery("SELECT 1", "ping");
    }).not.toThrow();
  });

  it("rechaza INSERT", () => {
    expect(() => {
      assertReadOnlyQuery("INSERT INTO users VALUES (1)", "write");
    }).toThrow(/no permitida|debe ser SELECT/);
  });

  it("rechaza UPDATE", () => {
    expect(() => {
      assertReadOnlyQuery("UPDATE users SET name = 'x'", "write");
    }).toThrow();
  });

  it("rechaza DELETE", () => {
    expect(() => {
      assertReadOnlyQuery("DELETE FROM users", "write");
    }).toThrow();
  });

  it("rechaza DROP aunque empiece con SELECT", () => {
    expect(() => {
      assertReadOnlyQuery("SELECT 1; DROP TABLE users", "malicious");
    }).toThrow();
  });
});
