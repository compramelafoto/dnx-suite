/** Parte un `User.name` en nombre y apellido (primer token / resto). */
export function splitDisplayName(name: string | null | undefined): {
  firstName: string;
  lastName: string;
} {
  const trimmed = name?.trim() ?? "";
  if (!trimmed) return { firstName: "", lastName: "" };
  const space = trimmed.search(/\s+/);
  if (space === -1) return { firstName: trimmed, lastName: "" };
  return {
    firstName: trimmed.slice(0, space),
    lastName: trimmed.slice(space).trim(),
  };
}

export function joinDisplayName(firstName: string, lastName: string): string {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
}
