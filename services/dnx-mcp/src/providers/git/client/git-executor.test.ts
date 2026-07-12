import { describe, expect, it } from "vitest";
import { GitForbiddenCommandError, GitValidationError } from "../errors.js";
import { validateGitArgs } from "./git-executor.js";

describe("validateGitArgs", () => {
  it("permite subcomandos de solo lectura", () => {
    expect(() => {
      validateGitArgs(["status", "--porcelain"]);
    }).not.toThrow();
    expect(() => {
      validateGitArgs(["rev-parse", "--abbrev-ref", "HEAD"]);
    }).not.toThrow();
    expect(() => {
      validateGitArgs(["config", "--get", "remote.origin.url"]);
    }).not.toThrow();
  });

  it("rechaza subcomandos peligrosos", () => {
    expect(() => {
      validateGitArgs(["push", "origin", "main"]);
    }).toThrow(GitForbiddenCommandError);
    expect(() => {
      validateGitArgs(["commit", "-m", "x"]);
    }).toThrow(GitForbiddenCommandError);
    expect(() => {
      validateGitArgs(["reset", "--hard"]);
    }).toThrow(GitForbiddenCommandError);
    expect(() => {
      validateGitArgs(["checkout", "main"]);
    }).toThrow(GitForbiddenCommandError);
  });

  it("rechaza config sin flags de lectura", () => {
    expect(() => {
      validateGitArgs(["config", "user.email", "a@b.com"]);
    }).toThrow(GitForbiddenCommandError);
  });

  it("rechaza argumentos inseguros", () => {
    expect(() => {
      validateGitArgs(["status", "file;rm -rf /"]);
    }).toThrow(GitValidationError);
  });
});
