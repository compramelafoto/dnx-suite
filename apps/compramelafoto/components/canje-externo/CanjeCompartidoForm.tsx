"use client";

import { useState } from "react";

type Props = {
  token: string;
  albumTitle: string;
  photographerName: string | null;
  giftLabel: string;
};

/**
 * Formulario del link compartido de regalo: la familia deja sus datos (todos obligatorios)
 * y pasa al canje por pasos de su propio combo. El fotógrafo después revisa los nombres.
 */
export default function CanjeCompartidoForm({ token, albumTitle, photographerName, giftLabel }: Props) {
  const [parentName, setParentName] = useState("");
  const [studentName, setStudentName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [albumHref, setAlbumHref] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAlbumHref(null);
    setEnviando(true);
    try {
      const res = await fetch(`/api/canje/compartido/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentName, studentName, email, phone }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok: true; href: string }
        | { ok: false; error?: string; albumHref?: string | null }
        | null;
      if (data && data.ok) {
        window.location.assign(data.href);
        return;
      }
      setError((data && !data.ok && data.error) || "No pudimos guardar tus datos. Probá de nuevo.");
      if (data && !data.ok && data.albumHref) setAlbumHref(data.albumHref);
    } catch {
      setError("No hay conexión. Revisá internet y probá de nuevo.");
    }
    setEnviando(false);
  }

  const campo =
    "mt-1 w-full rounded-lg border border-[#d9d2ca] bg-white px-3 py-2.5 text-base text-[#1f2328] outline-none focus:border-[#a8652e]";

  return (
    <section className="mx-auto max-w-lg px-4 py-10">
      <div className="rounded-2xl bg-white px-5 py-8 shadow-[0_1px_2px_rgba(60,40,20,0.08)] sm:px-8">
        <p className="m-0 text-sm text-[#6b6f76]">
          {albumTitle}
          {photographerName ? ` — ${photographerName}` : ""}
        </p>
        <h1 className="m-0 mt-2 text-2xl font-semibold text-[#1f2328]">Tenés {giftLabel}</h1>
        <p className="m-0 mt-2 text-[#4b4f56]">
          Completá tus datos para elegir tus fotos. Después, si querés, podés sumar más fotos pagas.
        </p>

        <form onSubmit={enviar} className="mt-6 space-y-4">
          <label className="block text-sm font-medium text-[#1f2328]">
            Tu nombre y apellido
            <input
              className={campo}
              value={parentName}
              onChange={(e) => setParentName(e.target.value)}
              autoComplete="name"
              required
            />
          </label>
          <label className="block text-sm font-medium text-[#1f2328]">
            Nombre y apellido de quien aparece en las fotos
            <input className={campo} value={studentName} onChange={(e) => setStudentName(e.target.value)} required />
          </label>
          <label className="block text-sm font-medium text-[#1f2328]">
            Email
            <input
              className={campo}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </label>
          <label className="block text-sm font-medium text-[#1f2328]">
            WhatsApp (con código de área)
            <input
              className={campo}
              type="tel"
              inputMode="tel"
              placeholder="341 555 1234"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
              required
            />
          </label>

          {error ? (
            <p className="m-0 rounded-lg bg-[#fdf0ec] px-3 py-2 text-sm text-[#9a3b1f]">
              {error}{" "}
              {albumHref ? (
                <a href={albumHref} className="font-medium underline">
                  Ir a la galería
                </a>
              ) : null}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={enviando}
            className="w-full rounded-xl bg-[#2f7d5b] px-4 py-3 text-base font-semibold text-white disabled:opacity-60"
          >
            {enviando ? "Guardando…" : "Continuar"}
          </button>
          <p className="m-0 text-center text-xs text-[#6b6f76]">
            El regalo es uno por familia. El fotógrafo revisa los datos antes de entregar las fotos.
          </p>
        </form>
      </div>
    </section>
  );
}
