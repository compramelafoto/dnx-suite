import { notFound } from "next/navigation";
import DownloadCenterClient from "./DownloadCenterClient";
import { loadDownloadCenterByToken } from "@/lib/digital-download/load-download-center";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function DownloadCenterPage({ params }: PageProps) {
  const { token } = await Promise.resolve(params);
  const accessToken = token?.trim();

  if (!accessToken) {
    notFound();
  }

  const baseUrl =
    process.env.APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);

  const data = await loadDownloadCenterByToken(accessToken, baseUrl);

  if (!data) {
    notFound();
  }

  return <DownloadCenterClient data={data} />;
}
