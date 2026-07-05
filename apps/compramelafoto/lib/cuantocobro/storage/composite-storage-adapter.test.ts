import { describe, expect, it, vi } from "vitest";
import {
  persistFinancialProfile,
  resolveFinancialProfileLoad,
} from "./resolve-financial-profile-load";

type TestProfile = { currency: string };

describe("resolveFinancialProfileLoad", () => {
  it("usa perfil remoto cuando existe", async () => {
    const loadRemote = vi.fn().mockResolvedValue({ currency: "USD" });
    const loadLocal = vi.fn();
    const saveRemote = vi.fn();

    const profile = await resolveFinancialProfileLoad<TestProfile>({
      userId: 1,
      loadRemote,
      loadLocal,
      saveRemote,
    });

    expect(profile.currency).toBe("USD");
    expect(saveRemote).not.toHaveBeenCalled();
    expect(loadLocal).not.toHaveBeenCalled();
  });

  it("migra local a remoto cuando no hay fila en DB", async () => {
    const localProfile: TestProfile = { currency: "ARS" };
    const loadRemote = vi.fn().mockResolvedValue(null);
    const loadLocal = vi.fn().mockResolvedValue(localProfile);
    const saveRemote = vi.fn().mockResolvedValue(undefined);

    const profile = await resolveFinancialProfileLoad<TestProfile>({
      userId: 9,
      loadRemote,
      loadLocal,
      saveRemote,
    });

    expect(profile).toEqual(localProfile);
    expect(saveRemote).toHaveBeenCalledWith(localProfile);
  });

  it("sin userId solo lee local", async () => {
    const loadRemote = vi.fn();
    const loadLocal = vi.fn().mockResolvedValue({ currency: "EUR" });
    const saveRemote = vi.fn();

    const profile = await resolveFinancialProfileLoad<TestProfile>({
      userId: null,
      loadRemote,
      loadLocal,
      saveRemote,
    });

    expect(profile.currency).toBe("EUR");
    expect(loadRemote).not.toHaveBeenCalled();
  });
});

describe("persistFinancialProfile", () => {
  it("guarda en remoto y local cuando hay userId", async () => {
    const profile: TestProfile = { currency: "ARS" };
    const saveRemote = vi.fn().mockResolvedValue(undefined);
    const saveLocal = vi.fn().mockResolvedValue(undefined);

    await persistFinancialProfile({
      userId: 4,
      profile,
      saveRemote,
      saveLocal,
    });

    expect(saveRemote).toHaveBeenCalledWith(profile);
    expect(saveLocal).toHaveBeenCalledWith(profile);
  });

  it("sin userId solo guarda en local", async () => {
    const profile: TestProfile = { currency: "EUR" };
    const saveRemote = vi.fn();
    const saveLocal = vi.fn().mockResolvedValue(undefined);

    await persistFinancialProfile({
      userId: null,
      profile,
      saveRemote,
      saveLocal,
    });

    expect(saveRemote).not.toHaveBeenCalled();
    expect(saveLocal).toHaveBeenCalledWith(profile);
  });
});
