export type AppHeaderNavPriority = "high" | "medium" | "low";

export type AppHeaderNavItem = {
  href: string;
  label: string;
  /** Reservado por si en el futuro se reintroduce colapso por prioridad (no usado en el nav actual). */
  priority?: AppHeaderNavPriority;
};
