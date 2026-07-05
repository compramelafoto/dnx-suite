"use client";

import Image from "next/image";

type Props = {
  message: string;
  variant: "success" | "error";
};

/**
 * Overlay de estado para acciones de guardado o errores.
 * Mantiene el estilo del overlay de inicio de sesión.
 */
export default function StatusOverlay({ message, variant }: Props) {
  const textClass = variant === "error" ? "text-red-600" : "text-green-600";
  const dotClass = variant === "error" ? "bg-red-400/80" : "bg-green-500/80";

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white/95 backdrop-blur-sm session-overlay-fade-in"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-col items-center gap-6">
        <div className="relative rounded-full ring-2 ring-black/10">
          <Image
            src="/watermark.png"
            alt="ComprameLaFoto"
            width={120}
            height={120}
            className="h-[7.5rem] w-[7.5rem] rounded-full object-cover"
            priority
          />
        </div>
        <p className={`text-sm font-medium tracking-wide ${textClass}`}>
          {message}
        </p>
        <div className="flex gap-1">
          <span className={`h-1.5 w-1.5 rounded-full ${dotClass} animate-bounce [animation-delay:0ms]`} />
          <span className={`h-1.5 w-1.5 rounded-full ${dotClass} animate-bounce [animation-delay:150ms]`} />
          <span className={`h-1.5 w-1.5 rounded-full ${dotClass} animate-bounce [animation-delay:300ms]`} />
        </div>
      </div>
    </div>
  );
}
