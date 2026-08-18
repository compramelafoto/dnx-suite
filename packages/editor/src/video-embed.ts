export const VIDEO_PROVIDERS = ["youtube", "vimeo", "instagram"] as const;
export type VideoProvider = (typeof VIDEO_PROVIDERS)[number];

export const VIDEO_WIDTHS = ["full", "content"] as const;
export type VideoWidth = (typeof VIDEO_WIDTHS)[number];

export const VIDEO_ALIGNMENTS = ["left", "center", "right"] as const;
export type VideoAlignment = (typeof VIDEO_ALIGNMENTS)[number];

export const VIDEO_VARIANTS = ["standard", "short", "reel", "post"] as const;
export type VideoVariant = (typeof VIDEO_VARIANTS)[number];

export type EditorialVideoAttrs = {
  provider: VideoProvider;
  url: string;
  videoId: string;
  caption: string;
  width: VideoWidth;
  alignment: VideoAlignment;
  variant: VideoVariant;
};

export type ParseVideoErrorCode =
  | "empty"
  | "html"
  | "invalid_url"
  | "protocol"
  | "credentials"
  | "provider"
  | "unsupported";

export type ParseVideoResult =
  | { ok: true; value: EditorialVideoAttrs }
  | { ok: false; code: ParseVideoErrorCode; message: string };

const PARSE_MESSAGES: Record<ParseVideoErrorCode, string> = {
  empty: "Pegá el enlace del video.",
  html: "No se admite código HTML, scripts ni iframes. Pegá solo el enlace del video.",
  invalid_url: "El enlace no es una URL válida.",
  protocol: "Solo se admiten enlaces https.",
  credentials: "El enlace no es válido.",
  provider:
    "Ese dominio no está permitido. Admitimos YouTube, Vimeo e Instagram.",
  unsupported:
    "No se pudo identificar un video incrustable. Revisá que el enlace sea una publicación, Reel o video público.",
};

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "www.youtu.be",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

const VIMEO_HOSTS = new Set(["vimeo.com", "www.vimeo.com", "player.vimeo.com"]);

const INSTAGRAM_HOSTS = new Set([
  "instagram.com",
  "www.instagram.com",
  "instagr.am",
  "www.instagr.am",
]);

const YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const VIMEO_ID_RE = /^\d{6,12}$/;
const VIMEO_HASH_RE = /^[a-f0-9]{6,12}$/i;
const INSTAGRAM_CODE_RE = /^[A-Za-z0-9_-]{5,32}$/;
const CAPTION_MAX = 500;

function looksLikeHtmlOrScript(raw: string): boolean {
  const value = raw.trim();
  if (!value) return false;
  if (/[<>]/.test(value)) return true;
  if (/javascript\s*:/i.test(value)) return true;
  if (/data\s*:\s*text\/html/i.test(value)) return true;
  if (/<\s*(script|iframe|object|embed|svg)\b/i.test(value)) return true;
  return false;
}

function fail(code: ParseVideoErrorCode): ParseVideoResult {
  return { ok: false, code, message: PARSE_MESSAGES[code] };
}

function normalizeHost(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/\.+$/, "");
}

function firstPathSegment(pathname: string, index = 0): string {
  const parts = pathname.split("/").filter(Boolean);
  return parts[index] ?? "";
}

function youtubeIdFromValue(value: string): string | null {
  const id = value.trim().replace(/[^A-Za-z0-9_-].*$/, "");
  return YOUTUBE_ID_RE.test(id) ? id : null;
}

function parseYoutube(url: URL): ParseVideoResult {
  const host = normalizeHost(url.hostname);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  let id: string | null = null;
  let variant: VideoVariant = "standard";

  if (host === "youtu.be" || host === "www.youtu.be") {
    id = youtubeIdFromValue(firstPathSegment(path));
  } else if (path.startsWith("/shorts/")) {
    id = youtubeIdFromValue(firstPathSegment(path, 1));
    variant = "short";
  } else if (path.startsWith("/embed/") || path.startsWith("/live/")) {
    id = youtubeIdFromValue(firstPathSegment(path, 1));
  } else if (path === "/watch" || path.startsWith("/watch")) {
    id = youtubeIdFromValue(url.searchParams.get("v") || "");
  } else {
    return fail("unsupported");
  }

  if (!id) return fail("unsupported");

  return {
    ok: true,
    value: {
      provider: "youtube",
      url: variant === "short" ? `https://www.youtube.com/shorts/${id}` : `https://www.youtube.com/watch?v=${id}`,
      videoId: id,
      caption: "",
      width: "full",
      alignment: "center",
      variant,
    },
  };
}

