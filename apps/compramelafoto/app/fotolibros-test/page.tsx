"use client";

import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

/**
 * Prueba de diseñador deshabilitada.
 * Por ahora se usa exclusivamente el Diseñador de plantillas en Admin.
 */
export default function FotolibrosTestPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f1f5f9] p-6">
      <Card className="max-w-md w-full p-8 text-center">
        <h1 className="text-xl font-semibold text-[#1a1a1a] mb-2">
          Diseñador deshabilitado
        </h1>
        <p className="text-sm text-[#6b7280] mb-6">
          El diseñador de prueba está deshabilitado temporalmente.
          Usá el <strong>Diseñador de plantillas</strong> en Admin.
        </p>
        <Link href="/admin/plantillas/disenador">
          <Button>Ir al Diseñador de plantillas</Button>
        </Link>
      </Card>
    </div>
  );
}
