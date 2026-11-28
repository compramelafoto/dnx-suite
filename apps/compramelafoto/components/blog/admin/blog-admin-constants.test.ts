import { describe, expect, it } from "vitest";
import { formatBlogAdminDate, formatBlogAdminDateTime } from "./blog-admin-constants";

// 28/11/2026 01:15 en hora universal = 27/11/2026 22:15 en Argentina.
const NOCHE_ARGENTINA = new Date("2026-11-28T01:15:50Z");

describe("fechas del blog en hora de Argentina", () => {
  it("la fecha no salta al día siguiente por la hora universal", () => {
    expect(formatBlogAdminDate(NOCHE_ARGENTINA)).toBe("27/11/2026");
  });
  it("la hora es la de Argentina", () => {
    expect(formatBlogAdminDateTime(NOCHE_ARGENTINA)).toMatch(/^27\/11\/2026, 10:15\sp\.\sm\./);
  });
  it("sin fecha muestra un guion", () => {
    expect(formatBlogAdminDate(null)).toBe("—");
  });
});
