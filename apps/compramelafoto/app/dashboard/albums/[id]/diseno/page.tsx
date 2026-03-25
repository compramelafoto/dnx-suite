"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

/**
 * Diseñador de fotolibros deshabilitado.
 * Por ahora se usa exclusivamente el Diseñador de plantillas en Admin.
 */
export default function DisenoDeshabilitadoPage() {
  const params = useParams();
  const albumId = params?.id ? String(params.id) : null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f1f5f9] p-6">
      <Card className="max-w-md w-full p-8 text-center">
        <h1 className="text-xl font-semibold text-[#1a1a1a] mb-2">
          Diseñador deshabilitado
        </h1>
        <p className="text-sm text-[#6b7280] mb-6">
          El diseñador de fotolibros de álbumes está deshabilitado temporalmente.
          Usá el <strong>Diseñador de plantillas</strong> en Admin para crear y editar diseños.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/admin/plantillas/disenador">
            <Button>Ir al Diseñador de plantillas</Button>
          </Link>
          {albumId && (
            <Link href={`/dashboard/albums/${albumId}`}>
              <Button variant="secondary">Volver al álbum</Button>
            </Link>
          )}
        </div>
      </Card>
    </div>
  );
}
