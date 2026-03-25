/**
 * Clases Tailwind para fichas de directorio.
 * Alineadas a `themeComprameLaFoto.directory` y `compositionSpacing.comprameLaFotoDirectory` (@repo/design-system).
 */
export const cmlfDirCard = {
  page: "min-h-screen bg-[#f7f5f2]",
  section: "section-spacing bg-[#f9fafb]",
  /** 32px entre fichas — `compositionSpacing.comprameLaFotoDirectory.gridGap` */
  grid: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8",
  /** Contenedor de tarjeta: borde suave + sombra ligera + hover */
  shell:
    "flex h-full flex-col overflow-hidden rounded-2xl border border-black/[0.08] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-shadow duration-200 hover:shadow-[0_6px_20px_rgba(0,0,0,0.07)]",
  /** Bloque interior bajo el logo: sin gap global — márgenes por bloque (`titleToMeta` mt-4, redes mt-6) */
  bodyInner: "flex w-full max-w-full flex-col",
  title: "text-lg font-semibold leading-snug text-[#111827]",
  /** Líneas ciudad / dirección / tel. */
  metaStack: "flex w-full flex-col gap-3 text-sm leading-relaxed text-[#6b7280]",
  metaRow: "flex items-start justify-center gap-2 text-balance",
  /** Iconos redes: gap 12px — `socialIconGap` */
  socialRow: "flex flex-wrap items-center justify-center gap-3",
  socialBtn:
    "inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[#f7f5f2] text-[#6b7280] transition-colors hover:bg-[#c27b3d]/15 hover:text-[#c27b3d]",
  /** CTA con separador */
  ctaWrap: "mt-6 w-full border-t border-black/[0.06] pt-5",
  ctaLink:
    "inline-flex items-center gap-1 text-sm font-semibold text-[#A67341] transition-colors hover:text-[#8B5E34] hover:underline underline-offset-4",
  initials:
    "flex size-[4.5rem] shrink-0 items-center justify-center rounded-full bg-[#c27b3d]/12 text-3xl font-semibold text-[#A67341] ring-1 ring-[#c27b3d]/15 md:text-4xl",
} as const;
