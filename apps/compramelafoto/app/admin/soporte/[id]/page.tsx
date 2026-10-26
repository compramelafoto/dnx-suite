"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import FichaTicket from "@/components/admin/soporte/FichaTicket";

/** Ficha de un reclamo en su propia página (link directo desde avisos y notificaciones). */
export default function AdminSoporteTicketPage() {
  const { id } = useParams<{ id: string }>();
  const ticketId = Number(id);
  if (!Number.isFinite(ticketId)) return <p className="text-gray-600">Reclamo inválido.</p>;
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/admin/soporte" className="text-sm text-blue-700 underline">← Volver al centro de reclamos</Link>
      <FichaTicket ticketId={ticketId} />
    </div>
  );
}
