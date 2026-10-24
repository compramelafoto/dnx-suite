"use client";

import { buildGoogleAuthUrl } from "@/lib/auth/build-google-auth-url";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import AccessShell from "./AccessShell";
import { fetchGate, nextPathFor, safeReturn } from "./access-client";

/** Ingresar a Cam Of Duty con la cuenta de fotógrafo (email y contraseña, o Google). */
export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const returnTo = safeReturn(params.get("redirect"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const notPhotographer = params.get("cuenta") === "no-fotografo";
  const [error, setError] = useState<string | null>(
    params.get("error") ?? (notPhotographer ? "Esa cuenta de CompraMeLaFoto no es de fotógrafo. Cam Of Duty es para fotógrafos: registrate con otro email." : null),
  );

  // Con sesión de CLF ya iniciada no se pide nada: sigue al simulador (o al paso que le falte).
  useEffect(() => {
    void fetchGate().then((gate) => {
      const next = gate ? nextPathFor(gate, returnTo) : null;
      if (next) router.replace(next);
    });
  }, [router, returnTo]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No pudimos iniciar sesión.");
      const gate = await fetchGate();
      const next = gate ? nextPathFor(gate, returnTo) : null;
      if (!next) throw new Error("Esa cuenta de CompraMeLaFoto no es de fotógrafo. Cam Of Duty es para fotógrafos: registrate con otro email.");
      router.replace(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos iniciar sesión.");
      setBusy(false);
    }
  };

  return (
    <AccessShell title="Ingresar" subtitle="Usá tu cuenta de fotógrafo para entrar al simulador y al estudio de luz.">
      <a className="cod-btn cod-btn--secondary cod-access__google" href={buildGoogleAuthUrl({ role: "PHOTOGRAPHER", redirect: returnTo })}>
        Continuar con Google
      </a>
      <div className="cod-access__or">o con tu email</div>
      <form onSubmit={submit} className="cod-access__form">
        <div className="cod-field">
          <label htmlFor="cod-email">Email</label>
          <input id="cod-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="cod-field">
          <label htmlFor="cod-pass">Contraseña</label>
          <input id="cod-pass" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error ? <p className="cod-access__error">{error}</p> : null}
        <button className="cod-btn cod-btn--primary cod-btn--full" type="submit" disabled={busy}>
          {busy ? "Ingresando…" : "Ingresar"}
        </button>
      </form>
      <p className="cod-access__links">
        ¿No tenés cuenta? <Link href={`/camofduty/registro?redirect=${encodeURIComponent(returnTo)}`}>Registrate gratis</Link>
        <span aria-hidden="true"> · </span>
        <Link href="/forgot-password">Olvidé mi contraseña</Link>
      </p>
    </AccessShell>
  );
}
