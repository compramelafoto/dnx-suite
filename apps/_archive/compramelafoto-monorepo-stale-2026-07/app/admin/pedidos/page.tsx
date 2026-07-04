import { Suspense } from "react";
import PedidosClient from "./PedidosClient";

export default function AdminPedidosPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-[#6b7280]">Cargando...</p>
        </div>
      }
    >
      <PedidosClient />
    </Suspense>
  );
}
