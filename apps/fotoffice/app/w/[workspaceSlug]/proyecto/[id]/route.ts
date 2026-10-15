import { openSharedLink } from "@/lib/governance/share-server";

export const dynamic = "force-dynamic";

/** Enlace único para compartir por WhatsApp. Lleva a cada uno a su lugar: ver `lib/governance/share.ts`. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ workspaceSlug: string; id: string }> },
) {
  const { workspaceSlug, id } = await params;
  return openSharedLink(request, "proyecto", workspaceSlug, id);
}
