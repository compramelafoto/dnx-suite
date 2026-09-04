import Image from "next/image";

/**
 * Constancia de inscripción de ComprameLaFoto en el Registro Nacional de Bases de
 * Datos Personales (AAIP). El enlace apunta a la ficha pública del organismo.
 */
export const AAIP_RNBD_URL =
  "https://www.argentina.gob.ar/aaip/datospersonales/reclama/20319733788--RL-2026-21549110-APN-DNPDP#AAIP";

const ALT_TEXT =
  "AAIP — Registro Nacional de Bases de Datos Personales: ver la inscripción de ComprameLaFoto";

type AaipBadgeProps = {
  /**
   * `footer`: sello compacto sobre fondo oscuro.
   * `light`: sello compacto sobre fondo claro.
   * `card`: bloque con explicación para páginas legales.
   */
  variant?: "footer" | "light" | "card";
  className?: string;
};

export default function AaipBadge({ variant = "footer", className = "" }: AaipBadgeProps) {
  if (variant === "footer" || variant === "light") {
    const isLight = variant === "light";
    return (
      <a
        href={AAIP_RNBD_URL}
        target="_blank"
        rel="noopener noreferrer"
        title="Inscripción en el Registro Nacional de Bases de Datos Personales (AAIP)"
        className={`group inline-flex items-center gap-3 rounded-xl border px-3 py-2 transition-colors focus:outline-none focus-visible:ring-2 ${
          isLight
            ? "border-[#111827]/10 bg-white hover:border-[#c27b3d]/40 hover:bg-[#f7f5f2] focus-visible:ring-[#c27b3d]"
            : "border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/10 focus-visible:ring-white/60"
        } ${className}`}
      >
        <Image
          src="/aaip-rnbd.png"
          alt={ALT_TEXT}
          width={892}
          height={669}
          sizes="72px"
          className="h-auto w-[72px] rounded-md shadow-sm"
        />
        <span
          className={`max-w-[15rem] text-left text-xs leading-snug transition-colors ${
            isLight
              ? "text-[#6b7280] group-hover:text-[#1a1a1a]"
              : "text-white/70 group-hover:text-white"
          }`}
        >
          Inscripta en el Registro Nacional de Bases de Datos Personales{" "}
          <span className="whitespace-nowrap">(AAIP)</span>
        </span>
      </a>
    );
  }

  return (
    <div
      className={`flex flex-col items-center gap-4 rounded-2xl border border-[#c27b3d]/20 bg-[#f7f5f2] p-5 text-center sm:flex-row sm:items-center sm:text-left ${className}`}
    >
      <a
        href={AAIP_RNBD_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 rounded-lg transition-transform hover:scale-[1.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c27b3d]"
      >
        <Image
          src="/aaip-rnbd.png"
          alt={ALT_TEXT}
          width={892}
          height={669}
          sizes="128px"
          className="h-auto w-32 rounded-lg shadow-sm ring-1 ring-black/5"
        />
      </a>
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-[#1a1a1a]">
          Base de datos registrada ante la AAIP
        </h3>
        <p className="text-sm leading-relaxed text-[#6b7280]">
          ComprameLaFoto está inscripta en el Registro Nacional de Bases de Datos Personales de la
          Agencia de Acceso a la Información Pública (Ley 25.326).
        </p>
        <a
          href={AAIP_RNBD_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center text-sm font-medium text-[#c27b3d] hover:text-[#a0662f] hover:underline"
        >
          Ver la constancia en argentina.gob.ar →
        </a>
      </div>
    </div>
  );
}
