/** Divide nombre guardado en API (`name` + respaldo `companyOwner`) para la UI de titular. */
export function splitTitularName(
  name: string | null | undefined,
  companyOwner: string | null | undefined,
): { firstName: string; lastName: string } {
  const full = (name || "").trim();
  if (!full) {
    return { firstName: "", lastName: (companyOwner || "").trim() };
  }
  const space = full.indexOf(" ");
  if (space === -1) {
    const owner = (companyOwner || "").trim();
    if (owner && owner.toLowerCase() !== full.toLowerCase()) {
      return { firstName: full, lastName: owner };
    }
    return { firstName: full, lastName: "" };
  }
  return {
    firstName: full.slice(0, space).trim(),
    lastName: full.slice(space + 1).trim(),
  };
}

export function joinTitularName(firstName: string, lastName: string): string {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
}

/** Unifica teléfono y WhatsApp para mostrar un solo campo en perfil. */
export function pickContactPhone(
  phone: string | null | undefined,
  whatsapp: string | null | undefined,
): string {
  const w = (whatsapp || "").trim();
  if (w) return w;
  return (phone || "").trim();
}
