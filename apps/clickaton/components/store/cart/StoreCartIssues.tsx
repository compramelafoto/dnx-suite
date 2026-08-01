import type { StoreCartIssue, StoreCartValidatedLine } from "@/lib/public-store/cart";

type StoreCartIssuesProps = {
  issues?: StoreCartIssue[];
  lines?: StoreCartValidatedLine[];
  className?: string;
};

export function StoreCartIssues({ issues = [], lines = [], className }: StoreCartIssuesProps) {
  const messages = [
    ...issues.map((i) => i.message),
    ...lines.flatMap((l) => l.messages),
  ].filter(Boolean);
  const unique = [...new Set(messages)];
  if (unique.length === 0) return null;

  return (
    <div
      className={className}
      role="status"
      aria-live="polite"
    >
      <ul className="space-y-2 rounded-[var(--ck-radius-md)] border border-[var(--ck-warning)]/40 bg-[var(--ck-warning-soft)] p-4">
        {unique.map((msg) => (
          <li key={msg} className="ck-body-sm text-ck-text">
            {msg}
          </li>
        ))}
      </ul>
    </div>
  );
}
