import type { Metadata } from "next";
import { getBlogDefaultCoverImageUrl } from "@/lib/blog/blog-default-cover";

const OG_IMAGE_WIDTH = 1200;
const OG_IMAGE_HEIGHT = 630;
const defaultBlogImage = getBlogDefaultCoverImageUrl();

/** Evita que el openGraph del layout raíz (watermark.png) se use en rutas del blog. */
export const metadata: Metadata = {
  openGraph: {
    type: "website",
    images: [
      {
        url: defaultBlogImage,
        width: OG_IMAGE_WIDTH,
        height: OG_IMAGE_HEIGHT,
        alt: "Blog de ComprameLaFoto",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: [defaultBlogImage],
  },
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return children;
}
