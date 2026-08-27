import { parseEditorialPhotoCredit } from "@/lib/editorial-photos/credit";

export function PhotoCreditInner({
  credit,
  companyHref,
}: {
  credit: string;
  companyHref?: string | null;
}) {
  const parsed = parseEditorialPhotoCredit(credit);
  if (!parsed.companyName) return <>{credit}</>;
  const href = companyHref?.trim() || null;
  return (
    <>
      {parsed.beforeCompany}
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-[var(--is-accent)] hover:underline"
        >
          {parsed.companyName}
        </a>
      ) : (
        parsed.companyName
      )}
    </>
  );
}
