import { getClfInstagramStatus, listStoryQueue } from "@/lib/social/album-stories";
import StoriesQueuePanel from "@/components/admin/social/StoriesQueuePanel";

export const dynamic = "force-dynamic";

export default async function AdminSocialPage({
  searchParams,
}: {
  searchParams: Promise<{ instagram?: string }>;
}) {
  const [status, queue, params] = await Promise.all([getClfInstagramStatus(), listStoryQueue(), searchParams]);
  return <StoriesQueuePanel status={status} queue={queue} connectResult={params.instagram ?? null} />;
}
