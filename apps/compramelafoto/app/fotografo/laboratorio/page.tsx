import { Suspense } from "react";
import ConfiguracionClient from "../configuracion/ConfiguracionClient";

export default function FotografoLaboratorioPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <p className="text-gray-600">Cargando...</p>
        </div>
      }
    >
      <ConfiguracionClient defaultTab="laboratorio" workspaceTitle="Lab preferido y márgenes" />
    </Suspense>
  );
}
