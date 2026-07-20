import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";
import { PaymentReturnView } from "../PaymentReturnView";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ registrationId?: string; t?: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return buildPageMetadata({
    title: "Pago — éxito",
    description: "Retorno de checkout Clickatón.",
    path: `/maratones/${slug}/inscripcion/pago/exito`,
    noIndex: true,
  });
}

export default async function PaymentSuccessPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { registrationId = "", t = "" } = await searchParams;
  return (
    <PaymentReturnView
      slug={slug}
      registrationId={registrationId}
      accessToken={t}
      variant="exito"
    />
  );
}
