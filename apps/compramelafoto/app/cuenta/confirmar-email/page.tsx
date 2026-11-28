import { Suspense } from "react";
import ConfirmarEmailClient from "./ConfirmarEmailClient";

export const dynamic = "force-dynamic";

export default function ConfirmarEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center px-6 py-16">
          <p className="text-[#6b7280]">Confirmando tu nuevo email…</p>
        </div>
      }
    >
      <ConfirmarEmailClient />
    </Suspense>
  );
}
