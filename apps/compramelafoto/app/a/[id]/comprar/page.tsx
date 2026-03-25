import { Suspense } from "react";
import ComprarClient from "./ComprarClient";

export default function AlbumComprarPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-[#6b7280]">Cargando...</p>
        </div>
      }
    >
      <ComprarClient />
    </Suspense>
  );
}
