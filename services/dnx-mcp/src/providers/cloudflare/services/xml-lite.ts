/**
 * Parser XML mínimo para ListBucketResult de S3 (sin dependencia extra).
 */
export const XMLParser = {
  parseListBucketResult(xml: string): Array<{
    key: string;
    size: number | null;
    etag: string | null;
    lastModified: string | null;
    storageClass: string | null;
  }> {
    const contents = [...xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)];
    return contents.map((match) => {
      const block = match[1] ?? "";
      return {
        key: extractTag(block, "Key") ?? "",
        size: toNumberOrNull(extractTag(block, "Size")),
        etag: extractTag(block, "ETag")?.replaceAll('"', "") ?? null,
        lastModified: extractTag(block, "LastModified"),
        storageClass: extractTag(block, "StorageClass"),
      };
    });
  },
};

function extractTag(xml: string, tag: string): string | null {
  const match = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`).exec(xml);
  return match?.[1] ?? null;
}

function toNumberOrNull(value: string | null): number | null {
  if (value === null) {
    return null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