function parseVimeo(url: URL): ParseVideoResult {
  const host = normalizeHost(url.hostname);
  const parts = url.pathname.split("/").filter(Boolean);
  let id: string | null = null;
  let hash: string | null = null;

  if (host === "player.vimeo.com") {
    const videoIdx = parts.indexOf("video");
    const candidate = videoIdx >= 0 ? parts[videoIdx + 1] : parts[0];
    if (candidate && VIMEO_ID_RE.test(candidate)) id = candidate;
    const h = url.searchParams.get("h");
    if (h && VIMEO_HASH_RE.test(h)) hash = h;
  } else {
    const skip = new Set(["channels", "groups", "album", "showcase", "manage", "videos"]);
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i] ?? "";
      if (skip.has(part) || !VIMEO_ID_RE.test(part)) continue;
      id = part;
      const next = parts[i + 1];
      if (next && VIMEO_HASH_RE.test(next)) hash = next;
      break;
    }
  }

  if (!id) return fail("unsupported");

  const canonical = hash ? `https://vimeo.com/${id}/${hash}` : `https://vimeo.com/${id}`;
  return {
    ok: true,
    value: {
      provider: "vimeo",
      url: canonical,
      videoId: hash ? `${id}:${hash}` : id,
      caption: "",
      width: "full",
      alignment: "center",
      variant: "standard",
    },
  };
}

function parseInstagram(url: URL): ParseVideoResult {
  const parts = url.pathname.split("/").filter(Boolean);
  const kind = (parts[0] || "").toLowerCase();
  let code = "";
  let variant: VideoVariant = "post";

  if (kind === "p" || kind === "tv") {
    code = parts[1] || "";
    variant = "post";
  } else if (kind === "reel" || kind === "reels") {
    code = parts[1] || "";
    variant = "reel";
  } else {
    return fail("unsupported");
  }

  if (!INSTAGRAM_CODE_RE.test(code)) return fail("unsupported");

  const pathKind = variant === "reel" ? "reel" : "p";
  return {
    ok: true,
    value: {
      provider: "instagram",
      url: `https://www.instagram.com/${pathKind}/${code}/`,
      videoId: code,
      caption: "",
      width: "content",
      alignment: "center",
      variant,
    },
  };
}

/**
 * Valida una URL pegada por el redactor y la convierte a un bloque estructurado.
 * No acepta HTML, scripts, iframes ni dominios fuera de la lista blanca.
 */
export function parseVideoUrl(
  raw: string,
  extras: Partial<Pick<EditorialVideoAttrs, "caption" | "width" | "alignment">> = {},
): ParseVideoResult {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return fail("empty");
  if (looksLikeHtmlOrScript(trimmed)) return fail("html");

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return fail("invalid_url");
  }

  if (parsed.protocol !== "https:") return fail("protocol");
  if (parsed.username || parsed.password) return fail("credentials");

  const host = normalizeHost(parsed.hostname);
  if (!host || host.includes(":") || /^\d/.test(host)) return fail("provider");

  let result: ParseVideoResult;
  if (YOUTUBE_HOSTS.has(host)) result = parseYoutube(parsed);
  else if (VIMEO_HOSTS.has(host)) result = parseVimeo(parsed);
  else if (INSTAGRAM_HOSTS.has(host)) result = parseInstagram(parsed);
  else result = fail("provider");

  if (!result.ok) return result;

  return {
    ok: true,
    value: {
      ...result.value,
      caption: sanitizeVideoCaption(extras.caption ?? ""),
      width: isVideoWidth(extras.width) ? extras.width : result.value.width,
      alignment: isVideoAlignment(extras.alignment)
        ? extras.alignment
        : result.value.alignment,
    },
  };
}

