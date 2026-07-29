import { notFound } from "next/navigation";
import type { Metadata } from "next";
import CharlaFotoEscolarClient from "@/components/land/charla-foto-escolar/CharlaFotoEscolarClient";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await Promise.resolve(params);
  const talk = await prisma.talk.findUnique({
    where: { slug },
    select: { seoTitle: true, seoDescription: true, ogImageUrl: true, title: true, shortDescription: true },
  });

  const title = talk?.seoTitle || talk?.title || "Charla | ComprameLaFoto";
  const description =
    talk?.seoDescription ||
    talk?.shortDescription ||
    "Charla gratuita para fotógrafos argentinos organizada por ComprameLaFoto.";
  const ogImage = talk?.ogImageUrl || "/charla-foto-escolar-flyer.png";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: ogImage }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function TalkLandingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await Promise.resolve(params);
  const talk = await prisma.talk.findUnique({
    where: { slug },
    select: { id: true, status: true },
  });
  if (!talk || talk.status !== "PUBLISHED") return notFound();

  return (
    <CharlaFotoEscolarClient
      talkSlug={slug}
      fallbackLinks={{
        calendarUrl: "https://calendar.app.google/fZehF9PeL8HoFH2q8",
        whatsappUrl: "https://chat.whatsapp.com/Dla9eNPKIiWAnOswmxMldk",
      }}
    />
  );
}
