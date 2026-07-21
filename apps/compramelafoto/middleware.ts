import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  BLOG_VISITOR_COOKIE_MAX_AGE,
  BLOG_VISITOR_COOKIE_NAME,
  BLOG_VISITOR_HEADER,
  isBlogArticlePath,
  resolveBlogVisitorKey,
} from "@/lib/blog/blog-visitor";

const REFERRAL_COOKIE_NAME = "clf_ref";
/** JSON: { "sourceType": "TRAINING", "sourceEntityId": number } — capacitación desde la que vino el click */
const REFERRAL_META_COOKIE_NAME = "clf_ref_meta";
/** Atribución Info Spot (redactor de la nota) para comisión futura en compras. */
const INFOSPOT_ATTR_COOKIE_NAME = "clf_infospot_attr";
const REFERRAL_COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 días en segundos

function buildCookieHeader(
  name: string,
  value: string,
  maxAgeSeconds: number
): string {
  const isProd = process.env.NODE_ENV === "production";
  return (
    encodeURIComponent(name) +
    "=" +
    encodeURIComponent(value) +
    "; Path=/; Max-Age=" +
    maxAgeSeconds +
    "; SameSite=Lax" +
    (isProd ? "; Secure" : "")
  );
}

function applyBlogVisitorCookie(response: NextResponse, visitorKey: string): void {
  response.cookies.set(BLOG_VISITOR_COOKIE_NAME, visitorKey, {
    path: "/",
    maxAge: BLOG_VISITOR_COOKIE_MAX_AGE,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
  });
}

function prepareBlogVisitor(request: NextRequest): {
  requestHeaders: Headers;
  visitorKey: string | null;
  isNewVisitor: boolean;
} {
  if (!isBlogArticlePath(request.nextUrl.pathname)) {
    return { requestHeaders: request.headers, visitorKey: null, isNewVisitor: false };
  }

  const { visitorKey, isNew } = resolveBlogVisitorKey(
    request.cookies.get(BLOG_VISITOR_COOKIE_NAME)?.value
  );
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(BLOG_VISITOR_HEADER, visitorKey);
  return { requestHeaders, visitorKey, isNewVisitor: isNew };
}

export function middleware(request: NextRequest) {
  const blogVisitor = prepareBlogVisitor(request);

  if (request.nextUrl.pathname === "/") {
    const userParam = request.nextUrl.searchParams.get("user");
    if (userParam) {
      try {
        const userData = JSON.parse(userParam);
        if (userData?.role === "ORGANIZER") {
          const res = NextResponse.next({
            request: { headers: blogVisitor.requestHeaders },
          });
          if (blogVisitor.isNewVisitor && blogVisitor.visitorKey) {
            applyBlogVisitorCookie(res, blogVisitor.visitorKey);
          }
          return res;
        }
      } catch {}
    }
    const homeRes = NextResponse.next({
      request: { headers: blogVisitor.requestHeaders },
    });
    if (blogVisitor.isNewVisitor && blogVisitor.visitorKey) {
      applyBlogVisitorCookie(homeRes, blogVisitor.visitorKey);
    }
    return homeRes;
  }

  const ref = request.nextUrl.searchParams.get("ref");
  const refTrimmed = typeof ref === "string" ? ref.trim() : "";
  const sourceParam = request.nextUrl.searchParams.get("source");
  const trainingIdParam = request.nextUrl.searchParams.get("trainingId");
  const trainingIdNum =
    typeof trainingIdParam === "string" && /^\d+$/.test(trainingIdParam.trim())
      ? parseInt(trainingIdParam.trim(), 10)
      : null;
  const hasTrainingMeta =
    sourceParam === "training" && trainingIdNum !== null && trainingIdNum > 0;

  // Info Spot → atribución al redactor (is_author) + artículo (is_article)
  const isArticleParam = request.nextUrl.searchParams.get("is_article");
  const isAuthorParam = request.nextUrl.searchParams.get("is_author");
  const isEventParam = request.nextUrl.searchParams.get("is_event");
  const authorIdNum =
    typeof isAuthorParam === "string" && /^\d+$/.test(isAuthorParam.trim())
      ? parseInt(isAuthorParam.trim(), 10)
      : null;
  const hasInfospotAttr =
    sourceParam === "infospot" &&
    authorIdNum !== null &&
    authorIdNum > 0;

  const response = NextResponse.next({
    request: { headers: blogVisitor.requestHeaders },
  });

  if (blogVisitor.isNewVisitor && blogVisitor.visitorKey) {
    applyBlogVisitorCookie(response, blogVisitor.visitorKey);
  }

  if (refTrimmed) {
    response.headers.append(
      "Set-Cookie",
      buildCookieHeader(REFERRAL_COOKIE_NAME, refTrimmed, REFERRAL_COOKIE_MAX_AGE)
    );
  }

  if (hasTrainingMeta) {
    const metaPayload = JSON.stringify({
      sourceType: "TRAINING",
      sourceEntityId: trainingIdNum,
    });
    response.headers.append(
      "Set-Cookie",
      buildCookieHeader(REFERRAL_META_COOKIE_NAME, metaPayload, REFERRAL_COOKIE_MAX_AGE)
    );
  } else if (refTrimmed) {
    response.headers.append(
      "Set-Cookie",
      buildCookieHeader(REFERRAL_META_COOKIE_NAME, "", 0)
    );
  }

  if (hasInfospotAttr) {
    const attrPayload = JSON.stringify({
      source: "infospot",
      authorId: authorIdNum,
      articleId:
        typeof isArticleParam === "string" && isArticleParam.trim()
          ? isArticleParam.trim()
          : null,
      eventId:
        typeof isEventParam === "string" && isEventParam.trim()
          ? isEventParam.trim()
          : null,
    });
    response.headers.append(
      "Set-Cookie",
      buildCookieHeader(INFOSPOT_ATTR_COOKIE_NAME, attrPayload, REFERRAL_COOKIE_MAX_AGE)
    );
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:ico|png|jpg|jpeg|gif|webp|svg|woff2?|css|js)$).*)",
  ],
};
