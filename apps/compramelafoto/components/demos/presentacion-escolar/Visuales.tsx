"use client";

import { useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import type { VisualPlaca } from "./placas";

/*
 * Dibujos de las placas: maquetas de las pantallas, sin datos (nombres y números genéricos).
 * No usan la base ni las pantallas reales: sirven aunque la demo no esté preparada.
 */

const COBRE = "#c27b3d";
const VERDE = "#5cb46a";

function Barra({ w = "100%", tono = "bg-slate-200", alto = "h-2" }: { w?: string; tono?: string; alto?: string }) {
  return <span className={`block rounded-full ${alto} ${tono}`} style={{ width: w }} />;
}

/** Lugar de una foto: un retrato genérico (silueta) sobre un degradé. */
function Foto({ className = "", tono = 0 }: { className?: string; tono?: number }) {
  const fondos = [
    "from-amber-200 to-orange-300",
    "from-sky-200 to-indigo-300",
    "from-emerald-200 to-teal-300",
    "from-rose-200 to-pink-300",
    "from-violet-200 to-fuchsia-300",
    "from-lime-200 to-green-300",
  ];
  return (
    <span className={`relative block overflow-hidden bg-gradient-to-br ${fondos[tono % fondos.length]} ${className}`}>
      <svg viewBox="0 0 40 40" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMax meet" aria-hidden>
        <circle cx="20" cy="16" r="7" fill="white" fillOpacity="0.75" />
        <path d="M6 40c0-9 6-14 14-14s14 5 14 14z" fill="white" fillOpacity="0.75" />
      </svg>
    </span>
  );
}

/** Código QR de adorno (no lleva a ningún lado). */
function QR({ className = "h-16 w-16" }: { className?: string }) {
  const n = 11;
  const celdas: boolean[] = [];
  for (let i = 0; i < n * n; i++) celdas.push(((i * 37 + (i % 7) * 11) % 5) < 2);
  const esquina = (x: number, y: number) =>
    (x < 3 && y < 3) || (x > n - 4 && y < 3) || (x < 3 && y > n - 4);
  return (
    <span className={`grid bg-white p-1 ${className}`} style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }} aria-hidden>
      {celdas.map((on, i) => {
        const x = i % n;
        const y = Math.floor(i / n);
        const lleno = esquina(x, y) || on;
        return <span key={i} className={lleno ? "bg-slate-900" : "bg-white"} />;
      })}
    </span>
  );
}

