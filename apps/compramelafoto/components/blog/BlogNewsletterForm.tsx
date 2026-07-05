"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { cn } from "@/lib/utils";

type BlogNewsletterFormProps = {
  source?: string;
  compact?: boolean;
};

export default function BlogNewsletterForm({ source = "blog-home", compact = false }: BlogNewsletterFormProps) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/public/blog/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name: name.trim() || undefined,
          source,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No pudimos registrar tu suscripción.");
      setSuccess(data.message || "¡Gracias por suscribirte!");
      setEmail("");
      setName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al suscribirte.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={cn("blog-newsletter-card", compact && "blog-newsletter-card--compact")}>
      <h2 className="blog-newsletter-card__title">Newsletter del blog</h2>
      <p className="blog-newsletter-card__lead">
        Recibí novedades sobre fotografía, eventos y ComprameLaFoto. Sin spam.
      </p>
      <form onSubmit={handleSubmit} className="ds-form-stack mt-4">
        {!compact ? (
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tu nombre (opcional)"
            disabled={loading}
          />
        ) : null}
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@email.com"
          required
          disabled={loading}
        />
        <Button type="submit" disabled={loading} className="w-full sm:w-auto">
          {loading ? "Enviando..." : "Suscribirme"}
        </Button>
      </form>
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      {success ? <p className="mt-3 text-sm text-green-700">{success}</p> : null}
    </div>
  );
}
