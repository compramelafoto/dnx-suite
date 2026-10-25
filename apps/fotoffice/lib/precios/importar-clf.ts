import type { CuantoCobroProfileInput } from "@repo/cuanto-cobro-core";
import { validarPerfil } from "./perfil-datos";

export type PlanDeImportacion = {
  accion: "escribir" | "nada";
  motivo: string;
  perfil: CuantoCobroProfileInput | null;
};

/** Decide qué hacer al importar el perfil de CLF a un workspace. Pura: no toca bases. */
export function planDeImportacion(args: {
  perfilClf: unknown;
  existente: boolean;
  aplicar: boolean;
  pisar: boolean;
}): PlanDeImportacion {
  const validacion = validarPerfil(args.perfilClf);
  if (!validacion.ok) {
    return { accion: "nada", motivo: `El perfil de CLF no es válido: ${validacion.error}`, perfil: null };
  }
  const perfil = validacion.perfil;
  if (args.existente && !args.pisar) {
    return { accion: "nada", motivo: "El workspace ya tiene perfil; usá --pisar.", perfil };
  }
  if (!args.aplicar) {
    return { accion: "nada", motivo: "En seco: no se escribió nada.", perfil };
  }
  return { accion: "escribir", motivo: "Perfil importado desde CLF.", perfil };
}
