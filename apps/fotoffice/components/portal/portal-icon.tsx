import type { PortalIconName } from "@/lib/portal/menu";

/** Los trazos de cada sección del portal. Uno solo por nombre: el menú no dibuja lo que no tiene. */
const TRAZOS: Record<PortalIconName, string> = {
  home: "M3 10.5 12 3l9 7.5M5.5 9.5V20h13V9.5",
  card: "M3 7.5h18v11H3zM3 11h18M6.5 15h4",
  wallet: "M3 7.5h15a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 7.5 15 4M16.5 13h1.5",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20a7.5 7.5 0 0 1 15 0",
  gift: "M4 11h16v9H4zM4 7.5h16V11H4zM12 7.5V20M12 7.5C12 5.5 10.5 4 9 4S6.5 5.5 7.5 7.5M12 7.5c0-2 1.5-3.5 3-3.5s2.5 1.5 1.5 3.5",
  calendar: "M4 6h16v14H4zM4 10h16M8.5 3.5v4M15.5 3.5v4",
  ticket: "M3 9.5V7h18v2.5a2.5 2.5 0 0 0 0 5V17H3v-2.5a2.5 2.5 0 0 0 0-5ZM12 8.5v7",
  school: "M12 4 3 8.5l9 4.5 9-4.5zM6.5 11v5c0 1.5 2.5 3 5.5 3s5.5-1.5 5.5-3v-5",
  institution: "M3 9.5 12 4l9 5.5M5 11v8M9.5 11v8M14.5 11v8M19 11v8M3.5 20h17",
  share: "M9 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM21 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM21 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM8.6 13.5l6.8 3.4M15.4 7.1 8.6 10.5",
};

export function PortalIcon({
  name,
  className = "h-5 w-5",
}: {
  name: PortalIconName;
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={TRAZOS[name]} />
    </svg>
  );
}
