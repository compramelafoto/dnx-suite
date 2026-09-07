import { describe, expect, it } from "vitest";
import { invitationExtrasFor } from "./invitation-extras";

describe("invitationExtrasFor", () => {
  it("una institución sin entrada no suma nada al email", () => {
    // Es la garantía de que este agregado no le cambia el mensaje a las demás.
    expect(invitationExtrasFor("ws-cualquier-otra")).toEqual({
      migrationNote: null,
      video: null,
    });
  });

  it("la SFPR trae su nota de migración y su video", () => {
    const e = invitationExtrasFor("ws_sfpr_seed");
    expect(e.migrationNote).toContain("cambió de sistema");
    expect(e.video?.watchUrl).toContain("youtube.com");
    expect(e.video?.durationLabel).toBe("3:47");
  });

  it("la portada del video sale del mismo proveedor que el video", () => {
    // Una imagen alojada en otro lado la bloquean varios clientes de correo.
    const e = invitationExtrasFor("ws_sfpr_seed");
    expect(e.video?.posterUrl).toContain("ytimg.com");
  });
});
