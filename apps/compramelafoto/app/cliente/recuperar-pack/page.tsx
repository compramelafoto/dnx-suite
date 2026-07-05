"use client";

import { useState } from "react";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

export default function RecuperarPackPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/public/pack/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        throw new Error("No se pudo enviar la solicitud.");
      }
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#fafafa] px-4 py-12 sm:py-16">
      <div className="max-w-3xl mx-auto">
        <Card className="space-y-4 p-6 sm:p-8">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-[#1a1a1a]">Recuperar acceso a tu pack</h1>
            <p className="text-sm text-[#6b7280]">
              Te vamos a enviar un link para continuar tu pedido.
            </p>
          </div>
          {submitted ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              Si encontramos pedidos con ese email, te enviamos un link de acceso.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              {error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              ) : null}
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1">
                  Email
                </label>
                <Input
                  type="email"
                  required
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Enviando…" : "Enviar link"}
              </Button>
            </form>
          )}
        </Card>
      </div>
    </main>
  );
}
