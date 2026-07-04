"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";

export default function FotolibroImprimirPage() {
  const params = useParams();
  const id = params?.id ? String(params.id) : null;

  return (
    <div className="min-h-screen bg-[#f7f5f2] p-6">
      <div className="max-w-3xl mx-auto w-full px-4 sm:px-6">
        <Link href={id ? `/fotolibro/${id}/vista` : "/admin/plantillas/disenador"} className="text-sm text-[#6b7280] hover:text-[#1a1a1a] mb-4 inline-block">
          ← Volver
        </Link>
        <Card className="p-6">
          <h1 className="text-xl font-semibold text-[#1a1a1a] mb-2">Imprimir fotolibro</h1>
          <p className="text-sm text-[#6b7280] mb-6">
            Tu diseño se enviará al laboratorio para imprimir. Completá tus datos para crear el pedido.
          </p>

          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1">Nombre</label>
              <Input placeholder="Tu nombre" className="w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1">Email</label>
              <Input type="email" placeholder="tu@email.com" className="w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1">Teléfono</label>
              <Input type="tel" placeholder="+54 9 11 1234-5678" className="w-full" />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link href="/imprimir" className="flex-1">
              <Button variant="primary" className="w-full">
                Crear pedido de impresión
              </Button>
            </Link>
            <Link href={id ? `/fotolibro/${id}/vista` : "/admin/plantillas/disenador"} className="flex-1">
              <Button variant="secondary" className="w-full">
                Cancelar
              </Button>
            </Link>
          </div>

          <p className="text-xs text-[#9ca3af] mt-4">
            El pedido se enviará al laboratorio configurado. Para fotolibros, el sistema exportará las páginas y las incluirá en el pedido.
          </p>
        </Card>
      </div>
    </div>
  );
}
