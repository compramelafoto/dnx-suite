import { describe, expect, it } from "vitest";
import { PrismaForbiddenCommandError } from "../errors.js";
import { validatePrismaArgs } from "./prisma-executor.js";

describe("validatePrismaArgs", () => {
  it("permite validate", () => {
    expect(() => {
      validatePrismaArgs(["validate", "--schema", "prisma/schema.prisma"]);
    }).not.toThrow();
  });

  it("permite format solo con --check", () => {
    expect(() => {
      validatePrismaArgs(["format", "--check", "--schema", "prisma/schema.prisma"]);
    }).not.toThrow();
  });

  it("rechaza format sin --check", () => {
    expect(() => {
      validatePrismaArgs(["format", "--schema", "prisma/schema.prisma"]);
    }).toThrow(PrismaForbiddenCommandError);
  });

  it("permite migrate status", () => {
    expect(() => {
      validatePrismaArgs(["migrate", "status", "--schema", "prisma/schema.prisma"]);
    }).not.toThrow();
  });

  it("rechaza migrate dev", () => {
    expect(() => {
      validatePrismaArgs(["migrate", "dev"]);
    }).toThrow(PrismaForbiddenCommandError);
  });

  it("rechaza migrate deploy", () => {
    expect(() => {
      validatePrismaArgs(["migrate", "deploy"]);
    }).toThrow(PrismaForbiddenCommandError);
  });

  it("rechaza db push", () => {
    expect(() => {
      validatePrismaArgs(["db", "push"]);
    }).toThrow(PrismaForbiddenCommandError);
  });

  it("rechaza generate", () => {
    expect(() => {
      validatePrismaArgs(["generate"]);
    }).toThrow(PrismaForbiddenCommandError);
  });
});
