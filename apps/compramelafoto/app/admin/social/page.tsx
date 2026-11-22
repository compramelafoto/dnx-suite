import { getClfInstagramStatus, listPreviewCandidates, listStoryQueue } from "@/lib/social/album-stories";
import StoriesQueuePanel from "@/components/admin/social/StoriesQueuePanel";
import StoryPreviewSection from "@/components/admin/social/StoryPreviewSection";

export const dynamic = "force-dynamic";

export default async function AdminSocialPage({
  searchParams,
}: {
  searchParams: Promise<{ instagram?: string }>;
}) {
  const [status, queue, candidates, params] = await Promise.all([
    getClfInstagramStatus(),
    listStoryQueue(),
    listPreviewCandidates(),
    searchParams,
  ]);
  return (
    <StoriesQueuePanel
      status={status}
      queue={queue}
      connectResult={params.instagram ?? null}
      preview={<StoryPreviewSection candidates={candidates} />}
    />
  );
}
