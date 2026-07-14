import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Source_Serif_4 } from "next/font/google";
import { AppChrome } from "@/components/navigation/AppChrome";
import { resolveSiteHeaderChrome } from "@/components/navigation/resolve-site-header-auth";
import { getInfoSpotSettings, getSiteUrl } from "@/lib/settings";
import "./globals.css";

const infoSans = Plus_Jakarta_Sans({
  variable: "--font-info-sans",
  subsets: ["latin"],
  display: "swap",
});

const infoSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  display: "swap",
});

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getInfoSpotSettings();
  const description =
    settings.seoDescription ||
    "Descubrí lo que está pasando cerca tuyo. Medio digital argentino de cobertura deportiva, cultural y social.";
  const title = settings.seoTitle || settings.siteName;
  const ogImage = settings.defaultShareImageUrl || "/brand/og-default.png";
  const logoUrl = settings.logoUrl || "/brand/infospot-logo-horizontal.png";

  return {
    title: {
      default: title,
      template: `%s | ${settings.siteName}`,
    },
    description,
    applicationName: settings.siteName,
    metadataBase: new URL(getSiteUrl(settings)),
    icons: {
      icon: [{ url: "/brand/infospot-favicon.png", type: "image/png" }],
      apple: [{ url: "/apple-icon.png", type: "image/png" }],
    },
    openGraph: {
      type: "website",
      locale: "es_AR",
      siteName: settings.siteName,
      title,
      description,
      images: [{ url: ogImage, alt: settings.siteName }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
    other: {
      "brand:logo": logoUrl,
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [settings, headerChrome] = await Promise.all([
    getInfoSpotSettings(),
    resolveSiteHeaderChrome(),
  ]);
  const siteUrl = getSiteUrl(settings);

  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsMediaOrganization",
    name: settings.siteName,
    description: settings.seoDescription || settings.slogan,
    url: siteUrl,
    logo: settings.logoUrl || `${siteUrl}/brand/infospot-logo-horizontal.png`,
    ...(settings.contactEmail
      ? { email: settings.contactEmail }
      : {}),
    ...(settings.instagramUrl || settings.facebookUrl || settings.xUrl
      ? {
          sameAs: [settings.instagramUrl, settings.facebookUrl, settings.xUrl].filter(
            Boolean,
          ),
        }
      : {}),
    ...(settings.baseCity || settings.country
      ? {
          address: {
            "@type": "PostalAddress",
            ...(settings.baseCity ? { addressLocality: settings.baseCity } : {}),
            ...(settings.country ? { addressCountry: settings.country } : {}),
          },
        }
      : {}),
  };

  return (
    <html lang="es-AR" className={`${infoSans.variable} ${infoSerif.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
        />
        <AppChrome
          auth={headerChrome.auth}
          primaryCta={headerChrome.primaryCta}
          secondaryLinks={headerChrome.secondaryLinks}
        >
          <main id="contenido" className="flex-1">
            {children}
          </main>
        </AppChrome>
      </body>
    </html>
  );
}