function Navegador({ url, children, oscuro = false }: { url: string; children: ReactNode; oscuro?: boolean }) {
  return (
    <div className={`w-full overflow-hidden rounded-2xl border shadow-xl ${oscuro ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"}`}>
      <div className={`flex items-center gap-2 border-b px-3 py-2 ${oscuro ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-slate-50"}`}>
        <span className="h-2.5 w-2.5 rounded-full bg-red-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-green-300" />
        <span className={`ml-2 truncate rounded-md px-3 py-0.5 text-[11px] ${oscuro ? "bg-slate-700 text-slate-300" : "bg-white text-slate-500"}`}>{url}</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Telefono({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-[230px] rounded-[2.2rem] border-[7px] border-slate-900 bg-white shadow-2xl">
      <div className="mx-auto mt-1.5 h-4 w-20 rounded-full bg-slate-900" />
      <div className="h-[400px] overflow-hidden px-3 pb-3 pt-2">{children}</div>
    </div>
  );
}

function Boton({ children, tono = COBRE, className = "" }: { children: ReactNode; tono?: string; className?: string }) {
  return (
    <span className={`inline-block rounded-full px-3 py-1.5 text-center text-xs font-semibold text-white ${className}`} style={{ background: tono }}>
      {children}
    </span>
  );
}

function Chip({ children, activo = false }: { children: ReactNode; activo?: boolean }) {
  return (
    <span
      className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${activo ? "border-transparent text-white" : "border-slate-200 bg-white text-slate-600"}`}
      style={activo ? { background: COBRE } : undefined}
    >
      {children}
    </span>
  );
}

/** Página de un librito: foto, nombre y curso genéricos. */
function PaginaLibrito({ variante = 0 }: { variante?: number }) {
  if (variante === 1) {
    return (
      <div className="grid h-full grid-cols-2 gap-1.5 bg-[#fbf6f1] p-2.5">
        {[0, 1, 2, 3].map((i) => (
          <Foto key={i} tono={i + 1} className="rounded-md" />
        ))}
      </div>
    );
  }
  if (variante === 2) {
    return (
      <div className="flex h-full flex-col bg-white p-2.5">
        <span className="text-center text-[9px] font-bold uppercase tracking-wider" style={{ color: COBRE }}>
          Mis compañeros
        </span>
        <div className="mt-1.5 grid flex-1 grid-cols-4 gap-1">
          {Array.from({ length: 16 }, (_, i) => (
            <span key={i} className="flex flex-col items-center gap-0.5">
              <Foto tono={i} className="aspect-square w-full rounded-full" />
              <Barra w="80%" alto="h-[3px]" />
            </span>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 bg-gradient-to-b from-[#fbf6f1] to-[#f3e3d3] p-3">
      <span className="text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: COBRE }}>
        Tu colegio · 2026
      </span>
      <Foto tono={0} className="aspect-[3/4] w-3/4 rounded-lg border-4 border-white shadow" />
      <span className="text-sm font-extrabold text-slate-800">Nombre Apellido</span>
      <span className="text-[10px] text-slate-500">3.º grado A</span>
    </div>
  );
}

/** El librito en 3D: se abre, pasa una hoja y vuelve a cerrarse. Se puede girar arrastrando. */
function Libro3D() {
  const [giro, setGiro] = useState(-18);
  const arrastre = useRef<{ x: number; giro: number } | null>(null);
  return (
    <div
      className="flex h-[380px] w-full cursor-grab touch-none select-none items-center justify-center active:cursor-grabbing"
      style={{ perspective: "1600px" }}
      onPointerDown={(e) => {
        arrastre.current = { x: e.clientX, giro };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!arrastre.current) return;
        setGiro(Math.max(-60, Math.min(60, arrastre.current.giro + (e.clientX - arrastre.current.x) / 3)));
      }}
      onPointerUp={() => {
        arrastre.current = null;
      }}
      aria-label="Librito en 3D: arrastrá para girarlo"
    >
      <style>{`
@keyframes libro-tapa { 0%,12% { transform: rotateY(0deg); } 30%,82% { transform: rotateY(-178deg); } 96%,100% { transform: rotateY(0deg); } }
@keyframes libro-hoja { 0%,36% { transform: rotateY(0deg); } 52%,70% { transform: rotateY(-176deg); } 84%,100% { transform: rotateY(0deg); } }
.libro-tapa { animation: libro-tapa 9s ease-in-out infinite; }
.libro-hoja { animation: libro-hoja 9s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .libro-tapa, .libro-hoja { animation: none; transform: rotateY(-178deg); } }
`}</style>
      <div
        className="relative h-[300px] w-[220px] translate-x-[110px]"
        style={{ transformStyle: "preserve-3d", transform: `rotateX(12deg) rotateY(${giro}deg)` }}
      >
        {/* Contratapa con la última página interior */}
        <div className="absolute inset-0 overflow-hidden rounded-r-md border border-slate-200 shadow-2xl" style={{ transform: "translateZ(-4px)" }}>
          <PaginaLibrito variante={2} />
        </div>
        {/* Hoja interior: frente con fotos, dorso con el mosaico */}
        <div className="libro-hoja absolute inset-0" style={{ transformStyle: "preserve-3d", transformOrigin: "left center", transform: "translateZ(-1px)" }}>
          <div className="absolute inset-0 overflow-hidden rounded-r-md border border-slate-200" style={{ backfaceVisibility: "hidden" }}>
            <PaginaLibrito variante={1} />
          </div>
          <div className="absolute inset-0 overflow-hidden rounded-l-md border border-slate-200" style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
            <PaginaLibrito variante={0} />
          </div>
        </div>
        {/* Tapa */}
        <div className="libro-tapa absolute inset-0" style={{ transformStyle: "preserve-3d", transformOrigin: "left center", transform: "translateZ(1px)" }}>
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 overflow-hidden rounded-r-md p-5 text-white shadow-xl"
            style={{ backfaceVisibility: "hidden", background: `linear-gradient(135deg, ${COBRE}, #8a4f22)` }}
          >
            <span className="text-[10px] font-semibold uppercase tracking-[0.25em] opacity-80">Tu colegio</span>
            <Foto tono={0} className="aspect-square w-32 rounded-full border-4 border-white/80" />
            <span className="text-lg font-extrabold">Nombre Apellido</span>
            <span className="text-xs opacity-80">3.º grado A · 2026</span>
          </div>
          <div className="absolute inset-0 overflow-hidden rounded-l-md border border-slate-200 bg-[#fbf6f1]" style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
            <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
              <span className="text-xs font-bold" style={{ color: COBRE }}>
                Mi año en el colegio
              </span>
              <Barra w="70%" />
              <Barra w="55%" />
              <Barra w="62%" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Portada() {
  return (
    <div className="relative flex h-[360px] items-center justify-center">
      <div className="absolute left-4 top-6 w-40 -rotate-6 rounded-xl bg-white p-2 shadow-xl">
        <Foto tono={1} className="aspect-[4/3] rounded-md" />
        <Barra w="60%" alto="h-1.5" tono="bg-slate-300 mt-2" />
      </div>
      <div className="absolute bottom-6 right-4 w-44 rotate-6 rounded-xl bg-white p-2 shadow-xl">
        <Foto tono={2} className="aspect-[4/3] rounded-md" />
        <Barra w="45%" alto="h-1.5" tono="bg-slate-300 mt-2" />
      </div>
      <div className="relative z-10 flex h-56 w-56 items-center justify-center rounded-full bg-white shadow-2xl">
        <Image src="/demos/isotipo-clf.png" alt="" width={290} height={290} className="h-36 w-36" />
      </div>
    </div>
  );
}

function Landing() {
  return (
    <Navegador url="compramelafoto.com/escolar/tu-estudio">
      <div className="rounded-xl bg-gradient-to-br from-[#fbf6f1] to-[#f1dfcc] p-5">
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: COBRE }}>
          Tu estudio
        </span>
        <p className="mt-1 text-xl font-extrabold leading-tight text-slate-900">Fotografía escolar sin gestionar cobros ni pedidos</p>
        <div className="mt-3 flex gap-2">
          <Boton>Pedir propuesta</Boton>
          <span className="rounded-full border border-slate-300 px-3 py-1.5 text-xs text-slate-600">Ver trabajos</span>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <Foto key={i} tono={i + 2} className="aspect-[4/3] rounded-lg" />
        ))}
      </div>
      <div className="mt-3 flex items-center gap-3 rounded-xl border border-slate-200 p-3">
        <QR className="h-14 w-14 shrink-0" />
        <div className="flex-1 space-y-1.5">
          <p className="text-xs font-semibold text-slate-700">Tu QR para compartir</p>
          <Barra w="80%" />
          <Barra w="50%" />
        </div>
        <span className="rounded-full px-2 py-0.5 text-[11px] font-bold text-white" style={{ background: VERDE }}>
          3 consultas
        </span>
      </div>
    </Navegador>
  );
}

