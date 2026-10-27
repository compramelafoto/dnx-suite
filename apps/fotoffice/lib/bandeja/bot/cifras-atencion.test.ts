import { describe, expect, it } from "vitest";
import { cifrasNoRespaldadas } from "@/lib/dnx-bot/cifras";
import { cifrasRespaldadasEnAtencion } from "./cifras-atencion";

const herramienta = (texto: string) => ({ role: "user", content: [{ type: "tool_result", tool_use_id: "t", content: texto }] });

describe("cifras respaldadas en la atención por WhatsApp", () => {
  it("cantidad que dijo el cliente × precio del catálogo vale", () => {
    const ok = cifrasRespaldadasEnAtencion(
      [],
      [{ role: "user", content: "tengo 2 videos para pasar a pendrive" }, herramienta("- Digitalización de VHS: $ 12.000")],
    );
    expect(cifrasNoRespaldadas("Son 2, así que $24.000 en total.", ok)).toEqual([]);
  });

  it("un precio que el bot ya dijo antes en el chat vale aunque no vuelva a buscarlo", () => {
    const ok = cifrasRespaldadasEnAtencion(
      [{ role: "user", content: "cuánto sale un VHS?" }, { role: "assistant", content: "Sale $12.000 cada uno." }],
      [{ role: "user", content: "y los martes atienden?" }],
    );
    expect(cifrasNoRespaldadas("Sí, y recordá que el VHS sale $12.000.", ok)).toEqual([]);
  });

  it("un precio inventado sigue sin pasar", () => {
    const ok = cifrasRespaldadasEnAtencion([], [{ role: "user", content: "tengo 3 videos" }, herramienta("- Digitalización de VHS: $ 12.000")]);
    expect(cifrasNoRespaldadas("Te queda en $30.000.", ok)).toEqual(["$30000"]);
  });
});
