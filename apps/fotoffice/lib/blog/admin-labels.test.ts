import { describe, expect, it } from "vitest";
import { blogDisplayStatus, formatBlogDateTime } from "./admin-labels";

const now = new Date("2026-10-05T15:00:00Z");

describe("blogDisplayStatus", () => {
  it("publicado con fecha futura se muestra como programado", () => {
    expect(blogDisplayStatus("PUBLISHED", "2026-10-12T13:00:00Z", now)).toBe("SCHEDULED");
  });
  it("publicado con fecha pasada o sin fecha sigue publicado", () => {
    expect(blogDisplayStatus("PUBLISHED", "2026-09-01T13:00:00Z", now)).toBe("PUBLISHED");
    expect(blogDisplayStatus("PUBLISHED", null, now)).toBe("PUBLISHED");
  });
  it("un borrador con fecha futura sigue siendo borrador", () => {
    expect(blogDisplayStatus("DRAFT", "2026-10-12T13:00:00Z", now)).toBe("DRAFT");
  });
});

describe("formatBlogDateTime", () => {
  it("muestra la hora argentina aunque el servidor corra en UTC", () => {
    expect(formatBlogDateTime("2026-10-12T13:00:00Z")).toContain("10:00");
  });
});
