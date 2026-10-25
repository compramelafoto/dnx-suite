/** Íconos de trazo del Estudio Fotográfico (24×24, heredan el color del texto). */

const PATHS = {
  set: "M12 3 4 7.5v9L12 21l8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9",
  camera: "M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
  undo: "M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3",
  redo: "m15 14 5-5-5-5M20 9H10a6 6 0 0 0 0 12h3",
  download: "M12 4v11M7 10l5 5 5-5M5 20h14",
  share: "M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1",
  help: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5v.01",
  light: "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.4.3.5.7.5 1.1v1h6v-1c0-.4.2-.8.5-1.1A6 6 0 0 0 12 3",
  scene: "M12 7a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5M8 22l1-9-3-2 2-3h8l2 3-3 2 1 9",
  presets: "M4 5h7v6H4zM13 5h7v6h-7zM4 13h7v6H4zM13 13h7v6h-7z",
  plus: "M12 5v14M5 12h14",
  trash: "M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13",
  close: "M6 6l12 12M18 6 6 18",
  solo: "M12 3v3M12 18v3M3 12h3M18 12h3M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6",
  copy: "M8 8h11v11H8zM5 16V5h11",
  meter: "M5 18a8 8 0 1 1 14 0M12 14l4-5",
  walk: "M13 4.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3M9 21l2.5-6.5L14 17v4M7.5 11.5 10 8l3.5.5 2 3 2.5 1M11.5 14.5 12.5 9",
} as const;

export type StudioIconName = keyof typeof PATHS;

export default function StudioIcon({ name, size = 18 }: { name: StudioIconName; size?: number }) {
  return (
    <svg
      className="cod-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