function Ficha() {
  const pestanas = ["Institución", "Administradores", "Gestión escolar", "Álbumes"];
  return (
    <Navegador url="compramelafoto.com/fotografo/escuelas">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl text-lg font-black text-white" style={{ background: COBRE }}>
          TC
        </span>
        <div>
          <p className="font-bold text-slate-900">Tu colegio</p>
          <p className="text-xs text-slate-500">Jardín · Primaria · Secundaria</p>
        </div>
      </div>
      <div className="mt-4 flex gap-1 border-b border-slate-200">
        {pestanas.map((p, i) => (
          <span
            key={p}
            className={`-mb-px border-b-2 px-2.5 py-1.5 text-xs font-medium ${i === 0 ? "text-slate-900" : "border-transparent text-slate-400"}`}
            style={i === 0 ? { borderColor: COBRE } : undefined}
          >
            {p}
          </span>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {["Nombre", "Dirección", "Teléfono", "Correo", "Niveles", "Logo"].map((c) => (
          <div key={c}>
            <p className="text-[11px] text-slate-500">{c}</p>
            <span className="mt-1 block h-8 rounded-lg border border-slate-200 bg-slate-50" />
          </div>
        ))}
      </div>
    </Navegador>
  );
}

function Listado() {
  return (
    <div className="flex items-center gap-4">
      <div className="w-28 shrink-0 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center shadow">
        <span className="mx-auto flex h-12 w-10 items-center justify-center rounded-md bg-emerald-600 text-xs font-black text-white">XLS</span>
        <p className="mt-2 text-[11px] font-semibold text-emerald-800">Padrón del colegio</p>
      </div>
      <span className="text-3xl" style={{ color: COBRE }}>
        →
      </span>
      <Navegador url="Listado de alumnos">
        <div className="mb-2 flex flex-wrap gap-1.5">
          <Chip activo>1.º A</Chip>
          <Chip>1.º B</Chip>
          <Chip>2.º A</Chip>
          <Chip>3.º A</Chip>
        </div>
        <div className="divide-y divide-slate-100">
          {[70, 55, 80, 62, 48, 74].map((w, i) => (
            <div key={i} className="flex items-center gap-3 py-1.5">
              <span className="w-5 text-[11px] text-slate-400">{i + 1}</span>
              <Barra w={`${w}%`} tono="bg-slate-300" />
              <span className="ml-auto text-[10px] text-slate-400">Mañana</span>
            </div>
          ))}
        </div>
      </Navegador>
    </div>
  );
}

function Bot() {
  return (
    <div className="mx-auto w-full max-w-sm space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
        <span className="h-8 w-8 rounded-full" style={{ background: COBRE }} />
        <p className="text-sm font-bold text-slate-800">DNX Bot</p>
      </div>
      <p className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-slate-900 px-3 py-2 text-sm text-white">
        Creá el colegio, con 1.º a 7.º grado turno mañana, y cargá este listado.
      </p>
      <p className="max-w-[85%] rounded-2xl rounded-bl-md bg-[#fbf6f1] px-3 py-2 text-sm text-slate-700">
        Listo. Preparé el colegio, 7 cursos y el listado de alumnos. ¿Lo guardo?
      </p>
      <div className="flex gap-2">
        <Boton tono={VERDE}>Sí, guardar</Boton>
        <span className="rounded-full border border-slate-300 px-3 py-1.5 text-xs text-slate-600">Cambiar algo</span>
      </div>
    </div>
  );
}

function Comision() {
  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative h-48 w-48">
        <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f1e4d6" strokeWidth="3.5" />
          <circle cx="18" cy="18" r="15.9" fill="none" stroke={COBRE} strokeWidth="3.5" strokeDasharray="10 90" strokeLinecap="round" />
        </svg>
        <span className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-black text-slate-900">%</span>
          <span className="text-xs text-slate-500">para el colegio</span>
        </span>
      </div>
      <div className="flex w-full max-w-sm items-center gap-2 text-center text-xs">
        <span className="flex-1 rounded-xl bg-white p-3 shadow">Familia paga</span>
        <span style={{ color: COBRE }}>→</span>
        <span className="flex-1 rounded-xl bg-white p-3 shadow">Vos cobrás</span>
        <span style={{ color: COBRE }}>→</span>
        <span className="flex-1 rounded-xl bg-white p-3 shadow">Colegio suma</span>
      </div>
    </div>
  );
}

function PanelEscuela({ cierre = false }: { cierre?: boolean }) {
  const cursos = [80, 65, 90, 45, 70, 55];
  return (
    <Navegador url="compramelafoto.com/escuela/panel">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Panel Escuela</p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {[cierre ? "Venta total" : "Familias que compraron", "Comisión del colegio", "Cursos"].map((t) => (
          <div key={t} className="rounded-xl bg-[#fbf6f1] p-3">
            <p className="text-[10px] text-slate-500">{t}</p>
            <Barra w="60%" alto="h-3 mt-2" tono="bg-[#c27b3d]/60" />
          </div>
        ))}
      </div>
      <div className="mt-4 flex h-32 items-end gap-2">
        {cursos.map((h, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <span className="w-full rounded-t-md" style={{ height: `${cierre ? Math.min(100, h + 20) : h}%`, background: i % 2 ? COBRE : VERDE }} />
            <span className="text-[10px] text-slate-400">{i + 1}.º</span>
          </div>
        ))}
      </div>
    </Navegador>
  );
}

function Packs() {
  return (
    <div className="grid grid-cols-2 gap-4">
      {[
        { t: "Librito + digitales", d: "Impreso con el nombre", libro: true },
        { t: "Fotos digitales", d: "Descarga en alta", libro: false },
      ].map((p) => (
        <div key={p.t} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
          {p.libro ? (
            <div className="mx-auto h-32 w-24 overflow-hidden rounded-r-md shadow-md">
              <PaginaLibrito />
            </div>
          ) : (
            <div className="grid h-32 grid-cols-3 gap-1">
              {Array.from({ length: 6 }, (_, i) => (
                <Foto key={i} tono={i} className="rounded" />
              ))}
            </div>
          )}
          <p className="mt-3 font-bold text-slate-900">{p.t}</p>
          <p className="text-xs text-slate-500">{p.d}</p>
          <p className="mt-2 text-lg font-black" style={{ color: COBRE }}>
            $ —
          </p>
        </div>
      ))}
    </div>
  );
}

function Plantillas() {
  const tipos = ["Librito", "Diploma", "Calendario", "Anuario", "Figuritas", "Señalador", "Portarretrato", "Tarjeta", "Póster"];
  const formas = ["aspect-[3/4]", "aspect-[4/3]", "aspect-[3/4]", "aspect-square", "aspect-[3/4]", "aspect-[4/3]", "aspect-[3/4]", "aspect-[3/4]"];
  return (
    <Navegador url="compramelafoto.com/fotografo/diseno">
      <div className="flex flex-wrap gap-1.5">
        {tipos.map((t, i) => (
          <Chip key={t} activo={i === 0}>
            {t}
          </Chip>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {["Jardín", "Primaria", "Secundaria", "Egresados", "Con logo", "Con listado"].map((t) => (
          <span key={t} className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
            {t} ▾
          </span>
        ))}
      </div>
      <p className="mt-3 text-[11px] font-bold uppercase tracking-widest text-slate-400">Plantillas del sistema</p>
      <div className="mt-2 grid grid-cols-4 gap-2">
        {formas.map((f, i) => (
          <div key={i} className="rounded-lg border border-slate-200 bg-white p-1.5">
            <div className={`${f} overflow-hidden rounded`}>
              {i % 3 === 0 ? <PaginaLibrito /> : i % 3 === 1 ? <PaginaLibrito variante={1} /> : <PaginaLibrito variante={2} />}
            </div>
            <Barra w="70%" alto="h-1.5 mt-1.5" tono="bg-slate-300" />
          </div>
        ))}
      </div>
    </Navegador>
  );
}

function Disenador() {
  return (
    <Navegador url="compramelafoto.com/fotografo/diseno/editor">
      <div className="flex h-[280px] gap-3">
        <div className="flex w-10 flex-col items-center gap-2 rounded-lg bg-slate-100 py-2">
          {["▢", "T", "◐", "▦", "☰", "⬚"].map((s) => (
            <span key={s} className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-xs text-slate-600 shadow-sm">
              {s}
            </span>
          ))}
        </div>
        <div className="relative flex flex-1 items-center justify-center rounded-lg bg-[repeating-linear-gradient(45deg,#f8fafc,#f8fafc_8px,#f1f5f9_8px,#f1f5f9_16px)]">
          <div className="relative h-[240px] w-[180px] bg-white shadow-lg">
            <span className="absolute inset-2 border border-dashed border-red-300" aria-hidden />
            <div className="absolute left-6 right-6 top-8 h-[120px] rounded border-2" style={{ borderColor: COBRE }}>
              <Foto tono={0} className="h-full w-full" />
            </div>
            <span className="absolute left-6 right-6 top-[172px] rounded border border-dashed border-slate-300 py-1 text-center text-[11px] font-bold text-slate-700">
              {"{Nombre del alumno}"}
            </span>
            <span className="absolute left-10 right-10 top-[200px] rounded border border-dashed border-slate-300 py-0.5 text-center text-[9px] text-slate-500">
              {"{Curso}"}
            </span>
          </div>
        </div>
        <div className="w-36 space-y-2 rounded-lg border border-slate-200 p-2 text-[10px] text-slate-500">
          <p className="font-bold text-slate-700">Bloque: Foto</p>
          <p>Origen</p>
          <span className="block rounded border border-slate-200 bg-slate-50 px-1.5 py-1 text-slate-700">Foto elegida 1</span>
          <p>Tamaño (cm)</p>
          <div className="flex gap-1">
            <span className="flex-1 rounded border border-slate-200 px-1.5 py-1">10,0</span>
            <span className="flex-1 rounded border border-slate-200 px-1.5 py-1">8,0</span>
          </div>
          <p>Encuadre</p>
          <Barra tono="bg-slate-200" />
          <p className="pt-1 font-bold text-slate-700">Páginas</p>
          <div className="flex gap-1">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={`h-8 flex-1 rounded border ${i === 0 ? "border-[#c27b3d]" : "border-slate-200"} bg-slate-50`} />
            ))}
          </div>
        </div>
      </div>
    </Navegador>
  );
}

function Variables() {
  const vars = ["{Nombre}", "{Curso}", "{Colegio}", "{Año}", "{Logo}", "{Foto 1}"];
  return (
    <div className="flex items-center gap-4">
      <div className="flex w-36 shrink-0 flex-col gap-2">
        {vars.map((v) => (
          <span key={v} className="rounded-lg border border-dashed bg-white px-3 py-1.5 text-center text-xs font-semibold text-slate-700" style={{ borderColor: COBRE }}>
            {v}
          </span>
        ))}
      </div>
      <span className="text-3xl" style={{ color: COBRE }}>
        →
      </span>
      <div className="relative h-[300px] flex-1">
        {[2, 1, 0].map((i) => (
          <div
            key={i}
            className="absolute h-[260px] w-[190px] overflow-hidden rounded-r-md border border-slate-200 shadow-xl"
            style={{ left: `${i * 34}px`, top: `${i * 14}px` }}
          >
            <PaginaLibrito />
          </div>
        ))}
      </div>
    </div>
  );
}

function Probar() {
  return (
    <Navegador url="Probar la plantilla con fotos">
      <div className="flex flex-wrap gap-2 text-[11px]">
        <span className="rounded-lg border border-slate-200 px-2 py-1 text-slate-600">Álbum de prueba ▾</span>
        <span className="rounded-lg border border-slate-200 px-2 py-1 text-slate-600">Curso: 3.º A ▾</span>
        <Boton tono={VERDE}>Armar</Boton>
      </div>
      <div className="mt-4 flex justify-center gap-0.5 rounded-xl bg-slate-100 p-4">
        <div className="h-[200px] w-[150px] overflow-hidden rounded-l-md shadow-lg">
          <PaginaLibrito variante={1} />
        </div>
        <div className="h-[200px] w-[150px] overflow-hidden rounded-r-md shadow-lg">
          <PaginaLibrito variante={2} />
        </div>
      </div>
    </Navegador>
  );
}

function Preventa() {
  return (
    <Telefono>
      <p className="text-center text-[10px] font-bold uppercase tracking-widest" style={{ color: COBRE }}>
        Preventa · Tu colegio
      </p>
      <div className="mt-2 overflow-hidden rounded-xl border border-slate-200">
        <div className="h-28">
          <PaginaLibrito />
        </div>
        <div className="p-2.5">
          <p className="text-sm font-bold text-slate-900">Librito + digitales</p>
          <p className="text-[11px] text-slate-500">Alumno: elegí del listado ▾</p>
        </div>
      </div>
      <div className="mt-2 rounded-xl border border-slate-200 p-2.5">
        <p className="text-sm font-bold text-slate-900">Fotos digitales</p>
        <p className="text-[11px] text-slate-500">Descarga en alta calidad</p>
      </div>
      <div className="mt-3 rounded-xl bg-[#009ee3] py-2.5 text-center text-xs font-bold text-white">Pagar con Mercado Pago</div>
      <p className="mt-2 text-center text-[10px] text-slate-400">El dinero entra directo a la cuenta del fotógrafo</p>
    </Telefono>
  );
}

function Subida() {
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border-2 border-dashed bg-white p-5 text-center" style={{ borderColor: COBRE }}>
        <span className="text-4xl">📁</span>
        <p className="mt-1 text-sm font-semibold text-slate-700">Soltá la carpeta de la jornada</p>
        <div className="mx-auto mt-3 h-2 w-3/4 overflow-hidden rounded-full bg-slate-100">
          <span className="block h-full w-2/3 rounded-full" style={{ background: VERDE }} />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="relative">
            <Foto tono={i} className="aspect-square rounded-lg" />
            <span className="absolute left-[30%] top-[18%] h-[34%] w-[40%] rounded-sm border-2 border-[#5cb46a]" aria-hidden />
          </div>
        ))}
      </div>
      <p className="text-center text-xs text-slate-500">Reconociendo caras en segundo plano…</p>
    </div>
  );
}

