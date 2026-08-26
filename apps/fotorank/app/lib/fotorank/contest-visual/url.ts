export function hasUsableImageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const t = url.trim();
  return t.length > 0 && t !== "#" && !t.startsWith("about:");
}
