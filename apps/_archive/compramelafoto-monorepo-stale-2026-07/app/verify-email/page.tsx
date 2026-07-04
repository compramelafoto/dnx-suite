import { Suspense } from "react";
import VerifyEmailClient from "./VerifyEmailClient";

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center px-6 py-16">
          <p className="text-[#6b7280]">Verificando tu email...</p>
        </div>
      }
    >
      <VerifyEmailClient />
    </Suspense>
  );
}
