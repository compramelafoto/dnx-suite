import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import CarnetFlow from "@/components/prints/CarnetFlow";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function CarnetPhotographerPage({
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
      showCarnetPrints: true,
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
            <h1 className="text-3xl md:text-4xl font-semibold text-[#1a1a1a]">Fotos Carnet</h1>
            <p className="text-sm text-[#6b7280]">
              Generá tu plancha 10x15 y finalizá el pedido online.
            </p>
          </div>
          <CarnetFlow enabled={photographer.showCarnetPrints === true} checkoutPath={`/${handler}/imprimir/datos`} />
        </div>
      </div>
    </section>
  );
}
