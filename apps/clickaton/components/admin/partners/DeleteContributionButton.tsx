type Props = {
  action: (formData: FormData) => Promise<void>;
  contributionId: string;
  partnerId?: string;
  editionId?: string;
  participationId?: string;
  title?: string;
};

/** Botón cesto para eliminar un aporte (server action). */
export function DeleteContributionButton({
  action,
  contributionId,
  partnerId,
  editionId,
  participationId,
  title = "Eliminar aporte",
}: Props) {
  return (
    <form action={action}>
      {partnerId ? <input type="hidden" name="partnerId" value={partnerId} /> : null}
      {editionId ? <input type="hidden" name="editionId" value={editionId} /> : null}
      {participationId ? (
        <input type="hidden" name="participationId" value={participationId} />
      ) : null}
      <input type="hidden" name="contributionId" value={contributionId} />
      <button
        type="submit"
        title={title}
        aria-label={title}
        className="inline-flex size-9 items-center justify-center rounded-lg border border-red-500/35 text-red-300 transition hover:border-red-400/60 hover:bg-red-500/10"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          className="size-4"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 6h18M9 6V4h6v2m-7 4v8m4-8v8m4-8v8M6 6l1 14h10l1-14"
          />
        </svg>
      </button>
    </form>
  );
}
