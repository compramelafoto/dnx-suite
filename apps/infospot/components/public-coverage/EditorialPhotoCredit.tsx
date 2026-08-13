import { PhotoCreditInner } from "@/components/editorial/PhotoCreditInner";

type Props = {
  credit: string;
  photographerName?: string | null;
  companyHref?: string | null;
  className?: string;
};

/** Crédito legible obligatorio bajo / sobre foto editorial. */
export function EditorialPhotoCredit({
  credit,
  photographerName,
  companyHref,
  className = "",
}: Props) {
  const text = credit?.trim() || (photographerName ? `Foto: ${photographerName}` : "");
  if (!text) return null;
  return (
    <span
      className={`text-xs leading-relaxed text-[var(--is-muted)] ${className}`.trim()}
      data-testid="editorial-photo-credit"
    >
      <PhotoCreditInner credit={text} companyHref={companyHref} />
    </span>
  );
}
