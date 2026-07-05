"use client";

import Image from "next/image";

type Props = {
  message: string;
  variant: "logout" | "login";
};

/**
 * Overlay con logo de ComprameLaFoto para transiciones de sesión (login/logout).
 * Muestra animación suave para evitar confusión y dar feedback claro.
 */
export default function SessionTransitionOverlay({ message, variant }: Props) {
  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white/95 backdrop-blur-sm session-overlay-fade-in"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-col items-center gap-6">
        <div
          className={`relative rounded-full ring-2 ring-black/10 ${
            variant === "logout" ? "animate-pulse" : ""
          }`}
        >
          <Image
            src="/watermark.png"
            alt="ComprameLaFoto"
            width={120}
            height={120}
            className="h-[7.5rem] w-[7.5rem] rounded-full object-cover"
            priority
          />
        </div>
        <p className="text-sm font-medium text-black/70 tracking-wide">
          {message}
        </p>
        <div className="flex gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-black/30 animate-bounce [animation-delay:0ms]" />
          <span className="h-1.5 w-1.5 rounded-full bg-black/40 animate-bounce [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 rounded-full bg-black/50 animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}
