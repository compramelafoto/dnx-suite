import { describe, expect, it } from "vitest";
import type { Provider, ProviderName } from "../../types/provider.js";
import { ProviderNotConfiguredError } from "../../utils/errors.js";
import { createDefaultProviderRegistry } from "./provider-factory.js";
import { ProviderRegistry } from "./provider-registry.js";
import {
  ProviderNameMismatchError,
  ProviderNotRegisteredError,
} from "./provider-registry-types.js";

function createTestProvider(name: ProviderName, configured: boolean): Provider {
  return {
    name,
    isConfigured: () => configured,
  };
}

describe("ProviderRegistry", () => {
  it("registra y lista providers", () => {
    const registry = new ProviderRegistry();
    const git = createTestProvider("git", true);
    const prisma = createTestProvider("prisma", false);

    registry.registerProvider("git", git).registerProvider("prisma", prisma);

    expect(registry.hasProvider("git")).toBe(true);
    expect(registry.hasProvider("prisma")).toBe(true);
    expect(registry.listProviders()).toEqual(["git", "prisma"]);
    expect(registry.getProvider("git")).toBe(git);
  });

  it("getProvider devuelve undefined si falta el provider", () => {
    const registry = new ProviderRegistry();
    expect(registry.getProvider("vercel")).toBeUndefined();
    expect(registry.hasProvider("vercel")).toBe(false);
    expect(registry.isConfigured("vercel")).toBe(false);
  });

  it("assertConfigured lanza si el provider no está registrado", () => {
    const registry = new ProviderRegistry();

    expect(() => {
      registry.assertConfigured("git");
    }).toThrow(ProviderNotRegisteredError);
  });

  it("assertConfigured lanza si el provider no está configurado", () => {
    const registry = new ProviderRegistry();
    registry.registerProvider("prisma", createTestProvider("prisma", false));

    expect(() => {
      registry.assertConfigured("prisma");
    }).toThrow(ProviderNotConfiguredError);
  });

  it("rechaza registro con name distinto al provider.name", () => {
    const registry = new ProviderRegistry();

    expect(() => {
      registry.registerProvider("git", createTestProvider("prisma", true));
    }).toThrow(ProviderNameMismatchError);
  });

  it("getHealth reporta estado configurado y no configurado", () => {
    const registry = new ProviderRegistry();
    registry.registerProvider("git", createTestProvider("git", true));
    registry.registerProvider("prisma", createTestProvider("prisma", false));

    const health = registry.getHealth();

    expect(health.totalCount).toBe(2);
    expect(health.configuredCount).toBe(1);
    expect(health.providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "git", configured: true, status: "healthy" }),
        expect.objectContaining({ name: "prisma", configured: false, status: "unconfigured" }),
      ]),
    );
  });
});

describe("createDefaultProviderRegistry", () => {
  it("registra vercel, git, prisma y stubs", () => {
    const registry = createDefaultProviderRegistry();

    expect(registry.hasProvider("vercel")).toBe(true);
    expect(registry.hasProvider("git")).toBe(true);
    expect(registry.hasProvider("prisma")).toBe(true);
    expect(registry.hasProvider("docker")).toBe(true);
    expect(registry.hasProvider("cursor")).toBe(true);
    expect(registry.listProviders().length).toBeGreaterThanOrEqual(12);
  });

  it("permite overrides por nombre", () => {
    const customGit = createTestProvider("git", true);
    const registry = createDefaultProviderRegistry({
      providers: { git: customGit },
    });

    expect(registry.getProvider("git")).toBe(customGit);
  });
});
