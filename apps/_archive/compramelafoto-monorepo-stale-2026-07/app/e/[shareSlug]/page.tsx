import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { Role } from "@prisma/client";
import { getR2PublicUrl } from "@/lib/r2-client";
import EventJoinBlock from "./EventJoinBlock";
import EventLocationMapSection from "./EventLocationMapSection";
import Link from "next/link";

const EVENT_TYPE_LABELS: Record<string, string> = {
  PUBLIC_SESSION: "Sesión pública",
  PRIVATE_SESSION: "Sesión privada",
  SPORTS: "Evento deportivo",
  PUBLIC_PHOTOGRAPHY: "Fotografías públicas",
  THEMATIC_SESSIONS: "Sesiones temáticas",
  COMMERCIAL_SESSIONS: "Sesiones comerciales",
  SCHOOL: "Eventos escolares",
  RELIGIOUS: "Eventos religiosos",
  FESTIVAL: "Festival / Fiesta popular",
  CONFERENCE: "Conferencia / Charla",
  CONCERT: "Recital / Concierto",
  CORPORATE: "Corporativo",
  OTHER: "Otro",
  WEDDING: "Boda",
  BIRTHDAY: "Cumpleaños",
  GRADUATION: "Graduación",
};

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://compramelafoto.com";

export async function generateMetadata({
  params,
}: {
  params: { shareSlug: string } | Promise<{ shareSlug: string }>;
}): Promise<Metadata> {
  const { shareSlug } = await Promise.resolve(params);
  if (!shareSlug) return { title: "Evento no encontrado" };

  const event = await prisma.event.findUnique({
    where: { shareSlug },
    select: { title: true, description: true, coverImageKey: true },
  });
  if (!event) return { title: "Evento no encontrado" };

  const title = `Evento Publicado - ${event.title}`;
  const descriptionText = event.description?.trim()
    ? `${event.title}. ${event.description.trim()}`
    : event.title;
  const coverUrl = event.coverImageKey
    ? getR2PublicUrl(event.coverImageKey)
    : null;

  return {
    title,
    description: descriptionText,
    openGraph: {
      title,
      description: descriptionText,
      url: `${baseUrl}/e/${shareSlug}`,
      siteName: "ComprameLaFoto",
      ...(coverUrl && {
        images: [{ url: coverUrl, width: 1200, height: 630, alt: event.title }],
      }),
    },
    twitter: {
      card: coverUrl ? "summary_large_image" : "summary",
      title,
      description: descriptionText,
      ...(coverUrl && { images: [coverUrl] }),
    },
  };
}

export default async function PublicEventPage({
  params,
}: {
  params: { shareSlug: string } | Promise<{ shareSlug: string }>;
}) {
  const { shareSlug } = await Promise.resolve(params);
  if (!shareSlug) return notFound();

  const event = await prisma.event.findUnique({
    where: { shareSlug },
    include: {
      _count: { select: { members: true } },
      invitedPhotographers: { select: { userId: true } },
    },
  });
  if (!event) return notFound();

  const user = await getAuthUser();
  const isPhotographer =
    !!user &&
    (user.role === Role.PHOTOGRAPHER || user.role === Role.LAB_PHOTOGRAPHER);
  const isPrivateOrInviteOnly =
    event.visibility === "PRIVATE" || event.joinPolicy === "INVITE_ONLY";
  const invitedUserIds = (event.invitedPhotographers ?? []).map((i) => i.userId);
  const isInvited = !!user && invitedUserIds.includes(user.id);
  let isMember = false;
  if (user) {
    const member = await prisma.eventMember.findUnique({
      where: {
        eventId_userId: { eventId: event.id, userId: user.id },
      },
    });
    isMember = !!member;
  }

  const coverUrl = event.coverImageKey
    ? getR2PublicUrl(event.coverImageKey)
    : null;
  const typeLabel = EVENT_TYPE_LABELS[event.type] ?? event.type;

  const formatDate = (d: Date) =>
    new Date(d).toLocaleString("es-AR", {
      dateStyle: "medium",
      timeStyle: "short",
    });

  return (
    <div className="min-h-screen bg-gray-50">
      {coverUrl && (
        <div className="w-full aspect-[2/1] max-h-[40vh] bg-gray-200">
          <img
            src={coverUrl}
            alt=""
            className="w-full h-full object-cover object-center"
          />
        </div>
      )}
      <header className="bg-white border-b border-gray-200">
        <div className="w-full max-w-4xl mx-auto px-4 py-4 flex items-center justify-between min-w-0">
          <Link href="/" className="text-gray-600 hover:text-gray-900 text-sm truncate min-w-0">
            ← Volver al inicio
          </Link>
          <span className="text-sm text-gray-500 flex-shrink-0">compramelafoto</span>
        </div>
      </header>

      <main className="w-full max-w-4xl mx-auto px-4 py-8 min-w-0 box-border">
        <h1 className="text-2xl font-bold text-gray-900 mb-2 break-words">{event.title}</h1>
        <p className="text-sm text-gray-500 mb-4 break-words">
          {typeLabel}
          {event.city ? ` · ${event.city}` : ""}
        </p>
        <p className="text-gray-600 mb-2 break-words">
          {formatDate(event.startsAt)}
          {event.endsAt ? ` – ${formatDate(event.endsAt)}` : ""}
        </p>
        {event.locationName && (
          <p className="text-gray-600 mb-4 break-words">{event.locationName}</p>
        )}
        <div className="min-w-0">
          <EventLocationMapSection
            latitude={event.latitude}
            longitude={event.longitude}
            locationName={event.locationName}
          />
        </div>
        {event.description && (
          <div className="prose prose-sm text-gray-700 mb-6 min-w-0 max-w-full">
            <p className="whitespace-pre-wrap break-words">{event.description}</p>
          </div>
        )}
        {event.accreditationNotes && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 mb-6 min-w-0">
            <p className="text-sm font-medium text-amber-900 mb-1">
              Instrucciones para acreditarse
            </p>
            <p className="text-sm text-amber-800 whitespace-pre-wrap break-words">
              {event.accreditationNotes}
            </p>
          </div>
        )}

        <p className="text-sm text-gray-500 mb-4">
          {event._count.members} fotógrafo(s) inscrito(s)
          {event.maxPhotographers != null
            ? ` · Cupo: ${event.maxPhotographers}`
            : ""}
          {event.expectedAttendees != null && event.expectedAttendees > 0
            ? ` · Aprox. ${event.expectedAttendees.toLocaleString("es-AR")} asistentes`
            : ""}
        </p>
        {event.expectedAttendees != null && event.expectedAttendees > 0 && (
          <p className="text-sm text-gray-600 mb-4">
            {event.expectedAttendees >= 500
              ? "Evento multitudinario."
              : event.expectedAttendees >= 100
                ? "Evento con gran afluencia de público."
                : "Evento de afluencia moderada."}
          </p>
        )}

        <EventJoinBlock
          shareSlug={shareSlug}
          isLoggedIn={!!user}
          isPhotographer={isPhotographer}
          isMember={isMember}
          maxPhotographers={event.maxPhotographers}
          membersCount={event._count.members}
          isPrivateOrInviteOnly={isPrivateOrInviteOnly}
          isInvited={isInvited}
        />
      </main>
    </div>
  );
}
