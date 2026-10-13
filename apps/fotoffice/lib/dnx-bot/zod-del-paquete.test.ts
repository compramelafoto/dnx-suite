import { describe, expect, it } from "vitest";
import { toInputSchema, z } from "@repo/dnx-bot";

/**
 * FOTOFFICE usa zod 3 y el paquete del bot zod 4 (`z.toJSONSchema`). Los esquemas de las
 * herramientas se arman SIEMPRE con la `z` que re-exporta el paquete: así convierten bien a JSON
 * Schema y pasan el tipo `z.ZodType` del motor (riesgo 2 del spec).
 */
describe("z del paquete del bot", () => {
  it("es zod 4 y sus esquemas convierten a JSON Schema", () => {
    const s = z.object({ horas: z.string().optional(), canal: z.enum(["WHATSAPP", "EMAIL"]) });
    const j = toInputSchema(s);
    expect(j.type).toBe("object");
    expect(j).not.toHaveProperty("$schema");
    expect(typeof z.toJSONSchema).toBe("function");
  });
});
