import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PolaroidFlow from "@/components/prints/PolaroidFlow";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function PolaroidsPhotographerPage({
  params,
}: {
  params: { handler: string } | Promise<{ handler: string }>;
}) {
  const { handler } = await Promise.resolve(params);
  if (!handler || typeof handler !== "string") {
    notFound();
  }

  const photographer = await prisma.user.findFirst({
    where: {
      publicPageHandler: handler.toLowerCase(),
      isPublicPageEnabled: true,
      role: "PHOTOGRAPHER",
    },
    select: {
      id: true,
      name: true,
      showPolaroidPrints: true,
    },
  });

  if (!photographer) {
    notFound();
  }

  return (
    <section className="section-spacing bg-[#f9fafb]">
      <div className="container-custom">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-3xl md:text-4xl font-semibold text-[#1a1a1a]">Polaroids</h1>
            <p className="text-sm text-[#6b7280]">
              Diseñá tus polaroids y continuá con el pago.
            </p>
          </div>
          <PolaroidFlow enabled={photographer.showPolaroidPrints === true} checkoutPath={`/${handler}/imprimir/datos`} />
        </div>
      </div>
    </section>
  );
}
