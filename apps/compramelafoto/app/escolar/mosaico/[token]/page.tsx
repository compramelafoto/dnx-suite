import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { cursoDelEnlace, resumenDelCurso } from "@/lib/mosaico/curso";
import { resumenParaElColegio } from "@/lib/escolar-mosaico/resumen-para-el-colegio";
import MosaicoDelColegio from "./MosaicoDelColegio";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Nombres del curso | ComprameLaFoto",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

function EnlaceVencido() {
  return (
    <main className="min-h-screen bg-[#f9fafb] flex items-center justify-center px-4">
      <div className="max-w-md w-full rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-gray-900 mb-2">Este enlace ya no está activo</h1>
        <p className="text-sm text-gray-600">
          Puede que haya vencido o que el fotógrafo ya haya cerrado el curso. ¡Gracias por la ayuda! Si todavía
          quedan chicos por nombrar, pedile un enlace nuevo al fotógrafo.
        </p>
      </div>
    </main>
  );
}

/**
 * Página sin cuenta para la maestra o la secretaría: le ponen nombre a los retratos del
 * «Mosaico del curso» que nadie compró y corrigen los datos de la seño y los directivos.
 */
export default async function MosaicoDelColegioPage({ params }: { params: Promise<{ token: string }> }) {
  const { token: raw } = await params;
  const token = decodeURIComponent(String(raw || "")).trim().slice(0, 200);
  const e = token ? await cursoDelEnlace(prisma, token) : null;
  if (!e) return <EnlaceVencido />;
  let inicial;
  try {
    inicial = resumenParaElColegio(await resumenDelCurso(prisma, e.albumId, e.courseKey));
  } catch {
    return <EnlaceVencido />;
  }
  return <MosaicoDelColegio token={token} inicial={inicial} />;
}
