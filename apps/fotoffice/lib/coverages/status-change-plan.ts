import { assertRequestTransition } from "./transitions";

/**
 * Los tres controles previos a mover una solicitud, en el orden que corresponde.
 *
 * Primero la pertenencia al workspace, después la transición, y último el motivo. El orden no
 * es estético: al revés, un mensaje de «falta el motivo» sobre una solicitud ajena ya le
 * confirmaría a quien probó un id que esa solicitud existe.
 */
export type StatusChangePlan =
  | { ok: true; from: string; to: string }
  | { ok: false; error: string };

export function planStatusChange(input: {
  solicitud: { id: string; workspaceId: string; status: string } | null;
  workspaceId: string;
  to: string;
  reason: string | null;
}): StatusChangePlan {
  if (!input.solicitud || input.solicitud.workspaceId !== input.workspaceId) {
    return { ok: false, error: "No encontramos esa solicitud." };
  }

  const check = assertRequestTransition({
    from: input.solicitud.status,
    to: input.to,
    reason: input.reason,
  });
  if (!check.ok) return { ok: false, error: check.error };

  return { ok: true, from: input.solicitud.status, to: input.to };
}
