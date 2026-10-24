"use client";

import { buildGoogleAuthUrl } from "@/lib/auth/build-google-auth-url";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import AccessShell from "./AccessShell";
import ProfileFields, { EMPTY_PROFILE, profilePayload, type ProfileState } from "./ProfileFields";
import { fetchGate, nextPathFor, safeReturn } from "./access-client";

/**
 * Registro en Cam Of Duty: crea una cuenta de fotógrafo de CompraMeLaFoto con
 * sus datos (georreferenciados) y después se valida el email con un código.
 */
export default function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const returnTo = safeReturn(params.get("redirect"));
  const [profile, setProfile] = useState<ProfileState>(EMPTY_PROFILE);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accept, setAccept] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [exists, setExists] = useState(false);
  const [busy, setBusy] = useState(false);

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
    setErrors({});
    setExists(false);
    try {
      const res = await fetch("/api/camofduty/registro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...profilePayload(profile), email, password, acceptTerms: accept }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrors(data.errors ?? {});
        setExists(!!data.exists);
        throw new Error(data.error || "No pudimos crear la cuenta.");
      }
      router.replace(`/camofduty/verificar?redirect=${encodeURIComponent(returnTo)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos crear la cuenta.");
      setBusy(false);
    }
  };

  return (
    <AccessShell
      wide
      title="Creá tu cuenta"
      subtitle="Cam Of Duty es gratis para fotógrafos. Completá tus datos: te pedimos un código para validar tu email."
    >
      <a className="cod-btn cod-btn--secondary cod-access__google" href={buildGoogleAuthUrl({ role: "PHOTOGRAPHER", redirect: returnTo })}>
        Registrarme con Google
      </a>
      <div className="cod-access__or">o con tu email</div>
      <form onSubmit={submit} className="cod-access__form" noValidate>
        <ProfileFields value={profile} onChange={setProfile} errors={errors} />
        <div className="cod-field-row">
          <div className="cod-field">
            <label htmlFor="cod-email">Email</label>
            <input id="cod-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!errors.email} />
            {errors.email ? <span className="cod-field__error">{errors.email}</span> : null}
          </div>
          <div className="cod-field">
            <label htmlFor="cod-pass">Contraseña</label>
            <input id="cod-pass" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!errors.password} />
            {errors.password ? <span className="cod-field__error">{errors.password}</span> : <span className="cod-field__hint">Al menos 8 caracteres</span>}
          </div>
        </div>
        <label className="cod-check">
          <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} />
          <span>
            Acepto los{" "}
            <a href="/terminos" target="_blank" rel="noreferrer">
              términos
            </a>{" "}
            y la{" "}
            <a href="/privacidad" target="_blank" rel="noreferrer">
              política de privacidad
            </a>{" "}
            de CompraMeLaFoto.
          </span>
        </label>
        {errors.acceptTerms ? <span className="cod-field__error">{errors.acceptTerms}</span> : null}
        {error ? (
          <p className="cod-access__error">
            {error}
            {exists ? (
              <>
                {" "}
                <Link href={`/camofduty/ingresar?redirect=${encodeURIComponent(returnTo)}`}>Ingresar</Link>
              </>
            ) : null}
          </p>
        ) : null}
        <button className="cod-btn cod-btn--primary cod-btn--full" type="submit" disabled={busy}>
          {busy ? "Creando la cuenta…" : "Crear cuenta"}
        </button>
      </form>
      <p className="cod-access__links">
        ¿Ya tenés cuenta? <Link href={`/camofduty/ingresar?redirect=${encodeURIComponent(returnTo)}`}>Ingresá</Link>
      </p>
    </AccessShell>
  );
}
