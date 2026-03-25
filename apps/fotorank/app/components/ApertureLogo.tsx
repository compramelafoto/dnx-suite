"use client";

interface ApertureLogoProps {
  className?: string;
}

/** Ícono del obturador/apertura de cámara - fondo transparente, color dorado */
export function ApertureLogo({ className = "h-16 w-16" }: ApertureLogoProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`text-gold ${className}`}
      aria-hidden
    >
      {/* 6 aspas del obturador - forma de apertura de cámara */}
      <path
        d="M32 4 L36 26 L36 38 L32 60 L28 38 L28 26 Z"
        fill="currentColor"
        transform="rotate(0 32 32)"
      />
      <path
        d="M32 4 L36 26 L36 38 L32 60 L28 38 L28 26 Z"
        fill="currentColor"
        transform="rotate(60 32 32)"
      />
      <path
        d="M32 4 L36 26 L36 38 L32 60 L28 38 L28 26 Z"
        fill="currentColor"
        transform="rotate(120 32 32)"
      />
      <path
        d="M32 4 L36 26 L36 38 L32 60 L28 38 L28 26 Z"
        fill="currentColor"
        transform="rotate(180 32 32)"
      />
      <path
        d="M32 4 L36 26 L36 38 L32 60 L28 38 L28 26 Z"
        fill="currentColor"
        transform="rotate(240 32 32)"
      />
      <path
        d="M32 4 L36 26 L36 38 L32 60 L28 38 L28 26 Z"
        fill="currentColor"
        transform="rotate(300 32 32)"
      />
      {/* Centro */}
      <circle cx="32" cy="32" r="8" fill="currentColor" />
    </svg>
  );
}
