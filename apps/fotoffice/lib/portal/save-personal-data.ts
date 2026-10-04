import "server-only";
import { prisma } from "@repo/db";
import { MemberConcurrencyError, updateMember } from "@repo/db/fotoffice-members";
import {
  parseDatosPersonales,
  type DatosPersonalesInput,
} from "@/lib/portal/personal-data";

export type ResultadoGuardado =
  | { ok: true }
  | { ok: false; error: string; field?: string };

/**
 * El socio actualiza sus propios datos personales desde el portal.
 *
 * Tres cosas que no se pueden aflojar acá:
 *
 * 1. **La ficha se resuelve por sesión, nunca por el formulario.** No hay un `memberId` que
 *    viaje en el POST: se busca la ficha ACTIVA de este `userId`, la misma que muestra el
 *    portal. Sin esto, cualquiera podría editar la ficha de otro socio cambiando un campo
 *    oculto.
 * 2. **Una sola ficha.** Quien sea socio de dos instituciones tiene dos fichas; un `updateMany`
 *    por `userId` pisaría la otra sin que nadie se entere. Mismo criterio que
 *    `guardarPerfilProfesional`.
 * 3. **Queda auditado.** Se escribe con `updateMember`, que arma el diff y la fila de
 *    `MemberAudit` dentro de la misma transacción. La Secretaría ve qué cambió, cuándo y que
 *    lo hizo el propio socio: un dato del padrón que cambia sin rastro es un dato que nadie
 *    puede defender después.
 *
 * NO se manda testigo de concurrencia a propósito. En esta misma pantalla el socio sube sus
 * fotos, y cada subida mueve el `updatedAt` de la ficha: el testigo tomado al abrir quedaría
 * viejo y el guardado fallaría por un cambio que hizo la propia persona.
 */
export async function guardarDatosPersonales(
  userId: number,
  entrada: DatosPersonalesInput,
): Promise<ResultadoGuardado> {
  const socio = await prisma.member.findFirst({
    where: { userId, status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      workspaceId: true,
      documentType: true,
      documentNumber: true,
      firstName: true,
      lastName: true,
    },
  });
  if (!socio) return { ok: false, error: "No encontramos tu ficha de socio." };

  const parsed = parseDatosPersonales(entrada, {
    documentType: socio.documentType,
    documentNumber: socio.documentNumber,
  });
  if (!parsed.ok) return parsed;

  try {
    const actualizado = await updateMember(socio.workspaceId, socio.id, parsed.data, {
      action: "UPDATED",
      source: "MANUAL",
      // Snapshot legible para el historial. Se guarda el nombre que la ficha tenía ANTES del
      // cambio: si lo que se está corrigiendo es justamente el nombre, el evento tiene que
      // poder leerse desde el dato viejo. No dice "el propio socio": cada institución llama
      // distinto a su gente, y el historial no tiene de dónde sacar esa palabra.
      actor: { userId, label: `${socio.firstName} ${socio.lastName} (desde su portal)` },
    });
    if (!actualizado) return { ok: false, error: "No encontramos tu ficha de socio." };
  } catch (e) {
    if (e instanceof MemberConcurrencyError) {
      return {
        ok: false,
        error: "Alguien modificó tu ficha mientras la editabas. Recargá la pantalla y probá de nuevo.",
      };
    }
    return errorAmable(e);
  }

  return { ok: true };
}

/**
 * Nunca mostrarle el error crudo de Prisma al socio, y sobre todo nunca decirle "ya existe
 * otro socio con ese documento": eso le confirmaría un dato de una persona que no es él.
 */
function errorAmable(e: unknown): { ok: false; error: string; field?: string } {
  const err = e as { code?: string; meta?: { target?: string[] | string } } | undefined;
  if (err?.code === "P2002") {
    const target = err.meta?.target;
    const t = (Array.isArray(target) ? target.join(",") : String(target ?? "")).toLowerCase();
    if (t.includes("email")) {
      return {
        ok: false,
        error: "Ese email ya figura en la institución. Usá otro o escribinos para que lo revisemos.",
        field: "email",
      };
    }
    if (t.includes("document")) {
      return {
        ok: false,
        error: "Ese documento ya figura en la institución. Revisalo o escribinos para que lo corrijamos.",
        field: "documentNumber",
      };
    }
  }
  return { ok: false, error: "No pudimos guardar tus datos. Probá de nuevo en un momento." };
}