export function isVideoProvider(value: unknown): value is VideoProvider {
  return VIDEO_PROVIDERS.includes(value as VideoProvider);
}

export function isVideoWidth(value: unknown): value is VideoWidth {
  return VIDEO_WIDTHS.includes(value as VideoWidth);
}

export function isVideoAlignment(value: unknown): value is VideoAlignment {
  return VIDEO_ALIGNMENTS.includes(value as VideoAlignment);
}

export function isVideoVariant(value: unknown): value is VideoVariant {
  return VIDEO_VARIANTS.includes(value as VideoVariant);
}

export function sanitizeVideoCaption(value: unknown): string {
  return String(value ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()
    .slice(0, CAPTION_MAX);
}

export function defaultEditorialVideoAttrs(): EditorialVideoAttrs {
  return {
    provider: "youtube",
    url: "",
    videoId: "",
    caption: "",
    width: "full",
    alignment: "center",
    variant: "standard",
  };
}

/**
 * Revalida atributos persistidos. Si la URL es inválida, intenta reconstruir
 * desde provider + videoId estrictamente validados.
 */
export function resolveEditorialVideo(
  attrs: Partial<EditorialVideoAttrs> | Record<string, unknown>,
): ParseVideoResult {
  const caption = sanitizeVideoCaption(attrs.caption);
  const width = isVideoWidth(attrs.width) ? attrs.width : "full";
  const alignment = isVideoAlignment(attrs.alignment) ? attrs.alignment : "center";
  const fromUrl = parseVideoUrl(String(attrs.url ?? ""), { caption, width, alignment });
  if (fromUrl.ok) {
    const storedVariant = isVideoVariant(attrs.variant) ? attrs.variant : fromUrl.value.variant;
    return {
      ok: true,
      value: {
        ...fromUrl.value,
        caption,
        width,
        alignment,
        variant: storedVariant === "reel" || storedVariant === "short" ? storedVariant : fromUrl.value.variant,
      },
    };
  }

  const provider = attrs.provider;
  const videoId = String(attrs.videoId ?? "").trim();
  if (!isVideoProvider(provider) || !videoId) return fromUrl;

  let reconstructed = "";
  if (provider === "youtube" && YOUTUBE_ID_RE.test(videoId)) {
    reconstructed = `https://www.youtube.com/watch?v=${videoId}`;
  } else if (provider === "vimeo") {
    const [id, hash] = videoId.split(":");
    if (id && VIMEO_ID_RE.test(id) && (!hash || VIMEO_HASH_RE.test(hash))) {
      reconstructed = hash ? `https://vimeo.com/${id}/${hash}` : `https://vimeo.com/${id}`;
    }
  } else if (provider === "instagram" && INSTAGRAM_CODE_RE.test(videoId)) {
    const pathKind = attrs.variant === "reel" ? "reel" : "p";
    reconstructed = `https://www.instagram.com/${pathKind}/${videoId}/`;
  }

  if (!reconstructed) return fromUrl;
  return parseVideoUrl(reconstructed, { caption, width, alignment });
}

export function youtubeEmbedSrc(videoId: string): string | null {
  if (!YOUTUBE_ID_RE.test(videoId)) return null;
  return `https://www.youtube.com/embed/${videoId}`;
}

export function vimeoEmbedSrc(videoId: string): string | null {
  const [id, hash] = videoId.split(":");
  if (!id || !VIMEO_ID_RE.test(id)) return null;
  const src = new URL(`https://player.vimeo.com/video/${id}`);
  if (hash && VIMEO_HASH_RE.test(hash)) src.searchParams.set("h", hash);
  return src.toString();
}

export function instagramPermalink(attrs: Pick<EditorialVideoAttrs, "videoId" | "variant" | "url">): string | null {
  const resolved = resolveEditorialVideo(attrs);
  if (!resolved.ok || resolved.value.provider !== "instagram") return null;
  return resolved.value.url;
}

/** iframe src interno. Nunca usa la URL cruda del redactor. */
export function buildSafeIframeSrc(attrs: EditorialVideoAttrs): string | null {
  if (attrs.provider === "youtube") return youtubeEmbedSrc(attrs.videoId);
  if (attrs.provider === "vimeo") return vimeoEmbedSrc(attrs.videoId);
  return null;
}

export function videoEmbedLayoutClass(attrs: Pick<EditorialVideoAttrs, "width" | "alignment" | "variant" | "provider">): string {
  const width = attrs.width === "content" ? "is-video-width-content" : "is-video-width-full";
  const align =
    attrs.width === "content"
      ? attrs.alignment === "left"
        ? "is-video-align-left"
        : attrs.alignment === "right"
          ? "is-video-align-right"
          : "is-video-align-center"
      : "is-video-align-center";
  const vertical =
    attrs.provider === "instagram" && attrs.variant === "reel" ? "is-video-vertical" : "is-video-landscape";
  return `is-video-embed is-video-${attrs.provider} ${width} ${align} ${vertical}`;
}

export function serializeEditorialVideoHtml(attrs: EditorialVideoAttrs): string {
  const resolved = resolveEditorialVideo(attrs);
  if (!resolved.ok) return "";
  const value = resolved.value;
  const figAttrs = [
    `data-editorial-video="true"`,
    `data-provider="${escapeAttr(value.provider)}"`,
    `data-video-id="${escapeAttr(value.videoId)}"`,
    `data-url="${escapeAttr(value.url)}"`,
    `data-width="${escapeAttr(value.width)}"`,
    `data-alignment="${escapeAttr(value.alignment)}"`,
    `data-variant="${escapeAttr(value.variant)}"`,
    `class="is-editorial-video ${videoEmbedLayoutClass(value)}"`,
  ];
  if (value.caption) figAttrs.push(`data-caption="${escapeAttr(value.caption)}"`);

  const fallback = `<a href="${escapeAttr(value.url)}" rel="noopener noreferrer" target="_blank" data-video-fallback="true">${escapeText(fallbackLabel(value.provider))}</a>`;

  if (!value.caption) {
    return `<figure ${figAttrs.join(" ")}>${fallback}</figure>`;
  }

  return `<figure ${figAttrs.join(" ")}>${fallback}<figcaption class="is-figcaption"><span data-caption="true" class="is-caption">${escapeText(value.caption)}</span></figcaption></figure>`;
}

function fallbackLabel(provider: VideoProvider): string {
  if (provider === "youtube") return "Ver en YouTube";
  if (provider === "vimeo") return "Ver en Vimeo";
  return "Ver en Instagram";
}

export function parseEditorialVideoFromFigureHtml(html: string): EditorialVideoAttrs | null {
  const block = html.trim();
  if (!/data-editorial-video/i.test(block)) return null;
  const resolved = resolveEditorialVideo({
    provider: attr(block, "data-provider"),
    videoId: attr(block, "data-video-id"),
    url: attr(block, "data-url"),
    caption: attr(block, "data-caption") || innerCaption(block),
    width: attr(block, "data-width"),
    alignment: attr(block, "data-alignment"),
    variant: attr(block, "data-variant"),
  });
  return resolved.ok ? resolved.value : null;
}

export function extractEditorialVideos(content: string): EditorialVideoAttrs[] {
  const figureRe = /<figure\b[^>]*data-editorial-video[^>]*>[\s\S]*?<\/figure>|<figure\b[^>]*data-editorial-video[^>]*\/>/gi;
  const out: EditorialVideoAttrs[] = [];
  let match: RegExpExecArray | null;
  while ((match = figureRe.exec(content)) !== null) {
    const parsed = parseEditorialVideoFromFigureHtml(match[0]);
    if (parsed) out.push(parsed);
  }
  return out;
}

function attr(html: string, name: string): string {
  const re = new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, "i");
  return re.exec(html)?.[1]?.trim() || "";
}

function innerCaption(block: string): string {
  const re = /<span[^>]*data-caption[^>]*>([\s\S]*?)<\/span>/i;
  return sanitizeVideoCaption(re.exec(block)?.[1] ?? "");
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
