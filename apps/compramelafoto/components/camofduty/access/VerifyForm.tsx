"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import AccessShell from "./AccessShell";
import { fetchGate, nextPathFor, safeReturn } from "./access-client";

/** Validar el email con el código de 6 dígitos que llegó por correo. */
export default function VerifyForm() {
  const router = useRouter();
  const params = useSearchParams();
  const returnTo = safeReturn(params.get("redirect"));
  const [email, setEmail] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const asked = useRef(false);

  // Quien llega sin código (por ejemplo, una cuenta vieja) recibe uno al entrar.
  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    void (async () => {
      const res = await fetch("/api/camofduty/perfil", { credentials: "include", cache: "no-store" });
      if (res.status === 401) {
        router.replace(`/camofduty/ingresar?redirect=${encodeURIComponent(returnTo)}`);
        return;
      }
      const data = await res.json().catch(() => ({}));
      setEmail(data.email ?? null);
      if (data.gate && data.gate !== "verify") {
        const next = nextPathFor(data.gate, returnTo);
        if (next) router.replace(next);
        return;
      }
      await fetch("/api/camofduty/codigo", { method: "POST", credentials: "include" });
      setCooldown(60);
    })();
  }, [router, returnTo]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/camofduty/verificar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No pudimos validar el código.");
      const gate = await fetchGate();
      router.replace((gate && nextPathFor(gate, returnTo)) || returnTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos validar el código.");
      setBusy(false);
    }
  };

  const resend = async () => {
    setError(null);
    setInfo(null);
    const res = await fetch("/api/camofduty/codigo", { method: "POST", credentials: "include" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setError(data.error || "No pudimos mandar el código.");
    else setInfo("Te mandamos un código nuevo.");
    setCooldown(60);
  };

  return (
    <AccessShell
      title="Validá tu email"
      subtitle={
        <>
          Te mandamos un código de 6 números{email ? (
            <>
              {" "}a <strong>{email}</strong>
            </>
          ) : null}
          . Si no lo ves, revisá la carpeta de spam.
        </>
      }
    >
      <form onSubmit={submit} className="cod-access__form">
        <div className="cod-field">
          <label htmlFor="cod-code">Código</label>
          <input
            id="cod-code"
            className="cod-code-input"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={7}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ""))}
            placeholder="000000"
            autoFocus
          />
        </div>
        {error ? <p className="cod-access__error">{error}</p> : null}
        {info ? <p className="cod-access__info">{info}</p> : null}
        <button className="cod-btn cod-btn--primary cod-btn--full" type="submit" disabled={busy || code.replace(/\D/g, "").length !== 6}>
          {busy ? "Validando…" : "Validar"}
        </button>
      </form>
      <p className="cod-access__links">
        <button type="button" className="cod-link" onClick={resend} disabled={cooldown > 0}>
          {cooldown > 0 ? `Pedir otro código (${cooldown} s)` : "Pedir otro código"}
        </button>
      </p>
    </AccessShell>
  );
}
