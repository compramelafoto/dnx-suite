"use client";

import Button from "@/components/ui/Button";

export type EventMemberRow = {
  id: number;
  userId: number;
  name: string | null;
  email: string;
  status: string;
  createdAt: string;
};

type Props = {
  members: EventMemberRow[];
  actingMemberId: number | null;
  onApprove: (memberId: number) => void;
  onReject: (memberId: number) => void;
  description?: string;
};

export default function EventPhotographersMembersPanel({
  members,
  actingMemberId,
  onApprove,
  onReject,
  description = "Solicitudes pendientes (eventos con aprobación), fotógrafos inscriptos y solicitudes rechazadas.",
}: Props) {
  const pending = members.filter((m) => m.status === "PENDING");
  const approved = members.filter((m) => m.status === "ACTIVE");
  const rejected = members.filter((m) => m.status === "REJECTED");

  const formatDt = (iso: string) =>
    new Date(iso).toLocaleString("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
    });

  const rowClass =
    "flex flex-col sm:flex-row sm:items-center gap-2 rounded-lg bg-gray-50 p-3 border border-gray-100";

  return (
    <section className="w-full min-w-0 rounded-2xl border border-[#111827]/10 bg-white p-4 md:p-5 space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Fotógrafos del evento</h2>
        <p className="ds-readable-text ds-readable-text--fluid text-sm text-gray-500 m-0">
          {description}
        </p>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-800 mb-2">
          Pendientes de aprobación ({pending.length})
        </h3>
        {pending.length === 0 ? (
          <p className="ds-readable-text ds-readable-text--fluid text-sm text-gray-500 m-0">
            No hay solicitudes pendientes.
          </p>
        ) : (
          <ul className="space-y-3">
            {pending.map((m) => (
              <li key={m.id} className={rowClass}>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{m.name || m.email}</p>
                  <p className="text-xs text-gray-500 truncate">{m.email}</p>
                  <p className="text-xs text-gray-400 mt-1">Solicitud: {formatDt(m.createdAt)}</p>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <Button
                    variant="primary"
                    size="sm"
                    className="whitespace-nowrap shrink-0"
                    disabled={actingMemberId === m.id}
                    onClick={() => onApprove(m.id)}
                  >
                    {actingMemberId === m.id ? "…" : "Aprobar"}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={actingMemberId === m.id}
                    className="text-red-700 hover:bg-red-50 whitespace-nowrap shrink-0"
                    onClick={() => onReject(m.id)}
                  >
                    {actingMemberId === m.id ? "…" : "Rechazar"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-800 mb-2">Inscriptos ({approved.length})</h3>
        {approved.length === 0 ? (
          <p className="ds-readable-text ds-readable-text--fluid text-sm text-gray-500 m-0">
            Todavía no hay fotógrafos inscriptos.
          </p>
        ) : (
          <ul className="space-y-3">
            {approved.map((m) => (
              <li key={m.id} className={rowClass}>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{m.name || m.email}</p>
                  <p className="text-xs text-gray-500 truncate">{m.email}</p>
                  <p className="text-xs text-gray-400 mt-1">Alta: {formatDt(m.createdAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-800 mb-2">Rechazados ({rejected.length})</h3>
        {rejected.length === 0 ? (
          <p className="ds-readable-text ds-readable-text--fluid text-sm text-gray-500 m-0">
            No hay solicitudes rechazadas.
          </p>
        ) : (
          <ul className="space-y-3">
            {rejected.map((m) => (
              <li key={m.id} className={rowClass}>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{m.name || m.email}</p>
                  <p className="text-xs text-gray-500 truncate">{m.email}</p>
                  <p className="text-xs text-gray-400 mt-1">Solicitud: {formatDt(m.createdAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
