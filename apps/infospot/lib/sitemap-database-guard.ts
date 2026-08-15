/** Fail-closed: sin DATABASE_URL seteada, el sitemap no debe tocar Prisma. */
export function shouldLoadPublishedSitemapEntries(
  databaseUrl: string | undefined,
): boolean {
  return Boolean(databaseUrl?.trim());
}
