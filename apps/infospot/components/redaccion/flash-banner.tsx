type FlashBannerProps = {
  ok?: string | null;
  error?: string | null;
};

export function FlashBanner({ ok, error }: FlashBannerProps) {
  if (!ok && !error) return null;
  if (error) {
    return (
      <div
        role="alert"
        className="rounded-[var(--is-radius-sm)] border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
      >
        {error}
      </div>
    );
  }
  return (
    <div
      role="status"
      className="rounded-[var(--is-radius-sm)] border border-teal-300 bg-teal-50 px-4 py-3 text-sm text-teal-900"
    >
      {ok}
    </div>
  );
}
