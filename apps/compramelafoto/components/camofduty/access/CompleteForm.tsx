"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import AccessShell from "./AccessShell";
import ProfileFields, { EMPTY_PROFILE, profilePayload, type ProfileState } from "./ProfileFields";
import { safeReturn } from "./access-client";

interface PerfilResponse {
  gate: string;
  profile: {
    firstName: string;
    lastName: string;
    whatsapp: string;
    instagram: string;
    company: string;
    city: string;
    province: string;
    country: string;
    latitude: number | null;
    longitude: number | null;
    jobAlerts: boolean;
  };
}

/** Completar los datos que le faltan a una cuenta (por ejemplo, la de Google o una cuenta vieja de CLF). */
export default function CompleteForm() {
  const router = useRouter();
  const params = useSearchParams();
  const returnTo = safeReturn(params.get("redirect"));
  const [profile, setProfile] = useState<ProfileState>(EMPTY_PROFILE);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/camofduty/perfil", { credentials: "include", cache: "no-store" });
      if (res.status === 401) {
        router.replace(`/camofduty/ingresar?redirect=${encodeURIComponent(returnTo)}`);
        return;
      }
      const data = (await res.json()) as PerfilResponse;
      const p = data.profile;
      setProfile({
        firstName: p.firstName,
        lastName: p.lastName,
        whatsapp: p.whatsapp,
        instagram: p.instagram,
        company: p.company,
        city: p.city && p.latitude != null && p.longitude != null ? { city: p.city, province: p.province, country: p.country, latitude: p.latitude, longitude: p.longitude } : null,
        jobAlerts: p.jobAlerts,
      });
    })();
  }, [router, returnTo]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setErrors({});
    try {
      const res = await fetch("/api/camofduty/perfil", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(profilePayload(profile)),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrors(data.errors ?? {});
        throw new Error(data.error || "No pudimos guardar tus datos.");
      }
      router.replace(returnTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos guardar tus datos.");
      setBusy(false);
    }
  };

  return (
    <AccessShell wide title="Completá tus datos" subtitle="Una sola vez: así sabemos quién sos y dónde trabajás.">
      <form onSubmit={submit} className="cod-access__form" noValidate>
        <ProfileFields value={profile} onChange={setProfile} errors={errors} />
        {error ? <p className="cod-access__error">{error}</p> : null}
        <button className="cod-btn cod-btn--primary cod-btn--full" type="submit" disabled={busy}>
          {busy ? "Guardando…" : "Guardar y entrar"}
        </button>
      </form>
    </AccessShell>
  );
}
