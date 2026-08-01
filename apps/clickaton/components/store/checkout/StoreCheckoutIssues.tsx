"use client";

type Props = {
  message: string | null;
};

export function StoreCheckoutIssues({ message }: Props) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="rounded-[var(--ck-radius-md)] border border-red-500/40 bg-red-500/10 px-4 py-3"
    >
      <p className="ck-body-sm text-ck-text">{message}</p>
    </div>
  );
}
