"use client";

import { useCallback, useEffect, useState } from "react";

type Laboratorio = {
  id: number;
  labId: number | null;
  nombre: string;
  email: string;
  whatsapp: string | null;
  esPredeterminado: boolean;
  puntoDeRetiro: boolean;
  direccion: string | null;
  horario: string | null;
};

type LabDirectorio = {
  id: number;
  name: string;
  city: string | null;
  email: string | null;
  address: string | null;
  logoUrl?: string | null;
};

type Formulario = {
  nombre: string;
  email: string;
  whatsapp: string;
  puntoDeRetiro: boolean;
  direccion: string;
  horario: string;
  esPredeterminado: boolean;
};

const VACIO: Formulario = {
  nombre: "",
  email: "",
  whatsapp: "",
  puntoDeRetiro: false,
  direccion: "",
  horario: "",
  esPredeterminado: false,
};

const CAMPO =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#c27b3d]";

export default function MisLaboratorios() {
  const [lista, setLista] = useState<Laboratorio[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Formulario | null>(null);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [directorio, setDirectorio] = useState<LabDirectorio[] | null>(null);
  const [cargandoDirectorio, setCargandoDirectorio] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const res = await fetch("/api/fotografo/laboratorios", { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "No pudimos cargar tus laboratorios.");
      setLista(data.laboratorios ?? []);
    } catch (e: any) {
      setError(e?.message || "No pudimos cargar tus laboratorios.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  function nuevo() {
    setError(null);
    setEditandoId(null);
    setForm({ ...VACIO, esPredeterminado: lista.length === 0 });
  }

  function editar(l: Laboratorio) {
    setError(null);
    setEditandoId(l.id);
    setForm({
      nombre: l.nombre,
      email: l.email,
      whatsapp: l.whatsapp ?? "",
      puntoDeRetiro: l.puntoDeRetiro,
      direccion: l.direccion ?? "",
      horario: l.horario ?? "",
      esPredeterminado: l.esPredeterminado,
    });
  }

  async function abrirDirectorio() {
    setError(null);
    setCargandoDirectorio(true);
    try {
      const res = await fetch("/api/fotografo/laboratorios?directorio=1", { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "No pudimos cargar el directorio.");
      setDirectorio(data.labs ?? []);
    } catch (e: any) {
      setError(e?.message || "No pudimos cargar el directorio.");
    } finally {
      setCargandoDirectorio(false);
    }
  }

  function elegirDelDirectorio(lab: LabDirectorio) {
    // El correo identifica al laboratorio: al guardar, el servidor lo vincula con el del directorio.
    setForm((f) => ({
      ...(f ?? VACIO),
      nombre: lab.name,
      email: lab.email ?? "",
      direccion: f?.direccion || lab.address || "",
    }));
    setDirectorio(null);
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(
        editandoId ? `/api/fotografo/laboratorios/${editandoId}` : "/api/fotografo/laboratorios",
        {
          method: editandoId ? "PATCH" : "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "No pudimos guardar el laboratorio.");
      setForm(null);
      setEditandoId(null);
      await cargar();
    } catch (err: any) {
      setError(err?.message || "No pudimos guardar el laboratorio.");
    } finally {
      setGuardando(false);
    }
  }

  async function quitar(l: Laboratorio) {
    if (!window.confirm(`¿Sacás a ${l.nombre} de tus laboratorios? Los lotes ya armados no se tocan.`)) return;
    setError(null);
    try {
      const res = await fetch(`/api/fotografo/laboratorios/${l.id}`, { method: "DELETE", credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "No pudimos quitar el laboratorio.");
      await cargar();
    } catch (e: any) {
      setError(e?.message || "No pudimos quitar el laboratorio.");
    }
  }

  async function hacerPredeterminado(l: Laboratorio) {
    setError(null);
    try {
      const res = await fetch(`/api/fotografo/laboratorios/${l.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ esPredeterminado: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "No pudimos cambiar el predeterminado.");
      await cargar();
    } catch (e: any) {
      setError(e?.message || "No pudimos cambiar el predeterminado.");
    }
  }

  const set = <K extends keyof Formulario>(k: K, v: Formulario[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  return (
    <section className="w-full min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <p className="max-w-2xl text-gray-600 leading-relaxed">
          Cargá los laboratorios a los que les mandás tus lotes de impresión. El predeterminado se elige solo al
          armar un lote.
        </p>
        {!form && (
          <button
            type="button"
            onClick={nuevo}
            className="rounded-lg bg-[#c27b3d] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Agregar laboratorio
          </button>
        )}
      </div>

      {error && (
        <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {form && (
        <form onSubmit={guardar} className="mb-6 rounded-xl border border-gray-200 bg-white p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-gray-900">
              {editandoId ? "Editar laboratorio" : "Nuevo laboratorio"}
            </h2>
            {!editandoId && (
              <button
                type="button"
                onClick={abrirDirectorio}
                disabled={cargandoDirectorio}
                className="text-sm font-medium text-[#c27b3d] hover:underline disabled:opacity-50"
              >
                {cargandoDirectorio ? "Buscando..." : "Elegir del directorio"}
              </button>
            )}
          </div>

          {directorio && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-2 max-h-56 overflow-auto">
              {directorio.length === 0 ? (
                <p className="p-2 text-sm text-gray-600">Todavía no hay laboratorios en el directorio.</p>
              ) : (
                <ul className="divide-y divide-gray-200">
                  {directorio.map((lab) => (
                    <li key={lab.id}>
                      <button
                        type="button"
                        onClick={() => elegirDelDirectorio(lab)}
                        disabled={!lab.email}
                        className="w-full text-left px-2 py-2 text-sm hover:bg-white disabled:opacity-50 flex items-center gap-2"
                      >
                        {lab.logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={lab.logoUrl}
                            alt=""
                            className="h-8 w-8 shrink-0 rounded-full object-contain p-0.5 border border-gray-200 bg-white"
                          />
                        ) : (
                          <span className="h-8 w-8 shrink-0 rounded-full border border-gray-200 bg-white" aria-hidden />
                        )}
                        <span className="min-w-0">
                          <span className="font-medium text-gray-900">{lab.name}</span>
                          {lab.city && <span className="text-gray-600"> · {lab.city}</span>}
                          {!lab.email && <span className="text-gray-500"> (sin correo cargado)</span>}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm text-gray-700">
              Nombre
              <input className={CAMPO} value={form.nombre} onChange={(e) => set("nombre", e.target.value)} required />
            </label>
            <label className="block text-sm text-gray-700">
              Correo
              <input
                className={CAMPO}
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                required
              />
            </label>
            <label className="block text-sm text-gray-700">
              WhatsApp (opcional)
              <input className={CAMPO} value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} />
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.puntoDeRetiro}
              onChange={(e) => set("puntoDeRetiro", e.target.checked)}
            />
            Tus clientes retiran en este laboratorio
          </label>
          {form.puntoDeRetiro && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm text-gray-700">
                Dirección
                <input className={CAMPO} value={form.direccion} onChange={(e) => set("direccion", e.target.value)} />
              </label>
              <label className="block text-sm text-gray-700">
                Horario de retiro
                <input
                  className={CAMPO}
                  placeholder="Lunes a viernes de 9 a 18"
                  value={form.horario}
                  onChange={(e) => set("horario", e.target.value)}
                />
              </label>
            </div>
          )}

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.esPredeterminado}
              onChange={(e) => set("esPredeterminado", e.target.checked)}
            />
            Usarlo como predeterminado
          </label>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={guardando}
              className="rounded-lg bg-[#c27b3d] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {guardando ? "Guardando..." : "Guardar"}
            </button>
            <button
              type="button"
              onClick={() => {
                setForm(null);
                setEditandoId(null);
                setDirectorio(null);
              }}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {cargando ? (
        <p className="text-gray-600">Cargando...</p>
      ) : lista.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center text-gray-600">
          Todavía no cargaste ningún laboratorio. Tocá «Agregar laboratorio» para empezar.
        </p>
      ) : (
        <ul className="space-y-3">
          {lista.map((l) => (
            <li key={l.id} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900">
                    {l.nombre}
                    {l.esPredeterminado && (
                      <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                        Predeterminado
                      </span>
                    )}
                    {l.labId && (
                      <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">
                        Del directorio
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-gray-600 break-all">{l.email}</p>
                  {l.whatsapp && <p className="text-sm text-gray-600">WhatsApp {l.whatsapp}</p>}
                  {l.puntoDeRetiro && (
                    <p className="text-sm text-gray-600">
                      Punto de retiro{l.direccion ? ` · ${l.direccion}` : ""}
                      {l.horario ? ` · ${l.horario}` : ""}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-3 text-sm">
                  {!l.esPredeterminado && (
                    <button type="button" onClick={() => hacerPredeterminado(l)} className="text-[#c27b3d] hover:underline">
                      Hacer predeterminado
                    </button>
                  )}
                  <button type="button" onClick={() => editar(l)} className="text-gray-700 hover:underline">
                    Editar
                  </button>
                  <button type="button" onClick={() => quitar(l)} className="text-red-600 hover:underline">
                    Quitar
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