function Selfie() {
  return (
    <div className="flex items-center justify-center gap-6">
      <Telefono>
        <p className="text-center text-xs font-bold text-slate-800">Galería con fotos ocultas</p>
        <div className="mt-2 grid grid-cols-3 gap-1 blur-[3px]">
          {Array.from({ length: 9 }, (_, i) => (
            <Foto key={i} tono={i} className="aspect-square rounded" />
          ))}
        </div>
        <div className="mt-3 flex flex-col items-center">
          <span className="relative flex h-24 w-24 items-center justify-center rounded-full border-4" style={{ borderColor: COBRE }}>
            <Foto tono={3} className="h-full w-full rounded-full" />
          </span>
          <Boton className="mt-3">Buscarme con una selfie</Boton>
          <p className="mt-2 text-center text-[10px] text-slate-400">Se usa solo para buscar tus fotos</p>
        </div>
      </Telefono>
    </div>
  );
}

function Elegir() {
  const marcadas = [0, 2, 3, 5, 7];
  return (
    <Telefono>
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-slate-800">Elegí las fotos de tu pack</p>
        <span className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ background: VERDE }}>
          5 de 5
        </span>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        {Array.from({ length: 12 }, (_, i) => (
          <span key={i} className="relative">
            <Foto tono={i} className={`aspect-square rounded-md ${marcadas.includes(i) ? "ring-2 ring-[#5cb46a]" : "opacity-80"}`} />
            {marcadas.includes(i) ? (
              <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#5cb46a] text-[9px] text-white">✓</span>
            ) : null}
          </span>
        ))}
      </div>
      <Boton tono={COBRE} className="mt-3 w-full">
        Ver mi librito
      </Boton>
    </Telefono>
  );
}

