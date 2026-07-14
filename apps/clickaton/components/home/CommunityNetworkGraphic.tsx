import { cn } from "@/lib/cn";

type CommunityNetworkGraphicProps = {
  roles: readonly string[];
  className?: string;
};

/** Composición abstracta de conexiones / puntos de una ciudad. Decorativa. */
export function CommunityNetworkGraphic({
  roles,
  className,
}: CommunityNetworkGraphicProps) {
  return (
    <div
      className={cn(
        "relative aspect-square w-full max-w-md overflow-hidden rounded-[var(--ck-radius-md)] border-2 border-ck-border-strong bg-ck-black p-6 text-ck-yellow",
        className,
      )}
      aria-hidden="true"
    >
      <svg viewBox="0 0 320 320" className="absolute inset-0 h-full w-full opacity-40">
        <circle cx="160" cy="160" r="88" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="160" cy="160" r="48" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="4 6" />
        <line x1="160" y1="40" x2="160" y2="280" stroke="currentColor" strokeWidth="1" opacity="0.5" />
        <line x1="40" y1="160" x2="280" y2="160" stroke="currentColor" strokeWidth="1" opacity="0.5" />
        <line x1="70" y1="70" x2="250" y2="250" stroke="currentColor" strokeWidth="1" opacity="0.35" />
        <line x1="250" y1="70" x2="70" y2="250" stroke="currentColor" strokeWidth="1" opacity="0.35" />
        {[
          [160, 48],
          [248, 112],
          [232, 220],
          [88, 220],
          [72, 112],
          [160, 160],
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i === 5 ? 6 : 4} fill="currentColor" />
        ))}
      </svg>

      <div className="relative z-[1] flex h-full flex-wrap content-end gap-2">
        {roles.slice(0, 6).map((role) => (
          <span
            key={role}
            className="ck-label rounded-[var(--ck-radius-sm)] border border-ck-yellow/40 bg-ck-black/70 px-2 py-1 text-ck-yellow"
          >
            {role}
          </span>
        ))}
      </div>
    </div>
  );
}
