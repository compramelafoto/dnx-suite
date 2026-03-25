"use client";

import { useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";

const COMMITMENT_MESSAGE = (
  <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
    Inscribirse al evento es un <strong>compromiso de asistencia</strong>. Para no afectar a otros colegas, es importante respetar ese compromiso. Si tenés que cancelar, avisá en la plataforma con <strong>mínimo 24 horas de anticipación</strong> (desinscribite desde &quot;Mis eventos&quot; en tu panel).
  </p>
);

type Props = {
  shareSlug: string;
  isLoggedIn: boolean;
  isPhotographer: boolean;
  isMember: boolean;
  maxPhotographers: number | null;
  membersCount: number;
  isPrivateOrInviteOnly?: boolean;
  isInvited?: boolean;
};

export default function EventJoinBlock({
  shareSlug,
  isLoggedIn,
  isPhotographer,
  isMember,
  maxPhotographers,
  membersCount,
  isPrivateOrInviteOnly = false,
  isInvited = false,
}: Props) {
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [left, setLeft] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canJoin =
    isPhotographer &&
    (left || (!isMember && !joined)) &&
    (maxPhotographers == null || membersCount < maxPhotographers) &&
    (!isPrivateOrInviteOnly || isInvited);

  async function handleLeave() {
    if (!isMember && !joined) return;
    setError(null);
    setLeaving(true);
    try {
      const res = await fetch(`/api/public/events/${shareSlug}/leave`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setLeft(true);
        setJoined(false);
      } else {
        setError(data.error || "No se pudo desinscribir");
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setLeaving(false);
    }
  }

  async function handleJoin() {
    if (!canJoin) return;
    setError(null);
    setJoining(true);
    try {
      const res = await fetch(`/api/public/events/${shareSlug}/join`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        if (data.alreadyMember) {
          setJoined(true);
        } else {
          setJoined(true);
        }
      } else {
        if (res.status === 401) {
          window.location.href = `/fotografo/login?redirect=${encodeURIComponent(`/e/${shareSlug}`)}`;
          return;
        }
        setError(data.error || "No se pudo inscribir");
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setJoining(false);
    }
  }

  if ((isMember || joined) && !left) {
    return (
      <div className="space-y-3">
        {COMMITMENT_MESSAGE}
        <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-green-800">
          <p className="mb-3">Ya estás inscrito en este evento.</p>
          {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Link href="/fotografo/dashboard">
              <Button variant="secondary" size="sm">Ir a Mis eventos</Button>
            </Link>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleLeave}
              disabled={leaving}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              {leaving ? "Desinscribiendo…" : "Desinscribirme"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="rounded-lg bg-gray-100 border border-gray-200 p-4">
        <p className="text-gray-700 mb-3">
          Iniciá sesión con tu cuenta de fotógrafo para inscribirte al evento.
        </p>
        <Link href={`/fotografo/login?redirect=${encodeURIComponent(`/e/${shareSlug}`)}`} className="inline-block">
          <Button variant="primary" size="sm">
            Iniciar sesión para inscribirse
          </Button>
        </Link>
      </div>
    );
  }

  if (isPrivateOrInviteOnly && isLoggedIn && isPhotographer && !isInvited) {
    return (
      <div className="rounded-lg bg-gray-100 border border-gray-200 p-4 text-gray-700">
        <p className="text-sm">
          Este evento es privado. Solo los fotógrafos invitados por el organizador pueden inscribirse.
        </p>
      </div>
    );
  }

  if (!isPhotographer) {
    return (
      <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-amber-800">
        <p className="text-sm mb-3">
          Solo los fotógrafos pueden inscribirse a este evento. Iniciá sesión con una cuenta de fotógrafo para inscribirte.
        </p>
        <Link
          href={`/fotografo/login?redirect=${encodeURIComponent(`/e/${shareSlug}`)}`}
          className="inline-block"
        >
          <Button variant="primary" size="sm">
            Iniciar sesión para inscribirse
          </Button>
        </Link>
      </div>
    );
  }

  if (maxPhotographers != null && membersCount >= maxPhotographers) {
    return (
      <div className="rounded-lg bg-gray-100 border border-gray-200 p-4 text-gray-700">
        El evento ya alcanzó el cupo máximo de fotógrafos.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {COMMITMENT_MESSAGE}
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
      <Button
        variant="primary"
        onClick={handleJoin}
        disabled={joining}
      >
        {joining ? "Inscribiendo..." : "Inscribirme al evento"}
      </Button>
    </div>
  );
}
