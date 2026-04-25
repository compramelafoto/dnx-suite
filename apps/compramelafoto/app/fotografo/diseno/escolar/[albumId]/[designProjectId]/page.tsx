import Link from "next/link";
import { SchoolDesignReviewClient } from "@/components/school-design/SchoolDesignReviewClient";

export default async function SchoolDesignReviewPage({
  params,
}: {
  params: Promise<{ albumId: string; designProjectId: string }>;
}) {
  const { albumId: a, designProjectId: d } = await params;
  const albumId = parseInt(a, 10);
  const designProjectId = parseInt(d, 10);
  if (!Number.isInteger(albumId) || !Number.isInteger(designProjectId)) {
    return <p className="p-6 text-red-600">IDs inválidos</p>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <Link href="/fotografo/dashboard" className="text-sm text-[#c27b3d] hover:underline mb-6 inline-block">
        ← Volver al panel
      </Link>
      <h1 className="text-2xl font-semibold text-[#1a1a1a] mb-2">Revisión de diseño escolar</h1>
      <p className="text-sm text-[#6b7280] mb-8">
        Álbum #{albumId} · Proyecto #{designProjectId}
      </p>
      <SchoolDesignReviewClient albumId={albumId} designProjectId={designProjectId} />
    </div>
  );
}
