"use client";

import Link from "next/link";
import Button from "@/components/ui/Button";

export default function AdminBlogError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isMissingTable =
    error.message.includes("BlogPost") ||
    error.message.includes("does not exist") ||
    error.message.includes("P2021");

  return (
    <div className="mx-auto max-w-xl space-y-4 rounded-xl border border-red-200 bg-red-50 p-6">
      <h2 className="text-lg font-semibold text-red-900">Error al cargar el blog</h2>
      <p className="text-sm text-red-800">
        {isMissingTable
          ? "Las tablas del módulo blog no están en esta base de datos. Ejecutá la migración en producción."
          : "No pudimos cargar el panel del blog. Probá de nuevo o revisá los logs del servidor."}
      </p>
      {process.env.NODE_ENV === "development" ? (
        <pre className="overflow-x-auto rounded bg-red-100 p-3 text-xs text-red-900">{error.message}</pre>
      ) : null}
      {isMissingTable ? (
        <pre className="overflow-x-auto rounded bg-gray-900 p-3 text-xs text-gray-100">
          npx prisma migrate deploy{"\n"}npm run seed:blog:all
        </pre>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={() => reset()}>
          Reintentar
        </Button>
        <Link href="/admin" className="text-sm text-[#c27b3d] hover:underline self-center">
          Volver al admin
        </Link>
      </div>
    </div>
  );
}
