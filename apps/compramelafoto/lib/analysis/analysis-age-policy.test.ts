import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  ANALYSIS_SUSPENDED_BY_AGE_PREFIX,
  analysisSuspendedByAgeMessage,
  photoCreatedAtCutoff,
  resolveMaxPhotoAgeDays,
} from "./analysis-age-policy";

describe("analysis-age-policy", () => {
  const prev = process.env.ANALYSIS_MAX_PHOTO_AGE_DAYS;

  afterEach(() => {
    if (prev == null) delete process.env.ANALYSIS_MAX_PHOTO_AGE_DAYS;
    else process.env.ANALYSIS_MAX_PHOTO_AGE_DAYS = prev;
  });

  it("default 7 días", () => {
    delete process.env.ANALYSIS_MAX_PHOTO_AGE_DAYS;
    expect(resolveMaxPhotoAgeDays()).toBe(7);
  });

  it("off desactiva el tope", () => {
    process.env.ANALYSIS_MAX_PHOTO_AGE_DAYS = "off";
    expect(resolveMaxPhotoAgeDays()).toBeNull();
  });

  it("mensaje de suspensión", () => {
    expect(analysisSuspendedByAgeMessage(7)).toContain(
      ANALYSIS_SUSPENDED_BY_AGE_PREFIX
    );
    expect(analysisSuspendedByAgeMessage(7)).toContain("7 días");
  });

  it("cutoff de createdAt", () => {
    const now = new Date("2026-08-05T12:00:00.000Z");
    const cutoff = photoCreatedAtCutoff(7, now);
    expect(cutoff.toISOString()).toBe("2026-07-29T12:00:00.000Z");
  });
});
