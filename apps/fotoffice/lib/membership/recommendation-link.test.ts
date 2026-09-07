import { describe, expect, it } from "vitest";
import { resolveRecommender, type RecommenderCandidate } from "./recommendation-link";

const socio: RecommenderCandidate = {
  id: "socio-a",
  workspaceId: "ws-sfpr",
  status: "ACTIVE",
  firstName: "Juan",
  lastName: "Pérez",
};

describe("resolveRecommender", () => {
  it("resuelve el socio activo del mismo workspace", () => {
    expect(resolveRecommender({ rawCode: "ABCDEFGHJK", workspaceId: "ws-sfpr", candidate: socio }))
      .toEqual({ memberId: "socio-a", displayName: "Juan Pérez" });
  });

  it("sin código no hay recomendación, y no es un error", () => {
    expect(resolveRecommender({ rawCode: null, workspaceId: "ws-sfpr", candidate: null })).toBeNull();
  });

  it("un código que no existe se ignora en silencio", () => {
    expect(resolveRecommender({ rawCode: "ABCDEFGHJK", workspaceId: "ws-sfpr", candidate: null })).toBeNull();
  });

  it("un código de otra institución no vale", () => {
    expect(
      resolveRecommender({ rawCode: "ABCDEFGHJK", workspaceId: "ws-otra", candidate: socio }),
    ).toBeNull();
  });

  it("el enlace de un socio dado de baja no otorga nada", () => {
    expect(
      resolveRecommender({
        rawCode: "ABCDEFGHJK",
        workspaceId: "ws-sfpr",
        candidate: { ...socio, status: "INACTIVE" },
      }),
    ).toBeNull();
  });

  it("un código con forma inválida se ignora sin mirar el padrón", () => {
    expect(resolveRecommender({ rawCode: "no-es-un-codigo", workspaceId: "ws-sfpr", candidate: socio })).toBeNull();
  });
});
