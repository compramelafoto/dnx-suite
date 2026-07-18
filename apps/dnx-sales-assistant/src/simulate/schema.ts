import { z } from "zod";
import { normalizeSimulateMessageInput } from "./normalize.js";

/**
 * Contrato de entrada para POST /simulate/message.
 * - `from`: teléfono; se normaliza a dígitos y se exige longitud 10–15.
 * - `message`: texto no vacío, máx. 4096.
 * - Sin claves adicionales (strict).
 */
export const simulateMessageRequestSchema = z
  .object({
    from: z.string().min(1, "from es obligatorio"),
    message: z.string().min(1, "message es obligatorio"),
  })
  .strict()
  .transform((value) => normalizeSimulateMessageInput(value))
  .superRefine((value, ctx) => {
    if (value.from.length < 10 || value.from.length > 15) {
      ctx.addIssue({
        code: "custom",
        path: ["from"],
        message: "from debe tener entre 10 y 15 dígitos tras normalizar",
      });
    }
    if (value.message.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["message"],
        message: "message es obligatorio",
      });
    } else if (value.message.length > 4096) {
      ctx.addIssue({
        code: "custom",
        path: ["message"],
        message: "message es demasiado largo",
      });
    }
  });

export type SimulateMessageRequestParsed = z.infer<typeof simulateMessageRequestSchema>;
