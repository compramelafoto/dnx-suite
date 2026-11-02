import Image from "next/image";

const APPS: Array<{ nombre: string; texto: string; color: string }> = [
  { nombre: "ComprameLaFoto", texto: "Venta de fotos en línea: eventos, deportes y colegios.", color: "#c27b3d" },
  { nombre: "FOTOFFICE", texto: "Gestión de asociaciones y estudios: socios, cuotas, sorteos y sitio propio.", color: "#2563eb" },
  { nombre: "¿Cuánto Cobro?", texto: "Tu perfil de precios y presupuestos en un minuto.", color: "#5cb46a" },
  { nombre: "FotoRank", texto: "Concursos fotográficos con jurado, calificación y diplomas.", color: "#7c3aed" },
  { nombre: "Muestras Fotográficas", texto: "Muestras y galerías virtuales de obras.", color: "#db2777" },
  { nombre: "Cam Of Duty", texto: "Simulador de cámara en 3D para aprender a fotografiar.", color: "#0f172a" },
];

/** Cierre de la presentación: las apps principales de DNX y el QR a dnx-suite.com. */
export function AppsDnx() {
  return (
    <div className="mt-[clamp(1rem,3vh,1.75rem)] flex flex-col gap-[clamp(1rem,3vw,2.5rem)] lg:flex-row lg:items-stretch">
      <ul className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {APPS.map((a) => (
          <li key={a.nombre} className="rounded-2xl border border-slate-200 bg-white p-[clamp(0.9rem,1.6vw,1.4rem)] shadow-sm">
            <span className="block h-1.5 w-10 rounded-full" style={{ background: a.color }} aria-hidden />
            <p className="mt-2.5 text-[clamp(1.05rem,min(1.6vw,2.4vh),1.4rem)] font-extrabold leading-tight text-slate-900">{a.nombre}</p>
            <p className="mt-1 text-[clamp(0.85rem,1.05vw,1rem)] leading-snug text-slate-600">{a.texto}</p>
          </li>
        ))}
      </ul>
      <div className="flex shrink-0 flex-col items-center justify-center rounded-3xl bg-slate-900 p-[clamp(1rem,2vw,1.75rem)] text-center text-white lg:w-[min(30%,20rem)]">
        <Image src="/demos/qr-dnx-suite.svg" alt="QR a dnx-suite.com" width={240} height={240} className="w-[clamp(9rem,16vw,14rem)] rounded-xl bg-white p-2" unoptimized />
        <p className="mt-4 text-[clamp(1rem,1.5vw,1.35rem)] font-bold">Conocé todo en</p>
        <p className="text-[clamp(1.2rem,2vw,1.75rem)] font-black tracking-tight text-[#e0a15f]">dnx-suite.com</p>
      </div>
    </div>
  );
}
