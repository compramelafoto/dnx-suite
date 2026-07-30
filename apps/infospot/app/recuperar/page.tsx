import type { Metadata } from "next";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = {
  title: "Recuperar contraseña",
  robots: { index: false, follow: false },
};

export default function RecuperarPage() {
  return (
    <main className="flex min-h-[70vh] w-full items-center justify-center px-6 py-16 md:px-10">
      <ForgotPasswordForm />
    </main>
  );
}
