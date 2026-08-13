import { permanentRedirect } from "next/navigation";
import { parseNoticiasPage } from "@/components/editorial/noticias-index";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ page?: string }>;
};

/** El listado de noticias vive en el home (`/`). */
export default async function NoticiasAliasPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = parseNoticiasPage(params.page);
  permanentRedirect(page > 1 ? `/?page=${page}` : "/");
}