function Aprobar() {
  return (
    <Navegador url="Mi pack · Revisá tu librito">
      <div className="flex justify-center gap-0.5 rounded-xl bg-slate-100 p-3">
        <div className="relative h-[190px] w-[140px] overflow-hidden rounded-l-md shadow-lg">
          <PaginaLibrito />
          <span className="absolute inset-x-6 top-[30%] h-[42%] rounded border-2 border-dashed border-[#c27b3d]" aria-hidden />
        </div>
        <div className="h-[190px] w-[140px] overflow-hidden rounded-r-md shadow-lg">
          <PaginaLibrito variante={1} />
        </div>
      </div>
      <p className="mt-2 text-center text-[11px] text-slate-500">Tocá una foto para cambiarla o acomodarla</p>
      <div className="mt-3 flex justify-center gap-2">
        <span className="rounded-full border border-slate-300 px-3 py-1.5 text-xs text-slate-600">Pedir un cambio</span>
        <Boton tono={VERDE}>Confirmar mi pack</Boton>
      </div>
    </Navegador>
  );
}

function Mosaico() {
  return (
    <div className="mx-auto h-[340px] w-[280px] overflow-hidden rounded-md border border-slate-200 shadow-2xl">
      <PaginaLibrito variante={2} />
    </div>
  );
}

