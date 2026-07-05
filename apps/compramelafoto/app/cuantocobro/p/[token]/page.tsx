import CuantoCobroPublicChrome from "@/components/cuantocobro/CuantoCobroPublicChrome";
import QuotePublicView from "@/components/cuantocobro/presupuestos/QuotePublicView";
import { buildQuotePublicViewPayload } from "@/lib/cuantocobro/quote/quote-public-view";
import { recordQuotePublicView } from "@/lib/cuantocobro/quote/quote-delivery-db";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ token: string }>;
};

function resolveClientIp(headerStore: Headers): string {
  const forwarded = headerStore.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return headerStore.get("x-real-ip")?.trim() || "unknown";
}

export default async function CuantoCobroQuotePublicPage({ params }: PageProps) {
  const { token } = await params;
  const headerStore = await headers();

  const view = await recordQuotePublicView(token, {
    userAgent: headerStore.get("user-agent") ?? "",
    ip: resolveClientIp(headerStore),
  });

  if (!view) notFound();

  const payload = buildQuotePublicViewPayload(view);

  return (
    <CuantoCobroPublicChrome>
      <div className="container-custom ds-gallery-inner py-8 md:py-12">
        <QuotePublicView payload={payload} />
      </div>
    </CuantoCobroPublicChrome>
  );
}
