type HeaderMenuToggleProps = {
  onClick: () => void;
  /** Por defecto: abrir menú fullscreen */
  "aria-label"?: string;
};

/** Botón circular dorado del header (área mínima ~44px, alineado a `appShellHeader.circularAction`). */
export function HeaderMenuToggle({ onClick, "aria-label": ariaLabel = "Abrir menú" }: HeaderMenuToggleProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#D4AF37] text-[#050505] transition-colors hover:bg-[#e5c04a] focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
      aria-label={ariaLabel}
    >
      <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </button>
  );
}