const ETAPAS_EMBUDO = ["Por canjear", "Revisar diseño", "Cambios pedidos", "Para imprimir", "En imprenta", "Para entregar", "Entregado"];

function Embudo({ oscuro = false }: { oscuro?: boolean }) {
  const cantidades = [3, 2, 1, 4, 2, 3, 2];
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {ETAPAS_EMBUDO.map((e, i) => (
        <div key={e} className={`rounded-lg p-1.5 ${oscuro ? "bg-slate-800" : "bg-white shadow"}`}>
          <p className={`text-[9px] font-bold leading-tight ${oscuro ? "text-slate-300" : "text-slate-600"}`}>
            {i + 1}. {e}
          </p>
          <div className="mt-1.5 space-y-1">
            {Array.from({ length: cantidades[i] }, (_, j) => (
              <span
                key={j}
                className={`block rounded-md p-1 ${oscuro ? "bg-slate-700" : "bg-[#fbf6f1]"}`}
                style={{ borderLeft: `3px solid ${i === 6 ? VERDE : i === 2 ? "#e0a15f" : COBRE}` }}
              >
                <Barra w="80%" alto="h-1" tono={oscuro ? "bg-slate-500" : "bg-slate-300"} />
                <Barra w="50%" alto="h-1 mt-1" tono={oscuro ? "bg-slate-600" : "bg-slate-200"} />
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Imprenta() {
  return (
    <div className="flex items-center gap-4">
      <div className="space-y-1.5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex w-36 items-center gap-2 rounded-lg bg-white p-1.5 shadow">
            <span className="h-8 w-6 overflow-hidden rounded-sm">
              <PaginaLibrito />
            </span>
            <Barra w="60%" tono="bg-slate-300" />
            <span className="ml-auto text-[10px] text-[#5cb46a]">✓</span>
          </div>
        ))}
        <p className="pt-1 text-center text-[11px] font-semibold text-slate-600">Lote de impresión</p>
      </div>
      <span className="text-3xl" style={{ color: COBRE }}>
        →
      </span>
      <div className="flex flex-1 flex-col items-center gap-3">
        <div className="flex gap-3">
          {["ZIP", "PDF"].map((t) => (
            <span key={t} className="flex h-24 w-20 flex-col items-center justify-center rounded-xl text-lg font-black text-white shadow-lg" style={{ background: t === "ZIP" ? COBRE : "#475569" }}>
              {t}
              <span className="mt-1 text-[9px] font-medium opacity-80">alta calidad</span>
            </span>
          ))}
        </div>
        <Boton>Descargar para la imprenta</Boton>
        <div className="w-full max-w-[220px] space-y-1 text-[10px] text-slate-500">
          <p>📁 3.º A / Nombre Apellido</p>
          <p>📁 3.º B / Nombre Apellido</p>
        </div>
      </div>
    </div>
  );
}

function Etiquetas() {
  return (
    <div className="relative mx-auto h-[300px] w-[360px]">
      <div className="absolute inset-x-6 bottom-0 top-10 rounded-lg bg-[#e8d3b9] shadow-xl" />
      <div className="absolute inset-x-6 top-10 h-24 bg-[#dcc2a3]" style={{ clipPath: "polygon(0 0, 100% 0, 50% 100%)" }} />
      <div className="absolute left-1/2 top-[48%] flex w-64 -translate-x-1/2 items-center gap-3 rounded-lg bg-white p-3 shadow-lg">
        <QR className="h-20 w-20 shrink-0" />
        <div className="min-w-0 space-y-1 text-[11px] text-slate-600">
          <p className="text-sm font-bold text-slate-900">Nombre Apellido</p>
          <p>3.º grado A · Turno mañana</p>
          <p>Tu colegio</p>
          <p className="font-mono text-[10px] text-slate-400">Pedido N.º —</p>
        </div>
      </div>
    </div>
  );
}

function Entrega() {
  return (
    <div className="flex items-center justify-center gap-6">
      <Telefono>
        <div className="relative h-36 overflow-hidden rounded-xl bg-slate-800">
          <span className="absolute inset-6 rounded-lg border-2 border-white/80" aria-hidden />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <QR className="h-16 w-16" />
          </span>
          <span className="absolute inset-x-6 top-1/2 h-0.5 bg-[#5cb46a] shadow-[0_0_8px_#5cb46a]" aria-hidden />
        </div>
        <div className="mt-3 rounded-xl border border-slate-200 p-3">
          <p className="text-sm font-bold text-slate-900">Nombre Apellido</p>
          <p className="text-[11px] text-slate-500">3.º grado A · Tu colegio</p>
          <p className="mt-2 text-[11px] text-slate-600">Librito + digitales</p>
        </div>
        <Boton tono={VERDE} className="mt-3 w-full">
          ✓ Marcar entregado
        </Boton>
      </Telefono>
    </div>
  );
}

function Pantalla() {
  return (
    <Navegador url="Pantalla de pedidos" oscuro>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-bold text-white">Pedidos escolares</p>
        <span className="flex items-center gap-1.5 text-[10px] text-emerald-400">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> en vivo
        </span>
      </div>
      <Embudo oscuro />
    </Navegador>
  );
}

export function VisualDePlaca({ visual }: { visual: VisualPlaca }) {
  switch (visual) {
    case "portada":
      return <Portada />;
    case "landing":
      return <Landing />;
    case "ficha":
      return <Ficha />;
    case "listado":
      return <Listado />;
    case "bot":
      return <Bot />;
    case "comision":
      return <Comision />;
    case "panelEscuela":
      return <PanelEscuela />;
    case "packs":
      return <Packs />;
    case "plantillas":
      return <Plantillas />;
    case "disenador":
      return <Disenador />;
    case "variables":
      return <Variables />;
    case "probar":
      return <Probar />;
    case "preventa":
      return <Preventa />;
    case "subida":
      return <Subida />;
    case "selfie":
      return <Selfie />;
    case "elegir":
      return <Elegir />;
    case "libro3d":
      return <Libro3D />;
    case "aprobar":
      return <Aprobar />;
    case "mosaico":
      return <Mosaico />;
    case "embudo":
      return <Embudo />;
    case "imprenta":
      return <Imprenta />;
    case "etiquetas":
      return <Etiquetas />;
    case "entrega":
      return <Entrega />;
    case "pantalla":
      return <Pantalla />;
    case "ventaColegio":
      return <PanelEscuela cierre />;
  }
}
