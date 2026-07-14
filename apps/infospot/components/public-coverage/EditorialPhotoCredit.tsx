type Props = {
  credit: string;
  photographerName?: string | null;
  className?: string;
};

/** Crédito legible obligatorio bajo / sobre foto editorial. */
export function EditorialPhotoCredit({
  credit,
  photographerName,
  className = "",
}: Props) {
  const text = credit?.trim() || (photographerName ? `Foto: ${photographerName}` : "");
  if (!text) return null;
  return (
    <span
      className={`text-xs leading-relaxed text-[var(--is-muted)] ${className}`.trim()}
      data-testid="editorial-photo-credit"
    >
      {text}
    </span>
  );
}
